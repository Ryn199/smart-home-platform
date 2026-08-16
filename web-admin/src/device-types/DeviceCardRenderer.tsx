import React from 'react';
import { Device } from '../types';
import { SmartDoorCard } from './smart-door/SmartDoorCard';
import { SmartCurtainCard } from './smart-curtain/SmartCurtainCard';
import { ExhaustFanCard } from './exhaust-fan/ExhaustFanCard';
import { CustomSensorCard } from './custom-sensor/CustomSensorCard';

interface DeviceCardRendererProps {
  device: Device;
}

export const DeviceCardRenderer: React.FC<DeviceCardRendererProps> = ({ device }) => {
  switch (device.deviceType) {
    case 'SMART_DOOR':
      return <SmartDoorCard device={device} />;
    case 'SMART_CURTAIN':
      return <SmartCurtainCard device={device} />;
    case 'EXHAUST_FAN':
      return <ExhaustFanCard device={device} />;
    case 'CUSTOM_SENSOR':
    default:
      return <CustomSensorCard device={device} />;
  }
};
