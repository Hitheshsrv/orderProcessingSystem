import { Controller, Get } from '@nestjs/common';
import { PaymentSimulatorService } from './payment-simulator.service.js';

@Controller('payments')
export class PaymentSimulatorController {
  constructor(private readonly paymentSimulator: PaymentSimulatorService) {}

  @Get('simulator')
  getSimulatorStatus(): { circuit: 'closed' | 'open' | 'half-open' } {
    return { circuit: this.paymentSimulator.getState() };
  }
}