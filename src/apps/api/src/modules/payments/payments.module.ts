import { Module } from '@nestjs/common';
import { MockPaymentGatewayModule } from '../../mock/payment-gateway/mock-payment-gateway.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { PaymentsController } from './payments.controller';
import { PaymentsWebhookController } from './payments-webhook.controller';
import { PaymentGatewayCircuitBreakerService } from './payment-gateway-circuit.service';
import { PaymentInitiateIdempotencyService } from './payment-initiate-idempotency.service';
import { PaymentsService } from './payments.service';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    NotificationsModule,
    MockPaymentGatewayModule,
  ],
  controllers: [PaymentsController, PaymentsWebhookController],
  providers: [
    PaymentsService,
    PaymentGatewayCircuitBreakerService,
    PaymentInitiateIdempotencyService,
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
