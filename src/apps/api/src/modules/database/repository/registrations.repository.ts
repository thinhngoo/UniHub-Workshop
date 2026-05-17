import { Injectable } from '@nestjs/common';
import { Prisma, type Registration as DbRegistration } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import type { Registration as DomainRegistration } from '@unihub/types';
import { RESERVATION_HOLD_MINUTES } from '../../../constant';
import { PrismaService } from '../prisma.service';

type RegisterSeatFailure =
  | 'workshop_not_found'
  | 'workshop_not_open'
  | 'already_registered'
  | 'no_seats'
  | 'idempotency_required'
  | 'workshop_missing_price'
  | 'idempotency_conflict';

type RegisterSeatResult =
  | {
      ok: true;
      registration: DomainRegistration;
      paymentIntentId: string | null;
    }
  | { ok: false; error: RegisterSeatFailure };

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

function isUniqueOnIdempotencyKey(
  e: Prisma.PrismaClientKnownRequestError,
): boolean {
  const t = e.meta?.target as string | string[] | undefined;
  if (Array.isArray(t)) {
    return t.some(
      (x) => typeof x === 'string' && x.toLowerCase().includes('idempotency'),
    );
  }
  return typeof t === 'string' && t.toLowerCase().includes('idempotency');
}

@Injectable()
export class RegistrationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  toDomain(row: DbRegistration): DomainRegistration {
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
   * decrement seats_left (conditional), insert registration; for paid workshops,
   * insert pending payment (idempotency_key unique).
   */
  async registerWithSeatTransaction(
    userId: string,
    workshopId: string,
    opts?: { idempotencyKey?: string },
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

        const isPaid = workshop.isPaid;
        if (isPaid) {
          const key = opts?.idempotencyKey?.trim();
          if (!key) {
            return {
              kind: 'fail' as const,
              error: 'idempotency_required' as const,
            };
          }
          if (workshop.price == null) {
            return {
              kind: 'fail' as const,
              error: 'workshop_missing_price' as const,
            };
          }
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
        const row = await tx.registration.create({
          data: {
            userId,
            workshopId,
            status: isPaid ? 'reserved' : 'confirmed',
            reservedAt: now,
            expiresAt: isPaid
              ? addMinutes(now, RESERVATION_HOLD_MINUTES)
              : null,
            confirmedAt: isPaid ? null : now,
            qrToken: isPaid
              ? null
              : `qrtok_${randomUUID().replace(/-/g, '').slice(0, 16)}`,
          },
        });

        let paymentIntentId: string | null = null;
        if (isPaid) {
          const pay = await tx.payment.create({
            data: {
              registrationId: row.id,
              idempotencyKey: opts!.idempotencyKey!.trim(),
              amount: workshop.price!,
              status: 'pending',
              attemptCount: 0,
            },
          });
          paymentIntentId = pay.id;
        }

        return { kind: 'ok' as const, row, paymentIntentId };
      });

      if (outcome.kind === 'fail') {
        return { ok: false, error: outcome.error };
      }
      return {
        ok: true,
        registration: this.toDomain(outcome.row),
        paymentIntentId: outcome.paymentIntentId,
      };
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        if (isUniqueOnIdempotencyKey(e)) {
          return { ok: false, error: 'idempotency_conflict' };
        }
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

  async releaseSeatHoldIfStillReserved(
    registrationId: string,
  ): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.registration.updateMany({
        where: {
          id: registrationId,
          status: 'reserved',
        },
        data: {
          status: 'expired',
          expiresAt: null,
        },
      });
      if (updated.count !== 1) return false;

      const reg = await tx.registration.findUnique({
        where: { id: registrationId },
        select: { workshopId: true },
      });
      if (!reg) return false;

      await tx.workshop.update({
        where: { id: reg.workshopId },
        data: { seatsLeft: { increment: 1 } },
      });

      await tx.payment.updateMany({
        where: {
          registrationId,
          status: 'pending',
        },
        data: {
          status: 'failed',
          lastError:
            'Hết thời gian giữ chỗ — đăng ký đã hết hạn; chỗ đã được giải phóng.',
        },
      });

      return true;
    });
  }
}
