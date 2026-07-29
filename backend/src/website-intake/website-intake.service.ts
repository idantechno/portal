import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes } from 'node:crypto';
import { extension as mimeExtension } from 'mime-types';
import { Business } from '../businesses/business.entity';
import { User } from '../users/user.entity';
import { UserRole } from '../common/enums/user-role.enum';
import { CustomersService } from '../customers/customers.service';
import { FilesystemService } from '../context-files/filesystem.service';
import { OperatorNotifierService } from '../questionnaire/operator-notifier.service';
import {
  IntakeAsset,
  IntakeSection,
  WebsiteIntake,
} from './website-intake.entity';
import { SubmitWebsiteIntakePayload } from './dto/submit-website-intake.dto';

/** An uploaded file as multer hands it to us (memory storage). */
export interface UploadedAsset {
  originalName: string;
  buffer: Buffer;
  mimeType: string;
  size: number;
}

const ALLOWED_IMAGE_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/svg+xml',
  'image/avif',
]);
const MAX_IMAGES = 5;

@Injectable()
export class WebsiteIntakeService {
  private readonly log = new Logger(WebsiteIntakeService.name);
  private cachedPlatformBusinessId: string | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly customers: CustomersService,
    private readonly filesystem: FilesystemService,
    private readonly operator: OperatorNotifierService,
    @InjectRepository(WebsiteIntake)
    private readonly intakes: Repository<WebsiteIntake>,
    @InjectRepository(Business)
    private readonly businesses: Repository<Business>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  /**
   * Public submission entry point. Validates the payload, finds-or-creates the
   * customer (deduped by phone/email), stores the uploaded assets, persists the
   * intake, and notifies the operator. Never registers a customer twice.
   */
  async submit(
    payload: SubmitWebsiteIntakePayload,
    files: { logo?: UploadedAsset; images: UploadedAsset[] },
  ): Promise<{ ok: true; pdfToken?: string }> {
    if (payload.hp && payload.hp.trim() !== '') {
      // Honeypot tripped — pretend success so bots learn nothing.
      return { ok: true };
    }

    const businessName = payload.businessName?.trim();
    const contactName = payload.contactName?.trim();
    const phone = payload.phone?.trim() || null;
    const email = payload.email?.trim() || null;

    if (!businessName) throw new BadRequestException('שם העסק חסר');
    if (!contactName) throw new BadRequestException('שם איש הקשר חסר');
    if (!phone && !email) {
      throw new BadRequestException('נדרש טלפון או אימייל אחד לפחות');
    }
    if (!Array.isArray(payload.sections)) {
      throw new BadRequestException('מבנה התשובות שגוי');
    }

    const sections = this.sanitizeSections(payload.sections);
    this.validateImages(files.images);
    if (files.logo) this.validateLogo(files.logo);

    const platformBusinessId = await this.resolvePlatformBusinessId();

    // Find-or-create the customer. If they're already registered (by phone or
    // email), reuse that row and only fill in blanks — never a second record.
    let customer = await this.customers.findByPhoneOrEmail(
      platformBusinessId,
      phone,
      email,
    );
    if (customer) {
      await this.customers.update(platformBusinessId, customer.id, {
        businessName: customer.businessName || businessName,
        phone: customer.phone || phone || undefined,
        email: customer.email || email || undefined,
      });
    } else {
      customer = await this.customers.create(platformBusinessId, {
        name: contactName,
        businessName,
        phone: phone || undefined,
        email: email || undefined,
      });
    }

    const intake = this.intakes.create({
      businessId: platformBusinessId,
      customerId: customer.id,
      contactName,
      businessName,
      phone,
      email,
      sections,
      logo: null,
      images: [],
      // Unguessable token that authenticates the client's public PDF download.
      publicToken: randomBytes(24).toString('hex'),
    });
    // Save first so we have a stable id to key the asset folder on.
    const saved = await this.intakes.save(intake);

    const folder = `_hidden/website-intakes/${saved.id}`;
    if (files.logo) {
      saved.logo = await this.storeAsset(
        platformBusinessId,
        folder,
        'logo',
        files.logo,
      );
    }
    saved.images = [];
    for (let i = 0; i < files.images.length; i++) {
      saved.images.push(
        await this.storeAsset(
          platformBusinessId,
          folder,
          `image-${i + 1}`,
          files.images[i],
        ),
      );
    }
    await this.intakes.save(saved);

    // Out-of-band operator notification — never blocks the submission.
    try {
      await this.operator.notify(platformBusinessId, {
        subject: `בריף אתר חדש — ${businessName}`,
        text: this.renderText(saved),
      });
    } catch (err) {
      this.log.warn(
        `Operator notify failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    return { ok: true, pdfToken: saved.publicToken };
  }

  /** Intakes for one customer, newest first. */
  listForCustomer(
    businessId: string,
    customerId: string,
  ): Promise<WebsiteIntake[]> {
    return this.intakes.find({
      where: { businessId, customerId },
      order: { createdAt: 'DESC' },
    });
  }

  async findByIdScoped(businessId: string, id: string): Promise<WebsiteIntake> {
    const intake = await this.intakes.findOne({ where: { id, businessId } });
    if (!intake) throw new NotFoundException('Intake not found');
    return intake;
  }

  /** Looks an intake up by its unguessable public token (the client PDF link). */
  async findByPublicToken(token: string): Promise<WebsiteIntake> {
    const intake = await this.intakes.findOne({
      where: { publicToken: token },
    });
    if (!intake) throw new NotFoundException('Intake not found');
    return intake;
  }

  /**
   * Reads a stored asset off the filesystem and returns it as a base64 `data:`
   * URI, so it can be inlined into the PDF HTML (no network fetch, works for the
   * public token render too). Returns null if the file is missing.
   */
  async assetDataUri(
    businessId: string,
    asset: IntakeAsset | null,
  ): Promise<string | null> {
    if (!asset) return null;
    try {
      const buffer = await this.filesystem.readFile(businessId, asset.path);
      return `data:${asset.mime};base64,${buffer.toString('base64')}`;
    } catch {
      return null;
    }
  }

  /** Reads a stored asset (logo or one image) back for download. */
  async readAsset(
    businessId: string,
    id: string,
    kind: 'logo' | 'image',
    index: number,
  ): Promise<{ asset: IntakeAsset; buffer: Buffer }> {
    const intake = await this.findByIdScoped(businessId, id);
    const asset =
      kind === 'logo' ? intake.logo : (intake.images?.[index] ?? null);
    if (!asset) throw new NotFoundException('Asset not found');
    const buffer = await this.filesystem.readFile(businessId, asset.path);
    return { asset, buffer };
  }

  private async storeAsset(
    businessId: string,
    folder: string,
    baseName: string,
    file: UploadedAsset,
  ): Promise<IntakeAsset> {
    const ext = this.extensionFor(file.originalName, file.mimeType);
    const path = `${folder}/${baseName}${ext ? `.${ext}` : ''}`;
    await this.filesystem.writeFile(businessId, path, file.buffer);
    return {
      name: file.originalName,
      path,
      mime: file.mimeType,
      size: file.size,
    };
  }

  private extensionFor(originalName: string, mime: string): string {
    const fromName = originalName.includes('.')
      ? originalName.split('.').pop()!.toLowerCase()
      : '';
    if (fromName && /^[a-z0-9]{1,5}$/.test(fromName)) return fromName;
    const fromMime = mimeExtension(mime);
    return fromMime || 'bin';
  }

  private validateLogo(file: UploadedAsset): void {
    if (!ALLOWED_IMAGE_MIME.has(file.mimeType)) {
      throw new BadRequestException('הלוגו חייב להיות קובץ תמונה');
    }
  }

  private validateImages(images: UploadedAsset[]): void {
    if (images.length > MAX_IMAGES) {
      throw new BadRequestException(`אפשר להעלות עד ${MAX_IMAGES} תמונות`);
    }
    for (const img of images) {
      if (!ALLOWED_IMAGE_MIME.has(img.mimeType)) {
        throw new BadRequestException('כל הקבצים חייבים להיות תמונות');
      }
    }
  }

  /** Keeps only well-formed items and clamps lengths — the payload is public. */
  private sanitizeSections(
    sections: SubmitWebsiteIntakePayload['sections'],
  ): IntakeSection[] {
    return sections
      .filter((s) => s && typeof s.title === 'string' && Array.isArray(s.items))
      .slice(0, 40)
      .map((s) => ({
        title: String(s.title).slice(0, 200),
        items: s.items
          .filter(
            (it) =>
              it &&
              typeof it.label === 'string' &&
              String(it.value ?? '').trim() !== '',
          )
          .slice(0, 60)
          .map((it) => ({
            id: it.id ? String(it.id).slice(0, 80) : undefined,
            label: String(it.label).slice(0, 300),
            value: String(it.value).slice(0, 4000),
          })),
      }))
      .filter((s) => s.items.length > 0);
  }

  /** Human-readable Hebrew summary for the operator email / WhatsApp. */
  private renderText(intake: WebsiteIntake): string {
    const head = [
      'התקבל בריף אתר חדש',
      '',
      `עסק: ${intake.businessName ?? '—'}`,
      `איש קשר: ${intake.contactName}`,
      `טלפון: ${intake.phone ?? '—'}`,
      `אימייל: ${intake.email ?? '—'}`,
      `לוגו: ${intake.logo ? 'הועלה' : '—'}`,
      `תמונות: ${intake.images?.length ?? 0}`,
    ];
    const body = intake.sections.flatMap((section) => {
      const items = section.items.map((it) => `• ${it.label}: ${it.value}`);
      if (items.length === 0) return [];
      return ['', `— ${section.title} —`, ...items];
    });
    return [...head, '', '════════════════', ...body].join('\n');
  }

  /**
   * Leads/customers require a businessId, but a public intake is tenant-less.
   * We attach it to the operator's own "platform" business:
   * `PLATFORM_BUSINESS_ID` if set, else the earliest business owned by a
   * super-admin, else the earliest business overall. Cached after first hit.
   * (Same resolution as QuestionnaireService.)
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
      'No business exists to attach the website intake to',
    );
  }
}
