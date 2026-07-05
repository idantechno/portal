import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FilesystemService } from '../context-files/filesystem.service';
import { Expense, ExpenseKind } from './expense.entity';
import { ExpenseExtractorService } from './expense-extractor.service';

export interface CreateExpenseInput {
  businessId: string;
  kind?: ExpenseKind;
  title?: string;
  amountCents?: number | null;
  expenseDate?: string | null;
  createdByUserId?: string | null;
  file?: { buffer: Buffer; mimeType: string; fileName: string; size: number };
}

export interface ExpenseSummary {
  fixedMonthlyCents: number;
  occasionalThisMonthCents: number;
  monthlyTotalCents: number;
  fixedCount: number;
  occasionalCount: number;
  count: number;
}

@Injectable()
export class ExpensesService {
  constructor(
    @InjectRepository(Expense)
    private readonly expenses: Repository<Expense>,
    private readonly filesystem: FilesystemService,
    private readonly extractor: ExpenseExtractorService,
  ) {}

  list(businessId: string): Promise<Expense[]> {
    return this.expenses.find({
      where: { businessId },
      order: { expenseDate: 'DESC', createdAt: 'DESC' },
    });
  }

  async summary(businessId: string): Promise<ExpenseSummary> {
    const rows = await this.expenses.find({ where: { businessId } });
    const now = new Date();
    const y = now.getFullYear();
    const mo = now.getMonth();
    let fixedMonthlyCents = 0;
    let occasionalThisMonthCents = 0;
    let fixedCount = 0;
    let occasionalCount = 0;
    for (const r of rows) {
      const amt = r.amountCents ?? 0;
      if (r.kind === 'fixed') {
        fixedMonthlyCents += amt;
        fixedCount += 1;
      } else {
        occasionalCount += 1;
        const d = r.expenseDate
          ? new Date(r.expenseDate)
          : new Date(r.createdAt);
        if (d.getFullYear() === y && d.getMonth() === mo) {
          occasionalThisMonthCents += amt;
        }
      }
    }
    return {
      fixedMonthlyCents,
      occasionalThisMonthCents,
      monthlyTotalCents: fixedMonthlyCents + occasionalThisMonthCents,
      fixedCount,
      occasionalCount,
      count: rows.length,
    };
  }

  async create(input: CreateExpenseInput): Promise<Expense> {
    if (!input.file && input.amountCents == null) {
      throw new BadRequestException('Provide a file or an amount');
    }
    const row = this.expenses.create({
      businessId: input.businessId,
      title: input.title?.trim() || this.titleFromFile(input.file?.fileName),
      kind: input.kind ?? 'occasional',
      amountCents: input.amountCents ?? null,
      currency: 'ILS',
      expenseDate: input.expenseDate ?? null,
      status: input.amountCents != null ? 'manual' : 'pending',
      createdByUserId: input.createdByUserId ?? null,
    });
    await this.expenses.save(row);

    if (input.file) {
      const safe = this.safeName(input.file.fileName);
      const relativePath = `expenses/${row.id}-${safe}`;
      await this.filesystem.writeFile(
        input.businessId,
        relativePath,
        input.file.buffer,
      );
      row.fileName = input.file.fileName;
      row.relativePath = relativePath;
      row.mimeType = input.file.mimeType;
      row.size = input.file.size;
    }

    // Read the amount from the document unless the user already gave one.
    if (input.amountCents == null && input.file) {
      const parsed = await this.extractor.extract(
        input.file.mimeType,
        input.file.buffer,
      );
      if (parsed?.amountCents != null) {
        row.amountCents = parsed.amountCents;
        row.currency = parsed.currency || 'ILS';
        if (parsed.date) row.expenseDate = parsed.date;
        if (!input.kind && parsed.kind) row.kind = parsed.kind;
        if (!input.title?.trim() && parsed.vendor) row.title = parsed.vendor;
        row.status = 'parsed';
      } else {
        row.status = 'failed';
      }
    }

    return this.expenses.save(row);
  }

  async update(
    businessId: string,
    id: string,
    patch: {
      title?: string;
      kind?: ExpenseKind;
      amountCents?: number | null;
      expenseDate?: string | null;
      note?: string | null;
    },
  ): Promise<Expense> {
    const row = await this.expenses.findOne({ where: { id, businessId } });
    if (!row) throw new NotFoundException('Expense not found');
    if (patch.title !== undefined) row.title = patch.title;
    if (patch.kind !== undefined) row.kind = patch.kind;
    if (patch.amountCents !== undefined) {
      row.amountCents = patch.amountCents;
      row.status = 'manual';
    }
    if (patch.expenseDate !== undefined) row.expenseDate = patch.expenseDate;
    if (patch.note !== undefined) row.note = patch.note;
    return this.expenses.save(row);
  }

  async remove(businessId: string, id: string): Promise<void> {
    const row = await this.expenses.findOne({ where: { id, businessId } });
    if (!row) throw new NotFoundException('Expense not found');
    if (row.relativePath) {
      await this.filesystem.deleteFile(businessId, row.relativePath);
    }
    await this.expenses.delete({ id, businessId });
  }

  async download(
    businessId: string,
    id: string,
  ): Promise<{ row: Expense; buffer: Buffer }> {
    const row = await this.expenses.findOne({ where: { id, businessId } });
    if (!row || !row.relativePath) {
      throw new NotFoundException('Expense file not found');
    }
    const buffer = await this.filesystem.readFile(businessId, row.relativePath);
    return { row, buffer };
  }

  private titleFromFile(fileName?: string): string {
    if (!fileName) return 'הוצאה';
    return fileName.replace(/\.[a-z0-9]+$/i, '').slice(0, 120) || 'הוצאה';
  }

  private safeName(name: string): string {
    return (
      name
        .replace(/[/\\]/g, '_')
        .replace(/\0/g, '')
        .replace(/\s+/g, '_')
        .slice(0, 180) || 'file'
    );
  }
}
