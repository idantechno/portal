import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { customAlphabet } from 'nanoid';
import { Business } from '../businesses/business.entity';
import { BusinessMember } from '../businesses/business-member.entity';
import { BusinessesService } from '../businesses/businesses.service';
import { AgentsService } from '../agents/agents.service';
import { AGENT_CATALOG } from '../agents/agent-catalog';
import { UsersService } from '../users/users.service';
import { UserRole } from '../common/enums/user-role.enum';
import { AccountStatus } from '../common/enums/account-status.enum';
import { CreateClientDto } from './dto/create-client.dto';

// Readable temp password (no ambiguous chars) the admin hands to the client.
const generatePassword = customAlphabet(
  'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789',
  12,
);

function publicUser(u: {
  id: string;
  email: string;
  name: string;
  status: AccountStatus;
}) {
  return { id: u.id, email: u.email, name: u.name, status: u.status };
}

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(Business)
    private readonly businesses: Repository<Business>,
    @InjectRepository(BusinessMember)
    private readonly members: Repository<BusinessMember>,
    private readonly users: UsersService,
    private readonly businessesService: BusinessesService,
    private readonly agents: AgentsService,
  ) {}

  /**
   * Provision a client in one step: owner account (with a generated temp
   * password) + business + agent grants. The admin's selection is authoritative
   * — every catalog agent is set explicitly (granted or revoked).
   */
  async createClient(actorUserId: string, dto: CreateClientDto) {
    const email = dto.ownerEmail.toLowerCase();
    // Reuse an existing account as the owner; only mint a temp password for a
    // brand-new owner. (Lets the operator onboard their own / a returning user.)
    let owner = await this.users.findByEmail(email);
    const createdOwner = !owner;
    let temporaryPassword: string | null = null;
    if (!owner) {
      temporaryPassword = generatePassword();
      const passwordHash = await bcrypt.hash(temporaryPassword, 12);
      owner = await this.users.create({
        email,
        passwordHash,
        name: dto.ownerName,
        role: UserRole.Member,
      });
    }
    try {
      const business = await this.businessesService.create(owner.id, {
        name: dto.businessName,
        slug: dto.slug,
      });
      for (const agent of AGENT_CATALOG) {
        await this.agents.setAccess(
          business.id,
          agent.key,
          dto.agentKeys.includes(agent.key),
          actorUserId,
        );
      }
      return {
        business,
        owner: { id: owner.id, email: owner.email, name: owner.name },
        temporaryPassword,
        ownerExisted: !createdOwner,
      };
    } catch (err) {
      // Compensate: if we minted the owner just now and business creation
      // failed, remove it so a partial failure doesn't orphan an account.
      if (createdOwner) await this.users.delete(owner.id);
      throw err;
    }
  }

  /** Generate a new temp password for a user (admin-driven reset). */
  async resetUserPassword(userId: string): Promise<{ temporaryPassword: string }> {
    const user = await this.users.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    const temporaryPassword = generatePassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, 12);
    await this.users.updatePassword(userId, passwordHash);
    return { temporaryPassword };
  }

  /** The agent catalog — used to populate the onboarding form. */
  agentCatalog() {
    return this.agents.catalog();
  }

  async overview() {
    const [totalBusinesses, suspendedBusinesses, totalUsers, suspendedUsers] =
      await Promise.all([
        this.businesses.count(),
        this.businesses.count({
          where: { status: AccountStatus.Suspended },
        }),
        this.users.count(),
        this.users.countByStatus(AccountStatus.Suspended),
      ]);
    return {
      totalBusinesses,
      suspendedBusinesses,
      totalUsers,
      suspendedUsers,
    };
  }

  /** Counts of members grouped by business id. */
  private async memberCountsByBusiness(): Promise<Map<string, number>> {
    const rows = await this.members
      .createQueryBuilder('m')
      .select('m.business_id', 'businessId')
      .addSelect('COUNT(*)', 'count')
      .groupBy('m.business_id')
      .getRawMany<{ businessId: string; count: string }>();
    return new Map(rows.map((r) => [r.businessId, Number(r.count)]));
  }

  async listBusinesses(q?: string) {
    const all = await this.businesses.find({ order: { createdAt: 'DESC' } });
    const needle = q?.trim().toLowerCase();
    const filtered = needle
      ? all.filter(
          (b) =>
            b.name.toLowerCase().includes(needle) || b.slug.includes(needle),
        )
      : all;

    const [counts, owners] = await Promise.all([
      this.memberCountsByBusiness(),
      this.users.findByIds([...new Set(filtered.map((b) => b.ownerUserId))]),
    ]);
    const ownerMap = new Map(owners.map((u) => [u.id, u]));

    return filtered.map((b) => ({
      id: b.id,
      name: b.name,
      slug: b.slug,
      status: b.status,
      createdAt: b.createdAt,
      memberCount: counts.get(b.id) ?? 0,
      owner: ownerMap.has(b.ownerUserId)
        ? publicUser(ownerMap.get(b.ownerUserId)!)
        : null,
    }));
  }

  async businessDetail(businessId: string) {
    const business = await this.businesses.findOne({
      where: { id: businessId },
    });
    if (!business) throw new NotFoundException('Business not found');
    const members = await this.members.find({
      where: { businessId },
      order: { createdAt: 'ASC' },
    });
    const users = await this.users.findByIds(members.map((m) => m.userId));
    const byId = new Map(users.map((u) => [u.id, u]));
    return {
      business,
      members: members.map((m) => ({
        id: m.id,
        userId: m.userId,
        role: m.role,
        createdAt: m.createdAt,
        user: byId.has(m.userId) ? publicUser(byId.get(m.userId)!) : null,
      })),
    };
  }

  async setBusinessStatus(businessId: string, status: AccountStatus) {
    const business = await this.businesses.findOne({
      where: { id: businessId },
    });
    if (!business) throw new NotFoundException('Business not found');
    business.status = status;
    return this.businesses.save(business);
  }

  async listUsers(q?: string) {
    const users = await this.users.search(q);
    const rows = await this.members
      .createQueryBuilder('m')
      .select('m.user_id', 'userId')
      .addSelect('COUNT(*)', 'count')
      .groupBy('m.user_id')
      .getRawMany<{ userId: string; count: string }>();
    const counts = new Map(rows.map((r) => [r.userId, Number(r.count)]));
    return users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      status: u.status,
      createdAt: u.createdAt,
      businessCount: counts.get(u.id) ?? 0,
    }));
  }
}
