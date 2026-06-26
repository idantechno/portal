import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserRole } from '../common/enums/user-role.enum';
import { AccountStatus } from '../common/enums/account-status.enum';

@Entity({ name: 'users' })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255 })
  email!: string;

  @Column({ type: 'varchar', length: 255, name: 'password_hash' })
  passwordHash!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  // Stored as varchar (not a Postgres enum) so platform roles can evolve
  // without enum-alter migrations. The TS enum still gives us type safety.
  @Column({ type: 'varchar', length: 32, default: UserRole.Member })
  role!: UserRole;

  @Column({ type: 'varchar', length: 16, default: AccountStatus.Active })
  status!: AccountStatus;

  @Column({ type: 'uuid', name: 'default_business_id', nullable: true })
  defaultBusinessId!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
