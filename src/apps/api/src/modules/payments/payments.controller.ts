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
  InitiatePaymentResponse,
  Payment as PaymentDto,
  User,
} from '@unihub/types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { THROTTLE_PAYMENT_INITIATE } from '../../throttle-presets';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { PaymentsService } from './payments.service';

const initiatePaymentPipe = new ValidationPipe({
  whitelist: true,
  transform: true,
  forbidNonWhitelisted: true,
  exceptionFactory: (errors: unknown) =>
    new BadRequestException({
      code: 'invalid_request',
      message:
        (errors as { constraints?: Record<string, string> }[]).flatMap((e) =>
          e.constraints ? Object.values(e.constraints) : [],
        )[0] ?? 'Yêu cầu không hợp lệ.',
    }),
});

@Controller('payments')
@UseGuards(AuthGuard)
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get(':id')
  async getById(
    @CurrentUser() user: User,
    @Param('id') paymentId: string,
  ): Promise<PaymentDto> {
    return this.payments.getPaymentByIdOwned(user.id, paymentId);
  }

  @Post()
  @Throttle(THROTTLE_PAYMENT_INITIATE)
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles('student')
  @UsePipes(initiatePaymentPipe)
  async initiate(
    @CurrentUser() user: User,
    @Body() body: InitiatePaymentDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<InitiatePaymentResponse> {
    return this.payments.initiateStudentPayment(user.id, body.registrationId, {
      returnUrl: body.returnUrl,
      idempotencyKey,
    });
  }
}
