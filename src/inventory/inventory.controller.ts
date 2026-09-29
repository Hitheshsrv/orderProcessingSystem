import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { InventoryItem } from './inventory-item.entity.js';
import { InventoryService } from './inventory.service.js';
import { RestockInventoryDto } from './dto/restock-inventory.dto.js';

@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  findAll(): Promise<InventoryItem[]> {
    return this.inventoryService.findAll();
  }

  @Post(':sku/restock')
  restock(
    @Param('sku') sku: string,
    @Body() restockInventoryDto: RestockInventoryDto,
  ): Promise<InventoryItem> {
    return this.inventoryService.restock(sku, restockInventoryDto.quantity);
  }
}