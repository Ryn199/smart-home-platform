import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { devicesApi } from '../../api/devices';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { useWebSocket } from '../../websocket/socket';
import { Device, DeviceCommand, EspDiagnostics } from '../../types';

interface DeviceSettingsModalProps {
  device: Device | null;
  isOpen: boolean;
  onClose: () => void;
  allRooms: Array<{ id: number; name: string; homeName?: string }>;
  onSuccessNotification: (msg: string) => void;
  onErrorNotification: (msg: string) => void;
}

type TabType = 'diagnostics' | 'edit' | 'controls' | 'history';

// Helper function to format bytes into readable KB/MB
function formatBytes(bytes?: number | null): string {
  if (bytes === undefined || bytes === null || isNaN(bytes)) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

// Helper function to format milliseconds uptime into human-readable duration
function formatUptime(millis?: number | null): string {
  if (millis === undefined || millis === null || isNaN(millis)) return '-';
  const totalSeconds = Math.floor(millis / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0 || days > 0) parts.push(`${hours}h`);
  if (minutes > 0 || hours > 0 || days > 0) parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);

  return parts.join(' ');
}

// Helper function for RSSI signal strength & color
function getRssiBadge(rssi?: number | null) {
  if (rssi === undefined || rssi === null || isNaN(rssi) || rssi === 0) {
    return { label: '-', color: 'text-outline bg-surface-container-highest', icon: 'signal_wifi_off' };
  }
  if (rssi >= -55) {
    return { label: `${rssi} dBm (Excellent)`, color: 'text-[#059669] bg-[#ecfdf5] border-[#10b981]/30', icon: 'signal_wifi_4_bar' };
  }
  if (rssi >= -70) {
    return { label: `${rssi} dBm (Good)`, color: 'text-[#059669] bg-[#ecfdf5] border-[#10b981]/30', icon: 'network_wifi_3_bar' };
  }
  if (rssi >= -80) {
    return { label: `${rssi} dBm (Fair)`, color: 'text-amber-700 bg-amber-50 border-amber-300', icon: 'network_wifi_2_bar' };
  }
  return { label: `${rssi} dBm (Weak)`, color: 'text-rose-700 bg-rose-50 border-rose-300', icon: 'network_wifi_1_bar' };
}

