import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CryptoService } from '../common/crypto/crypto.service';
import {
  GreenInvoiceConnection,
  GreenInvoiceEnv,
} from './green-invoice-connection.entity';
import { ConnectGreenInvoiceDto } from './dto/connect-green-invoice.dto';
import { IssueInvoiceDto } from './dto/issue-invoice.dto';

interface StoredCreds {
  id: string;
  secret: string;
}

/** Client-safe view — never includes credentials. */
export interface GreenInvoiceStatusView {
  connected: boolean;
  environment: GreenInvoiceEnv;
  accountName: string | null;
  connectedAt: Date | null;
}

/**
 * Integration with חשבונית ירוקה (Green Invoice). Per-business API credentials
 * are stored encrypted. The API authenticates via POST /account/token to get a
 * short-lived JWT, then issues legal documents via POST /documents.
 *
 * NOTE: endpoint paths + document field shapes follow Green Invoice API v1;
 * verify against their live docs when first connecting a real account.
 */
@Injectable()
export class GreenInvoiceService {
  private readonly log = new Logger(GreenInvoiceService.name);

  constructor(
    @InjectRepository(GreenInvoiceConnection)
    private readonly connections: Repository<GreenInvoiceConnection>,
    private readonly crypto: CryptoService,
  ) {}

  private baseUrl(env: GreenInvoiceEnv): string {
    return env === 'production'
      ? 'https://api.greeninvoice.co.il/api/v1'
      : 'https://sandbox.d.greeninvoice.co.il/api/v1';
  }

  async status(businessId: string): Promise<GreenInvoiceStatusView> {
    const row = await this.connections.findOne({ where: { businessId } });
    return {
      connected: row?.status === 'connected',
      environment: row?.environment ?? 'sandbox',
      accountName: row?.accountName ?? null,
      connectedAt: row?.connectedAt ?? null,
    };
  }

  /** Validate the credentials by fetching a token, then store them encrypted. */
  async connect(
    businessId: string,
    dto: ConnectGreenInvoiceDto,
  ): Promise<GreenInvoiceStatusView> {
    const env = dto.environment ?? 'sandbox';
    // Throws if the key pair is invalid — we only persist working credentials.
    await this.fetchToken(env, { id: dto.apiKeyId, secret: dto.apiSecret });

    let row = await this.connections.findOne({ where: { businessId } });
    if (!row) row = this.connections.create({ businessId });
    row.encryptedCredentials = this.crypto.encrypt(
      JSON.stringify({ id: dto.apiKeyId, secret: dto.apiSecret }),
    );
    row.environment = env;
    row.status = 'connected';
    row.connectedAt = new Date();
    await this.connections.save(row);
    return this.status(businessId);
  }

  async disconnect(businessId: string): Promise<void> {
    const row = await this.connections.findOne({ where: { businessId } });
    if (!row) throw new NotFoundException('Not connected');
    row.encryptedCredentials = null;
    row.status = 'disconnected';
    row.connectedAt = null;
    await this.connections.save(row);
  }

  /** Issue an invoice document under the business's Green Invoice account. */
  async issueInvoice(
    businessId: string,
    dto: IssueInvoiceDto,
  ): Promise<{ id: string; number?: string; url?: string }> {
    const row = await this.connections.findOne({ where: { businessId } });
    if (!row || row.status !== 'connected' || !row.encryptedCredentials) {
      throw new BadRequestException('GREEN_INVOICE_NOT_CONNECTED');
    }
    const creds = JSON.parse(
      this.crypto.decrypt(row.encryptedCredentials),
    ) as StoredCreds;
    const token = await this.fetchToken(row.environment, creds);

    const body = {
      // 320 = חשבונית מס/קבלה (tax invoice + receipt). Parameterize later.
      type: 320,
      lang: 'he',
      currency: 'ILS',
      vatType: 0,
      client: {
        name: dto.customerName,
        emails: dto.customerEmail ? [dto.customerEmail] : [],
        ...(dto.customerTaxId ? { taxId: dto.customerTaxId } : {}),
      },
      income: dto.items.map((i) => ({
        description: i.description,
        quantity: i.quantity,
        price: i.price,
        currency: 'ILS',
        vatType: 0,
      })),
    };

    const res = await fetch(`${this.baseUrl(row.environment)}/documents`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      this.log.error(
        `[green-invoice] document failed ${res.status}: ${detail.slice(0, 300)}`,
      );
      throw new BadRequestException(`GREEN_INVOICE_ISSUE_FAILED_${res.status}`);
    }
    const doc = (await res.json()) as {
      id?: string;
      number?: string;
      url?: { origin?: string } | string;
    };
    const url =
      typeof doc.url === 'string' ? doc.url : (doc.url?.origin ?? undefined);
    return { id: doc.id ?? '', number: doc.number, url };
  }

  private async fetchToken(
    env: GreenInvoiceEnv,
    creds: StoredCreds,
  ): Promise<string> {
    const res = await fetch(`${this.baseUrl(env)}/account/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: creds.id, secret: creds.secret }),
    });
    if (!res.ok) {
      throw new BadRequestException('GREEN_INVOICE_AUTH_FAILED');
    }
    const json = (await res.json()) as { token?: string };
    if (!json.token) throw new BadRequestException('GREEN_INVOICE_AUTH_FAILED');
    return json.token;
  }
}
