import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type OrderStatus = 'PLACED' | 'PENDING_PAYMENT' | 'PAID' | 'PAYMENT_FAILED';

@Entity('orders')
@Index(['idempotencyKey'], { unique: true })
export class OrderEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'idempotency_key', type: 'varchar', length: 255 })
  idempotencyKey!: string;

  @Column({ name: 'request_hash', type: 'varchar', length: 64 })
  requestHash!: string;

  @Column({ type: 'varchar', length: 20 })
  status!: OrderStatus;

  @Column({ name: 'payment_message', type: 'text', nullable: true })
  paymentMessage!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}