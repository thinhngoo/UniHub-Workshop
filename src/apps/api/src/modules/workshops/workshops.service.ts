import { Injectable } from '@nestjs/common';
import type {
  PaginatedResponse,
  Workshop,
  WorkshopListQuery,
} from '@unihub/types';
import { WorkshopsRepository } from '../database/workshops.repository';

@Injectable()
export class WorkshopsService {
  constructor(private readonly workshopsRepo: WorkshopsRepository) {}

  async findAll(
    params: WorkshopListQuery,
  ): Promise<PaginatedResponse<Workshop>> {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
    const { items, total } = await this.workshopsRepo.findMany(params);

    return { items, total, page, pageSize };
  }

  async findById(id: string): Promise<Workshop | undefined> {
    const row = await this.workshopsRepo.findById(id);
    return row ?? undefined;
  }

  async listAllRaw(): Promise<Workshop[]> {
    return this.workshopsRepo.listAllOrdered();
  }

  async tryReserveSeat(workshopId: string): Promise<boolean> {
    return this.workshopsRepo.tryDecrementSeats(workshopId);
  }
}
