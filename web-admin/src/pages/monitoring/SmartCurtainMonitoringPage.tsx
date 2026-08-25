import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { devicesApi } from '../../api/devices';
import { useWebSocket } from '../../websocket/socket';
import { SmartCurtainState } from '../../types';

export const SmartCurtainMonitoringPage: React.FC = () => {
  const { deviceUid } = useParams<{ deviceUid: string }>();
  const navigate = useNavigate();
  const { deviceStates, isConnected } = useWebSocket();
  const [isSending, setIsSending] = useState(false);
  const [sliderVal, setSliderVal] = useState<number | null>(null);

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

  // Merge DB state with real-time WebSocket state
  const dbState = (device?.metadata ?? {}) as unknown as SmartCurtainState;
  const wsState = (deviceUid ? (deviceStates[deviceUid] ?? {}) : {}) as unknown as SmartCurtainState;
  const liveState: SmartCurtainState = { ...dbState, ...wsState };

  const currentPos = liveState.position ?? 0;
  const motorState = liveState.state || 'stopped';
  const displayPos = sliderVal !== null ? sliderVal : currentPos;

  const handleSetPosition = async (newPos: number) => {
    if (!device) return;
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
    if (!device) return;
    setIsSending(true);
    try {
      await devicesApi.executeCommand(device.id, { action });
    } catch (err) {
      console.error(`Failed to execute ${action}:`, err);
    } finally {
      setIsSending(false);
    }
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSliderVal(parseInt(e.target.value, 10));
  };

  const handleSliderCommit = () => {
    if (sliderVal !== null) {
      handleSetPosition(sliderVal);
      setSliderVal(null);
    }
  };

  if (isLoading) {
    return (
      <div className="p-xl text-center text-outline flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-md">
          <span className="material-symbols-outlined text-4xl animate-spin text-primary">
            progress_activity
          </span>
          <span className="text-sm font-medium">Loading Smart Curtain monitoring dashboard...</span>
        </div>
      </div>
    );
  }

  if (error || !device) {
    return (
      <div className="p-xl text-center bg-surface border border-outline-variant rounded-xl text-error space-y-md">
        <span className="material-symbols-outlined text-4xl">error</span>
        <p>Smart Curtain device with UID "{deviceUid}" was not found.</p>
        <button onClick={() => navigate('/monitoring')} className="btn-primary-sm">
          Return to Monitoring
        </button>
      </div>
    );
  }

  // Diagnostics metadata
  const diag = (device.metadata?.diagnostics ?? {}) as Record<string, unknown>;

  return (
    <div className="space-y-lg">
      {/* Breadcrumb Navigation Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-md border-b border-outline-variant/60 pb-md">
        <div>
          <div className="flex items-center gap-2 text-xs text-outline mb-1 font-medium">
            <Link to="/monitoring" className="hover:text-primary transition-colors">
              Monitoring
            </Link>
            <span>/</span>
            <span className="text-on-surface font-semibold">Smart Curtain</span>
          </div>
          <div className="flex items-center gap-md">
            <h2 className="font-headline-lg text-headline-lg text-on-surface font-bold">
              {device.name}
            </h2>
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                device.status === 'ONLINE'
                  ? 'text-[#059669] bg-[#ecfdf5] border border-[#10b981]/30'
                  : 'text-error bg-error-container/40 border border-error/30'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  device.status === 'ONLINE' ? 'bg-[#10b981] animate-pulse' : 'bg-error'
                }`}
              />
              {device.status}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-md text-xs font-data-mono text-outline">
          <div className="bg-surface border border-outline-variant px-3 py-1.5 rounded-lg flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px] text-primary">fingerprint</span>
            <span>{device.deviceUid}</span>
          </div>
          {isConnected && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 text-[#059669] px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] animate-ping" />
              Live WebSocket
            </div>
          )}
        </div>
      </div>

      {/* Main Grid Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-lg">
        {/* Left Column: Interactive Roller Blind Visualizer */}
        <div className="bg-surface border border-outline-variant rounded-2xl p-lg flex flex-col items-center justify-between shadow-sm space-y-md">
          <div className="w-full flex justify-between items-center border-b border-outline-variant/60 pb-sm">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-xl">roller_shades</span>
              <h3 className="font-bold text-on-surface text-sm">Visual Blind Monitor</h3>
            </div>
            <span
              className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase ${
                motorState === 'opening'
                  ? 'bg-blue-500/15 text-blue-600 border border-blue-500/30 animate-pulse'
                  : motorState === 'closing'
                  ? 'bg-amber-500/15 text-amber-600 border border-amber-500/30 animate-pulse'
                  : 'bg-surface-container-high text-outline'
              }`}
            >
              {motorState}
            </span>
          </div>

          {/* Animated Graphic Window Frame */}
          <div className="w-full max-w-[240px] h-[280px] bg-sky-950/20 border-4 border-slate-700 rounded-xl relative overflow-hidden flex flex-col shadow-inner">
            {/* Sky background behind window */}
            <div className="absolute inset-0 bg-gradient-to-b from-sky-400/20 via-sky-200/10 to-amber-200/20 flex flex-col items-center justify-center">
              <span className="material-symbols-outlined text-amber-400/40 text-6xl">wb_sunny</span>
            </div>

            {/* Roller Blind Fabric Sheet (covers from top downward) */}
            <div
              className="w-full bg-gradient-to-b from-slate-800 via-slate-700 to-slate-900 border-b-4 border-slate-500 transition-all duration-500 relative z-10 shadow-lg"
              style={{ height: `${100 - displayPos}%` }}
            >
              {/* Fabric Texture Lines */}
              <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_4px,rgba(255,255,255,0.05)_4px)] bg-[size:100%_8px]" />
              {/* Bottom Pull Bar Handle */}
              <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-12 h-1 bg-slate-400 rounded-full opacity-60" />
            </div>

            {/* Window Glass Grid Lines */}
            <div className="absolute inset-0 border-t-2 border-slate-600/40 pointer-events-none grid grid-cols-2 grid-rows-2" />
          </div>

          <div className="text-center space-y-1">
            <div className="text-3xl font-extrabold font-data-mono text-primary">
              {displayPos}%
            </div>
            <p className="text-xs text-outline font-medium">
              {displayPos === 100
                ? 'Roller Blind Fully Open (100%)'
                : displayPos === 0
                ? 'Roller Blind Fully Closed (0%)'
                : `Partially Open (${displayPos}%)`}
            </p>
          </div>
        </div>

        {/* Right Column: Controls & Hardware Status (Spans 2 cols) */}
        <div className="lg:col-span-2 space-y-lg">
          {/* Real-time Position & Command Control Card */}
          <div className="bg-surface border border-outline-variant rounded-2xl p-lg space-y-md shadow-sm">
            <div className="flex justify-between items-center border-b border-outline-variant/60 pb-sm">
              <h3 className="font-bold text-on-surface text-base flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">tune</span>
                Position &amp; Motor Command Center
              </h3>
              {isSending && (
                <span className="text-xs text-primary font-bold animate-pulse flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm animate-spin">sync</span>
                  Sending Command...
                </span>
              )}
            </div>

            {/* IR Limit Mode Info Box */}
            <div className="space-y-sm bg-surface-container-low p-md rounded-xl border border-outline-variant/50">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-on-surface uppercase tracking-wider flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-primary">sensors</span>
                  Motor Control Mode: IR Limit Sensors
                </label>
                <span className="font-data-mono font-bold text-primary text-base">
                  {currentPos === 100 ? '100% (OPEN)' : currentPos === 0 ? '0% (CLOSED)' : `${currentPos}%`}
                </span>
              </div>

              <div className="text-xs text-outline leading-relaxed space-y-1">
                <p>• Motor berputar hingga <strong>Sensor IR Atas (Top IR) BERSIH</strong> $\rightarrow$ Stop pada <strong>100% (Buka Penuh)</strong>.</p>
                <p>• Motor berputar hingga <strong>Sensor IR Bawah (Bottom IR) TERTUTUP</strong> $\rightarrow$ Stop pada <strong>0% (Tutup Penuh)</strong>.</p>
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="grid grid-cols-3 gap-md">
              <button
                onClick={() => handleAction('close')}
                disabled={isSending}
                className={`py-3.5 px-4 rounded-xl border font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 shadow-sm ${
                  currentPos === 0
                    ? 'bg-surface-container-highest text-outline border-outline-variant'
                    : 'bg-surface-container-high hover:bg-surface-container-highest text-on-surface border-outline-variant'
                }`}
              >
                <span className="material-symbols-outlined text-lg">south</span>
                <span>TUTUP (0%)</span>
              </button>

              <button
                onClick={() => handleAction('stop')}
                disabled={isSending}
                className="py-3.5 px-4 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 border border-amber-500/30 font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 shadow-sm"
              >
                <span className="material-symbols-outlined text-lg">pause</span>
                <span>STOP MOTOR</span>
              </button>

              <button
                onClick={() => handleAction('open')}
                disabled={isSending}
                className={`py-3.5 px-4 rounded-xl border font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 shadow-sm ${
                  currentPos === 100
                    ? 'bg-primary text-on-primary border-primary'
                    : 'bg-primary/90 hover:bg-primary text-on-primary border-primary'
                }`}
              >
                <span className="material-symbols-outlined text-lg">north</span>
                <span>BUKA (100%)</span>
              </button>
            </div>
          </div>

          {/* Hardware Diagnostics Metrics */}
          <div className="bg-surface border border-outline-variant rounded-2xl p-lg space-y-md shadow-sm">
            <h3 className="font-bold text-on-surface text-base flex items-center gap-2 border-b border-outline-variant/60 pb-sm">
              <span className="material-symbols-outlined text-primary">memory</span>
              Hardware Diagnostics &amp; System Health
            </h3>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-md">
              <div className="bg-surface-container-low p-md rounded-xl border border-outline-variant/40 space-y-1">
                <div className="text-[10px] text-outline font-bold uppercase tracking-wider">Free Heap</div>
                <div className="text-sm font-bold text-on-surface font-data-mono">
                  {diag.freeHeap !== undefined ? `${Number(diag.freeHeap).toLocaleString()} B` : '--'}
                </div>
              </div>

              <div className="bg-surface-container-low p-md rounded-xl border border-outline-variant/40 space-y-1">
                <div className="text-[10px] text-outline font-bold uppercase tracking-wider">WiFi RSSI</div>
                <div className="text-sm font-bold text-on-surface font-data-mono">
                  {diag.rssi !== undefined ? `${diag.rssi} dBm` : '--'}
                </div>
              </div>

              <div className="bg-surface-container-low p-md rounded-xl border border-outline-variant/40 space-y-1">
                <div className="text-[10px] text-outline font-bold uppercase tracking-wider">IP Address</div>
                <div className="text-sm font-bold text-on-surface font-data-mono">
                  {(diag.ipAddress as string) || (device.ipAddress as string) || '--'}
                </div>
              </div>

              <div className="bg-surface-container-low p-md rounded-xl border border-outline-variant/40 space-y-1">
                <div className="text-[10px] text-outline font-bold uppercase tracking-wider">Firmware</div>
                <div className="text-sm font-bold text-primary font-data-mono">
                  {(diag.firmwareVersion as string) || (device.firmwareVersion as string) || 'v1.0.0'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
