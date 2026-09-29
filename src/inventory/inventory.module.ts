import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventoryController } from './inventory.controller.js';
import { InventoryItem } from './inventory-item.entity.js';
import { InventoryService } from './inventory.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([InventoryItem])],
  controllers: [InventoryController],
  providers: [InventoryService],
})
export class InventoryModule {}