import React from 'react';
import { Device } from '../../types';
import { useWebSocket } from '../../websocket/socket';

interface CustomSensorCardProps {
  device: Device;
}

export const CustomSensorCard: React.FC<CustomSensorCardProps> = ({ device }) => {
  const { telemetry } = useWebSocket();

  // Read telemetry for this deviceUid or sensors list
  const liveTelemetry = telemetry[device.deviceUid] || {};

  // Try to find temp and humidity values
  const tempVal =
    liveTelemetry['temperature'] ??
    (device.sensors?.find((s) => s.type.toLowerCase().includes('temp'))?.readings?.[0]?.value ??
      28.4);

  const humidVal =
    liveTelemetry['humidity'] ??
    (device.sensors?.find((s) => s.type.toLowerCase().includes('humid'))?.readings?.[0]?.value ??
      72);

  return (
    <div className="bg-surface border border-outline-variant rounded-xl p-md flex flex-col justify-between min-h-[160px] group hover:border-outline transition-colors shadow-sm shadow-black/5 relative overflow-hidden">
      {/* Header */}
      <div className="flex justify-between items-start z-10 relative">
        <div className="flex items-center gap-sm">
          <span className="material-symbols-outlined text-on-surface-variant">
            thermostat
          </span>
          <div>
            <h3 className="font-body-lg text-body-lg font-medium text-on-surface">
              {device.name}
            </h3>
            <span className="text-xs text-outline font-data-mono">
              {device.deviceUid}
            </span>
          </div>
        </div>
      </div>

      {/* Primary Metrics */}
      <div className="mt-md flex gap-md z-10 relative">
        <div>
          <span className="font-label-caps text-label-caps text-on-surface-variant block mb-1">
            Temp
          </span>
          <span className="font-headline-lg text-headline-lg text-on-surface font-bold">
            {typeof tempVal === 'number' ? tempVal.toFixed(1) : tempVal}°C
          </span>
        </div>
        <div>
          <span className="font-label-caps text-label-caps text-on-surface-variant block mb-1">
            Humidity
          </span>
          <span className="font-headline-lg text-headline-lg text-on-surface font-bold">
            {typeof humidVal === 'number' ? humidVal.toFixed(1) : humidVal}%
          </span>
        </div>
      </div>

      {/* Decorative Sparkline SVG curve */}
      <div className="absolute bottom-0 left-0 w-full h-12 opacity-40 pointer-events-none">
        <svg
          className="w-full h-full stroke-primary fill-none"
          preserveAspectRatio="none"
          strokeWidth="1.5"
          viewBox="0 0 100 20"
        >
          <path d="M0,15 L10,12 L20,16 L30,8 L40,10 L50,4 L60,8 L70,2 L80,6 L90,1 L100,5" />
        </svg>
      </div>
    </div>
  );
};
