import { Injectable } from '@nestjs/common';
import type {
  Payment as DbPayment,
  Registration as DbRegistration,
} from '@prisma/client';
import { PrismaService } from '../prisma.service';

export type PaymentWithRegistration = DbPayment & {
  registration: DbRegistration;
};

@Injectable()
export class PaymentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByIdempotencyKeyWithRegistration(
    idempotencyKey: string,
  ): Promise<PaymentWithRegistration | null> {
    return this.prisma.payment.findUnique({
      where: { idempotencyKey },
      include: { registration: true },
    });
  }

  findByRegistrationId(registrationId: string) {
    return this.prisma.payment.findUnique({
      where: { registrationId },
    });
  }
}
