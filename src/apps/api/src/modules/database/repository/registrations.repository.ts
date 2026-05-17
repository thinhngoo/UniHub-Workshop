import { Injectable } from '@nestjs/common';
import { Prisma, type Registration as DbRegistration } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import type { Registration as DomainRegistration } from '@unihub/types';
import { PrismaService } from '../prisma.service';

type RegisterSeatFailure =
  | 'workshop_not_found'
  | 'workshop_not_open'
  | 'already_registered'
  | 'no_seats';

type RegisterSeatResult =
  | { ok: true; registration: DomainRegistration }
  | { ok: false; error: RegisterSeatFailure };

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

@Injectable()
export class RegistrationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toDomain(row: DbRegistration): DomainRegistration {
    return {
      id: row.id,
      userId: row.userId,
      workshopId: row.workshopId,
      status: row.status,
      reservedAt: row.reservedAt.toISOString(),
      expiresAt: row.expiresAt?.toISOString() ?? null,
      confirmedAt: row.confirmedAt?.toISOString() ?? null,
      qrToken: row.qrToken,
    };
  }

  /**
   * Single transaction: validate workshop, reject duplicate active registration,
   * decrement seats_left (conditional), insert registration.
   */
  async registerWithSeatTransaction(
    userId: string,
    workshopId: string,
  ): Promise<RegisterSeatResult> {
    try {
      const outcome = await this.prisma.$transaction(async (tx) => {
        const workshop = await tx.workshop.findUnique({
          where: { id: workshopId },
        });
        if (!workshop) {
          return {
            kind: 'fail' as const,
            error: 'workshop_not_found' as const,
          };
        }
        if (workshop.status !== 'published') {
          return { kind: 'fail' as const, error: 'workshop_not_open' as const };
        }

        const dup = await tx.registration.findFirst({
          where: {
            userId,
            workshopId,
            status: { in: ['reserved', 'confirmed'] },
          },
        });
        if (dup) {
          return {
            kind: 'fail' as const,
            error: 'already_registered' as const,
          };
        }

        const dec = await tx.workshop.updateMany({
          where: { id: workshopId, seatsLeft: { gt: 0 } },
          data: { seatsLeft: { decrement: 1 } },
        });
        if (dec.count !== 1) {
          return { kind: 'fail' as const, error: 'no_seats' as const };
        }

        const now = new Date();
        const isPaid = workshop.isPaid;
        const row = await tx.registration.create({
          data: {
            userId,
            workshopId,
            status: isPaid ? 'reserved' : 'confirmed',
            reservedAt: now,
            expiresAt: isPaid ? addMinutes(now, 15) : null,
            confirmedAt: isPaid ? null : now,
            qrToken: isPaid
              ? null
              : `qrtok_${randomUUID().replace(/-/g, '').slice(0, 16)}`,
          },
        });
        return { kind: 'ok' as const, row };
      });

      if (outcome.kind === 'fail') {
        return { ok: false, error: outcome.error };
      }
      return { ok: true, registration: this.toDomain(outcome.row) };
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        return { ok: false, error: 'already_registered' };
      }
      throw e;
    }
  }

  async findByUserId(userId: string): Promise<DomainRegistration[]> {
    const rows = await this.prisma.registration.findMany({
      where: { userId },
      orderBy: { reservedAt: 'desc' },
    });
    return rows.map((r) => this.toDomain(r));
  }

  async findByWorkshopId(workshopId: string): Promise<DomainRegistration[]> {
    const rows = await this.prisma.registration.findMany({
      where: { workshopId },
      orderBy: { reservedAt: 'desc' },
    });
    return rows.map((r) => this.toDomain(r));
  }

  async findAll(): Promise<DomainRegistration[]> {
    const rows = await this.prisma.registration.findMany({
      orderBy: { reservedAt: 'desc' },
    });
    return rows.map((r) => this.toDomain(r));
  }

  async findByQrToken(qrToken: string): Promise<DomainRegistration | null> {
    const row = await this.prisma.registration.findFirst({
      where: { qrToken },
    });
    return row ? this.toDomain(row) : null;
  }

  async findById(id: string): Promise<DomainRegistration | null> {
    const row = await this.prisma.registration.findUnique({ where: { id } });
    return row ? this.toDomain(row) : null;
  }
}
