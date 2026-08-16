import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DeviceCardRenderer } from '../device-types/DeviceCardRenderer';
import { Device } from '../types';

// Mock websocket hook
vi.mock('../websocket/socket', () => ({
  useWebSocket: () => ({
    deviceStates: {},
    telemetry: {},
    deviceStatuses: {},
    activities: [],
    isConnected: true,
  }),
}));

describe('DeviceCardRenderer', () => {
  it('renders SmartDoorCard for SMART_DOOR device', () => {
    const device: Device = {
      id: 1,
      roomId: 1,
      name: 'Main Front Door',
      deviceUid: 'door-001',
      deviceType: 'SMART_DOOR',
      status: 'ONLINE',
      lastSeenAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: { door: 'closed', lock: 'locked' },
    };

    render(<DeviceCardRenderer device={device} />);
    expect(screen.getByText('Main Front Door')).toBeInTheDocument();
    expect(screen.getByText('door-001')).toBeInTheDocument();
    expect(screen.getByText('Locked')).toBeInTheDocument();
  });

  it('renders SmartCurtainCard for SMART_CURTAIN device', () => {
    const device: Device = {
      id: 2,
      roomId: 1,
      name: 'Living Room Window',
      deviceUid: 'curtain-001',
      deviceType: 'SMART_CURTAIN',
      status: 'ONLINE',
      lastSeenAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: { position: 80, state: 'stopped' },
    };

    render(<DeviceCardRenderer device={device} />);
    expect(screen.getByText('Living Room Window')).toBeInTheDocument();
    expect(screen.getByText('80%')).toBeInTheDocument();
    expect(screen.getByText('Open')).toBeInTheDocument();
  });

  it('renders ExhaustFanCard for EXHAUST_FAN device', () => {
    const device: Device = {
      id: 3,
      roomId: 2,
      name: 'Kitchen Exhaust Fan',
      deviceUid: 'fan-001',
      deviceType: 'EXHAUST_FAN',
      status: 'ONLINE',
      lastSeenAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: { power: true, speed: 2 },
    };

    render(<DeviceCardRenderer device={device} />);
    expect(screen.getByText('Kitchen Exhaust Fan')).toBeInTheDocument();
    expect(screen.getByText('Running')).toBeInTheDocument();
  });

  it('renders TempHumidityCard for TEMP_HUMIDITY device', () => {
    const device: Device = {
      id: 4,
      roomId: 1,
      name: 'Room Climate Sensor',
      deviceUid: 'th-001',
      deviceType: 'TEMP_HUMIDITY',
      status: 'ONLINE',
      lastSeenAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: { temperature: 27.5, humidity: 62 },
    };

    render(<DeviceCardRenderer device={device} />);
    expect(screen.getByText('Room Climate Sensor')).toBeInTheDocument();
    expect(screen.getByText('27.5')).toBeInTheDocument();
    expect(screen.getByText('62')).toBeInTheDocument();
    expect(screen.getByText('Temperature')).toBeInTheDocument();
    expect(screen.getByText('Humidity')).toBeInTheDocument();
  });
});
