import React from 'react';
import { Device, TempHumidityState } from '../../types';
import { useWebSocket } from '../../websocket/socket';

interface TempHumidityCardProps {
  device: Device;
}

export const TempHumidityCard: React.FC<TempHumidityCardProps> = ({ device }) => {
  const { deviceStates } = useWebSocket();

  // Read state from live WebSocket or device metadata
  const liveState = (deviceStates[device.deviceUid] ||
    device.metadata || {
      temperature: 0,
      humidity: 0,
    }) as unknown as TempHumidityState;

  const temp = liveState.temperature !== undefined ? liveState.temperature : '-';
  const hum = liveState.humidity !== undefined ? liveState.humidity : '-';

  return (
    <div className="bg-surface border border-outline-variant rounded-xl p-lg space-y-md flex flex-col justify-between group hover:border-outline transition-colors shadow-sm shadow-black/5">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-sm">
          <div className="p-2 rounded-xl bg-primary-container/20 text-primary">
            <span className="material-symbols-outlined text-2xl">
              device_thermostat
            </span>
          </div>
          <div>
            <h4 className="font-headline-md text-headline-md text-on-surface font-semibold">
              {device.name}
            </h4>
            <span className="text-xs text-outline font-data-mono">
              {device.deviceUid}
            </span>
          </div>
        </div>

        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold ${
            device.status === 'ONLINE'
              ? 'text-[#059669] bg-[#ecfdf5]'
              : 'text-error bg-error-container/40'
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              device.status === 'ONLINE' ? 'bg-[#10b981] animate-pulse' : 'bg-error'
            }`}
          />
          {device.status}
        </span>
      </div>

      {/* Temperature & Humidity Gauges / Readouts */}
      <div className="grid grid-cols-2 gap-sm pt-xs">
        {/* Temperature Card */}
        <div className="p-md bg-surface-container-low rounded-xl border border-outline-variant/60 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="font-label-caps text-label-caps text-on-surface-variant uppercase text-[10px]">
              Temperature
            </span>
            <span className="material-symbols-outlined text-primary text-[18px]">
              thermostat
            </span>
          </div>
          <div className="font-display-stat text-display-stat text-on-surface mt-2 flex items-baseline gap-0.5">
            <span>{temp}</span>
            <span className="text-sm font-semibold text-outline">°C</span>
          </div>
        </div>

        {/* Humidity Card */}
        <div className="p-md bg-surface-container-low rounded-xl border border-outline-variant/60 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="font-label-caps text-label-caps text-on-surface-variant uppercase text-[10px]">
              Humidity
            </span>
            <span className="material-symbols-outlined text-[#0284c7] text-[18px]">
              humidity_mid
            </span>
          </div>
          <div className="font-display-stat text-display-stat text-on-surface mt-2 flex items-baseline gap-0.5">
            <span>{hum}</span>
            <span className="text-sm font-semibold text-outline">%</span>
          </div>
        </div>
      </div>

      {/* Room Badge Footer */}
      <div className="pt-sm border-t border-outline-variant flex justify-between items-center text-xs text-on-surface-variant">
        <span className="flex items-center gap-1 font-medium">
          <span className="material-symbols-outlined text-[16px] text-outline">
            meeting_room
          </span>
          {device.room?.name || 'Assigned Room'}
        </span>
        <span className="font-data-mono text-[11px] text-outline">
          TEMP_HUMIDITY
        </span>
      </div>
    </div>
  );
};
