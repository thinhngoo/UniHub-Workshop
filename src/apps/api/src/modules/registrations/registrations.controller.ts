import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type {
  CreateRegistrationResponse,
  Payment,
  Registration,
  User,
} from '@unihub/types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PaymentsService } from '../payments/payments.service';
import { THROTTLE_REGISTRATION_CREATE } from '../../throttle-presets';
import { CreateRegistrationDto } from './dto/create-registration.dto';
import { RegistrationsService } from './registrations.service';

const registrationBodyValidationPipe = new ValidationPipe({
  whitelist: true,
  transform: true,
  forbidNonWhitelisted: true,
  exceptionFactory: (errors: unknown) => {
    const messages = (
      errors as { constraints?: Record<string, string> }[]
    ).flatMap((e) => (e.constraints ? Object.values(e.constraints) : []));
    return new BadRequestException({
      code: 'invalid_request',
      message: messages[0] ?? 'Yêu cầu không hợp lệ.',
    });
  },
});

@Controller('registrations')
@UseGuards(AuthGuard)
export class RegistrationsController {
  constructor(
    private readonly registrations: RegistrationsService,
    private readonly payments: PaymentsService,
  ) {}

  @Get('me')
  async listMine(@CurrentUser() user: User): Promise<Registration[]> {
    return this.registrations.listForUser(user.id);
  }

  @Post()
  @Throttle(THROTTLE_REGISTRATION_CREATE)
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(RolesGuard)
  @Roles('student')
  @UsePipes(registrationBodyValidationPipe)
  async create(
    @CurrentUser() user: User,
    @Body() body: CreateRegistrationDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<CreateRegistrationResponse> {
    return this.registrations.create(user.id, body.workshopId, idempotencyKey);
  }

  @Get(':id/payment')
  async getRegistrationPayment(
    @CurrentUser() user: User,
    @Param('id') registrationId: string,
  ): Promise<Payment> {
    return this.payments.getPaymentForRegistrationOwned(
      user.id,
      registrationId,
    );
  }

  @Get(':id/qr')
  async getQr(
    @CurrentUser() user: User,
    @Param('id') id: string,
  ): Promise<{ qrToken: string; qrImageUrl: string }> {
    return this.registrations.getQrForUser(user.id, id);
  }
}
