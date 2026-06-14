import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TerminusModule } from '@nestjs/terminus';
import { BullModule } from '@nestjs/bullmq';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthController } from './health/health.controller';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { BusinessesModule } from './businesses/businesses.module';
import { ContextFilesModule } from './context-files/context-files.module';
import { ChannelsModule } from './channels/channels.module';
import { ConversationsModule } from './conversations/conversations.module';
import { LeadsModule } from './leads/leads.module';
import { AgentWorkerModule } from './agent-worker/agent-worker.module';
import { CryptoModule } from './common/crypto/crypto.module';
import { WhatsappModule } from './whatsapp/whatsapp.module';
import { InboxModule } from './inbox/inbox.module';
import { WidgetModule } from './widget/widget.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        type: 'postgres',
        host: cfg.get<string>('DB_HOST', 'localhost'),
        port: cfg.get<number>('DB_PORT', 5432),
        username: cfg.get<string>('DB_USERNAME', 'postgres'),
        password: cfg.get<string>('DB_PASSWORD', 'postgres'),
        database: cfg.get<string>('DB_NAME', 'portal'),
        autoLoadEntities: true,
        synchronize: cfg.get<string>('DB_SYNCHRONIZE', 'false') === 'true',
        logging: cfg.get<string>('DB_LOGGING', 'false') === 'true',
      }),
    }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        connection: {
          host: cfg.get<string>('REDIS_HOST', 'redis'),
          port: cfg.get<number>('REDIS_PORT', 6379),
          username: cfg.get<string>('REDIS_USERNAME'),
          password: cfg.get<string>('REDIS_PASSWORD'),
        },
      }),
    }),
    TerminusModule,
    UsersModule,
    AuthModule,
    BusinessesModule,
    ContextFilesModule,
    ChannelsModule,
    ConversationsModule,
    LeadsModule,
    AgentWorkerModule,
    CryptoModule,
    InboxModule,
    WhatsappModule,
    WidgetModule,
  ],
  controllers: [AppController, HealthController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
