import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('order_items')
export class OrderItemEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'order_id', type: 'uuid' })
  orderId!: string;

  @Column({ type: 'varchar', length: 64 })
  sku!: string;

  @Column({ type: 'integer' })
  quantity!: number;

  @Column({ name: 'unit_price_cents', type: 'integer' })
  unitPriceCents!: number;
}