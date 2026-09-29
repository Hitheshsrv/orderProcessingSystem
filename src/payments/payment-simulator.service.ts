import { Injectable } from '@nestjs/common';
import CircuitBreaker from 'opossum';
import { PaymentScenario } from '../orders/dto/create-order.dto.js';

export interface PaymentSimulationOptions {
  outcome?: PaymentScenario;
  delayMs?: number;
}

export interface PaymentResult {
  approved: boolean;
  message: string;
}

@Injectable()
export class PaymentSimulatorService {
  private readonly breaker: CircuitBreaker<[PaymentSimulationOptions], PaymentResult>;

  constructor() {
    this.breaker = new CircuitBreaker(
      async ({ outcome = 'success', delayMs = 1200 }: PaymentSimulationOptions) => {
        if (delayMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
        if (outcome === 'provider-error') {
          throw new Error('Simulated payment provider outage.');
        }
        if (outcome === 'decline') {
          return { approved: false, message: 'Payment was declined by the simulator.' };
        }
        return { approved: true, message: 'Payment approved by the simulator.' };
      },
      {
        timeout: 20000,
        errorThresholdPercentage: 50,
        resetTimeout: 10000,
        rollingCountTimeout: 10000,
        volumeThreshold: 2,
      },
    );
  }

  authorize(options: PaymentSimulationOptions = {}): Promise<PaymentResult> {
    return this.breaker.fire(options);
  }

  getState(): 'closed' | 'open' | 'half-open' {
    if (this.breaker.opened) return 'open';
    if (this.breaker.halfOpen) return 'half-open';
    return 'closed';
  }
}