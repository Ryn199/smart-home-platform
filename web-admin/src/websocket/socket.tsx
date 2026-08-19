import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';

export interface TelemetryEvent {
  deviceUid: string;
  sensor: string;
  value: number;
  unit: string;
  recordedAt: string;
}

export interface DeviceStateEvent {
  deviceUid: string;
  deviceType: string;
  state: Record<string, unknown>;
}

export interface DeviceStatusEvent {
  deviceUid: string;
  status: 'online' | 'offline';
  lastSeenAt: string;
}

export interface CommandExecutedEvent {
  deviceUid: string;
  command: string;
  status: string;
  executedAt: string;
}

export interface DeviceDiagnosticsEvent {
  deviceUid: string;
  diagnostics: Record<string, unknown>;
  timestamp: string;
}

export interface ActivityEvent {
  id: string;
  message: string;
  time: string;
  timestamp: number;
}

interface WebSocketContextType {
  isConnected: boolean;
  telemetry: Record<string, Record<string, number>>; // deviceUid -> sensorType -> value
  deviceStates: Record<string, Record<string, unknown>>; // deviceUid -> state
  deviceStatuses: Record<string, 'online' | 'offline'>; // deviceUid -> status
  deviceDiagnostics: Record<string, Record<string, unknown>>; // deviceUid -> diagnostics
  activities: ActivityEvent[];
}

const WebSocketContext = createContext<WebSocketContextType>({
  isConnected: false,
  telemetry: {},
  deviceStates: {},
  deviceStatuses: {},
  deviceDiagnostics: {},
  activities: [],
});

export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [telemetry, setTelemetry] = useState<Record<string, Record<string, number>>>({});
  const [deviceStates, setDeviceStates] = useState<Record<string, Record<string, unknown>>>({});
  const [deviceStatuses, setDeviceStatuses] = useState<Record<string, 'online' | 'offline'>>({});
  const [deviceDiagnostics, setDeviceDiagnostics] = useState<Record<string, Record<string, unknown>>>({});
  const [activities, setActivities] = useState<ActivityEvent[]>([
    { id: '1', message: 'System initialized and connected', time: 'Just now', timestamp: Date.now() },
  ]);

  const queryClient = useQueryClient();

  useEffect(() => {
    // In Vite dev server (port 5173), direct connect to backend port 3000
    const wsUrl =
      import.meta.env.VITE_WS_URL ||
      (typeof window !== 'undefined' && window.location.port === '5173'
        ? 'http://localhost:3000'
        : window.location.origin);

    const s = io(wsUrl, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    s.on('connect', () => {
      setIsConnected(true);
      console.log('[WebSocket] Connected to backend events gateway at', wsUrl);
    });

    s.on('disconnect', () => {
      setIsConnected(false);
      console.log('[WebSocket] Disconnected from backend events gateway');
    });

    s.on('sensor.telemetry', (data: TelemetryEvent) => {
      setTelemetry((prev) => ({
        ...prev,
        [data.deviceUid]: {
          ...(prev[data.deviceUid] || {}),
          [data.sensor]: data.value,
        },
      }));

      setActivities((prev) => [
        {
          id: Math.random().toString(),
          message: `${data.deviceUid} [${data.sensor}]: ${data.value} ${data.unit}`,
          time: 'Just now',
          timestamp: Date.now(),
        },
        ...prev.slice(0, 19),
      ]);

      queryClient.invalidateQueries({ queryKey: ['sensors'] });
      queryClient.invalidateQueries({ queryKey: ['sensorReadings'] });
    });

    s.on('device.state', (data: DeviceStateEvent) => {
      setDeviceStates((prev) => ({
        ...prev,
        // Merge incoming state with existing state so partial updates don't wipe previous fields
        [data.deviceUid]: {
          ...(prev[data.deviceUid] || {}),
          ...data.state,
        },
      }));

      setActivities((prev) => [
        {
          id: Math.random().toString(),
          message: `${data.deviceUid} state updated`,
          time: 'Just now',
          timestamp: Date.now(),
        },
        ...prev.slice(0, 19),
      ]);

      queryClient.invalidateQueries({ queryKey: ['devices'] });
      queryClient.invalidateQueries({ queryKey: ['device-by-uid', data.deviceUid] });
    });

    s.on('device.status', (data: DeviceStatusEvent) => {
      setDeviceStatuses((prev) => ({
        ...prev,
        [data.deviceUid]: data.status,
      }));

      queryClient.invalidateQueries({ queryKey: ['devices'] });
      queryClient.invalidateQueries({ queryKey: ['presence'] });
    });

    s.on('device.diagnostics', (data: DeviceDiagnosticsEvent) => {
      setDeviceDiagnostics((prev) => ({
        ...prev,
        [data.deviceUid]: {
          ...(prev[data.deviceUid] || {}),
          ...data.diagnostics,
        },
      }));

      setActivities((prev) => [
        {
          id: Math.random().toString(),
          message: `Diagnostics received from ${data.deviceUid}`,
          time: 'Just now',
          timestamp: Date.now(),
        },
        ...prev.slice(0, 19),
      ]);

      queryClient.invalidateQueries({ queryKey: ['devices'] });
      queryClient.invalidateQueries({ queryKey: ['device-diagnostics', data.deviceUid] });
    });

    s.on('command.executed', (data: CommandExecutedEvent) => {
      setActivities((prev) => [
        {
          id: Math.random().toString(),
          message: `Command "${data.command}" sent to ${data.deviceUid}`,
          time: 'Just now',
          timestamp: Date.now(),
        },
        ...prev.slice(0, 19),
      ]);

      queryClient.invalidateQueries({ queryKey: ['devices'] });
      // Invalidate both possible command key formats used across pages
      queryClient.invalidateQueries({ queryKey: ['deviceCommands'] });
      queryClient.invalidateQueries({ queryKey: ['device-commands'] });
    });

    setSocket(s);

    return () => {
      s.disconnect();
    };
  }, [queryClient]);

  return (
    <WebSocketContext.Provider
      value={{
        isConnected,
        telemetry,
        deviceStates,
        deviceStatuses,
        deviceDiagnostics,
        activities,
      }}
    >
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = (): WebSocketContextType => {
  return useContext(WebSocketContext);
};
