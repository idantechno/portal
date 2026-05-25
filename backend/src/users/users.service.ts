import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import { UserRole } from '../common/enums/user-role.enum';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  findById(id: string): Promise<User | null> {
    return this.users.findOne({ where: { id } });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.users.findOne({ where: { email: email.toLowerCase() } });
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
      role: input.role ?? UserRole.BusinessOwner,
    });
    return this.users.save(user);
  }

  setDefaultBusiness(userId: string, businessId: string | null): Promise<void> {
    return this.users
      .update({ id: userId }, { defaultBusinessId: businessId })
      .then(() => undefined);
  }
}
