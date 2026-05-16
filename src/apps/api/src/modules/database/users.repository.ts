import { Injectable } from '@nestjs/common';
import type { User as DomainUser } from '@unihub/types';
import type { User as DbUser } from '@prisma/client';
import { PrismaService } from './prisma.service';

export interface UserWithPassword {
  user: DomainUser;
  password: string;
}

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findWithPasswordByEmail(
    normalizedEmail: string,
  ): Promise<UserWithPassword | null> {
    const row = await this.prisma.user.findFirst({
      where: {
        email: { equals: normalizedEmail, mode: 'insensitive' },
      },
    });
    if (!row) return null;
    return { password: row.password, user: this.toDomainUser(row) };
  }

  async findUserById(id: string): Promise<DomainUser | null> {
    const row = await this.prisma.user.findUnique({ where: { id } });
    return row ? this.toDomainUser(row) : null;
  }

  private toDomainUser(row: DbUser): DomainUser {
    return {
      id: row.id,
      studentCode: row.studentCode,
      email: row.email,
      fullName: row.fullName,
      status: row.status,
      role: row.role,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
