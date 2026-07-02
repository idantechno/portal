import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CryptoService } from '../common/crypto/crypto.service';
import { Integration, IntegrationProvider } from './integration.entity';
import { getProviderDef, INTEGRATION_PROVIDERS } from './integration.constants';

/** Subset of Google's token endpoint response we care about. */
interface GoogleTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  id_token?: string;
}

/** Client-safe view of an integration — never includes tokens. */
export interface IntegrationView {
  provider: IntegrationProvider;
  name: string;
  description: string;
  icon: string;
  status: 'connected' | 'disconnected' | 'error';
  accountEmail: string | null;
  connectedAt: Date | null;
  /** False when Google OAuth credentials aren't configured in the env yet. */
  available: boolean;
}

@Injectable()
export class IntegrationsService {
  constructor(
    @InjectRepository(Integration)
    private readonly integrations: Repository<Integration>,
    private readonly crypto: CryptoService,
    private readonly config: ConfigService,
  ) {}

  /** Google OAuth app credentials present? Gates the whole connect flow. */
  googleConfigured(): boolean {
    return (
      Boolean(this.config.get<string>('GOOGLE_CLIENT_ID')) &&
      Boolean(this.config.get<string>('GOOGLE_CLIENT_SECRET'))
    );
  }

  /** The OAuth redirect URI — must match what's registered in Google Console. */
  private redirectUri(): string {
    return (
      this.config.get<string>('GOOGLE_REDIRECT_URI') ??
      'http://localhost:3000/api/integrations/google/callback'
    );
  }

  /** Where to send the browser back to after the OAuth round-trip. */
  private frontendUrl(): string {
    return this.config.get<string>('APP_PUBLIC_URL') ?? 'http://localhost:5173';
  }

  /** Absolute frontend URL to bounce back to on a failed/denied consent. */
  errorRedirectUrl(state: string | undefined, reason: string): string {
    const [businessId] = (state ?? '').split(':');
    const base = businessId
      ? `${this.frontendUrl()}/app/businesses/${businessId}/integrations`
      : `${this.frontendUrl()}/app`;
    return `${base}?error=${reason}`;
  }

  /** Catalog merged with this business's connection state (token-free). */
  async list(businessId: string): Promise<IntegrationView[]> {
    const rows = await this.integrations.find({ where: { businessId } });
    const byProvider = new Map(rows.map((r) => [r.provider, r]));
    const available = this.googleConfigured();
    return INTEGRATION_PROVIDERS.map((def) => {
      const row = byProvider.get(def.provider);
      return {
        provider: def.provider,
        name: def.name,
        description: def.description,
        icon: def.icon,
        status: row?.status ?? 'disconnected',
        accountEmail: row?.accountEmail ?? null,
        connectedAt: row?.connectedAt ?? null,
        available,
      };
    });
  }

  /**
   * Build the Google consent URL for a provider. Throws if OAuth isn't
   * configured — the operator must set GOOGLE_CLIENT_ID/SECRET and a redirect
   * URI first. The token exchange in the callback is handled separately.
   */
  authUrl(businessId: string, provider: IntegrationProvider): string {
    if (!this.googleConfigured()) {
      throw new BadRequestException('GOOGLE_OAUTH_NOT_CONFIGURED');
    }
    const def = getProviderDef(provider);
    if (!def) throw new BadRequestException(`Unknown provider: ${provider}`);
    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID')!;
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: this.redirectUri(),
      response_type: 'code',
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true',
      // openid+email let us identify which Google account connected.
      scope: ['openid', 'email', ...def.scopes].join(' '),
      // Carries which business + provider this consent is for.
      state: `${businessId}:${provider}`,
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  /**
   * Handles the Google OAuth redirect: exchanges the auth code for tokens,
   * looks up the account email, and stores the connection encrypted. Returns
   * the frontend URL to redirect the browser back to.
   */
  async handleCallback(code: string, state: string): Promise<string> {
    const [businessId, provider] = (state ?? '').split(':');
    const def = getProviderDef(provider);
    const fail = (reason: string) =>
      `${this.frontendUrl()}/app/businesses/${businessId}/integrations?error=${reason}`;
    if (!businessId || !def) return fail('bad_state');
    if (!this.googleConfigured()) return fail('not_configured');

    try {
      const tokens = await this.exchangeCode(code);
      const email = await this.fetchAccountEmail(tokens.access_token);
      await this.saveTokens(
        businessId,
        def.provider,
        tokens as unknown as Record<string, unknown>,
        email,
      );
      return `${this.frontendUrl()}/app/businesses/${businessId}/integrations?connected=${def.provider}`;
    } catch (err) {
      return fail(
        encodeURIComponent((err as Error).message.slice(0, 80)) ||
          'exchange_failed',
      );
    }
  }

  private async exchangeCode(code: string): Promise<GoogleTokenResponse> {
    const body = new URLSearchParams({
      code,
      client_id: this.config.get<string>('GOOGLE_CLIENT_ID')!,
      client_secret: this.config.get<string>('GOOGLE_CLIENT_SECRET')!,
      redirect_uri: this.redirectUri(),
      grant_type: 'authorization_code',
    });
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    if (!res.ok) {
      throw new Error(`token_exchange_${res.status}`);
    }
    return (await res.json()) as GoogleTokenResponse;
  }

  private async fetchAccountEmail(
    accessToken: string | undefined,
  ): Promise<string | null> {
    if (!accessToken) return null;
    try {
      const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) return null;
      const info = (await res.json()) as { email?: string };
      return info.email ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Persist a token set after a successful OAuth exchange. Stored encrypted.
   * Called by the callback handler once token exchange is implemented.
   */
  async saveTokens(
    businessId: string,
    provider: IntegrationProvider,
    tokens: Record<string, unknown>,
    accountEmail: string | null,
  ): Promise<void> {
    const def = getProviderDef(provider);
    let row = await this.integrations.findOne({
      where: { businessId, provider },
    });
    if (!row) {
      row = this.integrations.create({ businessId, provider });
    }
    row.encryptedTokens = this.crypto.encrypt(JSON.stringify(tokens));
    row.accountEmail = accountEmail;
    row.scopes = def?.scopes ?? [];
    row.status = 'connected';
    row.connectedAt = new Date();
    await this.integrations.save(row);
  }

  async disconnect(
    businessId: string,
    provider: IntegrationProvider,
  ): Promise<void> {
    const row = await this.integrations.findOne({
      where: { businessId, provider },
    });
    if (!row) throw new NotFoundException('Integration not found');
    row.encryptedTokens = null;
    row.accountEmail = null;
    row.status = 'disconnected';
    row.connectedAt = null;
    await this.integrations.save(row);
  }
}
