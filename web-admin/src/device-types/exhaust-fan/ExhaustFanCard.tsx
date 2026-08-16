import React, { useState, useEffect } from 'react';
import { Device, ExhaustFanState, FanOperationState, DuctPosition } from '../../types';
import { devicesApi } from '../../api/devices';
import { useWebSocket } from '../../websocket/socket';

interface ExhaustFanCardProps {
  device: Device;
}

const OPERATION_STATE_LABELS: Record<FanOperationState, string> = {
  BOOTING: 'Booting...',
  IDLE: 'Idle (Off)',
  OPENING_DUCT: 'Opening Duct...',
  CLOSING_DUCT: 'Closing Duct...',
  STOPPING_FAN: 'Stopping Fan...',
  WAITING_MOTOR_STOP: 'Waiting Motor Stop...',
  CHANGING_DIRECTION: 'Changing Direction...',
  WAITING_RELAY_SETTLE: 'Relay Settling...',
  STARTING_FAN: 'Starting Fan...',
  RUNNING: 'Running',
  ERROR: 'Error',
};

const DUCT_POSITION_INFO: Record<DuctPosition, { label: string; color: string; icon: string }> = {
  OPEN: { label: 'Open', color: 'text-[#059669]', icon: 'door_open' },
  CLOSED: { label: 'Closed', color: 'text-outline', icon: 'door_back' },
  OPENING: { label: 'Opening...', color: 'text-amber-600', icon: 'sync' },
  CLOSING: { label: 'Closing...', color: 'text-amber-600', icon: 'sync' },
  UNKNOWN: { label: 'Unknown', color: 'text-outline', icon: 'help' },
  ERROR: { label: 'Error', color: 'text-error', icon: 'error' },
};

