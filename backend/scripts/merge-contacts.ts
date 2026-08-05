/**
 * Phase 2 of the Contact/Lead/Customer unification: a one-time, idempotent
 * merge that backfills the canonical `customers` "person" table from the two
 * legacy sources — `leads` and `customer_contacts` — WITHOUT touching or
 * dropping either source (fully additive, reversible, transition-safe).
 *
 * It reuses the EXACT production dedupe/enrich logic by instantiating
 * `CustomersService.upsertPerson` against the standalone DataSource
 * (`src/data-source.ts`), so its behaviour can never drift from the live write
 * paths. `upsertPerson` only touches the customers + customer_contacts repos,
 * so the service is constructed with those two and a stubbed LeadsService.
 *
 * What it does:
 *   • every `leads` row              → upsertPerson(stage='lead', leadId set,
 *                                       interest/sourceDetail/answers copied,
 *                                       capturedData._legacyLeadId stamped).
 *                                       Never demotes — a lead whose person is
 *                                       already a customer stays a customer.
 *   • every `customer_contacts` row with customer_id IS NULL **and a phone or
 *     email** → upsertPerson(stage = contact.status) + sets customer_id.
 *     Anonymous contacts (no phone/email) are SKIPPED on purpose — that keeps
 *     junk anonymous web-widget sessions out of the people list.
 *
 * Idempotent: re-running never double-creates — the phone/email (and
 * leadId/contactId) dedupe inside upsertPerson guarantees it.
 *
 * DRY_RUN=1  → runs everything inside a transaction that is ROLLED BACK at the
 *              end, printing a reconciliation report (nothing is persisted).
 * (unset)    → commits.
 *
 * Reads standard DB_* env vars (via src/data-source.ts) so the operator can
 * later run it against prod with `railway run` — it never targets prod itself.
 *
 * Usage:
 *   DRY_RUN=1 npx ts-node -T scripts/merge-contacts.ts   # report only, no writes
 *   npx ts-node -T scripts/merge-contacts.ts             # commit the merge
 */
import 'reflect-metadata';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { EntityManager } from 'typeorm';
import { AppDataSource } from '../src/data-source';
import { Customer } from '../src/customers/customer.entity';
import { CustomersService } from '../src/customers/customers.service';
import { CustomerContact } from '../src/conversations/customer-contact.entity';
import { Lead } from '../src/leads/lead.entity';
import { LeadsService } from '../src/leads/leads.service';
import { ContactStatus } from '../src/common/enums/contact-status.enum';

// Load .env from the repo root (same shallow parse as brief-smoke.ts).
const envPath = path.resolve(__dirname, '../../.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
}

const DRY_RUN = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true';

/** Thrown to force a transaction rollback in DRY_RUN without surfacing as an error. */
class RollbackSignal extends Error {}

/** Normalized-phone key mirror of customers.service.normalizePhoneKey. */
function phoneKey(phone?: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 7) return null;
  return digits.slice(-9);
}

interface Report {
  totalLeads: number;
  totalContacts: number;
  personsBefore: number;
  personsAfter: number;
  created: number;
  enriched: number;
  leadsSkipped: Array<{ id: string; reason: string }>;
  contactsSkippedAnonymous: number;
  contactsAlreadyLinked: number;
  contactsProcessed: number;
  /** key → set of distinct names that collapse onto it (only >1 kept). */
  collisions: Array<{ key: string; names: string[] }>;
}

