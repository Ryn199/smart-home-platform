import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateHomeDto {
  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  address?: string;
}
