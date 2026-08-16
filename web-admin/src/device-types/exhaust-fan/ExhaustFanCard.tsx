import React, { useState } from 'react';
import { Device, ExhaustFanState } from '../../types';
import { devicesApi } from '../../api/devices';
import { useWebSocket } from '../../websocket/socket';

interface ExhaustFanCardProps {
  device: Device;
}

export const ExhaustFanCard: React.FC<ExhaustFanCardProps> = ({ device }) => {
  const { deviceStates } = useWebSocket();
  const [isSending, setIsSending] = useState(false);

  const liveState = (deviceStates[device.deviceUid] ||
    device.metadata || {
      power: false,
      speed: 0,
    }) as unknown as ExhaustFanState;

  const isPowerOn = !!liveState.power && liveState.speed > 0;
  const currentSpeed = liveState.speed || 0;

  const handleTogglePower = async () => {
    setIsSending(true);
    try {
      if (isPowerOn) {
        await devicesApi.executeCommand(device.id, { action: 'off' });
      } else {
        await devicesApi.executeCommand(device.id, { action: 'set_speed', speed: 1 });
      }
    } catch (err) {
      console.error('Failed to toggle fan power:', err);
    } finally {
      setIsSending(false);
    }
  };

  const handleSetSpeed = async (speed: number) => {
    setIsSending(true);
    try {
      await devicesApi.executeCommand(device.id, { action: 'set_speed', speed });
    } catch (err) {
      console.error(`Failed to set fan speed to ${speed}:`, err);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="bg-surface border border-outline-variant rounded-xl p-md flex flex-col justify-between min-h-[160px] group hover:border-outline transition-colors shadow-sm shadow-black/5">
      {/* Top Bar */}
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-sm">
          <span
            className={`material-symbols-outlined text-on-surface-variant ${
              isPowerOn ? 'text-primary animate-spin' : ''
            }`}
            style={{ animationDuration: currentSpeed === 3 ? '1s' : currentSpeed === 2 ? '2s' : '3s' }}
          >
            mode_fan
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
        <div
          className={`flex items-center gap-xs font-label-caps text-label-caps px-2 py-0.5 rounded-full ${
            isPowerOn
              ? 'text-primary bg-primary-fixed-dim/30'
              : 'text-outline-variant bg-surface-container-highest'
          }`}
        >
          {isPowerOn && (
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          )}
          {isPowerOn ? 'Running' : 'Off'}
        </div>
      </div>

      {/* Speed Selector & Power Toggle */}
      <div className="mt-md flex items-center justify-between">
        <div className="flex items-center gap-xs font-data-mono text-data-mono text-on-surface-variant">
          <span className="material-symbols-outlined text-[16px]">speed</span>
          <div className="flex items-center gap-1">
            {[1, 2, 3].map((s) => (
              <button
                key={s}
                onClick={() => handleSetSpeed(s)}
                disabled={isSending}
                className={`w-6 h-6 text-xs rounded font-bold border ${
                  isPowerOn && currentSpeed === s
                    ? 'bg-primary text-on-primary border-primary'
                    : 'bg-surface-container-low text-on-surface-variant border-outline-variant hover:bg-surface-container-highest'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Toggle Pill Button */}
        <button
          onClick={handleTogglePower}
          disabled={isSending}
          title={isPowerOn ? 'Turn Off' : 'Turn On'}
          className={`w-12 h-6 rounded-full relative cursor-pointer active:scale-95 transition-all duration-200 ${
            isPowerOn ? 'bg-primary' : 'bg-outline-variant'
          }`}
        >
          <div
            className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-all duration-200 ${
              isPowerOn ? 'right-1' : 'left-1'
            }`}
          />
        </button>
      </div>
    </div>
  );
};
