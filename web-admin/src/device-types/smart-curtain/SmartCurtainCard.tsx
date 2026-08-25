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

  const [sliderVal, setSliderVal] = useState<number | null>(null);

  const displayPos = sliderVal !== null ? sliderVal : currentPos;

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSliderVal(parseInt(e.target.value, 10));
  };

  const handleSliderCommit = () => {
    if (sliderVal !== null) {
      handleSetPosition(sliderVal);
      setSliderVal(null);
    }
  };

  return (
    <div className="bg-surface border border-outline-variant rounded-xl p-md flex flex-col justify-between min-h-[180px] group hover:border-outline transition-colors shadow-sm shadow-black/5">
      {/* Top Bar */}
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-sm">
          <span className="material-symbols-outlined text-primary text-2xl">
            roller_shades
          </span>
          <div>
            <h3 className="font-body-lg text-body-lg font-medium text-on-surface">
              {device.name}
            </h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-xs text-outline font-data-mono">
                {device.deviceUid}
              </span>
              <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-semibold border border-primary/20">
                IR Limit Mode
              </span>
            </div>
          </div>
        </div>
        <div className="text-right">
          <span className="font-data-mono text-data-mono text-primary font-bold text-lg">
            {currentPos === 100 ? '100%' : currentPos === 0 ? '0%' : `${currentPos}%`}
          </span>
          <div className="text-[11px] capitalize text-primary font-medium flex items-center justify-end gap-1">
            {liveState.state === 'opening' && (
              <span className="material-symbols-outlined text-xs animate-spin">sync</span>
            )}
            {liveState.state === 'closing' && (
              <span className="material-symbols-outlined text-xs animate-spin">sync</span>
            )}
            {liveState.state || 'stopped'}
          </div>
        </div>
      </div>

      {/* Position Status Indicator */}
      <div className="mt-sm p-2 bg-surface-container-low rounded-lg border border-outline-variant/40 flex items-center justify-between text-xs">
        <span className="text-outline font-medium">State:</span>
        <span className="font-bold text-on-surface">
          {currentPos === 100 ? 'Fully Open (100%)' : currentPos === 0 ? 'Fully Closed (0%)' : `Position (${currentPos}%)`}
        </span>
      </div>

      {/* Quick Action Controls */}
      <div className="mt-sm grid grid-cols-3 gap-xs">
        <button
          onClick={() => handleAction('close')}
          disabled={isSending}
          className={`py-2 text-xs font-bold rounded-lg border transition-all flex items-center justify-center gap-1 active:scale-95 disabled:opacity-50 ${
            currentPos === 0
              ? 'bg-surface-container-highest text-outline border-outline-variant'
              : 'bg-surface-container-low hover:bg-surface-container-highest text-on-surface border-outline-variant'
          }`}
        >
          <span className="material-symbols-outlined text-[14px]">south</span>
          Tutup (0%)
        </button>
        <button
          onClick={() => handleAction('stop')}
          disabled={isSending}
          className="py-2 text-xs font-bold rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 border border-amber-500/30 active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-1"
        >
          <span className="material-symbols-outlined text-[14px]">pause</span>
          Stop
        </button>
        <button
          onClick={() => handleAction('open')}
          disabled={isSending}
          className={`py-2 text-xs font-bold rounded-lg border transition-all flex items-center justify-center gap-1 active:scale-95 disabled:opacity-50 ${
            currentPos === 100
              ? 'bg-primary text-on-primary border-primary'
              : 'bg-primary/90 hover:bg-primary text-on-primary border-primary'
          }`}
        >
          <span className="material-symbols-outlined text-[14px]">north</span>
          Buka (100%)
        </button>
      </div>
    </div>
  );
};

