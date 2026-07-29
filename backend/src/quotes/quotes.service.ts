import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FilesystemService } from '../context-files/filesystem.service';
import { CustomersService } from '../customers/customers.service';
import {
  Quote,
  QuoteChannel,
  QuoteLineItem,
  QuoteStatus,
} from './quote.entity';
import { renderQuote } from './quote-renderer';

export interface CreateQuoteInput {
  businessId: string;
  customerId: string;
  title: string;
  intro?: string;
  lineItems?: QuoteLineItem[];
  journey?: string;
  channels?: QuoteChannel[];
  budgetSummary?: string;
  total?: string | null;
  notes?: string | null;
}

export interface UpdateQuoteInput {
  title?: string;
  status?: QuoteStatus;
  intro?: string;
  lineItems?: QuoteLineItem[];
  journey?: string;
  channels?: QuoteChannel[];
  budgetSummary?: string;
  total?: string | null;
  notes?: string | null;
}

@Injectable()
export class QuotesService {
  private readonly log = new Logger(QuotesService.name);

  constructor(
    @InjectRepository(Quote)
    private readonly quotes: Repository<Quote>,
    private readonly customers: CustomersService,
    private readonly filesystem: FilesystemService,
  ) {}

  async create(input: CreateQuoteInput): Promise<Quote> {
    // Validates the customer belongs to the business (throws 404 otherwise).
    await this.customers.findByIdScoped(input.businessId, input.customerId);

    const quote = await this.quotes.save(
      this.quotes.create({
        businessId: input.businessId,
        customerId: input.customerId,
        title: input.title.trim().slice(0, 255),
        status: 'draft',
        intro: input.intro ?? '',
        lineItems: input.lineItems ?? [],
        journey: input.journey ?? '',
        channels: input.channels ?? [],
        budgetSummary: input.budgetSummary ?? '',
        total: input.total ?? null,
        notes: input.notes ?? null,
      }),
    );
    await this.mirror(quote);
    return quote;
  }

  list(businessId: string, customerId?: string): Promise<Quote[]> {
    return this.quotes.find({
      where: { businessId, ...(customerId ? { customerId } : {}) },
      order: { updatedAt: 'DESC' },
    });
  }

  /** Does the customer have an approved quote? — the campaign / plan gate. */
  async hasApproved(businessId: string, customerId: string): Promise<boolean> {
    const count = await this.quotes.count({
      where: { businessId, customerId, status: 'approved' },
    });
    return count > 0;
  }

  async findByIdScoped(businessId: string, id: string): Promise<Quote> {
    const quote = await this.quotes.findOne({ where: { id, businessId } });
    if (!quote) throw new NotFoundException(`Quote ${id} not found`);
    return quote;
  }

  async update(
    businessId: string,
    id: string,
    patch: UpdateQuoteInput,
  ): Promise<Quote> {
    const quote = await this.findByIdScoped(businessId, id);
    if (patch.title !== undefined)
      quote.title = patch.title.trim().slice(0, 255);
    if (patch.status !== undefined) quote.status = patch.status;
    if (patch.intro !== undefined) quote.intro = patch.intro;
    if (patch.lineItems !== undefined) quote.lineItems = patch.lineItems;
    if (patch.journey !== undefined) quote.journey = patch.journey;
    if (patch.channels !== undefined) quote.channels = patch.channels;
    if (patch.budgetSummary !== undefined)
      quote.budgetSummary = patch.budgetSummary;
    if (patch.total !== undefined) quote.total = patch.total;
    if (patch.notes !== undefined) quote.notes = patch.notes;
    const saved = await this.quotes.save(quote);
    await this.mirror(saved);
    return saved;
  }

  async remove(businessId: string, id: string): Promise<void> {
    const quote = await this.findByIdScoped(businessId, id);
    await this.quotes.remove(quote);
    await this.filesystem
      .deleteFile(businessId, this.artifactPath(id))
      .catch((err) =>
        this.log.warn(
          `Failed to delete quote artifact: ${(err as Error).message}`,
        ),
      );
  }

  private artifactPath(id: string): string {
    return `quotes/${id}.md`;
  }

  /** Writes the rendered markdown mirror; never throws — the DB row is authoritative. */
  private async mirror(quote: Quote): Promise<void> {
    try {
      await this.filesystem.ensureBusinessRoot(quote.businessId);
      await this.filesystem.writeFile(
        quote.businessId,
        this.artifactPath(quote.id),
        Buffer.from(renderQuote(quote), 'utf8'),
      );
    } catch (err) {
      this.log.warn(
        `Failed to mirror quote artifact: ${(err as Error).message}`,
      );
    }
  }
}
