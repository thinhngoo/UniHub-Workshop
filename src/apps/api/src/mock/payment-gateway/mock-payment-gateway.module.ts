import { Module } from '@nestjs/common';
import { MockPaymentGatewayController } from './mock-payment-gateway.controller';
import { MockPaymentSessionStore } from './mock-payment-session.store';

@Module({
  controllers: [MockPaymentGatewayController],
  providers: [MockPaymentSessionStore],
  exports: [MockPaymentSessionStore],
})
export class MockPaymentGatewayModule {}
