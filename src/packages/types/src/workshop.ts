import type { ISODateString, UUID } from './common.js';

export type WorkshopStatus = 'draft' | 'published' | 'cancelled';
export type SummaryStatus = 'none' | 'pending' | 'ready' | 'failed';

export interface Workshop {
  id: UUID;
  title: string;
  speaker: string;
  room: string;
  roomMapUrl: string | null;
  startsAt: ISODateString;
  endsAt: ISODateString;
  capacity: number;
  seatsLeft: number;
  isPaid: boolean;
  price: number | null;
  status: WorkshopStatus;
  summary: string | null;
  summaryStatus: SummaryStatus;
  version: number;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface WorkshopListQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: WorkshopStatus;
  isPaid?: boolean;
  startsAfter?: ISODateString;
  startsBefore?: ISODateString;
}

export interface CreateWorkshopRequest {
  title: string;
  speaker: string;
  room: string;
  roomMapUrl?: string;
  startsAt: ISODateString;
  endsAt: ISODateString;
  capacity: number;
  isPaid: boolean;
  price?: number;
}

export interface UpdateWorkshopRequest extends Partial<CreateWorkshopRequest> {
  version: number;
  status?: WorkshopStatus;
  summary?: string | null;
  summaryStatus?: SummaryStatus;
}
