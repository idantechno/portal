import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { customAlphabet } from 'nanoid';
import { Business } from './business.entity';
import { BusinessMember } from './business-member.entity';
import { BusinessRole } from '../common/enums/business-role.enum';
import { UserRole } from '../common/enums/user-role.enum';
import { UsersService } from '../users/users.service';
import { CreateBusinessDto } from './dto/create-business.dto';
import { UpdateBusinessDto } from './dto/update-business.dto';
import { AddMemberDto } from './dto/add-member.dto';

const PUBLIC_KEY_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const generatePublicKey = customAlphabet(PUBLIC_KEY_ALPHABET, 24);
const BCRYPT_ROUNDS = 12;

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function toSlug(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

@Injectable()
export class BusinessesService {
  constructor(
    @InjectRepository(Business)
    private readonly businesses: Repository<Business>,
    @InjectRepository(BusinessMember)
    private readonly members: Repository<BusinessMember>,
    private readonly users: UsersService,
    private readonly dataSource: DataSource,
  ) {}

  async create(ownerUserId: string, dto: CreateBusinessDto): Promise<Business> {
    const desiredSlug = dto.slug ? dto.slug.toLowerCase() : toSlug(dto.name);
    if (!desiredSlug || !SLUG_RE.test(desiredSlug)) {
      throw new BadRequestException('Invalid slug');
    }
    const slug = await this.uniqueSlug(desiredSlug);

    return this.dataSource.transaction(async (m) => {
      const business = m.create(Business, {
        name: dto.name,
        slug,
        ownerUserId,
        publicKey: generatePublicKey(),
        publicKeyEnabled: true,
        systemPromptOverride: null,
      });
      await m.save(business);
      await m.save(
        m.create(BusinessMember, {
          businessId: business.id,
          userId: ownerUserId,
          role: BusinessRole.Owner,
        }),
      );
      return business;
    });
  }

  async update(businessId: string, dto: UpdateBusinessDto): Promise<Business> {
    const business = await this.businesses.findOne({
      where: { id: businessId },
    });
    if (!business) throw new NotFoundException('Business not found');

    if (dto.slug && dto.slug !== business.slug) {
      const desired = dto.slug.toLowerCase();
      if (!SLUG_RE.test(desired)) throw new BadRequestException('Invalid slug');
      const taken = await this.businesses.findOne({ where: { slug: desired } });
      if (taken && taken.id !== businessId) {
        throw new ConflictException('Slug already taken');
      }
      business.slug = desired;
    }
    if (dto.name !== undefined) business.name = dto.name;
    if (dto.systemPromptOverride !== undefined) {
      business.systemPromptOverride = dto.systemPromptOverride;
    }
    if (dto.publicKeyEnabled !== undefined) {
      business.publicKeyEnabled = dto.publicKeyEnabled;
    }
    if (dto.widgetAllowedOrigins !== undefined) {
      business.widgetAllowedOrigins = dto.widgetAllowedOrigins;
    }
    return this.businesses.save(business);
  }

  findById(businessId: string): Promise<Business | null> {
    return this.businesses.findOne({ where: { id: businessId } });
  }

  findByPublicKey(publicKey: string): Promise<Business | null> {
    return this.businesses.findOne({
      where: { publicKey, publicKeyEnabled: true },
    });
  }

  async listForUser(userId: string, userRole: UserRole): Promise<Business[]> {
    if (userRole === UserRole.GlobalAdmin) {
      return this.businesses.find({ order: { createdAt: 'DESC' } });
    }
    const memberships = await this.members.find({ where: { userId } });
    if (memberships.length === 0) return [];
    return this.businesses.find({
      where: { id: In(memberships.map((m) => m.businessId)) },
      order: { createdAt: 'DESC' },
    });
  }

  membership(
    businessId: string,
    userId: string,
  ): Promise<BusinessMember | null> {
    return this.members.findOne({ where: { businessId, userId } });
  }

  listMembers(businessId: string): Promise<BusinessMember[]> {
    return this.members.find({
      where: { businessId },
      order: { createdAt: 'ASC' },
    });
  }

  async addMember(
    businessId: string,
    dto: AddMemberDto,
  ): Promise<BusinessMember> {
    const business = await this.businesses.findOne({
      where: { id: businessId },
    });
    if (!business) throw new NotFoundException('Business not found');

    let user = await this.users.findByEmail(dto.email);
    if (!user) {
      const passwordHash = await bcrypt.hash(
        dto.temporaryPassword,
        BCRYPT_ROUNDS,
      );
      user = await this.users.create({
        email: dto.email,
        passwordHash,
        name: dto.name,
        role:
          dto.role === BusinessRole.Owner
            ? UserRole.BusinessOwner
            : UserRole.BusinessAgent,
      });
    }
    const existing = await this.members.findOne({
      where: { businessId, userId: user.id },
    });
    if (existing) throw new ConflictException('User is already a member');

    const member = this.members.create({
      businessId,
      userId: user.id,
      role: dto.role,
    });
    return this.members.save(member);
  }

  async removeMember(businessId: string, userId: string): Promise<void> {
    const business = await this.businesses.findOne({
      where: { id: businessId },
    });
    if (!business) throw new NotFoundException('Business not found');
    if (business.ownerUserId === userId) {
      throw new BadRequestException('Cannot remove the founding owner');
    }
    await this.members.delete({ businessId, userId });
  }

  private async uniqueSlug(base: string): Promise<string> {
    for (let i = 0; i < 50; i++) {
      const candidate = i === 0 ? base : `${base}-${i + 1}`;
      const taken = await this.businesses.findOne({
        where: { slug: candidate },
      });
      if (!taken) return candidate;
    }
    throw new ConflictException('Could not allocate a unique slug');
  }
}
