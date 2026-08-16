import React, { useState } from 'react';
import { Device, SmartDoorState } from '../../types';
import { devicesApi } from '../../api/devices';
import { useWebSocket } from '../../websocket/socket';

interface SmartDoorCardProps {
  device: Device;
}

export const SmartDoorCard: React.FC<SmartDoorCardProps> = ({ device }) => {
  const { deviceStates } = useWebSocket();
  const [isLoading, setIsLoading] = useState(false);

  // Read state from live WebSocket or device metadata
  const liveState = (deviceStates[device.deviceUid] ||
    device.metadata || {
      door: 'closed',
      lock: 'locked',
    }) as unknown as SmartDoorState;

  const isLocked = liveState.lock === 'locked';

  const handleToggleLock = async () => {
    setIsLoading(true);
    try {
      const nextAction = isLocked ? 'unlock' : 'lock';
      await devicesApi.executeCommand(device.id, { action: nextAction });
    } catch (err) {
      console.error('Failed to toggle door lock:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-surface border border-outline-variant rounded-xl p-md flex flex-col justify-between min-h-[160px] group hover:border-outline transition-colors shadow-sm shadow-black/5">
      {/* Top Details */}
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-sm">
          <span className="material-symbols-outlined text-on-surface-variant">
            door_front
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
            isLocked
              ? 'text-[#059669] bg-[#ecfdf5]'
              : 'text-[#d97706] bg-[#fffbeb]'
          }`}
        >
          <span className="material-symbols-outlined text-[14px]">
            {isLocked ? 'lock' : 'lock_open'}
          </span>
          {isLocked ? 'Locked' : 'Unlocked'}
        </div>
      </div>

      {/* Action Button */}
      <div className="mt-lg">
        <button
          onClick={handleToggleLock}
          disabled={isLoading}
          className={`w-full py-2 font-body-md text-body-md rounded-lg border border-outline-variant transition-colors flex items-center justify-center gap-sm cursor-pointer active:scale-98 disabled:opacity-50 ${
            isLocked
              ? 'bg-surface-container-low hover:bg-surface-container-highest text-on-surface'
              : 'bg-primary text-on-primary hover:bg-primary/90'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">
            {isLocked ? 'lock_open' : 'lock'}
          </span>
          {isLoading
            ? 'Sending Command...'
            : isLocked
              ? 'Unlock Door'
              : 'Lock Door'}
        </button>
      </div>
    </div>
  );
};
