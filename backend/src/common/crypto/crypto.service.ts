import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;

/**
 * Encrypts short secrets at rest (WhatsApp tokens, app secrets, ...).
 * Storage format: base64(iv || authTag || ciphertext). Self-contained per row,
 * no central nonce registry needed.
 *
 * The key comes from APP_ENCRYPTION_KEY (32 bytes b64). Rotate by generating a
 * new key, re-encrypting all rows during a maintenance window, then deploying.
 */
@Injectable()
export class CryptoService {
  private readonly key: Buffer;

  constructor(config: ConfigService) {
    const raw = config.get<string>('APP_ENCRYPTION_KEY');
    if (!raw) {
      throw new Error('APP_ENCRYPTION_KEY is not configured');
    }
    const key = Buffer.from(raw, 'base64');
    if (key.length !== 32) {
      throw new Error(
        `APP_ENCRYPTION_KEY must decode to 32 bytes (got ${key.length})`,
      );
    }
    this.key = key;
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_LEN);
    const cipher = createCipheriv(ALGO, this.key, iv);
    const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, enc]).toString('base64');
  }

  decrypt(payload: string): string {
    const buf = Buffer.from(payload, 'base64');
    if (buf.length < IV_LEN + TAG_LEN + 1) {
      throw new Error('Ciphertext too short');
    }
    const iv = buf.subarray(0, IV_LEN);
    const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
    const enc = buf.subarray(IV_LEN + TAG_LEN);
    const decipher = createDecipheriv(ALGO, this.key, iv);
    decipher.setAuthTag(tag);
    const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
    return dec.toString('utf8');
  }

  /**
   * Constant-time string compare for sensitive equality checks
   * (e.g. verify_token from Meta).
   */
  safeEqual(a: string, b: string): boolean {
    const aBuf = Buffer.from(a);
    const bBuf = Buffer.from(b);
    if (aBuf.length !== bBuf.length) return false;
    return timingSafeEqual(aBuf, bBuf);
  }
}
