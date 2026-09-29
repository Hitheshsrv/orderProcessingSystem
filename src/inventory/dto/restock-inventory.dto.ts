import { IsInt, Max, Min } from 'class-validator';

export class RestockInventoryDto {
  @IsInt()
  @Min(1)
  @Max(10000)
  quantity!: number;
}