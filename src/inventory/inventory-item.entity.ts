import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('inventory')
export class InventoryItem {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  sku!: string;

  @Column({ type: 'varchar', length: 160 })
  name!: string;

  @Column({ name: 'unit_price_cents', type: 'integer' })
  unitPriceCents!: number;

  @Column({ name: 'available_quantity', type: 'integer' })
  availableQuantity!: number;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'now()' })
  updatedAt!: Date;
}