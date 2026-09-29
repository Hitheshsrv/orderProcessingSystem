import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateOrderItemDto {
  @IsString()
  @Matches(/^[A-Z0-9-]{1,64}$/)
  sku!: string;

  @IsInt()
  @Min(1)
  @Max(100000)
  quantity!: number;
}

export type PaymentScenario = 'success' | 'decline' | 'provider-error';

export class PaymentSimulationDto {
  @IsOptional()
  @IsIn(['success', 'decline', 'provider-error'])
  outcome?: PaymentScenario;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(15000)
  delayMs?: number;
}

export class CreateOrderDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items!: CreateOrderItemDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => PaymentSimulationDto)
  paymentSimulation?: PaymentSimulationDto;
}