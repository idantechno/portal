import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Business } from '../businesses/business.entity';
import { User } from '../users/user.entity';
import { UserRole } from '../common/enums/user-role.enum';
import { LeadsService } from '../leads/leads.service';
import {
  Audience,
  BusinessType,
  SubmitQuestionnaireDto,
} from './dto/submit-questionnaire.dto';
import { OperatorNotifierService } from './operator-notifier.service';

const BUSINESS_TYPE_LABEL: Record<BusinessType, string> = {
  service: 'עסק שירות',
  product: 'עסק מוצר',
  both: 'שירות ומוצר',
};
const AUDIENCE_LABEL: Record<Audience, string> = {
  b2b: 'לקוחות עסקיים (B2B)',
  b2c: 'לקוחות פרטיים (B2C)',
  both: 'עסקיים ופרטיים',
};

@Injectable()
export class QuestionnaireService {
  private readonly log = new Logger(QuestionnaireService.name);
  private cachedPlatformBusinessId: string | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly leads: LeadsService,
    private readonly operator: OperatorNotifierService,
    @InjectRepository(Business)
    private readonly businesses: Repository<Business>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  async submit(dto: SubmitQuestionnaireDto): Promise<{ ok: true }> {
    const phone = dto.phone?.trim() || null;
    const email = dto.email?.trim() || null;
    if (!phone && !email) {
      throw new BadRequestException('נדרש טלפון או אימייל אחד לפחות');
    }

    const businessId = await this.resolvePlatformBusinessId();

    const typeLabel = BUSINESS_TYPE_LABEL[dto.businessType];
    const audienceLabel = AUDIENCE_LABEL[dto.audience];
    const interest = `${dto.businessName} — ${typeLabel}, ${audienceLabel}`;

    const answers: Record<string, unknown> = {
      businessName: dto.businessName,
      businessType: dto.businessType,
      audience: dto.audience,
      preferredChannel: dto.preferredChannel ?? null,
      contactName: dto.contactName,
      phone,
      email,
      sections: dto.sections,
    };

    // Creating the lead also rings the cockpit bell and fires the
    // `lead.created` automation (both best-effort inside LeadsService).
    // Which landing page / campaign this came from, for the leads table.
    const campaign = dto.src?.trim();
    const sourceDetail = campaign
      ? `שאלון אסטרטגיה · ${campaign}`
      : 'שאלון אסטרטגיה';

    await this.leads.create({
      businessId,
      name: dto.contactName,
      phone,
      email,
      interest,
      source: 'questionnaire',
      sourceDetail,
      answers,
    });

    // Out-of-band delivery to the operator — never blocks the submission.
    try {
      await this.operator.notify(businessId, {
        subject: `שאלון אסטרטגיית שיווק חדש — ${dto.businessName}`,
        text: this.renderText(dto, { phone, email, typeLabel, audienceLabel }),
      });
    } catch (err) {
      this.log.warn(
        `Operator notify failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    return { ok: true };
  }

  /** Builds a readable Hebrew summary for the operator email / WhatsApp. */
  private renderText(
    dto: SubmitQuestionnaireDto,
    ctx: {
      phone: string | null;
      email: string | null;
      typeLabel: string;
      audienceLabel: string;
    },
  ): string {
    const channelLabel =
      dto.preferredChannel === 'phone'
        ? 'טלפון'
        : dto.preferredChannel === 'whatsapp'
          ? 'וואטסאפ'
          : dto.preferredChannel === 'email'
            ? 'אימייל'
            : '—';

    const head = [
      `התקבל שאלון אסטרטגיית שיווק חדש`,
      ``,
      `עסק: ${dto.businessName}`,
      `סוג: ${ctx.typeLabel} · קהל: ${ctx.audienceLabel}`,
      ``,
      `איש קשר: ${dto.contactName}`,
      `טלפון: ${ctx.phone ?? '—'}`,
      `אימייל: ${ctx.email ?? '—'}`,
      `ערוץ מועדף: ${channelLabel}`,
    ];

    const body = dto.sections.flatMap((section) => {
      const items = (section.items ?? [])
        .filter((it) => it && String(it.value ?? '').trim() !== '')
        .map((it) => `• ${it.label}: ${it.value}`);
      if (items.length === 0) return [];
      return ['', `— ${section.title} —`, ...items];
    });

    return [...head, '', '════════════════', ...body].join('\n');
  }

  /**
   * Leads/notifications require a businessId, but a marketing questionnaire is
   * tenant-less. We attach it to the operator's own "platform" business:
   * `PLATFORM_BUSINESS_ID` if set, else the earliest business owned by a
   * super-admin, else the earliest business overall. Cached after first hit.
   */
  private async resolvePlatformBusinessId(): Promise<string> {
    if (this.cachedPlatformBusinessId) return this.cachedPlatformBusinessId;

    const configured = this.config.get<string>('PLATFORM_BUSINESS_ID');
    if (configured) {
      const exists = await this.businesses.findOne({
        where: { id: configured },
      });
      if (exists) return (this.cachedPlatformBusinessId = configured);
      this.log.warn(
        `PLATFORM_BUSINESS_ID=${configured} not found — falling back`,
      );
    }

    const admins = await this.users.find({
      where: { role: UserRole.SuperAdmin },
      order: { createdAt: 'ASC' },
    });
    for (const admin of admins) {
      const biz = await this.businesses.findOne({
        where: { ownerUserId: admin.id },
        order: { createdAt: 'ASC' },
      });
      if (biz) return (this.cachedPlatformBusinessId = biz.id);
    }

    const first = await this.businesses.find({
      order: { createdAt: 'ASC' },
      take: 1,
    });
    if (first[0]) return (this.cachedPlatformBusinessId = first[0].id);

    throw new ServiceUnavailableException(
      'No business exists to attach the questionnaire lead to',
    );
  }
}
