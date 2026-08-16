import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { devicesApi } from '../../api/devices';
import { useWebSocket } from '../../websocket/socket';
import { ExhaustFanState, FanOperationState, DuctPosition } from '../../types';

const OPERATION_STATE_LABELS: Record<FanOperationState, { label: string; color: string }> = {
  BOOTING: { label: 'Booting', color: 'text-amber-600' },
  IDLE: { label: 'Idle (Off)', color: 'text-outline' },
  OPENING_DUCT: { label: 'Opening Duct...', color: 'text-amber-600' },
  CLOSING_DUCT: { label: 'Closing Duct...', color: 'text-amber-600' },
  STOPPING_FAN: { label: 'Stopping Fan...', color: 'text-amber-600' },
  WAITING_MOTOR_STOP: { label: 'Waiting Motor Stop...', color: 'text-amber-600' },
  CHANGING_DIRECTION: { label: 'Changing Direction...', color: 'text-amber-600' },
  WAITING_RELAY_SETTLE: { label: 'Relay Settling...', color: 'text-amber-600' },
  STARTING_FAN: { label: 'Starting Fan...', color: 'text-primary' },
  RUNNING: { label: 'Running', color: 'text-primary' },
  ERROR: { label: 'Error', color: 'text-error' },
};

const DUCT_ICONS: Record<DuctPosition, { icon: string; color: string }> = {
  OPEN: { icon: 'door_open', color: 'text-[#059669]' },
  CLOSED: { icon: 'door_back', color: 'text-outline' },
  OPENING: { icon: 'sync', color: 'text-amber-600' },
  CLOSING: { icon: 'sync', color: 'text-amber-600' },
  UNKNOWN: { icon: 'help', color: 'text-outline' },
  ERROR: { icon: 'error', color: 'text-error' },
};

