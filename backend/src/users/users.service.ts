import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, In, Repository } from 'typeorm';
import { User } from './user.entity';
import { UserRole } from '../common/enums/user-role.enum';
import { AccountStatus } from '../common/enums/account-status.enum';

@Injectable()
export class UsersService implements OnApplicationBootstrap {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly config: ConfigService,
  ) {}

  /**
   * Promote any user listed in SUPER_ADMIN_EMAILS (comma-separated) to super
   * admin on boot. This is how the first operator account is bootstrapped —
   * sign up normally, then add your email to the env var and restart.
   */
  async onApplicationBootstrap(): Promise<void> {
    const raw = this.config.get<string>('SUPER_ADMIN_EMAILS', '');
    const emails = raw
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    for (const email of emails) {
      const user = await this.findByEmail(email);
      if (user && user.role !== UserRole.SuperAdmin) {
        await this.users.update(
          { id: user.id },
          { role: UserRole.SuperAdmin, status: AccountStatus.Active },
        );
        this.logger.log(`Bootstrapped super admin: ${email}`);
      }
    }
  }

  findById(id: string): Promise<User | null> {
    return this.users.findOne({ where: { id } });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.users.findOne({ where: { email: email.toLowerCase() } });
  }

  findByIds(ids: string[]): Promise<User[]> {
    if (ids.length === 0) return Promise.resolve([]);
    return this.users.find({ where: { id: In(ids) } });
  }

  create(input: {
    email: string;
    passwordHash: string;
    name: string;
    role?: UserRole;
  }): Promise<User> {
    const user = this.users.create({
      email: input.email.toLowerCase(),
      passwordHash: input.passwordHash,
      name: input.name,
      role: input.role ?? UserRole.Member,
      status: AccountStatus.Active,
    });
    return this.users.save(user);
  }

  setDefaultBusiness(userId: string, businessId: string | null): Promise<void> {
    return this.users
      .update({ id: userId }, { defaultBusinessId: businessId })
      .then(() => undefined);
  }

  updatePassword(userId: string, passwordHash: string): Promise<void> {
    return this.users
      .update({ id: userId }, { passwordHash })
      .then(() => undefined);
  }

  delete(id: string): Promise<void> {
    return this.users.delete({ id }).then(() => undefined);
  }

  setRole(userId: string, role: UserRole): Promise<void> {
    return this.users.update({ id: userId }, { role }).then(() => undefined);
  }

  setStatus(userId: string, status: AccountStatus): Promise<void> {
    return this.users.update({ id: userId }, { status }).then(() => undefined);
  }

  /** Admin search across all users (by email or name). */
  search(query: string | undefined, limit = 100): Promise<User[]> {
    const take = Math.min(Math.max(limit, 1), 500);
    if (query && query.trim()) {
      const q = `%${query.trim()}%`;
      return this.users.find({
        where: [{ email: ILike(q) }, { name: ILike(q) }],
        order: { createdAt: 'DESC' },
        take,
      });
    }
    return this.users.find({ order: { createdAt: 'DESC' }, take });
  }

  count(): Promise<number> {
    return this.users.count();
  }

  countByStatus(status: AccountStatus): Promise<number> {
    return this.users.count({ where: { status } });
  }
}
