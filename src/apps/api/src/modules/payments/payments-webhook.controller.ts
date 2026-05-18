import {
  Controller,
  Post,
  Headers,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { PaymentsService } from './payments.service';

@Controller('payments/webhooks')
export class PaymentsWebhookController {
  constructor(private readonly payments: PaymentsService) {}

  @Post('mock-gateway')
  @HttpCode(HttpStatus.OK)
  @SkipThrottle()
  async mockGateway(
    @Headers('x-mock-payment-signature') signature: string | undefined,
    @Body() body: unknown,
  ): Promise<{ received: boolean }> {
    return this.payments.handleMockGatewayWebhook(signature, body);
  }
}
