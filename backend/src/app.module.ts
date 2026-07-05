import { join } from 'node:path';
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TerminusModule } from '@nestjs/terminus';
import { BullModule } from '@nestjs/bullmq';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
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
import { DocumentsModule } from './documents/documents.module';
import { AuditModule } from './audit/audit.module';
import { AdminModule } from './admin/admin.module';
import { AgentsModule } from './agents/agents.module';
import { TasksModule } from './tasks/tasks.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AutomationsModule } from './automations/automations.module';
import { BillingModule } from './billing/billing.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { GreenInvoiceModule } from './green-invoice/green-invoice.module';
import { IdeasModule } from './ideas/ideas.module';
import { SupportModule } from './support/support.module';
import { MainAgentModule } from './main-agent/main-agent.module';
import { DesignerModule } from './designer/designer.module';
import { FilingModule } from './filing/filing.module';
import { RemindersAgentModule } from './reminders-agent/reminders-agent.module';
import { OverviewModule } from './overview/overview.module';
import { ExpensesModule } from './expenses/expenses.module';
import { WorkspaceAgentModule } from './agents/workspace/workspace-agent.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
    }),
    // Global baseline rate limit: 120 requests / minute / IP. Public,
    // cost-amplifying surfaces (widget agent runs, login brute-force) tighten
    // this further with their own @Throttle decorators.
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 120 }],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => {
        const synchronize =
          cfg.get<string>('DB_SYNCHRONIZE', 'false') === 'true';
        return {
          type: 'postgres',
          host: cfg.get<string>('DB_HOST', 'localhost'),
          port: cfg.get<number>('DB_PORT', 5432),
          username: cfg.get<string>('DB_USERNAME', 'postgres'),
          password: cfg.get<string>('DB_PASSWORD', 'postgres'),
          database: cfg.get<string>('DB_NAME', 'portal'),
          autoLoadEntities: true,
          // Dev uses synchronize for fast iteration; prod keeps it off and runs
          // migrations automatically on boot instead.
          synchronize,
          migrations: [join(__dirname, 'migrations', '*.{js,ts}')],
          migrationsRun: !synchronize,
          logging: cfg.get<string>('DB_LOGGING', 'false') === 'true',
        };
      },
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
    DocumentsModule,
    AuditModule,
    AdminModule,
    AgentsModule,
    TasksModule,
    NotificationsModule,
    AutomationsModule,
    BillingModule,
    IntegrationsModule,
    GreenInvoiceModule,
    IdeasModule,
    SupportModule,
    MainAgentModule,
    DesignerModule,
    FilingModule,
    RemindersAgentModule,
    OverviewModule,
    ExpensesModule,
    WorkspaceAgentModule,
  ],
  controllers: [AppController, HealthController],
  providers: [
    AppService,
    // Runs first: rejects abusive request rates before auth/role work happens.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
