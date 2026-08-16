import { IsBoolean, IsInt, IsNotEmpty, Max, Min } from 'class-validator';

export class ExhaustFanStateDto {
  @IsBoolean()
  @IsNotEmpty()
  power!: boolean;

  @IsInt()
  @Min(0)
  @Max(3) // 0 = off, 1 = low, 2 = medium, 3 = high
  @IsNotEmpty()
  speed!: number;
}
