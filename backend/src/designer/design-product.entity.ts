import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type DesignKind =
  | 'menu'
  | 'poster'
  | 'invitation'
  | 'pricelist'
  | 'flyer'
  | 'other';

/**
 * A simple print product the designer agent produced (menu, poster, etc.).
 * `html` is the model-authored, self-contained document; the PDF is rendered
 * on demand through the hardened renderer. A markdown note is also mirrored to
 * the business root so other agents can read what was created as context.
 */
@Entity({ name: 'design_products' })
export class DesignProduct {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid', name: 'business_id' })
  businessId!: string;

  @Column({ type: 'varchar', length: 32 })
  kind!: DesignKind;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'text' })
  html!: string;

  /** Plain-text description of the actual content (e.g. menu items + prices). */
  @Column({ type: 'text', name: 'content_summary', nullable: true })
  contentSummary!: string | null;

  @Column({
    type: 'varchar',
    length: 16,
    name: 'primary_color',
    nullable: true,
  })
  primaryColor!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
