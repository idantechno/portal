import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { BusinessesModule } from '../businesses/businesses.module';
import { InboxGateway } from './inbox.gateway';
import { InboxEventsService } from './inbox-events.service';

/**
 * Global so any module that creates a conversation or message can inject
 * InboxEventsService without re-importing this module.
 */
@Global()
@Module({
  imports: [
    BusinessesModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>('JWT_SECRET');
        if (!secret) throw new Error('JWT_SECRET is not configured');
        return { secret };
      },
    }),
  ],
  providers: [InboxGateway, InboxEventsService],
  exports: [InboxEventsService],
})
export class InboxModule {}