export const DeviceSettingsModal: React.FC<DeviceSettingsModalProps> = ({
  device,
  isOpen,
  onClose,
  allRooms,
  onSuccessNotification,
  onErrorNotification,
}) => {
  const queryClient = useQueryClient();
  const { deviceDiagnostics } = useWebSocket();

  const [activeTab, setActiveTab] = useState<TabType>('diagnostics');
  const [isRestartConfirmOpen, setIsRestartConfirmOpen] = useState(false);
  const [isConfigPortalConfirmOpen, setIsConfigPortalConfirmOpen] = useState(false);
  const [isResetAuthConfirmOpen, setIsResetAuthConfirmOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Edit form state
  const [name, setName] = useState('');
  const [roomId, setRoomId] = useState<number>(0);
  const [pairingCode, setPairingCode] = useState('');
  const [macAddress, setMacAddress] = useState('');

  // Sync state when device changes
  useEffect(() => {
    if (device) {
      setName(device.name);
      setRoomId(device.roomId);
      setPairingCode(device.pairingCode || '');
      setMacAddress(device.macAddress || '');
      setActiveTab('diagnostics');
    }
  }, [device]);

  // Fetch command history
  const { data: commandHistory = [], isLoading: isLoadingHistory } = useQuery({
    queryKey: ['deviceCommands', device?.id],
    queryFn: () => (device ? devicesApi.getCommands(device.id) : []),
    enabled: isOpen && !!device && activeTab === 'history',
  });

  // Fetch cached diagnostics if needed
  const { data: cachedDiagnostics, refetch: refetchDiagnostics } = useQuery({
    queryKey: ['device-diagnostics', device?.id],
    queryFn: () => (device ? devicesApi.getDiagnostics(device.id) : Promise.resolve({})),
    enabled: isOpen && !!device,
  });

  // Combine live WebSocket diagnostics with cached diagnostics from DB metadata
  const liveWsDiag = device ? (deviceDiagnostics[device.deviceUid] as EspDiagnostics | undefined) : undefined;
  const dbDiag = (device?.metadata?.diagnostics as EspDiagnostics | undefined) || (cachedDiagnostics as EspDiagnostics | undefined);

  const diag: EspDiagnostics = {
    macAddress: liveWsDiag?.macAddress || dbDiag?.macAddress || device?.macAddress || null,
    ipAddress: liveWsDiag?.ipAddress || dbDiag?.ipAddress || device?.ipAddress || null,
    freeHeap: liveWsDiag?.freeHeap ?? dbDiag?.freeHeap ?? null,
    minFreeHeap: liveWsDiag?.minFreeHeap ?? dbDiag?.minFreeHeap ?? null,
    rssi: liveWsDiag?.rssi ?? dbDiag?.rssi ?? null,
    internalTemp: liveWsDiag?.internalTemp ?? dbDiag?.internalTemp ?? null,
    uptime: liveWsDiag?.uptime ?? dbDiag?.uptime ?? null,
    resetReason: liveWsDiag?.resetReason || dbDiag?.resetReason || null,
    firmwareVersion: liveWsDiag?.firmwareVersion || dbDiag?.firmwareVersion || device?.firmwareVersion || null,
    flashChipSize: liveWsDiag?.flashChipSize ?? dbDiag?.flashChipSize ?? null,
    sketchSize: liveWsDiag?.sketchSize ?? dbDiag?.sketchSize ?? null,
    cpuFreq: liveWsDiag?.cpuFreq ?? dbDiag?.cpuFreq ?? null,
    updatedAt: liveWsDiag?.updatedAt || dbDiag?.updatedAt || null,
  };

  const hasAnyDiagData =
    diag.freeHeap !== null ||
    diag.flashChipSize !== null ||
    diag.ipAddress !== null ||
    diag.uptime !== null ||
    diag.rssi !== null ||
    diag.internalTemp !== null ||
    diag.resetReason !== null;

  // Refresh Diagnostics Mutation (sends MQTT request to ESP)
  const refreshMutation = useMutation({
    mutationFn: (id: number) => devicesApi.refreshDiagnostics(id),
    onMutate: () => {
      setIsRefreshing(true);
    },
    onSuccess: (res) => {
      onSuccessNotification(res.message || 'Sent request for latest diagnostics to ESP.');
      refetchDiagnostics();
      setTimeout(() => setIsRefreshing(false), 1200);
    },
    onError: (err: any) => {
      onErrorNotification(`Failed to refresh diagnostics: ${err?.message || 'Unknown error'}`);
      setIsRefreshing(false);
    },
  });

  // Restart Mutation
  const restartMutation = useMutation({
    mutationFn: (id: number) => devicesApi.restart(id),
    onSuccess: () => {
      setIsRestartConfirmOpen(false);
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      queryClient.invalidateQueries({ queryKey: ['deviceCommands', device?.id] });
      onSuccessNotification(`Restart command dispatched to ${device?.name}. ESP is rebooting...`);
    },
    onError: (err: any) => {
      onErrorNotification(`Restart failed: ${err?.message || 'Unknown error'}`);
      setIsRestartConfirmOpen(false);
    },
  });

  // Open Web Config Mutation
  const openConfigMutation = useMutation({
    mutationFn: (id: number) => devicesApi.openConfigPortal(id),
    onSuccess: () => {
      setIsConfigPortalConfirmOpen(false);
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      queryClient.invalidateQueries({ queryKey: ['deviceCommands', device?.id] });
      onSuccessNotification(`Perintah Web Config dikirim ke ${device?.name}. ESP sedang mengaktifkan Web Config Portal.`);
    },
    onError: (err: any) => {
      onErrorNotification(`Gagal membuka Web Config: ${err?.message || 'Unknown error'}`);
      setIsConfigPortalConfirmOpen(false);
    },
  });

  // Update Device Mutation
  const updateMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number;
      data: { name?: string; roomId?: number; macAddress?: string; pairingCode?: string };
    }) => devicesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      onSuccessNotification('Device settings updated successfully!');
    },
    onError: (err: any) => {
      onErrorNotification(`Update failed: ${err?.message || 'Unknown error'}`);
    },
  });

  // Reset Auth Mutation
  const resetAuthMutation = useMutation({
    mutationFn: (id: number) => devicesApi.resetAuth(id),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      setIsResetAuthConfirmOpen(false);
      onSuccessNotification(res.message || 'Hardware MAC unlinked. Ready for new ESP pairing.');
    },
    onError: (err: any) => {
      onErrorNotification(`Reset auth failed: ${err?.message || 'Unknown error'}`);
      setIsResetAuthConfirmOpen(false);
    },
  });

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: (id: number) => devicesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      setIsDeleteConfirmOpen(false);
      onClose();
      onSuccessNotification('Device deleted successfully.');
    },
    onError: (err: any) => {
      onErrorNotification(`Delete failed: ${err?.message || 'Unknown error'}`);
      setIsDeleteConfirmOpen(false);
    },
  });

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!device) return;
    if (!name.trim()) {
      onErrorNotification('Device name cannot be empty');
      return;
    }
    if (!roomId || roomId === 0) {
      onErrorNotification('Please select a valid room');
      return;
    }

    updateMutation.mutate({
      id: device.id,
      data: {
        name: name.trim(),
        roomId,
        macAddress: macAddress.trim() || undefined,
        pairingCode: pairingCode.trim() || undefined,
      },
    });
  };

  const handleRefreshClick = () => {
    if (!device) return;
    refreshMutation.mutate(device.id);
  };

  if (!isOpen || !device) return null;

  const rssiBadge = getRssiBadge(diag.rssi);

  // Flash memory percentage calculation
  const flashUsagePercent =
    diag.flashChipSize && diag.sketchSize && diag.flashChipSize > 0
      ? Math.min(100, Math.round((diag.sketchSize / diag.flashChipSize) * 100))
      : null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-surface border border-outline-variant rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="p-5 border-b border-outline-variant bg-surface-container-low flex justify-between items-start">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-[24px]">settings_suggest</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-headline-md text-lg text-on-surface font-bold">
                  {device.name}
                </h3>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${
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
              <div className="flex items-center gap-2 mt-0.5 text-xs text-outline font-data-mono">
                <span>UID: {device.deviceUid}</span>
                <span>•</span>
                <span>Type: {device.deviceType}</span>
                <span>•</span>
                <span>Room: {device.room?.name || `Room #${device.roomId}`}</span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-outline hover:text-on-surface p-1 rounded-lg hover:bg-surface-container-high transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-outline-variant bg-surface px-5 gap-1">
          <button
            onClick={() => setActiveTab('diagnostics')}
            className={`flex items-center gap-1.5 py-3 px-3.5 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === 'diagnostics'
                ? 'border-primary text-primary font-bold'
                : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">monitor_heart</span>
            ESP Diagnostics
          </button>

          <button
            onClick={() => setActiveTab('edit')}
            className={`flex items-center gap-1.5 py-3 px-3.5 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === 'edit'
                ? 'border-primary text-primary font-bold'
                : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">edit_note</span>
            Edit Device
          </button>

          <button
            onClick={() => setActiveTab('controls')}
            className={`flex items-center gap-1.5 py-3 px-3.5 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === 'controls'
                ? 'border-primary text-primary font-bold'
                : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">tune</span>
            Actions &amp; Restart
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-1.5 py-3 px-3.5 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === 'history'
                ? 'border-primary text-primary font-bold'
                : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">history</span>
            Command History
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 flex-1 overflow-y-auto space-y-4">
          {/* TAB 1: ESP DIAGNOSTICS & SYSTEM STATUS */}
          {activeTab === 'diagnostics' && (
            <div className="space-y-4">
              {/* Status Header with Refresh Button */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-surface-container-low rounded-xl border border-outline-variant/70">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[20px]">
                    memory
                  </span>
                  <div>
                    <h4 className="text-xs font-bold text-on-surface uppercase tracking-wide">
                      ESP Microcontroller Diagnostics
                    </h4>
                    <p className="text-[11px] text-outline">
                      {diag.updatedAt
                        ? `Last updated: ${new Date(diag.updatedAt).toLocaleTimeString()}`
                        : 'On-demand telemetry fetched via MQTT'}
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleRefreshClick}
                  disabled={isRefreshing || refreshMutation.isPending}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 rounded-lg text-xs font-semibold transition-all cursor-pointer disabled:opacity-50 active:scale-95"
                >
                  <span
                    className={`material-symbols-outlined text-[16px] ${
                      isRefreshing || refreshMutation.isPending ? 'animate-spin' : ''
                    }`}
                  >
                    sync
                  </span>
                  {isRefreshing || refreshMutation.isPending ? 'Refreshing...' : 'Refresh Status'}
                </button>
              </div>

              {!hasAnyDiagData && device.status === 'OFFLINE' && (
                <div className="p-4 bg-surface-container-low border border-outline-variant rounded-xl text-center space-y-2">
                  <span className="material-symbols-outlined text-outline text-[32px]">
                    cloud_off
                  </span>
                  <p className="text-xs text-on-surface-variant">
                    Perangkat saat ini sedang OFFLINE. Data diagnostik internal akan tampil otomatis saat ESP terhubung atau ketika tombol <strong>Refresh Status</strong> ditekan saat online.
                  </p>
                </div>
              )}

              {/* 12 Diagnostic Metric Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {/* 1. Hardware MAC Address */}
                <div className="p-3 bg-surface border border-outline-variant/60 rounded-xl space-y-1 shadow-xs">
                  <div className="flex items-center justify-between text-outline">
                    <span className="text-[10px] uppercase font-bold tracking-wider">
                      MAC Address (ID Unik)
                    </span>
                    <span className="material-symbols-outlined text-[14px]">fingerprint</span>
                  </div>
                  <div className="font-data-mono text-xs font-bold text-on-surface truncate" title={diag.macAddress || 'Unbound'}>
                    {diag.macAddress || <span className="text-outline italic">Belum terikat</span>}
                  </div>
                </div>

                {/* 2. Local IP Address */}
                <div className="p-3 bg-surface border border-outline-variant/60 rounded-xl space-y-1 shadow-xs">
                  <div className="flex items-center justify-between text-outline">
                    <span className="text-[10px] uppercase font-bold tracking-wider">
                      Local IP Address
                    </span>
                    <span className="material-symbols-outlined text-[14px]">lan</span>
                  </div>
                  <div className="font-data-mono text-xs font-bold text-on-surface">
                    {diag.ipAddress || <span className="text-outline italic">-</span>}
                  </div>
                </div>

                {/* 3. Wi-Fi Signal RSSI */}
                <div className="p-3 bg-surface border border-outline-variant/60 rounded-xl space-y-1 shadow-xs">
                  <div className="flex items-center justify-between text-outline">
                    <span className="text-[10px] uppercase font-bold tracking-wider">
                      Wi-Fi RSSI
                    </span>
                    <span className="material-symbols-outlined text-[14px]">{rssiBadge.icon}</span>
                  </div>
                  <div>
                    <span
                      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold border ${rssiBadge.color}`}
                    >
                      {rssiBadge.label}
                    </span>
                  </div>
                </div>

                {/* 4. Free Heap (RAM) */}
                <div className="p-3 bg-surface border border-outline-variant/60 rounded-xl space-y-1 shadow-xs">
                  <div className="flex items-center justify-between text-outline">
                    <span className="text-[10px] uppercase font-bold tracking-wider">
                      Free Heap (Sisa RAM)
                    </span>
                    <span className="material-symbols-outlined text-[14px]">memory</span>
                  </div>
                  <div className="font-data-mono text-xs font-bold text-on-surface">
                    {formatBytes(diag.freeHeap)}
                  </div>
                </div>

                {/* 5. Min Free Heap */}
                <div className="p-3 bg-surface border border-outline-variant/60 rounded-xl space-y-1 shadow-xs">
                  <div className="flex items-center justify-between text-outline">
                    <span className="text-[10px] uppercase font-bold tracking-wider">
                      Min Free Heap (Lowest RAM)
                    </span>
                    <span className="material-symbols-outlined text-[14px]">speed</span>
                  </div>
                  <div className="font-data-mono text-xs font-bold text-on-surface">
                    {formatBytes(diag.minFreeHeap)}
                  </div>
                </div>

                {/* 6. Internal Temperature */}
                <div className="p-3 bg-surface border border-outline-variant/60 rounded-xl space-y-1 shadow-xs">
                  <div className="flex items-center justify-between text-outline">
                    <span className="text-[10px] uppercase font-bold tracking-wider">
                      Internal Chip Temp
                    </span>
                    <span className="material-symbols-outlined text-[14px]">device_thermostat</span>
                  </div>
                  <div className="font-data-mono text-xs font-bold text-on-surface">
                    {diag.internalTemp !== null && diag.internalTemp !== undefined && !isNaN(diag.internalTemp)
                      ? `${diag.internalTemp.toFixed(1)} °C`
                      : '-'}
                  </div>
                </div>

                {/* 7. Uptime / Millis */}
                <div className="p-3 bg-surface border border-outline-variant/60 rounded-xl space-y-1 shadow-xs">
                  <div className="flex items-center justify-between text-outline">
                    <span className="text-[10px] uppercase font-bold tracking-wider">
                      Uptime (Durasi Nyala)
                    </span>
                    <span className="material-symbols-outlined text-[14px]">timer</span>
                  </div>
                  <div className="font-data-mono text-xs font-bold text-on-surface">
                    {formatUptime(diag.uptime)}
                  </div>
                </div>

                {/* 8. Reset Reason */}
                <div className="p-3 bg-surface border border-outline-variant/60 rounded-xl space-y-1 shadow-xs">
                  <div className="flex items-center justify-between text-outline">
                    <span className="text-[10px] uppercase font-bold tracking-wider">
                      Reset Reason
                    </span>
                    <span className="material-symbols-outlined text-[14px]">restart_alt</span>
                  </div>
                  <div className="font-data-mono text-xs font-bold text-on-surface truncate" title={diag.resetReason || '-'}>
                    {diag.resetReason || '-'}
                  </div>
                </div>

                {/* 9. Firmware Version */}
                <div className="p-3 bg-surface border border-outline-variant/60 rounded-xl space-y-1 shadow-xs">
                  <div className="flex items-center justify-between text-outline">
                    <span className="text-[10px] uppercase font-bold tracking-wider">
                      Firmware Version
                    </span>
                    <span className="material-symbols-outlined text-[14px]">terminal</span>
                  </div>
                  <div className="font-data-mono text-xs font-bold text-primary">
                    {diag.firmwareVersion || '1.0.0'}
                  </div>
                </div>

                {/* 10. Flash Chip Size */}
                <div className="p-3 bg-surface border border-outline-variant/60 rounded-xl space-y-1 shadow-xs">
                  <div className="flex items-center justify-between text-outline">
                    <span className="text-[10px] uppercase font-bold tracking-wider">
                      Flash Chip Size (ROM)
                    </span>
                    <span className="material-symbols-outlined text-[14px]">save</span>
                  </div>
                  <div className="font-data-mono text-xs font-bold text-on-surface">
                    {formatBytes(diag.flashChipSize)}
                  </div>
                </div>

                {/* 11. Sketch Program Size */}
                <div className="p-3 bg-surface border border-outline-variant/60 rounded-xl space-y-1 shadow-xs">
                  <div className="flex items-center justify-between text-outline">
                    <span className="text-[10px] uppercase font-bold tracking-wider">
                      Sketch Size (Terpakai)
                    </span>
                    <span className="material-symbols-outlined text-[14px]">code</span>
                  </div>
                  <div className="font-data-mono text-xs font-bold text-on-surface">
                    {formatBytes(diag.sketchSize)}
                    {flashUsagePercent !== null && (
                      <span className="text-[10px] text-outline font-normal ml-1">
                        ({flashUsagePercent}%)
                      </span>
                    )}
                  </div>
                </div>

                {/* 12. CPU Frequency */}
                <div className="p-3 bg-surface border border-outline-variant/60 rounded-xl space-y-1 shadow-xs">
                  <div className="flex items-center justify-between text-outline">
                    <span className="text-[10px] uppercase font-bold tracking-wider">
                      CPU Frequency
                    </span>
                    <span className="material-symbols-outlined text-[14px]">developer_board</span>
                  </div>
                  <div className="font-data-mono text-xs font-bold text-on-surface">
                    {diag.cpuFreq ? `${diag.cpuFreq} MHz` : '-'}
                  </div>
                </div>
              </div>

              {/* Informational Footer Banner */}
              <div className="p-3 bg-primary-container/10 border border-primary/20 rounded-xl text-primary text-xs flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">info</span>
                <span>
                  Data diagnostik ESP ditampilkan secara on-demand via MQTT sehingga hemat penyimpanan database dan tidak memberatkan network.
                </span>
              </div>
            </div>
          )}

          {/* TAB 2: EDIT DEVICE SETTINGS */}
          {activeTab === 'edit' && (
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-on-surface-variant uppercase mb-1">
                  Device Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Nama perangkat (e.g. Sensor Suhu Ruang Tamu)"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-outline-variant rounded-lg bg-surface text-on-surface focus:outline-none focus:border-primary text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface-variant uppercase mb-1">
                  Device Unique Identifier (UID)
                </label>
                <input
                  type="text"
                  disabled
                  value={device.deviceUid}
                  className="w-full px-3 py-2 border border-outline-variant rounded-lg bg-surface-container-low text-on-surface-variant text-sm font-data-mono disabled:opacity-60 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface-variant uppercase mb-1">
                  Assign Room *
                </label>
                <select
                  value={roomId}
                  onChange={(e) => setRoomId(parseInt(e.target.value, 10))}
                  className="w-full px-3 py-2 border border-outline-variant rounded-lg bg-surface text-on-surface focus:outline-none focus:border-primary text-sm"
                >
                  <option value={0} disabled>
                    Pilih ruangan
                  </option>
                  {allRooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.homeName || 'Home'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Hardware Pairing Code & MAC */}
              <div className="p-3.5 bg-surface-container-low rounded-xl border border-outline-variant/60 space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-primary uppercase">
                  <span className="material-symbols-outlined text-[16px]">lock</span>
                  <span>ESP Authentication &amp; Hardware MAC</span>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-on-surface-variant uppercase mb-1">
                    Pairing Code
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Kode pairing (e.g. TH-7788)"
                    value={pairingCode}
                    onChange={(e) => setPairingCode(e.target.value)}
                    className="w-full px-3 py-1.5 border border-outline-variant rounded-lg bg-surface text-on-surface focus:outline-none focus:border-primary text-xs font-data-mono font-bold"
                  />
                  <span className="text-[10px] text-outline block mt-1">
                    Kode ini dicocokkan dengan firmware ESP untuk autentikasi awal.
                  </span>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-on-surface-variant uppercase mb-1">
                    Bound Hardware MAC Address
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      disabled
                      value={macAddress || 'Belum terikat (Menunggu koneksi ESP)'}
                      className="w-full px-3 py-1.5 border border-outline-variant rounded-lg bg-surface-container-highest text-on-surface-variant text-xs font-data-mono disabled:opacity-80"
                    />
                    {macAddress && (
                      <button
                        type="button"
                        onClick={() => setMacAddress('')}
                        className="px-2.5 py-1.5 text-xs border border-error/40 text-error hover:bg-error-container/20 rounded-lg cursor-pointer whitespace-nowrap"
                        title="Hapus binding MAC address"
                      >
                        Clear MAC
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="submit"
                  disabled={updateMutation.isPending}
                  className="flex items-center gap-1.5 px-4 py-2 bg-primary text-on-primary rounded-lg text-xs font-bold hover:bg-primary/90 disabled:opacity-50 cursor-pointer shadow-xs active:scale-98"
                >
                  <span className="material-symbols-outlined text-[16px]">save</span>
                  {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: ACTIONS, RESTART & MAINTENANCE */}
          {activeTab === 'controls' && (
            <div className="space-y-4">
              {/* Web Config Portal Section */}
              <div className="p-4 bg-surface border border-outline-variant rounded-xl flex items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-1.5 text-sm font-bold text-on-surface">
                    <span className="material-symbols-outlined text-primary text-[20px]">
                      wifi_tethering
                    </span>
                    <span>Web Configuration Portal</span>
                  </div>
                  <p className="text-xs text-on-surface-variant mt-1">
                    Aktifkan portal web konfigurasi (WiFi, MQTT, Pairing Code) langsung pada modul ESP32/ESP8266 melalui browser.
                  </p>
                </div>
                <button
                  onClick={() => setIsConfigPortalConfirmOpen(true)}
                  disabled={openConfigMutation.isPending}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-primary text-on-primary hover:bg-primary/90 rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95 disabled:opacity-50 whitespace-nowrap"
                >
                  <span className="material-symbols-outlined text-[16px]">tune</span>
                  Buka Web Config
                </button>
              </div>

              {/* Restart ESP Node Section */}
              <div className="p-4 bg-surface border border-outline-variant rounded-xl flex items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-1.5 text-sm font-bold text-on-surface">
                    <span className="material-symbols-outlined text-amber-600 text-[20px]">
                      restart_alt
                    </span>
                    <span>Restart ESP Microcontroller</span>
                  </div>
                  <p className="text-xs text-on-surface-variant mt-1">
                    Mengirim sinyal reboot jarak jauh melalui MQTT ke modul ESP32/ESP8266.
                  </p>
                </div>
                <button
                  onClick={() => setIsRestartConfirmOpen(true)}
                  disabled={restartMutation.isPending}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-600 text-white hover:bg-amber-700 rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95 disabled:opacity-50 whitespace-nowrap"
                >
                  <span className="material-symbols-outlined text-[16px]">power_settings_new</span>
                  Restart ESP
                </button>
              </div>

              {/* Unlink MAC Address Section */}
              {device.macAddress && (
                <div className="p-4 bg-surface border border-outline-variant rounded-xl flex items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-1.5 text-sm font-bold text-on-surface">
                      <span className="material-symbols-outlined text-amber-600 text-[20px]">
                        link_off
                      </span>
                      <span>Unlink Hardware MAC Binding</span>
                    </div>
                    <p className="text-xs text-on-surface-variant mt-1">
                      Lepas ikatan MAC Address ({device.macAddress}) agar modul ESP pengganti baru dapat terhubung menggunakan pairing code yang sama.
                    </p>
                  </div>
                  <button
                    onClick={() => setIsResetAuthConfirmOpen(true)}
                    disabled={resetAuthMutation.isPending}
                    className="flex items-center gap-1.5 px-3.5 py-2 border border-amber-600/40 text-amber-700 hover:bg-amber-50 rounded-lg text-xs font-bold transition-all cursor-pointer active:scale-95 disabled:opacity-50 whitespace-nowrap"
                  >
                    <span className="material-symbols-outlined text-[16px]">link_off</span>
                    Unlink MAC
                  </button>
                </div>
              )}

              {/* Danger Zone: Delete Device */}
              <div className="p-4 bg-error-container/10 border border-error/20 rounded-xl flex items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-1.5 text-sm font-bold text-error">
                    <span className="material-symbols-outlined text-[20px]">delete_forever</span>
                    <span>Delete Device</span>
                  </div>
                  <p className="text-xs text-on-surface-variant mt-1">
                    Menghapus perangkat secara permanen beserta data telemetry &amp; riwayat perintah.
                  </p>
                </div>
                <button
                  onClick={() => setIsDeleteConfirmOpen(true)}
                  disabled={deleteMutation.isPending}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-error text-on-error hover:bg-error/90 rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95 disabled:opacity-50 whitespace-nowrap"
                >
                  <span className="material-symbols-outlined text-[16px]">delete</span>
                  Delete Device
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: COMMAND HISTORY */}
          {activeTab === 'history' && (
            <div className="space-y-3">
              <div className="flex justify-between items-center text-xs text-outline">
                <span>Recent Command Log (Last 20)</span>
                <button
                  onClick={() => queryClient.invalidateQueries({ queryKey: ['deviceCommands', device.id] })}
                  className="text-primary hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[14px]">refresh</span>
                  Refresh Log
                </button>
              </div>

              {isLoadingHistory ? (
                <p className="text-center py-6 text-xs text-outline">Loading command log...</p>
              ) : commandHistory.length === 0 ? (
                <div className="text-center py-8 text-outline text-xs bg-surface-container-low rounded-xl border border-outline-variant/60">
                  <span className="material-symbols-outlined text-[28px] block mb-1">
                    receipt_long
                  </span>
                  Belum ada perintah yang dieksekusi untuk perangkat ini.
                </div>
              ) : (
                <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                  {commandHistory.map((cmd: DeviceCommand) => (
                    <div
                      key={cmd.id}
                      className="p-3 bg-surface-container-low rounded-xl border border-outline-variant/70 flex justify-between items-center text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-on-surface uppercase font-data-mono">
                            {cmd.command}
                          </span>
                          {cmd.payload && (
                            <span className="text-[10px] text-outline font-data-mono truncate max-w-[200px]">
                              {JSON.stringify(cmd.payload)}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-outline">
                          {new Date(cmd.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                          cmd.status === 'ACKNOWLEDGED' || cmd.status === 'SENT'
                            ? 'bg-primary-fixed-dim/40 text-primary'
                            : cmd.status === 'FAILED'
                              ? 'bg-error-container/40 text-error'
                              : 'bg-surface-container-highest text-on-surface-variant'
                        }`}
                      >
                        {cmd.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-outline-variant bg-surface-container-low flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-outline-variant rounded-lg text-xs font-semibold hover:bg-surface-container-high transition-colors cursor-pointer text-on-surface"
          >
            Close
          </button>
        </div>
      </div>

      {/* Confirmation Dialogs */}
      {/* 1. Restart ESP Dialog */}
      <ConfirmDialog
        isOpen={isRestartConfirmOpen}
        title="Restart ESP Microcontroller"
        message={`Apakah Anda yakin ingin me-restart modul ESP "${device.name}" (${device.deviceUid})? Perangkat akan offline beberapa detik selama reboot.`}
        confirmLabel="Ya, Restart ESP"
        isDestructive={false}
        isLoading={restartMutation.isPending}
        onConfirm={() => restartMutation.mutate(device.id)}
        onCancel={() => setIsRestartConfirmOpen(false)}
      />

      {/* 2. Reset Auth / Unlink MAC Dialog */}
      <ConfirmDialog
        isOpen={isResetAuthConfirmOpen}
        title="Unlink Hardware MAC"
        message={`Lepaskan binding MAC address "${device.macAddress}" dari perangkat "${device.name}"? Modul ESP baru dengan pairing code "${device.pairingCode}" akan dapat terhubung.`}
        confirmLabel="Ya, Unlink MAC"
        isDestructive={false}
        isLoading={resetAuthMutation.isPending}
        onConfirm={() => resetAuthMutation.mutate(device.id)}
        onCancel={() => setIsResetAuthConfirmOpen(false)}
      />

      {/* 3. Delete Device Dialog */}
      <ConfirmDialog
        isOpen={isDeleteConfirmOpen}
        title="Hapus Perangkat"
        message={`Apakah Anda yakin ingin menghapus perangkat "${device.name}" (${device.deviceUid}) secara permanen?`}
        confirmLabel="Ya, Hapus Perangkat"
        isDestructive={true}
        isLoading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate(device.id)}
        onCancel={() => setIsDeleteConfirmOpen(false)}
      />

      {/* 4. Web Config Portal Warning & Confirmation Dialog */}
      {isConfigPortalConfirmOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-outline-variant rounded-2xl max-w-md w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="p-5 border-b border-outline-variant/60 bg-surface-container-low flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 border border-amber-500/20">
                <span className="material-symbols-outlined text-[24px]">wifi_tethering</span>
              </div>
              <div>
                <h3 className="text-base font-bold text-on-surface">Buka Web Config Portal ESP</h3>
                <p className="text-xs text-outline">{device.name} ({device.deviceUid})</p>
              </div>
            </div>

            {/* Content & Warning */}
            <div className="p-5 space-y-4 text-xs">
              {/* Warning Box */}
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-200 space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-xs text-amber-700 dark:text-amber-300">
                  <span className="material-symbols-outlined text-[18px]">warning</span>
                  <span>PERINGATAN: FUNGSI PERANGKAT AKAN DIJEDA</span>
                </div>
                <p className="leading-relaxed">
                  Ketika Web Config dibuka, ESP akan beralih ke mode Access Point khusus. <strong>Semua fungsi normal (pembacaan sensor, otomatisasi, telemetri, dan koneksi MQTT) akan DIHENTIKAN SEMENTARA</strong> sampai konfigurasi disimpan atau dibatalkan dan ESP di-restart.
                </p>
              </div>

              {/* Instructions */}
              <div className="space-y-2 text-on-surface-variant">
                <p className="font-semibold text-on-surface">Panduan Langkah Mengakses:</p>
                <div className="space-y-2 bg-surface-container-low p-3.5 rounded-xl border border-outline-variant/50">
                  <div className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-[11px] shrink-0 mt-0.5">1</span>
                    <span>Sambungkan HP/Laptop Anda ke WiFi Hotspot baru bernama: <strong className="text-on-surface font-mono">SmartHome-Node-XXXX</strong></span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-[11px] shrink-0 mt-0.5">2</span>
                    <span>Buka browser dan buka URL: <strong className="text-primary font-mono">http://192.168.4.1</strong> {diag.ipAddress ? `(atau IP Lokal: http://${diag.ipAddress})` : ''}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-[11px] shrink-0 mt-0.5">3</span>
                    <span>Ubah konfigurasi WiFi, MQTT, atau Pairing Code lalu klik <em>Save & Restart</em> untuk kembali ke mode normal.</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="p-4 border-t border-outline-variant bg-surface-container-low flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsConfigPortalConfirmOpen(false)}
                disabled={openConfigMutation.isPending}
                className="px-4 py-2 border border-outline-variant rounded-xl text-xs font-semibold text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => openConfigMutation.mutate(device.id)}
                disabled={openConfigMutation.isPending}
                className="flex items-center gap-1.5 px-4 py-2 bg-primary text-on-primary hover:bg-primary/90 text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[16px]">
                  {openConfigMutation.isPending ? 'sync' : 'wifi_tethering'}
                </span>
                {openConfigMutation.isPending ? 'Mengirim Perintah...' : 'Ya, Buka Web Config'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
