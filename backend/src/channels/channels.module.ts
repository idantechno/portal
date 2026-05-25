import { Global, Module } from '@nestjs/common';
import { ChannelRegistry } from './channel-registry.service';

/**
 * Global so every channel-specific module can `inject(ChannelRegistry)` and
 * call `register()` on init without re-importing the module everywhere.
 */
@Global()
@Module({
  providers: [ChannelRegistry],
  exports: [ChannelRegistry],
})
export class ChannelsModule {}
