import React, { useState } from 'react';
import { Device, SmartCurtainState } from '../../types';
import { devicesApi } from '../../api/devices';
import { useWebSocket } from '../../websocket/socket';

interface SmartCurtainCardProps {
  device: Device;
}

export const SmartCurtainCard: React.FC<SmartCurtainCardProps> = ({ device }) => {
  const { deviceStates } = useWebSocket();
  const [isSending, setIsSending] = useState(false);

  const liveState = (deviceStates[device.deviceUid] ||
    device.metadata || {
      position: 100,
      state: 'stopped',
    }) as unknown as SmartCurtainState;

  const currentPos = liveState.position ?? 100;

  const handleSetPosition = async (newPos: number) => {
    setIsSending(true);
    try {
      await devicesApi.executeCommand(device.id, {
        action: 'set_position',
        position: newPos,
      });
    } catch (err) {
      console.error('Failed to set curtain position:', err);
    } finally {
      setIsSending(false);
    }
  };

  const handleAction = async (action: 'open' | 'close' | 'stop') => {
    setIsSending(true);
    try {
      await devicesApi.executeCommand(device.id, { action });
    } catch (err) {
      console.error(`Failed to ${action} curtain:`, err);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="bg-surface border border-outline-variant rounded-xl p-md flex flex-col justify-between min-h-[160px] group hover:border-outline transition-colors shadow-sm shadow-black/5">
      {/* Top Bar */}
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-sm">
          <span className="material-symbols-outlined text-on-surface-variant">
            blinds
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
        <span className="font-data-mono text-data-mono text-primary font-bold">
          {currentPos}%
        </span>
      </div>

      {/* Position Bar & Slider */}
      <div className="mt-md flex flex-col gap-sm">
        <div className="w-full h-1.5 bg-surface-container-highest rounded-full relative overflow-hidden">
          <div
            className="absolute left-0 top-0 h-full bg-primary rounded-full transition-all duration-300"
            style={{ width: `${currentPos}%` }}
          />
        </div>
        <div className="flex justify-between font-label-caps text-label-caps text-outline-variant">
          <span>Closed (0%)</span>
          <span className="capitalize text-primary">{liveState.state || 'stopped'}</span>
          <span>Open (100%)</span>
        </div>
      </div>

      {/* Quick Action Controls */}
      <div className="mt-sm grid grid-cols-3 gap-xs">
        <button
          onClick={() => handleAction('close')}
          disabled={isSending}
          className="py-1 text-xs font-semibold rounded bg-surface-container-low hover:bg-surface-container-highest text-on-surface border border-outline-variant active:scale-95 disabled:opacity-50"
        >
          Close
        </button>
        <button
          onClick={() => handleAction('stop')}
          disabled={isSending}
          className="py-1 text-xs font-semibold rounded bg-surface-container-low hover:bg-surface-container-highest text-on-surface border border-outline-variant active:scale-95 disabled:opacity-50"
        >
          Stop
        </button>
        <button
          onClick={() => handleAction('open')}
          disabled={isSending}
          className="py-1 text-xs font-semibold rounded bg-surface-container-low hover:bg-surface-container-highest text-on-surface border border-outline-variant active:scale-95 disabled:opacity-50"
        >
          Open
        </button>
      </div>
    </div>
  );
};
