import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CryptoService } from '../common/crypto/crypto.service';
import { WhatsappConnection } from './whatsapp-connection.entity';

export interface WhatsappConnectionPublic {
  id: string;
  businessId: string;
  phoneNumberId: string | null;
  wabaId: string | null;
  metaBusinessId: string | null;
  displayPhoneNumber: string | null;
  status: WhatsappConnection['status'];
  lastError: string | null;
  connectedAt: Date | null;
  hasAccessToken: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface WhatsappConnectInput {
  businessId: string;
  phoneNumberId: string;
  wabaId: string;
  displayPhoneNumber?: string | null;
  metaBusinessId?: string | null;
  accessToken: string;
}

@Injectable()
export class WhatsappConnectionsService {
  private readonly log = new Logger(WhatsappConnectionsService.name);

  constructor(
    @InjectRepository(WhatsappConnection)
    private readonly connections: Repository<WhatsappConnection>,
    private readonly crypto: CryptoService,
  ) {}

  toPublic(c: WhatsappConnection): WhatsappConnectionPublic {
    return {
      id: c.id,
      businessId: c.businessId,
      phoneNumberId: c.phoneNumberId,
      wabaId: c.wabaId,
      metaBusinessId: c.metaBusinessId,
      displayPhoneNumber: c.displayPhoneNumber,
      status: c.status,
      lastError: c.lastError,
      connectedAt: c.connectedAt,
      hasAccessToken: Boolean(c.accessTokenEncrypted),
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    };
  }

  findByBusinessId(businessId: string): Promise<WhatsappConnection | null> {
    return this.connections.findOne({ where: { businessId } });
  }

  findByPhoneNumberId(
    phoneNumberId: string,
  ): Promise<WhatsappConnection | null> {
    return this.connections.findOne({ where: { phoneNumberId } });
  }

  /**
   * Called after Embedded Signup completes. Persists the WABA / phone number
   * IDs and the access token Meta granted us for this business. Tokens are
   * AES-GCM encrypted at rest.
   */
  async connect(input: WhatsappConnectInput): Promise<WhatsappConnection> {
    const phoneConflict = await this.connections.findOne({
      where: { phoneNumberId: input.phoneNumberId },
    });
    if (phoneConflict && phoneConflict.businessId !== input.businessId) {
      throw new ConflictException(
        'This WhatsApp number is already connected to another business',
      );
    }

    let conn = await this.findByBusinessId(input.businessId);
    if (!conn) {
      conn = this.connections.create({
        businessId: input.businessId,
        phoneNumberId: input.phoneNumberId,
        wabaId: input.wabaId,
        metaBusinessId: input.metaBusinessId ?? null,
        displayPhoneNumber: input.displayPhoneNumber ?? null,
        accessTokenEncrypted: this.crypto.encrypt(input.accessToken),
        status: 'active',
        lastError: null,
        connectedAt: new Date(),
      });
    } else {
      conn.phoneNumberId = input.phoneNumberId;
      conn.wabaId = input.wabaId;
      conn.metaBusinessId = input.metaBusinessId ?? conn.metaBusinessId;
      conn.displayPhoneNumber =
        input.displayPhoneNumber ?? conn.displayPhoneNumber;
      conn.accessTokenEncrypted = this.crypto.encrypt(input.accessToken);
      conn.status = 'active';
      conn.lastError = null;
      conn.connectedAt = new Date();
    }
    return this.connections.save(conn);
  }

  async delete(businessId: string): Promise<void> {
    const conn = await this.findByBusinessId(businessId);
    if (!conn) return;
    await this.connections.delete({ id: conn.id });
  }

  decryptAccessToken(c: WhatsappConnection): string {
    if (!c.accessTokenEncrypted) {
      throw new BadRequestException('Access token not configured');
    }
    return this.crypto.decrypt(c.accessTokenEncrypted);
  }

  async markActive(connectionId: string): Promise<void> {
    await this.connections.update(
      { id: connectionId },
      { status: 'active', lastError: null, connectedAt: new Date() },
    );
  }

  async markFailed(connectionId: string, error: string): Promise<void> {
    await this.connections.update(
      { id: connectionId },
      { status: 'failed', lastError: error.slice(0, 1000) },
    );
  }

  async requireActive(businessId: string): Promise<WhatsappConnection> {
    const conn = await this.findByBusinessId(businessId);
    if (!conn || conn.status !== 'active') {
      throw new NotFoundException(
        'WhatsApp is not connected for this business',
      );
    }
    return conn;
  }
}
