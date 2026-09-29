import { PaymentSimulatorService } from './payment-simulator.service.js';

describe('PaymentSimulatorService', () => {
  it('approves a successful payment after the configured delay', async () => {
    const simulator = new PaymentSimulatorService();
    const startedAt = Date.now();

    await expect(simulator.authorize({ outcome: 'success', delayMs: 40 })).resolves.toEqual({
      approved: true,
      message: 'Payment approved by the simulator.',
    });
    expect(Date.now() - startedAt).toBeGreaterThanOrEqual(30);
  });

  it('treats a decline as a completed payment response, not a provider outage', async () => {
    const simulator = new PaymentSimulatorService();

    await expect(simulator.authorize({ outcome: 'decline', delayMs: 0 })).resolves.toEqual({
      approved: false,
      message: 'Payment was declined by the simulator.',
    });
    expect(simulator.getState()).toBe('closed');
  });

  it('opens the circuit after repeated provider errors', async () => {
    const simulator = new PaymentSimulatorService();
    const failures = await Promise.allSettled([
      simulator.authorize({ outcome: 'provider-error', delayMs: 0 }),
      simulator.authorize({ outcome: 'provider-error', delayMs: 0 }),
    ]);

    expect(failures.every((result) => result.status === 'rejected')).toBe(true);
    expect(simulator.getState()).toBe('open');
    await expect(simulator.authorize({ outcome: 'success', delayMs: 0 })).rejects.toThrow();
  });
});