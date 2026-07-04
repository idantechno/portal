import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CryptoService } from '../common/crypto/crypto.service';
import { Integration } from './integration.entity';

interface StoredTokens {
  access_token?: string;
  refresh_token?: string;
  [k: string]: unknown;
}

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
  ) {}

  async sendEmail(
    businessId: string,
    input: { to: string; subject: string; body: string },
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
    const raw = this.buildRawMessage(from, input.to, input.subject, input.body);

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

  /** Builds a base64url-encoded RFC822 message (UTF-8 safe, Hebrew subjects). */
  private buildRawMessage(
    from: string,
    to: string,
    subject: string,
    body: string,
  ): string {
    const encodedSubject = `=?UTF-8?B?${Buffer.from(subject, 'utf8').toString('base64')}?=`;
    const message = [
      `From: ${from}`,
      `To: ${to}`,
      `Subject: ${encodedSubject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset="UTF-8"',
      'Content-Transfer-Encoding: base64',
      '',
      Buffer.from(body, 'utf8').toString('base64'),
    ].join('\r\n');
    return Buffer.from(message, 'utf8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }
}
