import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { CreateRegistrationResponse, Registration } from '@unihub/types';
import type { PaymentWithRegistration } from '../database/repository/payments.repository';
import { PaymentsRepository } from '../database/repository/payments.repository';
import { RegistrationsRepository } from '../database/repository/registrations.repository';
import { WorkshopsService } from '../workshops/workshops.service';

@Injectable()
export class RegistrationsService {
  constructor(
    private readonly registrationsRepo: RegistrationsRepository,
    private readonly workshops: WorkshopsService,
    private readonly paymentsRepo: PaymentsRepository,
  ) {}

  /** Ensures replay belongs to the same caller and intent (workshop scope). */
  private assertReplayScope(
    replay: PaymentWithRegistration,
    userId: string,
    workshopId: string,
  ): void {
    if (replay.registration.userId !== userId) {
      throw new ForbiddenException({
        code: 'idempotency_user_mismatch',
        message: 'Key thuộc phiên/người dùng khác.',
      });
    }
    if (replay.registration.workshopId !== workshopId) {
      throw new ConflictException({
        code: 'idempotency_scope_mismatch',
        message: 'Key đã gắn với yêu cầu đăng ký khác.',
      });
    }
  }

  private async replayFromStoredPayment(
    replay: PaymentWithRegistration,
    userId: string,
    workshopId: string,
  ): Promise<CreateRegistrationResponse> {
    this.assertReplayScope(replay, userId, workshopId);
    const registration = await this.attachWorkshop(
      this.registrationsRepo.toDomain(replay.registration),
    );
    return {
      registration,
      paymentRequired: true,
      paymentIntentId: replay.id,
    };
  }

  async listForUser(userId: string): Promise<Registration[]> {
    const rows = await this.registrationsRepo.findByUserId(userId);
    const enriched = await Promise.all(rows.map((r) => this.attachWorkshop(r)));
    return enriched;
  }

  async listForWorkshop(workshopId: string): Promise<Registration[]> {
    const rows = await this.registrationsRepo.findByWorkshopId(workshopId);
    return Promise.all(rows.map((r) => this.attachWorkshop(r)));
  }

  async listAll(): Promise<Registration[]> {
    const rows = await this.registrationsRepo.findAll();
    return Promise.all(rows.map((r) => this.attachWorkshop(r)));
  }

  async findByQrToken(qrToken: string): Promise<Registration | undefined> {
    const reg = await this.registrationsRepo.findByQrToken(qrToken);
    return reg ? await this.attachWorkshop(reg) : undefined;
  }

  async getQrForUser(
    userId: string,
    registrationId: string,
  ): Promise<{ qrToken: string; qrImageUrl: string }> {
    const reg = await this.registrationsRepo.findById(registrationId);
    if (!reg || reg.userId !== userId) {
      throw new NotFoundException({
        code: 'registration_not_found',
        message: 'Không tìm thấy đăng ký.',
      });
    }
    if (reg.status !== 'confirmed' || !reg.qrToken) {
      throw new BadRequestException({
        code: 'registration_not_confirmed',
        message: 'Đăng ký chưa được xác nhận hoặc không còn hiệu lực.',
      });
    }
    return {
      qrToken: reg.qrToken,
      qrImageUrl: `https://qr.example.edu/${reg.qrToken}.png`,
    };
  }

  async create(
    userId: string,
    workshopId: string,
    idempotencyKey?: string,
  ): Promise<CreateRegistrationResponse> {
    const trimmedKey = idempotencyKey?.trim();
    const workshopPreview = await this.workshops.findById(workshopId);
    if (!workshopPreview) {
      throw new NotFoundException({
        code: 'workshop_not_found',
        message: 'Không tìm thấy workshop.',
      });
    }

    if (workshopPreview.isPaid && !trimmedKey) {
      throw new BadRequestException({
        code: 'payment_idempotency_required',
        message:
          'Workshop có phí cần header Idempotency-Key để đảm bảo giao dịch không lặp.',
      });
    }

    if (trimmedKey) {
      const existing =
        await this.paymentsRepo.findByIdempotencyKeyWithRegistration(
          trimmedKey,
        );
      if (existing) {
        return await this.replayFromStoredPayment(existing, userId, workshopId);
      }
    }

    const result = await this.registrationsRepo.registerWithSeatTransaction(
      userId,
      workshopId,
      { idempotencyKey: trimmedKey },
    );

    if (!result.ok) {
      switch (result.error) {
        case 'workshop_not_found':
          throw new NotFoundException({
            code: 'workshop_not_found',
            message: 'Không tìm thấy workshop hoặc workshop chưa mở đăng ký.',
          });
        case 'workshop_not_open':
          throw new BadRequestException({
            code: 'workshop_not_open',
            message: 'Workshop chưa mở đăng ký.',
          });
        case 'already_registered':
          throw new ConflictException({
            code: 'already_registered',
            message: 'Bạn đã đăng ký workshop này.',
          });
        case 'no_seats':
          throw new ConflictException({
            code: 'no_seats',
            message: 'Đã hết chỗ.',
          });
        case 'idempotency_required':
          throw new BadRequestException({
            code: 'payment_idempotency_required',
            message:
              'Workshop có phí cần header Idempotency-Key để đảm bảo giao dịch không lặp.',
          });
        case 'workshop_missing_price':
          throw new BadRequestException({
            code: 'workshop_missing_price',
            message: 'Workshop có phí nhưng chưa được gán đơn giá (price).',
          });
        case 'idempotency_conflict':
          if (trimmedKey) {
            const replay =
              await this.paymentsRepo.findByIdempotencyKeyWithRegistration(
                trimmedKey,
              );
            if (replay) {
              return await this.replayFromStoredPayment(
                replay,
                userId,
                workshopId,
              );
            }
          }
          throw new ConflictException({
            code: 'idempotency_conflict',
            message:
              'Yêu cầu trùng khóa Idempotency-Key và không tái hiện được trạng thái đăng ký.',
          });
      }
    }

    const registration = await this.attachWorkshop(result.registration);
    const isPaid = registration.workshop?.isPaid ?? false;

    return {
      registration,
      paymentRequired: isPaid,
      paymentIntentId: result.paymentIntentId,
    };
  }

  private async attachWorkshop(reg: Registration): Promise<Registration> {
    const workshop = await this.workshops.findById(reg.workshopId);
    return workshop ? { ...reg, workshop } : { ...reg };
  }
}
