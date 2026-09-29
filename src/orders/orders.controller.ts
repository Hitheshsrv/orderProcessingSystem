import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
} from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto.js';
import { OrderResponse, OrdersService } from './orders.service.js';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  create(
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() createOrderDto: CreateOrderDto,
  ): Promise<OrderResponse> {
    if (!idempotencyKey?.trim()) {
      throw new BadRequestException('The Idempotency-Key header is required.');
    }

    return this.ordersService.create(createOrderDto, idempotencyKey.trim());
  }

  @Get(':id')
  findById(@Param('id') id: string): Promise<OrderResponse> {
    return this.ordersService.findById(id);
  }
}