async function run(manager: EntityManager, report: Report): Promise<void> {
  const customers = new CustomersService(
    manager.getRepository(Customer),
    manager.getRepository(CustomerContact),
    // upsertPerson never touches LeadsService — safe to stub.
    null as unknown as LeadsService,
  );

  const leadsRepo = manager.getRepository(Lead);
  const contactsRepo = manager.getRepository(CustomerContact);
  const customersRepo = manager.getRepository(Customer);

  // Snapshot which person rows already existed, so we can classify each
  // upsert result as "created" vs "enriched" (dedupe within the run counts as
  // enriched, not a second create).
  const beforeRows = await customersRepo.find({ select: { id: true } });
  const beforeIds = new Set(beforeRows.map((r) => r.id));
  const createdIds = new Set<string>();
  report.personsBefore = beforeIds.size;

  // Collision tracking: which distinct names map onto a single phone/email key.
  const keyToNames = new Map<string, Set<string>>();
  const noteKey = (key: string | null, name: string | null): void => {
    if (!key) return;
    const nm = (name ?? '').trim();
    if (!nm) return;
    const set = keyToNames.get(key) ?? new Set<string>();
    set.add(nm);
    keyToNames.set(key, set);
  };

  const classify = (person: Customer | null): void => {
    if (!person) return;
    if (beforeIds.has(person.id) || createdIds.has(person.id)) {
      report.enriched += 1;
    } else {
      createdIds.add(person.id);
      report.created += 1;
    }
  };

  // --- Leads → persons -------------------------------------------------------
  const leads = await leadsRepo.find();
  report.totalLeads = leads.length;
  for (const lead of leads) {
    noteKey(phoneKey(lead.phone), lead.name);
    noteKey(lead.email?.trim().toLowerCase() || null, lead.name);
    try {
      const person = await customers.upsertPerson(lead.businessId, {
        name: lead.name,
        phone: lead.phone,
        email: lead.email,
        // Never demote: an existing customer stays a customer (upsertPerson
        // only promotes lead→customer, so passing 'lead' here is safe).
        stage: ContactStatus.Lead,
        source: lead.source === 'questionnaire' ? 'questionnaire' : 'agent',
        sourceDetail: lead.sourceDetail,
        interest: lead.interest,
        notes: lead.notes,
        leadId: lead.id,
        customerContactId: lead.customerContactId,
        capturedData: {
          _legacyLeadId: lead.id,
          source: lead.source,
          sourceDetail: lead.sourceDetail ?? null,
          interest: lead.interest ?? null,
          answers: lead.answers ?? null,
        },
        forceCreate: true,
      });
      if (!person) {
        report.leadsSkipped.push({
          id: lead.id,
          reason: 'upsert returned null (unexpected with forceCreate)',
        });
        continue;
      }
      classify(person);
    } catch (err) {
      report.leadsSkipped.push({
        id: lead.id,
        reason: `error: ${(err as Error).message}`,
      });
    }
  }

  // --- Contacts → persons ----------------------------------------------------
  const contacts = await contactsRepo.find();
  report.totalContacts = contacts.length;
  for (const contact of contacts) {
    if (contact.customerId) {
      report.contactsAlreadyLinked += 1;
      continue;
    }
    const phone = contact.phone?.trim() || null;
    const email = contact.email?.trim() || null;
    if (!phone && !email) {
      // Anonymous session (typically a web-widget contact) — intentionally
      // kept out of the people list.
      report.contactsSkippedAnonymous += 1;
      continue;
    }
    const displayName = contact.displayName?.trim() || phone || email;
    noteKey(phoneKey(phone), displayName);
    noteKey(email?.toLowerCase() || null, displayName);
    try {
      const person = await customers.upsertPerson(contact.businessId, {
        name: displayName,
        phone,
        email,
        stage: contact.status,
        source: 'contact',
        notes: contact.notes,
        customerContactId: contact.id,
        capturedData: {
          _legacyContactId: contact.id,
          channel: contact.channel,
          externalId: contact.externalId,
        },
      });
      report.contactsProcessed += 1;
      classify(person);
    } catch (err) {
      report.leadsSkipped.push({
        id: `contact:${contact.id}`,
        reason: `error: ${(err as Error).message}`,
      });
    }
  }

  report.personsAfter = await customersRepo.count();

  for (const [key, names] of keyToNames) {
    if (names.size > 1) {
      report.collisions.push({ key, names: [...names] });
    }
  }
}

function printReport(report: Report): void {
  const line = '─'.repeat(56);
  console.log('');
  console.log(line);
  console.log(
    `  merge-contacts reconciliation  (${DRY_RUN ? 'DRY RUN — rolled back' : 'COMMITTED'})`,
  );
  console.log(line);
  console.log(`  leads (total)              : ${report.totalLeads}`);
  console.log(`  contacts (total)           : ${report.totalContacts}`);
  console.log(`    already linked           : ${report.contactsAlreadyLinked}`);
  console.log(`    skipped (anonymous)      : ${report.contactsSkippedAnonymous}`);
  console.log(`    processed                : ${report.contactsProcessed}`);
  console.log(`  persons before             : ${report.personsBefore}`);
  console.log(`  persons after              : ${report.personsAfter}`);
  console.log(`  persons created            : ${report.created}`);
  console.log(`  persons enriched           : ${report.enriched}`);
  console.log(`  leads/contacts errored     : ${report.leadsSkipped.length}`);
  if (report.leadsSkipped.length) {
    for (const s of report.leadsSkipped) {
      console.log(`      • ${s.id}: ${s.reason}`);
    }
  }
  console.log(`  phone/email collisions     : ${report.collisions.length}`);
  if (report.collisions.length) {
    console.log(
      '    (one key → several distinct names; review before committing)',
    );
    for (const c of report.collisions) {
      console.log(`      • ${c.key} → ${c.names.join(' | ')}`);
    }
  }
  console.log(line);
  if (DRY_RUN) {
    console.log('  DRY RUN: transaction rolled back — nothing was written.');
    console.log('  Re-run without DRY_RUN=1 to commit.');
  } else {
    console.log('  Merge committed.');
  }
  console.log(line);
  console.log('');
}

async function main(): Promise<void> {
  await AppDataSource.initialize();
  const report: Report = {
    totalLeads: 0,
    totalContacts: 0,
    personsBefore: 0,
    personsAfter: 0,
    created: 0,
    enriched: 0,
    leadsSkipped: [],
    contactsSkippedAnonymous: 0,
    contactsAlreadyLinked: 0,
    contactsProcessed: 0,
    collisions: [],
  };

  try {
    if (DRY_RUN) {
      try {
        await AppDataSource.transaction(async (manager) => {
          await run(manager, report);
          // Force rollback — DRY_RUN never persists.
          throw new RollbackSignal();
        });
      } catch (err) {
        if (!(err instanceof RollbackSignal)) throw err;
      }
    } else {
      await AppDataSource.transaction(async (manager) => {
        await run(manager, report);
      });
    }
    printReport(report);
  } finally {
    await AppDataSource.destroy();
  }
}

void main().catch((err) => {
  console.error('merge-contacts failed:', err);
  process.exitCode = 1;
});
