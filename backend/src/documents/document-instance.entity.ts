import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DocumentStatus } from '../common/enums/document-status.enum';
import { RecipientFields, TemplateSnapshot } from './documents.types';

/**
 * One row per document the agent has prepared. The template + brand snapshot
 * is frozen at creation time so later edits never change a document already
 * sent. For client_sign, the recipient_fields / signature / signed_at /
 * signed_pdf_path columns are populated when the public signing form is
 * submitted; for owner_send they stay null.
 */
@Entity({ name: 'document_instances' })
export class DocumentInstance {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid', name: 'business_id' })
  businessId!: string;

  @Index()
  @Column({ type: 'uuid', name: 'template_id' })
  templateId!: string;

  @Column({ type: 'jsonb', name: 'template_snapshot' })
  templateSnapshot!: TemplateSnapshot;

  @Column({ type: 'jsonb' })
  variables!: Record<string, unknown>;

  @Index()
  @Column({
    type: 'enum',
    enum: DocumentStatus,
    default: DocumentStatus.Draft,
  })
  status!: DocumentStatus;

  /** Unguessable URL slug for the public signing page. Null for owner_send. */
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64, name: 'public_token', nullable: true })
  publicToken!: string | null;

  @Column({ type: 'jsonb', name: 'recipient_fields', nullable: true })
  recipientFields!: RecipientFields | null;

  @Column({ type: 'text', name: 'signature_svg', nullable: true })
  signatureSvg!: string | null;

  @Column({ type: 'timestamptz', name: 'signed_at', nullable: true })
  signedAt!: Date | null;

  /** Path under BUSINESSES_DIR/<business_id>/documents/ — managed by FilesystemService. */
  @Column({ type: 'text', name: 'signed_pdf_path', nullable: true })
  signedPdfPath!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
