import { Injectable } from '@nestjs/common';
import type { Prisma, Workshop as DbWorkshop } from '@prisma/client';
import type {
  Workshop as DomainWorkshop,
  WorkshopListQuery,
} from '@unihub/types';
import { PrismaService } from '../prisma.service';

@Injectable()
export class WorkshopsRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toDomain(row: DbWorkshop): DomainWorkshop {
    return {
      id: row.id,
      title: row.title,
      speaker: row.speaker,
      room: row.room,
      roomMapUrl: row.roomMapUrl,
      startsAt: row.startsAt.toISOString(),
      endsAt: row.endsAt.toISOString(),
      capacity: row.capacity,
      seatsLeft: row.seatsLeft,
      isPaid: row.isPaid,
      price: row.price != null ? row.price.toNumber() : null,
      status: row.status,
      summary: row.summary,
      summaryStatus: row.summaryStatus,
      version: row.version,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async findById(id: string): Promise<DomainWorkshop | null> {
    const row = await this.prisma.workshop.findUnique({ where: { id } });
    return row ? this.toDomain(row) : null;
  }

  async findMany(
    query: WorkshopListQuery,
  ): Promise<{ items: DomainWorkshop[]; total: number }> {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));

    const where: Prisma.WorkshopWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.isPaid === true || query.isPaid === false) {
      where.isPaid = query.isPaid;
    }
    const search = query.search?.trim();
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { speaker: { contains: search, mode: 'insensitive' } },
      ];
    }
    const startsAtFilter: Prisma.DateTimeFilter = {};
    if (query.startsAfter) {
      startsAtFilter.gte = new Date(query.startsAfter);
    }
    if (query.startsBefore) {
      startsAtFilter.lte = new Date(query.startsBefore);
    }
    if (Object.keys(startsAtFilter).length > 0) {
      where.startsAt = startsAtFilter;
    }

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.workshop.count({ where }),
      this.prisma.workshop.findMany({
        where,
        orderBy: { startsAt: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      total,
      items: rows.map((r) => this.toDomain(r)),
    };
  }

  async listAllOrdered(): Promise<DomainWorkshop[]> {
    const rows = await this.prisma.workshop.findMany({
      orderBy: { startsAt: 'asc' },
    });
    return rows.map((r) => this.toDomain(r));
  }

  /**
   * Atomically decreases seats_left by 1 when the workshop still has capacity.
   * Use from registration reserve flows (single row UPDATE … WHERE seats_left > 0).
   */
  async tryDecrementSeats(workshopId: string): Promise<boolean> {
    const result = await this.prisma.workshop.updateMany({
      where: { id: workshopId, seatsLeft: { gt: 0 } },
      data: { seatsLeft: { decrement: 1 } },
    });
    return result.count === 1;
  }
}
