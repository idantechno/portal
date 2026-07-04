import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type FiledDocumentSource = 'upload' | 'agent';

/**
 * A document in the business's "documents drawer" — a simple foldered filing
 * area (ביטוח לאומי / חשבונות / מס הכנסה / ...). Deliberately SEPARATE from
 * context files (`context_files`): this is the owner's paperwork, not the
 * agent-readable context. Files live under `filing/<folder>/` in the business
 * workspace, addressed by `relativePath`.
 */
@Entity({ name: 'filed_documents' })
export class FiledDocument {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid', name: 'business_id' })
  businessId!: string;

  @Column({ type: 'varchar', length: 128 })
  folder!: string;

  /** Display name shown to the user (original upload name / produced-doc name). */
  @Column({ type: 'varchar', length: 255 })
  filename!: string;

  /** Path under the business workspace, e.g. `filing/מס הכנסה/<token>__name.pdf`. */
  @Column({ type: 'varchar', length: 512, name: 'relative_path' })
  relativePath!: string;

  @Column({ type: 'varchar', length: 128, name: 'mime_type' })
  mimeType!: string;

  @Column({ type: 'bigint' })
  size!: number;

  @Column({ type: 'varchar', length: 16, default: 'upload' })
  source!: FiledDocumentSource;

  @Column({ type: 'uuid', name: 'created_by_user_id', nullable: true })
  createdByUserId!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
