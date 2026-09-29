import { createHash } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, QueryFailedError } from 'typeorm';
import { InventoryItem } from '../inventory/inventory-item.entity.js';
import { CreateOrderDto, PaymentSimulationDto } from './dto/create-order.dto.js';
import { OrderItemEntity } from './order-item.entity.js';
import { OrderEntity, OrderStatus } from './order.entity.js';
import { PaymentSimulatorService } from '../payments/payment-simulator.service.js';

interface NormalizedOrderItem {
  sku: string;
  quantity: number;
}

export interface OrderResponse {
  id: string;
  status: OrderStatus;
  createdAt: Date;
  paymentMessage?: string;
  items: Array<{
    sku: string;
    quantity: number;
    unitPriceCents: number;
  }>;
}

@Injectable()
export class OrdersService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly paymentSimulator: PaymentSimulatorService,
  ) {}

  async create(dto: CreateOrderDto, idempotencyKey: string): Promise<OrderResponse> {
    if (idempotencyKey.length > 255) {
      throw new BadRequestException('The Idempotency-Key header must be 255 characters or fewer.');
    }

    const items = this.normalizeItems(dto.items);
    const requestHash = createHash('sha256').update(JSON.stringify(items)).digest('hex');

    let reservation: {
      order: OrderEntity;
      orderItems: OrderItemEntity[];
      created: boolean;
    };

    try {
      reservation = await this.dataSource.transaction(async (manager) => {
        const orderRepository = manager.getRepository(OrderEntity);
        const orderItemRepository = manager.getRepository(OrderItemEntity);
        const existing = await orderRepository.findOneBy({ idempotencyKey });
        if (existing) {
          this.assertMatchingRequest(existing, requestHash);
          return {
            order: existing,
            orderItems: await orderItemRepository.findBy({ orderId: existing.id }),
            created: false,
          };
        }

        const skus = items.map((item) => item.sku);
        const inventoryRepository = manager.getRepository(InventoryItem);
        const inventory = await inventoryRepository
          .createQueryBuilder('inventory')
          .where('inventory.sku IN (:...skus)', { skus })
          .orderBy('inventory.sku', 'ASC')
          .setLock('pessimistic_write')
          .getMany();

        const replay = await orderRepository.findOneBy({ idempotencyKey });
        if (replay) {
          this.assertMatchingRequest(replay, requestHash);
          return {
            order: replay,
            orderItems: await orderItemRepository.findBy({ orderId: replay.id }),
            created: false,
          };
        }

        const inventoryBySku = new Map(inventory.map((item) => [item.sku, item]));
        const unknownSkus = skus.filter((sku) => !inventoryBySku.has(sku));
        if (unknownSkus.length > 0) {
          throw new NotFoundException(`Unknown SKU(s): ${unknownSkus.join(', ')}`);
        }

        for (const item of items) {
          const inventoryItem = inventoryBySku.get(item.sku)!;
          if (inventoryItem.availableQuantity < item.quantity) {
            throw new ConflictException(`Insufficient inventory for SKU ${item.sku}.`);
          }
          inventoryItem.availableQuantity -= item.quantity;
          inventoryItem.updatedAt = new Date();
        }
        await inventoryRepository.save(inventory);

        const order = await orderRepository.save(
          orderRepository.create({
            idempotencyKey,
            requestHash,
            status: 'PENDING_PAYMENT',
            paymentMessage: null,
          }),
        );
        const orderItems = await orderItemRepository.save(
          items.map((item) => {
            const inventoryItem = inventoryBySku.get(item.sku)!;
            return orderItemRepository.create({
              orderId: order.id,
              sku: item.sku,
              quantity: item.quantity,
              unitPriceCents: inventoryItem.unitPriceCents,
            });
          }),
        );

        return { order, orderItems, created: true };
      });
    } catch (error) {
      if (!(error instanceof QueryFailedError) || error.driverError?.code !== '23505') {
        throw error;
      }

      const existing = await this.dataSource
        .getRepository(OrderEntity)
        .findOneBy({ idempotencyKey });
      if (!existing) {
        throw error;
      }
      this.assertMatchingRequest(existing, requestHash);
      const orderItems = await this.dataSource
        .getRepository(OrderItemEntity)
        .findBy({ orderId: existing.id });
      return this.toResponse(existing, orderItems);
    }

    if (!reservation.created) {
      return this.toResponse(reservation.order, reservation.orderItems);
    }
    return this.settlePayment(reservation.order, reservation.orderItems, dto.paymentSimulation);
  }

  async findById(id: string): Promise<OrderResponse> {
    const order = await this.dataSource.getRepository(OrderEntity).findOneBy({ id });
    if (!order) {
      throw new NotFoundException(`Order ${id} was not found.`);
    }
    const items = await this.dataSource.getRepository(OrderItemEntity).findBy({ orderId: id });
    return this.toResponse(order, items);
  }

  private async settlePayment(
    order: OrderEntity,
    orderItems: OrderItemEntity[],
    simulation?: PaymentSimulationDto,
  ): Promise<OrderResponse> {
    let payment: Awaited<ReturnType<PaymentSimulatorService['authorize']>>;
    try {
      payment = await this.paymentSimulator.authorize(simulation);
    } catch (error) {
      const message =
        this.paymentSimulator.getState() === 'open'
          ? 'Payment service unavailable; circuit breaker is open.'
          : error instanceof Error
            ? error.message
            : 'Payment service failed.';
      return this.failAndRelease(order.id, message);
    }

    if (!payment.approved) {
      return this.failAndRelease(order.id, payment.message);
    }

    await this.dataSource.getRepository(OrderEntity).update(
      { id: order.id, status: 'PENDING_PAYMENT' },
      { status: 'PAID', paymentMessage: payment.message },
    );
    return this.toResponse({ ...order, status: 'PAID', paymentMessage: payment.message }, orderItems);
  }

  private async failAndRelease(orderId: string, message: string): Promise<OrderResponse> {
    return this.dataSource.transaction(async (manager) => {
      const orderRepository = manager.getRepository(OrderEntity);
      const order = await orderRepository.findOneBy({ id: orderId });
      if (!order) {
        throw new NotFoundException(`Order ${orderId} was not found.`);
      }
      const orderItems = await manager.getRepository(OrderItemEntity).findBy({ orderId });
      if (order.status !== 'PENDING_PAYMENT') {
        return this.toResponse(order, orderItems);
      }

      const skus = [...new Set(orderItems.map((item) => item.sku))].sort();
      const inventoryRepository = manager.getRepository(InventoryItem);
      const inventory = await inventoryRepository
        .createQueryBuilder('inventory')
        .where('inventory.sku IN (:...skus)', { skus })
        .orderBy('inventory.sku', 'ASC')
        .setLock('pessimistic_write')
        .getMany();
      const inventoryBySku = new Map(inventory.map((item) => [item.sku, item]));
      for (const item of orderItems) {
        const inventoryItem = inventoryBySku.get(item.sku);
        if (inventoryItem) {
          inventoryItem.availableQuantity += item.quantity;
          inventoryItem.updatedAt = new Date();
        }
      }
      await inventoryRepository.save(inventory);

      order.status = 'PAYMENT_FAILED';
      order.paymentMessage = message;
      const failedOrder = await orderRepository.save(order);
      return this.toResponse(failedOrder, orderItems);
    });
  }

  getPaymentCircuitState(): 'closed' | 'open' | 'half-open' {
    return this.paymentSimulator.getState();
  }

  private normalizeItems(items: CreateOrderDto['items']): NormalizedOrderItem[] {
    const quantities = new Map<string, number>();
    for (const item of items) {
      const quantity = (quantities.get(item.sku) ?? 0) + item.quantity;
      if (!Number.isSafeInteger(quantity)) {
        throw new ConflictException(`Quantity is too large for SKU ${item.sku}.`);
      }
      quantities.set(item.sku, quantity);
    }

    return [...quantities]
      .map(([sku, quantity]) => ({ sku, quantity }))
      .sort((left, right) => left.sku.localeCompare(right.sku));
  }

  private assertMatchingRequest(order: OrderEntity, requestHash: string): void {
    if (order.requestHash !== requestHash) {
      throw new ConflictException('This Idempotency-Key was already used for a different order.');
    }
  }

  private toResponse(order: OrderEntity, items: OrderItemEntity[]): OrderResponse {
    return {
      id: order.id,
      status: order.status,
      createdAt: order.createdAt,
      ...(order.paymentMessage ? { paymentMessage: order.paymentMessage } : {}),
      items: items.map(({ sku, quantity, unitPriceCents }) => ({
        sku,
        quantity,
        unitPriceCents,
      })),
    };
  }
}