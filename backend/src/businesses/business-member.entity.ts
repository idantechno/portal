import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { BusinessRole } from '../common/enums/business-role.enum';

@Entity({ name: 'business_members' })
@Index('uq_business_member', ['businessId', 'userId'], { unique: true })
export class BusinessMember {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid', name: 'business_id' })
  businessId!: string;

  @Index()
  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @Column({ type: 'varchar', length: 16, default: BusinessRole.Agent })
  role!: BusinessRole;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
