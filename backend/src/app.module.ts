import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { HomesModule } from './homes/homes.module';
import { RoomsModule } from './rooms/rooms.module';
import { DevicesModule } from './devices/devices.module';
import { CustomSensorsModule } from './custom-sensors/custom-sensors.module';
import { SmartDoorModule } from './smart-door/smart-door.module';
import { SmartCurtainModule } from './smart-curtain/smart-curtain.module';
import { ExhaustFanModule } from './exhaust-fan/exhaust-fan.module';
import { MqttModule } from './mqtt/mqtt.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    DatabaseModule,
    UsersModule,
    AuthModule,
    HomesModule,
    RoomsModule,
    DevicesModule,
    CustomSensorsModule,
    SmartDoorModule,
    SmartCurtainModule,
    ExhaustFanModule,
    MqttModule,
    HealthModule,
  ],
})
export class AppModule {}
