import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class ExecuteCommandDto {
  @IsString({ message: 'Action or command string is required' })
  @IsNotEmpty({ message: 'action cannot be empty' })
  action!: string;

  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;

  // Additional optional shortcut fields for specialized devices
  @IsOptional()
  position?: number;

  @IsOptional()
  speed?: number;
}
