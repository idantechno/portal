import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/** One uploaded asset (logo or product image) stored under the platform
 *  business workspace. `path` is a business-relative path resolved through
 *  FilesystemService — never an absolute path. */
export interface IntakeAsset {
  /** Original filename as the client uploaded it (UTF-8 decoded). */
  name: string;
  /** Business-relative storage path, e.g. `_hidden/website-intakes/<id>/logo.png`. */
  path: string;
  mime: string;
  size: number;
}

/** A group of answers, mirroring one wizard step (same shape as the marketing
 *  questionnaire's `sections`, so the same renderer works for both). */
export interface IntakeSection {
  title: string;
  items: { id?: string; label: string; value: string }[];
}

/**
 * A website-intake ("brief") a client fills through the public `/website-brief`
 * form so the operator has everything needed to build their site: business
 * details, prices, products, location, plus a logo and product images.
 *
 * Unlike the marketing questionnaire (which becomes a *lead*), an intake is
 * attached to a `Customer` — the client is someone the studio already builds
 * for. The submission finds-or-creates that customer under the operator's
 * platform business (deduped by phone/email) so nobody is registered twice.
 */
@Entity({ name: 'website_intakes' })
export class WebsiteIntake {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** The operator's platform business the intake is filed under. */
  @Index()
  @Column({ type: 'uuid', name: 'business_id' })
  businessId!: string;

  /** The customer this intake belongs to (found-or-created on submit). */
  @Index()
  @Column({ type: 'uuid', name: 'customer_id' })
  customerId!: string;

  @Column({ type: 'varchar', length: 255, name: 'contact_name' })
  contactName!: string;

  @Column({
    type: 'varchar',
    length: 255,
    name: 'business_name',
    nullable: true,
  })
  businessName!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  phone!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email!: string | null;

  /** Self-describing answer sections, rendered without duplicating the schema. */
  @Column({ type: 'jsonb', default: () => "'[]'" })
  sections!: IntakeSection[];

  /** The uploaded logo, if any. */
  @Column({ type: 'jsonb', nullable: true })
  logo!: IntakeAsset | null;

  /** Up to 5 product/business images. */
  @Column({ type: 'jsonb', default: () => "'[]'" })
  images!: IntakeAsset[];

  /**
   * Unguessable token that authenticates the client's public PDF download — the
   * "הורד PDF" button on the success screen. The token IS the auth (no JWT), so
   * the business owner who filled the form can grab their brief without a login.
   */
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64, name: 'public_token' })
  publicToken!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
