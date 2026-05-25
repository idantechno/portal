import { Global, Module } from '@nestjs/common';
import { CryptoService } from './crypto.service';

/**
 * Global so any module needing encrypt/decrypt can inject CryptoService
 * without re-importing this module.
 */
@Global()
@Module({
  providers: [CryptoService],
  exports: [CryptoService],
})
export class CryptoModule {}
