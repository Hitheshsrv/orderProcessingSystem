import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { InventoryItem } from './inventory-item.entity.js';

@Injectable()
export class InventoryService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  findAll(): Promise<InventoryItem[]> {
    return this.dataSource.getRepository(InventoryItem).find({ order: { sku: 'ASC' } });
  }

  async restock(sku: string, quantity: number): Promise<InventoryItem> {
    if (process.env.NODE_ENV === 'production' || process.env.DEMO_MODE === 'false') {
      throw new ForbiddenException('Demo inventory controls are disabled.');
    }

    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(InventoryItem);
      const item = await repository
        .createQueryBuilder('inventory')
        .where('inventory.sku = :sku', { sku })
        .setLock('pessimistic_write')
        .getOne();
      if (!item) {
        throw new NotFoundException(`Unknown SKU: ${sku}`);
      }

      item.availableQuantity += quantity;
      item.updatedAt = new Date();
      return repository.save(item);
    });
  }
}