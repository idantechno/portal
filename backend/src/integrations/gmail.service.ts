import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CryptoService } from '../common/crypto/crypto.service';
import { IntegrationsService } from './integrations.service';
import { Integration } from './integration.entity';

interface StoredTokens {
  access_token?: string;
  refresh_token?: string;
  [k: string]: unknown;
}

/** A file to attach to an outgoing Gmail message. */
export interface GmailOutAttachment {
  filename: string;
  mimeType: string;
  content: Buffer;
}

/** An attachment part of a Gmail message. */
export interface GmailAttachment {
  attachmentId: string;
  filename: string;
  mimeType: string;
  size: number;
}

/** A parsed Gmail message — the read shape consumed by the mail agent. */
export interface GmailMessage {
  id: string;
  from: string;
  subject: string;
  snippet: string | null;
  /** Epoch millis the message was received (Gmail `internalDate`). */
  internalDate: number;
  attachments: GmailAttachment[];
}

/** Raw Gmail payload part shape we walk for headers + attachments. */
interface GmailPart {
  filename?: string;
  mimeType?: string;
  headers?: { name: string; value: string }[];
  body?: { attachmentId?: string; size?: number; data?: string };
  parts?: GmailPart[];
}

interface GmailMessageRaw {
  id: string;
  snippet?: string;
  internalDate?: string;
  payload?: GmailPart;
}

const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1/users/me';

/**
 * Sends email through a business's connected Gmail account. Uses the stored
 * OAuth tokens (decrypted), transparently refreshing the access token on a 401.
 * Pure `fetch` against the Gmail REST API — no googleapis dependency.
 */
@Injectable()
export class GmailService {
  private readonly log = new Logger(GmailService.name);

  constructor(
    @InjectRepository(Integration)
    private readonly integrations: Repository<Integration>,
    private readonly crypto: CryptoService,
    private readonly config: ConfigService,
    private readonly integrationsService: IntegrationsService,
  ) {}

