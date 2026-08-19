import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UploadFirmwareDto {
  @ApiProperty({
    example: '1.0.1',
    description: 'SemVer or version string of the firmware',
  })
  @IsString()
  @IsNotEmpty()
  version!: string;

  @ApiProperty({
    example: 'firmware_v1.0.1.bin',
    description: 'Original .bin file name',
  })
  @IsString()
  @IsNotEmpty()
  fileName!: string;

  @ApiProperty({
    description: 'Base64-encoded binary content of the .bin file',
  })
  @IsString()
  @IsNotEmpty()
  fileData!: string;

  @ApiPropertyOptional({
    example: 'Added DHT sensor calibration and improved MQTT reconnection',
    description: 'Release notes or changelog for this firmware version',
  })
  @IsString()
  @IsOptional()
  changelog?: string;
}
