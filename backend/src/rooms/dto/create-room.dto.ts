import { IsInt, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateRoomDto {
  @IsString()
  @IsNotEmpty({ message: 'Room name is required' })
  @MaxLength(100)
  name!: string;

  @IsInt()
  @IsOptional()
  homeId?: number;
}
