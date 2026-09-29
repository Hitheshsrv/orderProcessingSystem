import { Module } from '@nestjs/common';
import { PaymentSimulatorController } from './payment-simulator.controller.js';
import { PaymentSimulatorService } from './payment-simulator.service.js';

@Module({
  controllers: [PaymentSimulatorController],
  providers: [PaymentSimulatorService],
  exports: [PaymentSimulatorService],
})
export class PaymentsModule {}