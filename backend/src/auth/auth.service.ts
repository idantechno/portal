import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { User } from '../users/user.entity';
import { AccountStatus } from '../common/enums/account-status.enum';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './auth.types';

const BCRYPT_ROUNDS = 12;

export interface AuthResult {
  accessToken: string;
  user: { id: string; email: string; name: string; role: string };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async signup(dto: SignupDto): Promise<AuthResult> {
    const existing = await this.users.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Email already registered');
    }
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = await this.users.create({
      email: dto.email,
      passwordHash,
      name: dto.name,
    });
    return this.toAuthResult(user);
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const user = await this.users.findByEmail(dto.email);
    if (!user) throw new UnauthorizedException('Invalid credentials');
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid credentials');
    if (user.status === AccountStatus.Suspended) {
      throw new ForbiddenException('Account suspended');
    }
    return this.toAuthResult(user);
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException('User not found');
    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) throw new BadRequestException('Current password is incorrect');
    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await this.users.updatePassword(userId, passwordHash);
  }

  private toAuthResult(user: User): AuthResult {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
    const expiresIn = this.config.get<string>(
      'JWT_EXPIRES_IN',
      '7d',
    ) as unknown as number;
    const accessToken = this.jwt.sign(payload, { expiresIn });
    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  }
}
