import { IsBoolean, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateAutomationDto {
  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;

  @IsBoolean()
  @IsOptional()
  enabled?: boolean;

  @IsObject()
  @IsOptional()
  configuration?: Record<string, unknown>;
}
