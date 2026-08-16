import { IsInt, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateRoomDto {
  @IsString()
  @IsNotEmpty({ message: 'Room name cannot be empty' })
  @MaxLength(100)
  name!: string;

  @IsInt()
  @IsOptional()
  homeId?: number;
}
