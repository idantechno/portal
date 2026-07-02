import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import {
  AutomationAction,
  AutomationCondition,
  AutomationTrigger,
} from './automation.constants';

/**
 * A "when X happens, do Y" rule. Stored per-business. The trigger is an event
 * key (see AUTOMATION_TRIGGERS); conditions narrow it; actions are run in order
 * when the rule fires. This is the connective tissue of the Business OS.
 */
@Entity({ name: 'automation_rules' })
export class AutomationRule {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid', name: 'business_id' })
  businessId!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'boolean', default: true })
  enabled!: boolean;

  @Index()
  @Column({ type: 'varchar', length: 64 })
  trigger!: AutomationTrigger;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  conditions!: AutomationCondition[];

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  actions!: AutomationAction[];

  @Column({ type: 'uuid', name: 'created_by_user_id', nullable: true })
  createdByUserId!: string | null;

  @Column({ type: 'timestamptz', name: 'last_run_at', nullable: true })
  lastRunAt!: Date | null;

  @Column({ type: 'int', name: 'run_count', default: 0 })
  runCount!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
