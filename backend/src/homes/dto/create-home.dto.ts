import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateHomeDto {
  @IsString()
  @IsNotEmpty({ message: 'Home name is required' })
  @MaxLength(100)
  name!: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  address?: string;
}
