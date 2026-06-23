import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DeliveryMode } from '../common/enums/delivery-mode.enum';

/**
 * Global, idant-managed master template (work order, quote, contract).
 * The active row per `key` is what new instances render against; old
 * instances keep a snapshot of the row that existed when they were created.
 */
@Entity({ name: 'document_templates' })
export class DocumentTemplate {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64 })
  key!: string;

  @Column({ type: 'varchar', length: 255, name: 'name_he' })
  nameHe!: string;

  @Column({ type: 'int', default: 1 })
  version!: number;

  @Column({ type: 'enum', enum: DeliveryMode, name: 'delivery_mode' })
  deliveryMode!: DeliveryMode;

  @Column({ type: 'jsonb', name: 'variable_schema' })
  variableSchema!: Record<string, unknown>;

  @Column({ type: 'text', name: 'html_template' })
  htmlTemplate!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
