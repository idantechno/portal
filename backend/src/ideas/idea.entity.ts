import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { IdeaStatus } from '../common/enums/idea-status.enum';

/**
 * One row per idea the business owner has thrown at the ideas agent. The agent
 * captures raw thoughts, polishes them (`summary`), and develops them into a
 * concrete direction (`body`). Rows are also mirrored to a markdown file under
 * the business root so other agents can read them as business context.
 */
@Entity({ name: 'ideas' })
export class Idea {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid', name: 'business_id' })
  businessId!: string;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  /** Short, polished restatement of the raw idea — the "so we remember it well". */
  @Column({ type: 'text', nullable: true })
  summary!: string | null;

  /** The developed content: directions, next steps, a first move (markdown). */
  @Column({ type: 'text', default: '' })
  body!: string;

  @Index()
  @Column({ type: 'enum', enum: IdeaStatus, default: IdeaStatus.Seed })
  status!: IdeaStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
