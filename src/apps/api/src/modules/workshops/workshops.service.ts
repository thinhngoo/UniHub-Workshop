import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  CreateWorkshopRequest,
  PaginatedResponse,
  Workshop,
  WorkshopListQuery,
} from '@unihub/types';
import { WorkshopsRepository } from '../database/repository/workshops.repository';
import type { CreateWorkshopDto } from './dto/create-workshop.dto';
import type { UpdateWorkshopDto } from './dto/update-workshop.dto';

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

  assertValidSchedule(startsAtIso: string, endsAtIso: string): void {
    const startMs = Date.parse(startsAtIso);
    const endMs = Date.parse(endsAtIso);
    if (
      !Number.isFinite(startMs) ||
      !Number.isFinite(endMs) ||
      endMs <= startMs
    ) {
      throw new BadRequestException({
        code: 'invalid_schedule',
        message: 'Thời gian kết thúc phải sau thời gian bắt đầu.',
      });
    }
  }

  async createWorkshop(dto: CreateWorkshopDto): Promise<Workshop> {
    this.assertValidSchedule(dto.startsAt, dto.endsAt);
    if (dto.isPaid && (dto.price === undefined || dto.price === null)) {
      throw new BadRequestException({
        code: 'price_required',
        message: 'Workshop có phí cần có giá.',
      });
    }
    const body: CreateWorkshopRequest = {
      title: dto.title,
      speaker: dto.speaker,
      room: dto.room,
      roomMapUrl: dto.roomMapUrl,
      startsAt: dto.startsAt,
      endsAt: dto.endsAt,
      capacity: dto.capacity,
      isPaid: dto.isPaid,
      price: dto.price,
    };
    return this.workshopsRepo.create(body);
  }

  async updateWorkshop(id: string, dto: UpdateWorkshopDto): Promise<Workshop> {
    const current = await this.workshopsRepo.findById(id);
    if (!current) {
      throw new NotFoundException({
        code: 'not_found',
        message: 'Workshop không tồn tại.',
      });
    }

    const dtoRecord = dto as unknown as Record<string, unknown>;
    const mutableKeys = Object.keys(dtoRecord).filter(
      (k) => k !== 'version' && dtoRecord[k] !== undefined,
    );
    if (mutableKeys.length === 0) {
      throw new BadRequestException({
        code: 'no_changes',
        message: 'Không có trường nào được cập nhật.',
      });
    }

    const startsAt = dto.startsAt ?? current.startsAt;
    const endsAt = dto.endsAt ?? current.endsAt;
    this.assertValidSchedule(startsAt, endsAt);

    const nextIsPaid = dto.isPaid !== undefined ? dto.isPaid : current.isPaid;
    const effectivePrice = dto.price !== undefined ? dto.price : current.price;
    if (
      nextIsPaid &&
      (effectivePrice === null || effectivePrice === undefined)
    ) {
      throw new BadRequestException({
        code: 'price_required',
        message: 'Workshop có phí cần có giá.',
      });
    }

    const occupied = current.capacity - current.seatsLeft;
    if (dto.capacity !== undefined && dto.capacity < occupied) {
      throw new BadRequestException({
        code: 'capacity_too_low',
        message:
          'Sức chứa mới không được nhỏ hơn số chỗ đã được giữ / đăng ký.',
      });
    }

    const data: Prisma.WorkshopUpdateManyMutationInput = {};

    if (dto.title !== undefined) data.title = dto.title.trim();
    if (dto.speaker !== undefined) data.speaker = dto.speaker.trim();
    if (dto.room !== undefined) data.room = dto.room.trim();
    if (dto.roomMapUrl !== undefined) {
      data.roomMapUrl =
        dto.roomMapUrl === null || dto.roomMapUrl.trim() === ''
          ? null
          : dto.roomMapUrl.trim();
    }
    if (dto.startsAt !== undefined) data.startsAt = new Date(dto.startsAt);
    if (dto.endsAt !== undefined) data.endsAt = new Date(dto.endsAt);
    if (dto.capacity !== undefined) {
      data.capacity = dto.capacity;
      data.seatsLeft = dto.capacity - occupied;
    }
    if (dto.isPaid !== undefined) data.isPaid = dto.isPaid;

    if (!nextIsPaid) {
      data.price = null;
    } else if (dto.price !== undefined) {
      data.price = new Prisma.Decimal(dto.price);
    }

    if (dto.status !== undefined) data.status = dto.status;
    if (dto.summary !== undefined) {
      const cleared = dto.summary === null || dto.summary.trim() === '';
      data.summary = cleared ? null : dto.summary.trim();
      data.summaryStatus = cleared ? 'none' : 'ready';
    } else if (dto.summaryStatus !== undefined) {
      data.summaryStatus = dto.summaryStatus;
    }

    const updated = await this.workshopsRepo.updateWithOptimisticLock(
      id,
      dto.version,
      data,
    );
    if (!updated) {
      throw new ConflictException({
        code: 'version_conflict',
        message:
          'Workshop đã được chỉnh sửa từ phiên khác. Vui lòng tải lại và thử lại.',
      });
    }
    return updated;
  }

  async deleteWorkshop(id: string): Promise<void> {
    const ok = await this.workshopsRepo.deleteById(id);
    if (!ok) {
      throw new NotFoundException({
        code: 'not_found',
        message: 'Workshop không tồn tại.',
      });
    }
  }
}
