import { createHash } from 'node:crypto';
import { ConflictException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { CreateOrderDto } from './dto/create-order.dto.js';
import { OrderItemEntity } from './order-item.entity.js';
import { OrderEntity } from './order.entity.js';
import { OrdersService } from './orders.service.js';

const originalItems = [{ sku: 'SKU-001', quantity: 2 }];
const originalRequestHash = createHash('sha256')
  .update(JSON.stringify(originalItems))
  .digest('hex');

function createService(requestHash: string) {
  const createdAt = new Date('2026-01-01T00:00:00.000Z');
  const order = {
    id: 'order-1',
    idempotencyKey: 'checkout-1',
    requestHash,
    status: 'PLACED' as const,
    createdAt,
  };
  const orderItems = [
    {
      id: 'item-1',
      orderId: order.id,
      sku: 'SKU-001',
      quantity: 2,
      unitPriceCents: 8999,
    },
  ];
  const orderRepository = { findOneBy: vi.fn().mockResolvedValue(order) };
  const orderItemRepository = { findBy: vi.fn().mockResolvedValue(orderItems) };
  const repositories = new Map<Function, unknown>();
  repositories.set(OrderEntity, orderRepository);
  repositories.set(OrderItemEntity, orderItemRepository);
  const manager = {
    getRepository: vi.fn((entity: Function) => repositories.get(entity)),
  } as unknown as EntityManager;
  const dataSource = {
    transaction: vi.fn(
      async (work: (transactionManager: EntityManager) => Promise<unknown>) => work(manager),
    ),
  } as unknown as DataSource;

  return {
    service: new OrdersService(dataSource, { authorize: vi.fn() } as never),
    orderRepository,
    orderItemRepository,
  };
}

describe('OrdersService', () => {
  it('replays the original order for a matching idempotency key and request', async () => {
    const { service, orderRepository, orderItemRepository } = createService(originalRequestHash);

    await expect(
      service.create({ items: originalItems } as CreateOrderDto, 'checkout-1'),
    ).resolves.toEqual({
      id: 'order-1',
      status: 'PLACED',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      items: [{ sku: 'SKU-001', quantity: 2, unitPriceCents: 8999 }],
    });

    expect(orderRepository.findOneBy).toHaveBeenCalledWith({ idempotencyKey: 'checkout-1' });
    expect(orderItemRepository.findBy).toHaveBeenCalledWith({ orderId: 'order-1' });
  });

  it('rejects an idempotency key reused for a different request', async () => {
    const { service } = createService(originalRequestHash);

    await expect(
      service.create(
        { items: [{ sku: 'SKU-002', quantity: 1 }] } as CreateOrderDto,
        'checkout-1',
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});