export const ExhaustFanMonitoringPage: React.FC = () => {
  const { deviceUid } = useParams<{ deviceUid: string }>();
  const navigate = useNavigate();
  const { deviceStates, isConnected } = useWebSocket();
  const [isSending, setIsSending] = useState(false);

  // Optimistic local state — updated immediately on user interaction
  // so UI feels responsive without waiting for server roundtrip
  const [localPower, setLocalPower] = useState<boolean | null>(null);
  const [localDirection, setLocalDirection] = useState<'INTAKE' | 'EXHAUST' | null>(null);

  const {
    data: device,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['device-by-uid', deviceUid],
    queryFn: async () => {
      const all = await devicesApi.getAll();
      const found = all.find((d) => d.deviceUid === deviceUid);
      if (!found) throw new Error('Device not found');
      return found;
    },
    enabled: !!deviceUid,
  });

  // Merge: DB metadata (desired/persisted) + WebSocket real-time (actual hardware)
  const dbState = (device?.metadata ?? {}) as unknown as ExhaustFanState;
  const wsState = (deviceUid ? (deviceStates[deviceUid] ?? {}) : {}) as unknown as ExhaustFanState;
  const serverState: ExhaustFanState = { ...dbState, ...wsState };

  // Effective desired values: local optimistic state takes priority until server echoes back
  // Once server state matches local, local is cleared (null) to let server lead
  const serverDesiredPower = serverState.desiredPower ?? false;
  const serverDesiredDirection = serverState.desiredDirection ?? 'EXHAUST';

  // Sync local state when server catches up
  React.useEffect(() => {
    if (localPower !== null && serverDesiredPower === localPower) {
      setLocalPower(null);
    }
  }, [serverDesiredPower, localPower]);

  React.useEffect(() => {
    if (localDirection !== null && serverDesiredDirection === localDirection) {
      setLocalDirection(null);
    }
  }, [serverDesiredDirection, localDirection]);

  // What we display: local (optimistic) if set, otherwise server value
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
  const opState = serverState.operationState ?? 'IDLE';
  const opInfo = OPERATION_STATE_LABELS[opState] ?? { label: opState, color: 'text-outline' };
  const ductIconInfo = DUCT_ICONS[ductPos] ?? { icon: 'help', color: 'text-outline' };
  const liveState = serverState; // alias used in JSX below

  const queryClient = useQueryClient();

  const sendCommand = async (action: string, direction?: string) => {
    if (!device) return;
    setIsSending(true);
    try {
      await devicesApi.executeCommand(device.id, { action, direction });
      // Immediately refetch command history — don't wait for polling
      void queryClient.invalidateQueries({ queryKey: ['device-commands', device.id] });
    } catch (err) {
      console.error('[ExhaustFan] Command error:', err);
    } finally {
      setIsSending(false);
    }
  };

  const handlePowerToggle = () => {
    const next = !desiredPower;
    setLocalPower(next); // optimistic update
    if (next) {
      sendCommand('on', desiredDirection);
    } else {
      sendCommand('off');
    }
  };

  const handleSetDirection = (dir: 'INTAKE' | 'EXHAUST') => {
    setLocalDirection(dir); // optimistic update
    sendCommand(desiredPower ? 'on' : 'set_direction', dir);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-4">
          <span className="material-symbols-outlined text-primary text-[48px] animate-spin">progress_activity</span>
          <p className="text-on-surface-variant">Loading device...</p>
        </div>
      </div>
    );
  }

  if (error || !device) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <span className="material-symbols-outlined text-error text-[48px]">error</span>
        <p className="text-error">Device not found or an error occurred.</p>
        <button onClick={() => navigate('/monitoring')} className="btn-primary-sm">
          ← Back to Monitoring
        </button>
      </div>
    );
  }

  return (
    <div className="page-container space-y-lg">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-xs text-sm text-on-surface-variant">
        <Link to="/monitoring" className="hover:text-on-surface transition-colors">Monitoring</Link>
        <span className="material-symbols-outlined text-[14px]">chevron_right</span>
        <span className="text-on-surface font-medium">Exhaust Fan</span>
        <span className="material-symbols-outlined text-[14px]">chevron_right</span>
        <span className="text-on-surface font-medium line-clamp-1">{device.name}</span>
      </nav>

      {/* Header */}
      <div className="flex justify-between items-start flex-wrap gap-md">
        <div className="flex items-center gap-sm">
          <div className={`p-3 rounded-2xl transition-colors ${isRunning ? 'bg-primary/10' : 'bg-surface-container-highest'}`}>
            <span
              className={`material-symbols-outlined text-[36px] ${
                isRunning ? 'text-primary animate-spin' : isTransitioning ? 'text-amber-600 animate-pulse' : 'text-on-surface-variant'
              }`}
              style={{ animationDuration: isRunning ? '1.2s' : '1.5s' }}
            >
              mode_fan
            </span>
          </div>
          <div>
            <h1 className="font-headline-lg text-headline-lg text-on-surface font-bold">{device.name}</h1>
            <span className="text-sm text-outline font-data-mono">{device.deviceUid}</span>
            {device.room && (
              <div className="text-xs text-on-surface-variant mt-0.5">
                {device.room.home?.name} › {device.room.name}
              </div>
            )}
          </div>
        </div>

        {/* Right side: status badges */}
        <div className="flex flex-col items-end gap-2">
          {/* WebSocket indicator */}
          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
            isConnected ? 'text-[#059669] bg-[#ecfdf5]' : 'text-amber-700 bg-amber-50'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-[#10b981] animate-pulse' : 'bg-amber-500'}`} />
            {isConnected ? 'Live' : 'Reconnecting...'}
          </div>
          {/* Device Status Badge */}
          <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold ${
            device.status === 'ONLINE' ? 'text-[#059669] bg-[#ecfdf5]' : 'text-error bg-error-container/40'
          }`}>
            <span className={`w-2 h-2 rounded-full ${device.status === 'ONLINE' ? 'bg-[#10b981] animate-pulse' : 'bg-error'}`} />
            {device.status}
          </div>
          {/* Last updated */}
          {liveState.lastUpdated && (
            <div className="text-[11px] text-outline font-mono">
              Last update: {new Date(liveState.lastUpdated).toLocaleTimeString()}
            </div>
          )}
        </div>
      </div>

      {/* Error Banner */}
      {hasError && liveState.errorCode && (
        <div className="flex items-center gap-sm p-md bg-error-container/20 border border-error/30 rounded-xl text-error">
          <span className="material-symbols-outlined text-[24px]">error</span>
          <div>
            <div className="font-semibold">Hardware Error</div>
            <div className="text-sm font-mono">{liveState.errorCode.replace(/_/g, ' ')}</div>
          </div>
        </div>
      )}

      {/* Main Status Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-md">
        {/* Operation State */}
        <div className="bg-surface border border-outline-variant rounded-xl p-md flex flex-col gap-xs">
          <div className="text-xs text-outline font-bold uppercase tracking-wider">State</div>
          <div className={`text-base font-bold ${opInfo.color}`}>{opInfo.label}</div>
          {(isRunning || isTransitioning) && (
            <div className={`w-2 h-2 rounded-full ${isRunning ? 'bg-primary animate-pulse' : 'bg-amber-500 animate-pulse'}`} />
          )}
        </div>

        {/* Duct Position */}
        <div className="bg-surface border border-outline-variant rounded-xl p-md flex flex-col gap-xs">
          <div className="text-xs text-outline font-bold uppercase tracking-wider">Duct</div>
          <div className={`flex items-center gap-xs ${ductIconInfo.color}`}>
            <span className={`material-symbols-outlined text-[20px] ${(ductPos === 'OPENING' || ductPos === 'CLOSING') ? 'animate-spin' : ''}`}>
              {ductIconInfo.icon}
            </span>
            <span className="font-bold">{ductPos}</span>
          </div>
        </div>

        {/* Actual Direction */}
        <div className="bg-surface border border-outline-variant rounded-xl p-md flex flex-col gap-xs">
          <div className="text-xs text-outline font-bold uppercase tracking-wider">Direction</div>
          <div className="flex items-center gap-xs text-on-surface">
            <span className="material-symbols-outlined text-[20px] text-primary">
              {actualDirection === 'INTAKE' ? 'download' : 'upload'}
            </span>
            <span className="font-bold">{actualDirection}</span>
          </div>
          {desiredDirection !== actualDirection && (
            <div className="text-[11px] text-amber-600">
              Desired: {desiredDirection}
            </div>
          )}
        </div>

        {/* Power */}
        <div className="bg-surface border border-outline-variant rounded-xl p-md flex flex-col gap-xs">
          <div className="text-xs text-outline font-bold uppercase tracking-wider">Power</div>
          <div className={`font-bold text-lg ${desiredPower ? 'text-primary' : 'text-outline'}`}>
            {desiredPower ? 'ON' : 'OFF'}
          </div>
          {liveState.power !== undefined && liveState.power !== desiredPower && (
            <div className="text-[11px] text-amber-600">
              Actual: {liveState.power ? 'ON' : 'OFF'}
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="bg-surface border border-outline-variant rounded-xl p-lg flex flex-col gap-md">
        <h2 className="text-base font-bold text-on-surface">Controls</h2>

        {/* Power Toggle */}
        <div className="flex items-center justify-between p-md bg-surface-container-low rounded-xl border border-outline-variant/50">
          <div className="flex items-center gap-sm">
            <span className="material-symbols-outlined text-[22px] text-on-surface-variant">power_settings_new</span>
            <div>
              <div className="font-semibold text-on-surface">Fan Power</div>
              <div className="text-xs text-outline">{desiredPower ? 'Fan is ON' : 'Fan is OFF'}</div>
            </div>
          </div>
          <button
            onClick={handlePowerToggle}
            disabled={isSending}
            className={`w-14 h-7 rounded-full relative cursor-pointer active:scale-95 transition-all duration-200 disabled:opacity-60 ${
              desiredPower ? 'bg-primary' : 'bg-outline-variant'
            }`}
          >
            <div className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-all duration-200 ${desiredPower ? 'right-1' : 'left-1'}`} />
          </button>
        </div>

        {/* Direction */}
        <div className="p-md bg-surface-container-low rounded-xl border border-outline-variant/50">
          <div className="flex items-center gap-sm mb-sm">
            <span className="material-symbols-outlined text-[22px] text-on-surface-variant">air</span>
            <div>
              <div className="font-semibold text-on-surface">Airflow Direction</div>
              <div className="text-xs text-outline">
                {desiredPower && actualDirection !== desiredDirection
                  ? '⚠ Changing direction — fan will pause automatically'
                  : 'Select desired airflow direction'}
              </div>
            </div>
          </div>
          <div className="flex gap-md">
            {(['INTAKE', 'EXHAUST'] as const).map((dir) => (
              <button
                key={dir}
                onClick={() => handleSetDirection(dir)}
                disabled={isSending}
                className={`flex-1 flex flex-col items-center gap-xs p-md rounded-xl border-2 transition-all cursor-pointer disabled:opacity-60 ${
                  desiredDirection === dir
                    ? 'border-primary bg-primary-container/20 text-primary'
                    : 'border-outline-variant text-on-surface-variant hover:border-outline hover:bg-surface-container-highest'
                }`}
              >
                <span className="material-symbols-outlined text-[28px]">
                  {dir === 'INTAKE' ? 'download' : 'upload'}
                </span>
                <span className="font-bold text-sm">{dir === 'INTAKE' ? '↙ Intake' : '↗ Exhaust'}</span>
                <span className="text-[11px] opacity-70">
                  {dir === 'INTAKE' ? 'Fresh air in' : 'Stale air out'}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Safety Note */}
        <div className="flex items-start gap-xs p-sm bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs">
          <span className="material-symbols-outlined text-[16px] mt-0.5">shield</span>
          <div>
            <strong>Safety Interlock:</strong> The ESP32 firmware automatically stops the fan before changing direction and waits for motor stop (3s) before switching relay. Commands are queued safely.
          </div>
        </div>
      </div>

      {/* State Timeline / Command History */}
      <div className="bg-surface border border-outline-variant rounded-xl p-lg flex flex-col gap-sm">
        <h2 className="text-base font-bold text-on-surface">Recent Commands</h2>
        <RecentCommands deviceId={device.id} />
      </div>
    </div>
  );
};

/** Sub-component for recent commands list */
const RecentCommands: React.FC<{ deviceId: number }> = ({ deviceId }) => {
  const { data: commands = [], isLoading } = useQuery({
    queryKey: ['device-commands', deviceId],
    queryFn: () => devicesApi.getCommands(deviceId, 10),
    refetchInterval: 2000,  // Poll every 2s as fallback; WebSocket invalidation handles instant updates
    staleTime: 0,           // Always consider stale so invalidation triggers immediately
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-md">
        <span className="material-symbols-outlined text-outline animate-spin">progress_activity</span>
      </div>
    );
  }

  if (!commands.length) {
    return <p className="text-outline text-sm">No commands sent yet.</p>;
  }

  const STATUS_CLASSES = {
    PENDING: 'text-amber-700 bg-amber-50',
    SENT: 'text-[#0284c7] bg-blue-50',
    ACKNOWLEDGED: 'text-[#059669] bg-[#ecfdf5]',
    FAILED: 'text-error bg-error-container/30',
  };

  return (
    <div className="space-y-xs">
      {commands.map((cmd) => {
        const payload = cmd.payload as Record<string, unknown> | null;
        return (
          <div
            key={cmd.id}
            className="flex items-center justify-between text-sm p-sm bg-surface-container-low rounded-lg border border-outline-variant/50"
          >
            <div className="flex items-center gap-sm">
              <span className="material-symbols-outlined text-[16px] text-on-surface-variant">
                {cmd.command === 'off' ? 'power_off' : cmd.command === 'set_direction' ? 'air' : 'power_settings_new'}
              </span>
              <div>
                <span className="font-mono font-semibold text-on-surface uppercase">{cmd.command}</span>
                {payload?.desiredDirection && (
                  <span className="ml-1.5 text-xs text-outline">→ {String(payload.desiredDirection)}</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-sm">
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${STATUS_CLASSES[cmd.status] ?? 'text-outline bg-surface-container-highest'}`}>
                {cmd.status}
              </span>
              <span className="text-[11px] text-outline font-mono hidden sm:block">
                {new Date(cmd.createdAt).toLocaleTimeString()}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
