import type { ISODateString, UUID } from './common.js';
import type { RegistrationStatus } from './registration.js';
import type { SummaryStatus, WorkshopStatus } from './workshop.js';

export interface StatusCount<T extends string> {
  status: T;
  count: number;
}

export interface AdminDashboardWorkshopRow {
  workshopId: UUID;
  title: string;
  speaker: string;
  startsAt: ISODateString;
  room: string;
  capacity: number;
  seatsLeft: number;
  fillRate: number;
  isPaid: boolean;
  price: number | null;
  status: WorkshopStatus;
}

export interface AdminDashboardRecentRegistration {
  id: UUID;
  status: RegistrationStatus;
  reservedAt: ISODateString;
  confirmedAt: ISODateString | null;
  userFullName: string;
  workshopTitle: string;
}

export interface StudentSyncIssue {
  line: number | null;
  code: string;
  message: string;
}

export interface StudentSyncReport {
  imported: number;
  skippedRows: number;
  duplicateIdsSuperseded: number;
  issues: StudentSyncIssue[];
}

export interface StudentSyncQueuedResponse {
  jobId: string;
}

export type StudentSyncJobState =
  | 'waiting'
  | 'active'
  | 'completed'
  | 'failed'
  | 'delayed'
  | 'paused'
  | 'unknown';

export interface StudentSyncJobStatusResponse {
  jobId: string;
  state: StudentSyncJobState;
  report?: StudentSyncReport;
  failedReason?: string;
}

export interface AdminDashboardSummary {
  generatedAt: ISODateString;

  workshops: {
    total: number;
    byStatus: StatusCount<WorkshopStatus>[];
    bySummaryStatus: StatusCount<SummaryStatus>[];
  };

  capacity: {
    totalCapacity: number;
    totalSeatsLeft: number;
    totalSeatsTaken: number;
    fillRate: number;
  };

  registrations: {
    total: number;
    byStatus: StatusCount<RegistrationStatus>[];
  };

  revenue: {
    confirmedRevenueVnd: number;
    paidWorkshopCount: number;
  };

  fillRateByWorkshop: AdminDashboardWorkshopRow[];

  upcomingWorkshops: AdminDashboardWorkshopRow[];

  recentRegistrations: AdminDashboardRecentRegistration[];
}
