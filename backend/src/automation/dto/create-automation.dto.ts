import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateAutomationDto {
  @IsInt({ message: 'homeId must be an integer' })
  @IsNotEmpty({ message: 'homeId is required' })
  homeId!: number;

  @IsString()
  @IsNotEmpty({ message: 'Automation name is required' })
  @MaxLength(100)
  name!: string;

  @IsBoolean()
  @IsOptional()
  enabled?: boolean = true;

  @IsObject()
  @IsNotEmpty({ message: 'configuration is required' })
  configuration!: Record<string, unknown>;
}
