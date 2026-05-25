import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ name: 'context_files' })
@Index('uq_context_file_path', ['businessId', 'relativePath'], { unique: true })
export class ContextFile {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid', name: 'business_id' })
  businessId!: string;

  @Column({ type: 'varchar', length: 512, name: 'relative_path' })
  relativePath!: string;

  @Column({ type: 'varchar', length: 128, name: 'mime_type' })
  mimeType!: string;

  @Column({ type: 'bigint' })
  size!: string;

  @Column({ type: 'boolean', name: 'hidden_for_business', default: false })
  hiddenForBusiness!: boolean;

  @Column({ type: 'uuid', name: 'uploaded_by_user_id' })
  uploadedByUserId!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
