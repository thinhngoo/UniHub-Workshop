import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { CreateRegistrationResponse, Registration } from '@unihub/types';
import { RegistrationsRepository } from '../database/repository/registrations.repository';
import { WorkshopsService } from '../workshops/workshops.service';

@Injectable()
export class RegistrationsService {
  constructor(
    private readonly registrationsRepo: RegistrationsRepository,
    private readonly workshops: WorkshopsService,
  ) {}

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
  ): Promise<CreateRegistrationResponse> {
    const result = await this.registrationsRepo.registerWithSeatTransaction(
      userId,
      workshopId,
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
      }
    }

    const registration = await this.attachWorkshop(result.registration);
    const isPaid = registration.workshop?.isPaid ?? false;

    return {
      registration,
      paymentRequired: isPaid,
      paymentIntentId: null,
    };
  }

  private async attachWorkshop(reg: Registration): Promise<Registration> {
    const workshop = await this.workshops.findById(reg.workshopId);
    return workshop ? { ...reg, workshop } : { ...reg };
  }
}
