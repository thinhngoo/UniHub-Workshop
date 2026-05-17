import { Injectable } from '@nestjs/common';
import type { StudentSyncIssue, User as DomainUser } from '@unihub/types';
import type { RoleCode, User as DbUser, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma.service';

export interface SyncedStudentUser {
  id: string;
  studentCode: string | null;
  email: string;
  password: string;
  fullName: string;
  role: RoleCode;
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
}

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

  /** Not using a transaction to avoid a failure in one row causing all to fail. */
  async upsertSyncedStudentsReport(
    rows: SyncedStudentUser[],
  ): Promise<{ imported: number; issues: StudentSyncIssue[] }> {
    const issues: StudentSyncIssue[] = [];
    let imported = 0;

    for (const row of rows) {
      const existing = await this.prisma.user.findUnique({
        where: { id: row.id },
      });
      if (existing && existing.role !== 'student') {
        issues.push({
          line: null,
          code: 'role_conflict',
          message: `Id ${row.id} thuộc tài khoản ${existing.role}, không ghi đè.`,
        });
        continue;
      }

      const emailClash = await this.prisma.user.findFirst({
        where: {
          email: { equals: row.email, mode: 'insensitive' },
          NOT: { id: row.id },
        },
      });
      if (emailClash) {
        issues.push({
          line: null,
          code: 'email_exists_db',
          message: `Email "${row.email}" đã gắn người dùng khác (id ${emailClash.id}) — bỏ qua id ${row.id}.`,
        });
        continue;
      }

      if (row.studentCode) {
        const codeClash = await this.prisma.user.findFirst({
          where: {
            studentCode: row.studentCode,
            NOT: { id: row.id },
          },
        });
        if (codeClash) {
          issues.push({
            line: null,
            code: 'student_code_exists_db',
            message: `Mã SV "${row.studentCode}" đã gắn người dùng khác (id ${codeClash.id}) — bỏ qua id ${row.id}.`,
          });
          continue;
        }
      }

      try {
        await this.prisma.user.upsert({
          where: { id: row.id },
          create: {
            id: row.id,
            studentCode: row.studentCode,
            email: row.email,
            password: row.password,
            fullName: row.fullName,
            role: row.role,
            status: row.status,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
          },
          update: {
            studentCode: row.studentCode,
            email: row.email,
            password: row.password,
            fullName: row.fullName,
            role: row.role,
            status: row.status,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
          },
        });
        imported += 1;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        issues.push({
          line: null,
          code: 'db_error',
          message: `Lỗi CSDL khi ghi id ${row.id}: ${message}`,
        });
      }
    }

    return { imported, issues };
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
