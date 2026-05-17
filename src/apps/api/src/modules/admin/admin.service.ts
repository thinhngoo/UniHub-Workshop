import { Injectable } from '@nestjs/common';
import type {
  AdminDashboardRecentRegistration,
  AdminDashboardSummary,
  AdminDashboardWorkshopRow,
  RegistrationStatus,
  SummaryStatus,
  Workshop,
} from '@unihub/types';
import { WORKSHOP_STATUSES } from '../../constant';
import { UsersRepository } from '../database/repository/users.repository';
import { RegistrationsService } from '../registrations/registrations.service';
import { WorkshopsService } from '../workshops/workshops.service';

const SUMMARY_STATUSES: SummaryStatus[] = [
  'none',
  'pending',
  'ready',
  'failed',
];
const REGISTRATION_STATUSES: RegistrationStatus[] = [
  'reserved',
  'confirmed',
  'expired',
  'cancelled',
];

const UPCOMING_DAYS = 14;
const UPCOMING_LIMIT = 6;
const RECENT_LIMIT = 8;

@Injectable()
export class AdminService {
  constructor(
    private readonly users: UsersRepository,
    private readonly workshops: WorkshopsService,
    private readonly registrations: RegistrationsService,
  ) {}

  async getDashboard(): Promise<AdminDashboardSummary> {
    const allWorkshops = await this.workshops.listAllRaw();
    const allRegistrations = await this.registrations.listAll();
    const nowIso = new Date().toISOString();
    const userLookup = await this.users.lookupFullNamesByIds(
      allRegistrations.map((r) => r.userId),
    );
    const nowMs = Date.now();

    const workshopsByStatus = countBy(
      WORKSHOP_STATUSES,
      allWorkshops,
      (w) => w.status,
    );
    const workshopsBySummary = countBy(
      SUMMARY_STATUSES,
      allWorkshops,
      (w) => w.summaryStatus,
    );

    // Capacity & seats — restrict to published workshops (drafts/cancelled
    // shouldn't pollute fill-rate KPIs).
    const publishedWorkshops = allWorkshops.filter(
      (w) => w.status === 'published',
    );
    const totalCapacity = sum(publishedWorkshops.map((w) => w.capacity));
    const totalSeatsLeft = sum(publishedWorkshops.map((w) => w.seatsLeft));
    const totalSeatsTaken = totalCapacity - totalSeatsLeft;
    const fillRate = totalCapacity === 0 ? 0 : totalSeatsTaken / totalCapacity;

    const registrationsByStatus = countBy(
      REGISTRATION_STATUSES,
      allRegistrations,
      (r) => r.status,
    );

    // Revenue: every confirmed registration on a paid workshop yields its price.
    const confirmedRevenueVnd = allRegistrations
      .filter((r) => r.status === 'confirmed' && r.workshop?.isPaid)
      .reduce((acc, r) => acc + (r.workshop?.price ?? 0), 0);

    const paidWorkshopCount = allWorkshops.filter((w) => w.isPaid).length;

    const fillRateByWorkshop = publishedWorkshops
      .map(toWorkshopRow)
      .sort((a, b) => b.fillRate - a.fillRate);

    const upcomingCutoffMs = nowMs + UPCOMING_DAYS * 24 * 3_600_000;
    const upcomingWorkshops = publishedWorkshops
      .filter((w) => {
        const startMs = Date.parse(w.startsAt);
        return startMs >= nowMs && startMs <= upcomingCutoffMs;
      })
      .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))
      .slice(0, UPCOMING_LIMIT)
      .map(toWorkshopRow);

    const recentRegistrations: AdminDashboardRecentRegistration[] = [
      ...allRegistrations,
    ]
      .sort((a, b) => (a.reservedAt < b.reservedAt ? 1 : -1))
      .slice(0, RECENT_LIMIT)
      .map((r) => ({
        id: r.id,
        status: r.status,
        reservedAt: r.reservedAt,
        confirmedAt: r.confirmedAt,
        userFullName: userLookup[r.userId] ?? r.userId,
        workshopTitle: r.workshop?.title ?? '—',
      }));

    return {
      generatedAt: nowIso,
      workshops: {
        total: allWorkshops.length,
        byStatus: workshopsByStatus,
        bySummaryStatus: workshopsBySummary,
      },
      capacity: {
        totalCapacity,
        totalSeatsLeft,
        totalSeatsTaken,
        fillRate,
      },
      registrations: {
        total: allRegistrations.length,
        byStatus: registrationsByStatus,
      },
      revenue: {
        confirmedRevenueVnd,
        paidWorkshopCount,
      },
      fillRateByWorkshop,
      upcomingWorkshops,
      recentRegistrations,
    };
  }
}

function toWorkshopRow(w: Workshop): AdminDashboardWorkshopRow {
  const taken = w.capacity - w.seatsLeft;
  const fillRate = w.capacity === 0 ? 0 : taken / w.capacity;
  return {
    workshopId: w.id,
    title: w.title,
    speaker: w.speaker,
    startsAt: w.startsAt,
    room: w.room,
    capacity: w.capacity,
    seatsLeft: w.seatsLeft,
    fillRate,
    isPaid: w.isPaid,
    price: w.price,
    status: w.status,
  };
}

function countBy<T extends string, U>(
  keys: readonly T[],
  items: readonly U[],
  pick: (item: U) => T,
): { status: T; count: number }[] {
  const counts = new Map<T, number>();
  for (const key of keys) counts.set(key, 0);
  for (const item of items) {
    const key = pick(item);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return keys.map((status) => ({ status, count: counts.get(status) ?? 0 }));
}

function sum(values: number[]): number {
  return values.reduce((acc, v) => acc + v, 0);
}
