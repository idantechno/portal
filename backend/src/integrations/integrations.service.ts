import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { CryptoService } from '../common/crypto/crypto.service';
import { Integration, IntegrationProvider } from './integration.entity';
import { getProviderDef, INTEGRATION_PROVIDERS } from './integration.constants';

/** OAuth state is valid for 15 minutes — long enough to consent, short enough
 * to bound replay of a signed state. */
const OAUTH_STATE_TTL_MS = 15 * 60 * 1000;

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
    const businessId = this.verifyState(state)?.businessId;
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
  /** Secret used to sign OAuth state. Reuses the app encryption key. */
  private stateSecret(): string {
    const key = this.config.get<string>('APP_ENCRYPTION_KEY');
    if (!key) throw new BadRequestException('APP_ENCRYPTION_KEY not set');
    return key;
  }

  /**
   * Signs OAuth state so the callback can only accept states WE issued from an
   * authenticated, membership-checked authUrl call. Without this, the callback
   * (necessarily public — Google redirects a browser to it) would trust a
   * hand-crafted `state=<victimBusinessId>:gmail`, letting an attacker bind
   * their own Google account to someone else's business.
   * Format: base64url(businessId:provider:userId:issuedAtMs).hmacHex
   */
  private signState(
    businessId: string,
    provider: IntegrationProvider,
    userId: string,
  ): string {
    const payload = Buffer.from(
      `${businessId}:${provider}:${userId}:${Date.now()}`,
    ).toString('base64url');
    const sig = createHmac('sha256', this.stateSecret())
      .update(payload)
      .digest('hex');
    return `${payload}.${sig}`;
  }

  /** Verifies a signed state; returns its parts or null if forged/expired. */
  verifyState(state: string | undefined): {
    businessId: string;
    provider: string;
    userId: string;
  } | null {
    if (!state || !state.includes('.')) return null;
    const [payload, sig] = state.split('.');
    if (!payload || !sig) return null;
    const expected = createHmac('sha256', this.stateSecret())
      .update(payload)
      .digest('hex');
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const [businessId, provider, userId, issuedAt] = Buffer.from(
      payload,
      'base64url',
    )
      .toString('utf8')
      .split(':');
    if (!businessId || !provider || !userId || !issuedAt) return null;
    if (Date.now() - Number(issuedAt) > OAUTH_STATE_TTL_MS) return null;
    return { businessId, provider, userId };
  }

  authUrl(
    businessId: string,
    provider: IntegrationProvider,
    userId: string,
  ): string {
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
      // Signed so the public callback can't be fed a forged business id.
      state: this.signState(businessId, provider, userId),
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  /**
   * Handles the Google OAuth redirect: exchanges the auth code for tokens,
   * looks up the account email, and stores the connection encrypted. Returns
   * the frontend URL to redirect the browser back to.
   */
  async handleCallback(code: string, state: string): Promise<string> {
    // Reject any state we didn't sign (forged/expired) BEFORE touching tokens.
    const verified = this.verifyState(state);
    if (!verified) {
      return `${this.frontendUrl()}/app?error=bad_state`;
    }
    const { businessId, provider } = verified;
    const def = getProviderDef(provider);
    const fail = (reason: string) =>
      `${this.frontendUrl()}/app/businesses/${businessId}/integrations?error=${reason}`;
    if (!def) return fail('bad_state');
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

  /** True if the business has this provider connected with stored tokens. */
  async isConnected(
    businessId: string,
    provider: IntegrationProvider,
  ): Promise<boolean> {
    const row = await this.integrations.findOne({
      where: { businessId, provider },
    });
    return Boolean(row && row.status === 'connected' && row.encryptedTokens);
  }

  /** Current (possibly-expired) access token for a connected provider. */
  async accessTokenFor(
    businessId: string,
    provider: IntegrationProvider,
  ): Promise<string> {
    const tokens = await this.decryptTokens(businessId, provider);
    if (!tokens.access_token) throw new BadRequestException('NOT_CONNECTED');
    return tokens.access_token;
  }

  /** Refresh the access token via the stored refresh_token, persist, return it. */
  async refreshAccessTokenFor(
    businessId: string,
    provider: IntegrationProvider,
  ): Promise<string> {
    const row = await this.integrations.findOne({
      where: { businessId, provider },
    });
    if (!row?.encryptedTokens) throw new BadRequestException('NOT_CONNECTED');
    const tokens = JSON.parse(this.crypto.decrypt(row.encryptedTokens)) as {
      access_token?: string;
      refresh_token?: string;
      [k: string]: unknown;
    };
    if (!tokens.refresh_token)
      throw new BadRequestException('NO_REFRESH_TOKEN');
    const body = new URLSearchParams({
      client_id: this.config.get<string>('GOOGLE_CLIENT_ID')!,
      client_secret: this.config.get<string>('GOOGLE_CLIENT_SECRET')!,
      refresh_token: tokens.refresh_token,
      grant_type: 'refresh_token',
    });
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    if (!res.ok) throw new BadRequestException('TOKEN_REFRESH_FAILED');
    const json = (await res.json()) as { access_token?: string };
    if (!json.access_token)
      throw new BadRequestException('TOKEN_REFRESH_FAILED');
    tokens.access_token = json.access_token;
    row.encryptedTokens = this.crypto.encrypt(JSON.stringify(tokens));
    await this.integrations.save(row);
    return json.access_token;
  }

  private async decryptTokens(
    businessId: string,
    provider: IntegrationProvider,
  ): Promise<{ access_token?: string; refresh_token?: string }> {
    const row = await this.integrations.findOne({
      where: { businessId, provider },
    });
    if (!row || row.status !== 'connected' || !row.encryptedTokens) {
      throw new BadRequestException('NOT_CONNECTED');
    }
    return JSON.parse(this.crypto.decrypt(row.encryptedTokens)) as {
      access_token?: string;
      refresh_token?: string;
    };
  }
}