export const ExhaustFanCard: React.FC<ExhaustFanCardProps> = ({ device }) => {
  const { deviceStates } = useWebSocket();
  const [isSending, setIsSending] = useState(false);

  // Optimistic local state — updated immediately on click so UI doesn't feel stuck
  const [localPower, setLocalPower] = useState<boolean | null>(null);
  const [localDirection, setLocalDirection] = useState<'INTAKE' | 'EXHAUST' | null>(null);

  // Merge DB metadata (desired/persisted) with WebSocket real-time (actual hardware)
  const dbState = (device.metadata ?? {}) as unknown as ExhaustFanState;
  const wsState = (deviceStates[device.deviceUid] ?? {}) as unknown as ExhaustFanState;
  const serverState: ExhaustFanState = { ...dbState, ...wsState };

  const serverDesiredPower = serverState.desiredPower ?? false;
  const serverDesiredDirection = serverState.desiredDirection ?? 'EXHAUST';

  // Clear optimistic state once server catches up
  useEffect(() => {
    if (localPower !== null && serverDesiredPower === localPower) {
      setLocalPower(null);
    }
  }, [serverDesiredPower, localPower]);

  useEffect(() => {
    if (localDirection !== null && serverDesiredDirection === localDirection) {
      setLocalDirection(null);
    }
  }, [serverDesiredDirection, localDirection]);

  // Effective displayed values: local (optimistic) if set, else server
  const desiredPower = localPower ?? serverDesiredPower;
  const desiredDirection = localDirection ?? serverDesiredDirection;

  const isRunning = serverState.operationState === 'RUNNING';
  const isTransitioning =
    serverState.operationState !== undefined &&
    serverState.operationState !== 'IDLE' &&
    serverState.operationState !== 'RUNNING' &&
    serverState.operationState !== 'ERROR';
  const hasError = !!serverState.errorCode && serverState.errorCode !== 'NONE';

  const actualDirection = serverState.direction ?? desiredDirection;
  const ductPos = serverState.ductPosition ?? 'UNKNOWN';
  const ductInfo = DUCT_POSITION_INFO[ductPos];
  const opState = serverState.operationState ?? 'IDLE';
  const opLabel = OPERATION_STATE_LABELS[opState] ?? opState;

  const sendCommand = async (action: string, direction?: string) => {
    setIsSending(true);
    try {
      await devicesApi.executeCommand(device.id, { action, direction });
    } catch (err) {
      console.error(`[ExhaustFan] Command failed:`, err);
      // Rollback optimistic state on error
      setLocalPower(null);
      setLocalDirection(null);
    } finally {
      setIsSending(false);
    }
  };

  const handlePowerToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = !desiredPower;
    setLocalPower(next); // optimistic — update UI immediately
    if (next) {
      void sendCommand('on', desiredDirection);
    } else {
      void sendCommand('off');
    }
  };

  const handleSetDirection = (e: React.MouseEvent, dir: 'INTAKE' | 'EXHAUST') => {
    e.stopPropagation();
    setLocalDirection(dir); // optimistic — update UI immediately
    void sendCommand(desiredPower ? 'on' : 'set_direction', dir);
  };

  return (
    <div className="bg-surface border border-outline-variant rounded-xl p-md flex flex-col justify-between min-h-[190px] group hover:border-outline transition-colors shadow-sm shadow-black/5">
      {/* Top Bar */}
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-sm">
          <div className={`p-2 rounded-xl transition-colors ${isRunning ? 'bg-primary/10' : 'bg-surface-container-highest'}`}>
            <span
              className={`material-symbols-outlined text-2xl ${
                isRunning
                  ? 'text-primary animate-spin'
                  : isTransitioning
                    ? 'text-amber-600 animate-pulse'
                    : 'text-on-surface-variant'
              }`}
              style={{ animationDuration: isRunning ? '1.2s' : '1.5s' }}
            >
              mode_fan
            </span>
          </div>
          <div>
            <h3 className="font-body-lg text-body-lg font-medium text-on-surface line-clamp-1">
              {device.name}
            </h3>
            <span className="text-xs text-outline font-data-mono">{device.deviceUid}</span>
          </div>
        </div>

        {/* Operation State Badge */}
        <div
          className={`flex items-center gap-xs font-label-caps text-label-caps px-2 py-0.5 rounded-full whitespace-nowrap text-[10px] font-bold ${
            hasError
              ? 'text-error bg-error-container/30'
              : isRunning
                ? 'text-primary bg-primary-container/20'
                : isTransitioning
                  ? 'text-amber-700 bg-amber-50'
                  : 'text-outline bg-surface-container-highest'
          }`}
        >
          {(isRunning || isTransitioning) && (
            <span className={`w-1.5 h-1.5 rounded-full ${isRunning ? 'bg-primary animate-pulse' : 'bg-amber-500 animate-pulse'}`} />
          )}
          {hasError ? '⚠ Error' : opLabel}
        </div>
      </div>

      {/* Direction indicator + Duct Status row */}
      <div className="mt-sm flex items-center justify-between text-xs">
        {/* Direction Buttons */}
        <div className="flex items-center gap-1">
          {(['INTAKE', 'EXHAUST'] as const).map((dir) => (
            <button
              key={dir}
              onClick={(e) => handleSetDirection(e, dir)}
              disabled={isSending}
              className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-all cursor-pointer ${
                desiredDirection === dir
                  ? 'bg-primary text-on-primary border-primary'
                  : 'border-outline-variant text-on-surface-variant hover:border-outline hover:text-on-surface'
              }`}
            >
              {dir === 'INTAKE' ? '↙ Intake' : '↗ Exhaust'}
            </button>
          ))}
        </div>

        {/* Duct Status */}
        <div className={`flex items-center gap-1 ${ductInfo.color}`}>
          <span className={`material-symbols-outlined text-[14px] ${ductPos === 'OPENING' || ductPos === 'CLOSING' ? 'animate-spin' : ''}`}>
            {ductInfo.icon}
          </span>
          <span className="font-semibold text-[11px]">{ductInfo.label}</span>
        </div>
      </div>

      {/* Error Message */}
      {hasError && serverState.errorCode && serverState.errorCode !== 'NONE' && (
        <div className="mt-xs px-2.5 py-1.5 bg-error-container/20 border border-error/20 rounded-lg text-error text-[11px] font-mono">
          ⚠ {serverState.errorCode.replace(/_/g, ' ')}
        </div>
      )}

      {/* Power Toggle */}
      <div className="mt-sm flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs text-on-surface-variant">
          <span className="material-symbols-outlined text-[15px]">electrical_services</span>
          <span className={`font-mono font-semibold transition-colors ${desiredPower ? 'text-primary' : 'text-outline'}`}>
            {desiredPower ? 'ON' : 'OFF'}
          </span>
          {/* Pending indicator while waiting for server */}
          {localPower !== null && (
            <span className="text-[10px] text-amber-600 animate-pulse">sending...</span>
          )}
        </div>
        <button
          onClick={handlePowerToggle}
          disabled={isSending}
          title={desiredPower ? 'Turn Off Fan' : 'Turn On Fan'}
          className={`w-12 h-6 rounded-full relative cursor-pointer active:scale-95 transition-all duration-200 disabled:opacity-60 ${
            desiredPower ? 'bg-primary' : 'bg-outline-variant'
          }`}
        >
          <div
            className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-all duration-200 ${
              desiredPower ? 'right-1' : 'left-1'
            }`}
          />
        </button>
      </div>
    </div>
  );
};