  async sendEmail(
    businessId: string,
    input: {
      to: string;
      subject: string;
      body: string;
      /** Optional file attachments (e.g. an accountant document package). */
      attachments?: GmailOutAttachment[];
    },
  ): Promise<{ ok: true; from: string }> {
    const row = await this.integrations.findOne({
      where: { businessId, provider: 'gmail' },
    });
    if (!row || row.status !== 'connected' || !row.encryptedTokens) {
      throw new BadRequestException('GMAIL_NOT_CONNECTED');
    }

    const tokens = JSON.parse(
      this.crypto.decrypt(row.encryptedTokens),
    ) as StoredTokens;
    const from = row.accountEmail ?? 'me';
    const raw = this.buildRawMessage(
      from,
      input.to,
      input.subject,
      input.body,
      input.attachments,
    );

    let res = await this.gmailSend(tokens.access_token, raw);

    // Access token likely expired — refresh once and retry.
    if (res.status === 401 && tokens.refresh_token) {
      const fresh = await this.refreshAccessToken(tokens.refresh_token);
      tokens.access_token = fresh;
      row.encryptedTokens = this.crypto.encrypt(JSON.stringify(tokens));
      await this.integrations.save(row);
      res = await this.gmailSend(fresh, raw);
    }

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      this.log.error(
        `[gmail] send failed ${res.status}: ${detail.slice(0, 200)}`,
      );
      throw new BadRequestException(`GMAIL_SEND_FAILED_${res.status}`);
    }
    return { ok: true, from };
  }

  private gmailSend(
    accessToken: string | undefined,
    raw: string,
  ): Promise<Response> {
    return fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken ?? ''}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ raw }),
      },
    );
  }

  private async refreshAccessToken(refreshToken: string): Promise<string> {
    const body = new URLSearchParams({
      client_id: this.config.get<string>('GOOGLE_CLIENT_ID')!,
      client_secret: this.config.get<string>('GOOGLE_CLIENT_SECRET')!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    });
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    if (!res.ok) throw new BadRequestException('GMAIL_REFRESH_FAILED');
    const json = (await res.json()) as { access_token?: string };
    if (!json.access_token)
      throw new BadRequestException('GMAIL_REFRESH_FAILED');
    return json.access_token;
  }

  /**
   * Runs an authed GET against the Gmail API, refreshing the access token once
   * on a 401 (same pattern as CalendarService.call). Reuses the shared token
   * store via IntegrationsService so refreshes are persisted.
   */
  private async get(businessId: string, url: string): Promise<Response> {
    let token = await this.integrationsService.accessTokenFor(
      businessId,
      'gmail',
    );
    const send = (t: string) =>
      fetch(url, { headers: { Authorization: `Bearer ${t}` } });
    let res = await send(token);
    if (res.status === 401) {
      token = await this.integrationsService.refreshAccessTokenFor(
        businessId,
        'gmail',
      );
      res = await send(token);
    }
    return res;
  }

  /** Message ids matching a Gmail search query (newest first, capped at 25). */
  async listMessageIds(businessId: string, query: string): Promise<string[]> {
    const params = new URLSearchParams({ q: query, maxResults: '25' });
    const res = await this.get(
      businessId,
      `${GMAIL_API}/messages?${params.toString()}`,
    );
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      this.log.warn(
        `[gmail] list failed ${res.status}: ${detail.slice(0, 200)}`,
      );
      throw new BadRequestException(`GMAIL_LIST_FAILED_${res.status}`);
    }
    const json = (await res.json()) as { messages?: { id: string }[] };
    return (json.messages ?? []).map((m) => m.id);
  }

  /** Full parsed message: from/subject headers + recursively-walked attachments. */
  async getMessage(businessId: string, id: string): Promise<GmailMessage> {
    const res = await this.get(
      businessId,
      `${GMAIL_API}/messages/${encodeURIComponent(id)}?format=full`,
    );
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      this.log.warn(
        `[gmail] get failed ${res.status}: ${detail.slice(0, 200)}`,
      );
      throw new BadRequestException(`GMAIL_GET_FAILED_${res.status}`);
    }
    const raw = (await res.json()) as GmailMessageRaw;
    const header = (name: string): string => {
      const h = (raw.payload?.headers ?? []).find(
        (x) => x.name.toLowerCase() === name.toLowerCase(),
      );
      return h?.value ?? '';
    };
    const attachments: GmailAttachment[] = [];
    this.collectAttachments(raw.payload, attachments);
    return {
      id: raw.id,
      from: header('From'),
      subject: header('Subject'),
      snippet: raw.snippet ?? null,
      internalDate: raw.internalDate ? Number(raw.internalDate) : Date.now(),
      attachments,
    };
  }

  /** Walks payload parts, collecting every part that is a real attachment. */
  private collectAttachments(
    part: GmailPart | undefined,
    out: GmailAttachment[],
  ): void {
    if (!part) return;
    if (part.filename && part.body?.attachmentId) {
      out.push({
        attachmentId: part.body.attachmentId,
        filename: part.filename,
        mimeType: part.mimeType ?? 'application/octet-stream',
        size: part.body.size ?? 0,
      });
    }
    for (const child of part.parts ?? []) this.collectAttachments(child, out);
  }

  /** Downloads an attachment's bytes (base64url `data` → Buffer). */
  async getAttachment(
    businessId: string,
    messageId: string,
    attachmentId: string,
  ): Promise<Buffer> {
    const res = await this.get(
      businessId,
      `${GMAIL_API}/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}`,
    );
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      this.log.warn(
        `[gmail] attachment failed ${res.status}: ${detail.slice(0, 200)}`,
      );
      throw new BadRequestException(`GMAIL_ATTACHMENT_FAILED_${res.status}`);
    }
    const json = (await res.json()) as { data?: string };
    return Buffer.from(json.data ?? '', 'base64url');
  }

  /** Builds a base64url-encoded RFC822 message (UTF-8 safe, Hebrew subjects). */
  private buildRawMessage(
    from: string,
    to: string,
    subject: string,
    body: string,
    attachments?: GmailOutAttachment[],
  ): string {
    const encodedSubject = `=?UTF-8?B?${Buffer.from(subject, 'utf8').toString('base64')}?=`;
    let message: string;

    if (attachments && attachments.length > 0) {
      // multipart/mixed: a text part followed by one base64 part per file.
      const boundary = `portal_${Buffer.from(subject + to)
        .toString('hex')
        .slice(0, 24)}`;
      const parts: string[] = [
        `From: ${from}`,
        `To: ${to}`,
        `Subject: ${encodedSubject}`,
        'MIME-Version: 1.0',
        `Content-Type: multipart/mixed; boundary="${boundary}"`,
        '',
        `--${boundary}`,
        'Content-Type: text/plain; charset="UTF-8"',
        'Content-Transfer-Encoding: base64',
        '',
        Buffer.from(body, 'utf8').toString('base64'),
      ];
      for (const att of attachments) {
        const encodedName = `=?UTF-8?B?${Buffer.from(att.filename, 'utf8').toString('base64')}?=`;
        parts.push(
          `--${boundary}`,
          `Content-Type: ${att.mimeType}; name="${encodedName}"`,
          'Content-Transfer-Encoding: base64',
          `Content-Disposition: attachment; filename="${encodedName}"`,
          '',
          att.content.toString('base64'),
        );
      }
      parts.push(`--${boundary}--`, '');
      message = parts.join('\r\n');
    } else {
      message = [
        `From: ${from}`,
        `To: ${to}`,
        `Subject: ${encodedSubject}`,
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset="UTF-8"',
        'Content-Transfer-Encoding: base64',
        '',
        Buffer.from(body, 'utf8').toString('base64'),
      ].join('\r\n');
    }

    return Buffer.from(message, 'utf8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }
}
