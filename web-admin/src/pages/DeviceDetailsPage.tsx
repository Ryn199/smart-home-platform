import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { devicesApi } from '../api/devices';
import { firmwareApi, UploadFirmwarePayload } from '../api/firmware';
import { homesApi } from '../api/homes';
import { useWebSocket } from '../websocket/socket';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Device, DeviceCommand, DeviceType, EspDiagnostics, Firmware } from '../types';

type TabType = 'overview' | 'firmware' | 'diagnostics' | 'settings' | 'history';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

function formatUptime(millis: number | null | undefined): string {
  if (millis === null || millis === undefined) return '-';
  const totalSeconds = Math.floor(millis / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);
  return parts.join(' ');
}

function getRssiBadge(rssi: number | null | undefined) {
  if (rssi === null || rssi === undefined) {
    return { label: 'No Signal', color: 'text-outline bg-surface-container-high border-outline/30', icon: 'signal_wifi_off' };
  }
  if (rssi >= -55) {
    return { label: `${rssi} dBm (Sangat Bagus)`, color: 'text-[#059669] bg-[#ecfdf5] border-[#10b981]/30', icon: 'signal_wifi_4_bar' };
  }
  if (rssi >= -70) {
    return { label: `${rssi} dBm (Bagus)`, color: 'text-[#059669] bg-[#ecfdf5] border-[#10b981]/30', icon: 'network_wifi_3_bar' };
  }
  if (rssi >= -80) {
    return { label: `${rssi} dBm (Cukup)`, color: 'text-amber-700 bg-amber-50 border-amber-300', icon: 'network_wifi_2_bar' };
  }
  return { label: `${rssi} dBm (Lemah)`, color: 'text-rose-700 bg-rose-50 border-rose-300', icon: 'network_wifi_1_bar' };
}

function getDeviceIcon(type: DeviceType): string {
  switch (type) {
    case 'TEMP_HUMIDITY':
      return 'device_thermostat';
    case 'SMART_DOOR':
      return 'door_sliding';
    case 'EXHAUST_FAN':
      return 'mode_fan';
    case 'SMART_CURTAIN':
      return 'curtains';
    default:
      return 'developer_board';
  }
}

export const DeviceDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { deviceDiagnostics } = useWebSocket();

  const deviceId = parseInt(id || '0', 10);

  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Dialog states
  const [isRestartConfirmOpen, setIsRestartConfirmOpen] = useState(false);
  const [isConfigPortalConfirmOpen, setIsConfigPortalConfirmOpen] = useState(false);
  const [isResetAuthConfirmOpen, setIsResetAuthConfirmOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [selectedFirmwareToDeploy, setSelectedFirmwareToDeploy] = useState<Firmware | null>(null);
  const [isRollbackConfirmOpen, setIsRollbackConfirmOpen] = useState(false);

  // Firmware Upload Form states
  const [firmwareVersion, setFirmwareVersion] = useState('');
  const [firmwareFile, setFirmwareFile] = useState<File | null>(null);
  const [firmwareBase64, setFirmwareBase64] = useState<string>('');
  const [firmwareChangelog, setFirmwareChangelog] = useState('');
  const [isUploadingFirmware, setIsUploadingFirmware] = useState(false);

  // Device General Edit Form states
  const [editName, setEditName] = useState('');
  const [editRoomId, setEditRoomId] = useState<number>(0);
  const [editPairingCode, setEditPairingCode] = useState('');
  const [editMacAddress, setEditMacAddress] = useState('');

  // Fetch Device Details
  const {
    data: device,
    isLoading: isDeviceLoading,
    error: deviceError,
  } = useQuery({
    queryKey: ['device', deviceId],
    queryFn: () => devicesApi.getById(deviceId),
    enabled: deviceId > 0,
  });

  // Fetch Homes / Rooms
  const { data: homes = [] } = useQuery({
    queryKey: ['homes'],
    queryFn: homesApi.getAll,
  });
  const allRooms = useMemo(
    () => homes.flatMap((h) => (h.rooms || []).map((r) => ({ ...r, homeName: h.name }))),
    [homes],
  );

  // Fetch Diagnostics
  const { data: cachedDiagnostics, refetch: refetchDiagnostics, isFetching: isRefreshingDiag } = useQuery({
    queryKey: ['device-diagnostics', deviceId],
    queryFn: () => (deviceId > 0 ? devicesApi.getDiagnostics(deviceId) : Promise.resolve({})),
    enabled: deviceId > 0,
  });

  // Fetch Firmwares
  const {
    data: firmwares = [],
    isLoading: isLoadingFirmware,
    refetch: refetchFirmware,
  } = useQuery({
    queryKey: ['device-firmware', deviceId],
    queryFn: () => (deviceId > 0 ? firmwareApi.getByDevice(deviceId) : Promise.resolve([])),
    enabled: deviceId > 0,
  });

  // Fetch Commands History
  const { data: commandHistory = [], isLoading: isLoadingHistory } = useQuery({
    queryKey: ['deviceCommands', deviceId],
    queryFn: () => (deviceId > 0 ? devicesApi.getCommands(deviceId) : Promise.resolve([])),
    enabled: deviceId > 0 && activeTab === 'history',
  });

  // Sync edit form with device data
  useEffect(() => {
    if (device) {
      setEditName(device.name);
      setEditRoomId(device.roomId);
      setEditPairingCode(device.pairingCode || '');
      setEditMacAddress(device.macAddress || '');
    }
  }, [device]);

  // Merge WebSocket Diagnostics with Database metadata
  const liveWsDiag = device ? (deviceDiagnostics[device.deviceUid] as EspDiagnostics | undefined) : undefined;
  const dbDiag = (device?.metadata?.diagnostics as EspDiagnostics | undefined) || (cachedDiagnostics as EspDiagnostics | undefined);

  const diag: EspDiagnostics = useMemo(
    () => ({
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
    }),
    [liveWsDiag, dbDiag, device],
  );

  const showNotification = (msg: string, isError = false) => {
    if (isError) {
      setErrorMessage(msg);
      setTimeout(() => setErrorMessage(null), 6000);
    } else {
      setSuccessMessage(msg);
      setTimeout(() => setSuccessMessage(null), 5000);
    }
  };

  // Mutations
  const refreshDiagMutation = useMutation({
    mutationFn: (id: number) => devicesApi.refreshDiagnostics(id),
    onSuccess: (res) => {
      showNotification(res.message || 'Permintaan diagnostik berhasil dikirim ke ESP.');
      refetchDiagnostics();
    },
    onError: (err: any) => {
      showNotification(`Gagal meminta diagnostik: ${err?.message || 'Error'}`, true);
    },
  });

  const restartMutation = useMutation({
    mutationFn: (id: number) => devicesApi.restart(id),
    onSuccess: () => {
      setIsRestartConfirmOpen(false);
      queryClient.invalidateQueries({ queryKey: ['device', deviceId] });
      queryClient.invalidateQueries({ queryKey: ['deviceCommands', deviceId] });
      showNotification(`Perintah restart dikirim ke ${device?.name}. ESP sedang reboot...`);
    },
    onError: (err: any) => {
      setIsRestartConfirmOpen(false);
      showNotification(`Restart gagal: ${err?.message || 'Error'}`, true);
    },
  });

  const openConfigMutation = useMutation({
    mutationFn: (id: number) => devicesApi.openConfigPortal(id),
    onSuccess: () => {
      setIsConfigPortalConfirmOpen(false);
      queryClient.invalidateQueries({ queryKey: ['device', deviceId] });
      queryClient.invalidateQueries({ queryKey: ['deviceCommands', deviceId] });
      showNotification(`Perintah Web Config dikirim ke ${device?.name}. ESP sedang mengaktifkan Web Portal.`);
    },
    onError: (err: any) => {
      setIsConfigPortalConfirmOpen(false);
      showNotification(`Gagal membuka Web Config: ${err?.message || 'Error'}`, true);
    },
  });

  const resetAuthMutation = useMutation({
    mutationFn: (id: number) => devicesApi.resetAuth(id),
    onSuccess: (res) => {
      setIsResetAuthConfirmOpen(false);
      queryClient.invalidateQueries({ queryKey: ['device', deviceId] });
      showNotification(res.message || 'Binding Hardware MAC berhasil dilepas.');
    },
    onError: (err: any) => {
      setIsResetAuthConfirmOpen(false);
      showNotification(`Gagal reset auth: ${err?.message || 'Error'}`, true);
    },
  });

  const updateDeviceMutation = useMutation({
    mutationFn: (data: { name?: string; roomId?: number; macAddress?: string; pairingCode?: string }) =>
      devicesApi.update(deviceId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['device', deviceId] });
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      showNotification('Pengaturan perangkat berhasil diperbarui!');
    },
    onError: (err: any) => {
      showNotification(`Gagal memperbarui perangkat: ${err?.message || 'Error'}`, true);
    },
  });

  const deleteDeviceMutation = useMutation({
    mutationFn: (id: number) => devicesApi.delete(id),
    onSuccess: () => {
      setIsDeleteConfirmOpen(false);
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      navigate('/devices');
    },
    onError: (err: any) => {
      setIsDeleteConfirmOpen(false);
      showNotification(`Gagal menghapus perangkat: ${err?.message || 'Error'}`, true);
    },
  });

  // Firmware Mutations
  const uploadFirmwareMutation = useMutation({
    mutationFn: (payload: UploadFirmwarePayload) => firmwareApi.upload(deviceId, payload),
    onSuccess: (newFirmware) => {
      queryClient.invalidateQueries({ queryKey: ['device-firmware', deviceId] });
      setFirmwareFile(null);
      setFirmwareBase64('');
      setFirmwareVersion('');
      setFirmwareChangelog('');
      setIsUploadingFirmware(false);
      showNotification(`Firmware v${newFirmware.version} (${newFirmware.fileName}) berhasil diunggah!`);
    },
    onError: (err: any) => {
      setIsUploadingFirmware(false);
      showNotification(`Gagal upload firmware: ${err?.message || 'Error'}`, true);
    },
  });

  const deployFirmwareMutation = useMutation({
    mutationFn: (firmwareId: number) => firmwareApi.deploy(deviceId, firmwareId),
    onSuccess: (res) => {
      setSelectedFirmwareToDeploy(null);
      queryClient.invalidateQueries({ queryKey: ['device-firmware', deviceId] });
      queryClient.invalidateQueries({ queryKey: ['device', deviceId] });
      queryClient.invalidateQueries({ queryKey: ['deviceCommands', deviceId] });
      showNotification(res.message || 'Perintah OTA firmware update berhasil dikirim ke ESP!');
    },
    onError: (err: any) => {
      setSelectedFirmwareToDeploy(null);
      showNotification(`Gagal deploy firmware: ${err?.message || 'Error'}`, true);
    },
  });

  const rollbackFirmwareMutation = useMutation({
    mutationFn: () => firmwareApi.rollback(deviceId),
    onSuccess: (res) => {
      setIsRollbackConfirmOpen(false);
      queryClient.invalidateQueries({ queryKey: ['device-firmware', deviceId] });
      queryClient.invalidateQueries({ queryKey: ['device', deviceId] });
      queryClient.invalidateQueries({ queryKey: ['deviceCommands', deviceId] });
      showNotification(res.message || 'Rollback firmware berhasil dieksekusi!');
    },
    onError: (err: any) => {
      setIsRollbackConfirmOpen(false);
      showNotification(`Rollback gagal: ${err?.message || 'Error'}`, true);
    },
  });

  const deleteFirmwareMutation = useMutation({
    mutationFn: (firmwareId: number) => firmwareApi.delete(deviceId, firmwareId),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['device-firmware', deviceId] });
      showNotification(res.message || 'Firmware berhasil dihapus');
    },
    onError: (err: any) => {
      showNotification(`Gagal hapus firmware: ${err?.message || 'Error'}`, true);
    },
  });

  // Handle File Upload Change
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.bin')) {
      showNotification('Hanya file firmware dengan ekstensi .bin yang diperbolehkan!', true);
      return;
    }

    const MAX_SIZE = 10 * 1024 * 1024; // 10MB
    if (file.size > MAX_SIZE) {
      showNotification('Ukuran file terlalu besar! Maksimal 10MB.', true);
      return;
    }

    setFirmwareFile(file);

    // Auto-suggest version from filename if matches pattern (e.g. firmware_v1.0.2.bin -> 1.0.2)
    const match = file.name.match(/v?(\d+\.\d+\.\d+|\d+\.\d+)/i);
    if (match && !firmwareVersion) {
      setFirmwareVersion(match[1]);
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setFirmwareBase64(result);
    };
    reader.readAsDataURL(file);
  };

  const handleUploadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firmwareFile || !firmwareBase64) {
      showNotification('Silakan pilih file firmware (.bin) terlebih dahulu', true);
      return;
    }
    if (!firmwareVersion.trim()) {
      showNotification('Nomor versi firmware wajib diisi (contoh: 1.0.1)', true);
      return;
    }

    setIsUploadingFirmware(true);
    uploadFirmwareMutation.mutate({
      version: firmwareVersion.trim(),
      fileName: firmwareFile.name,
      fileData: firmwareBase64,
      changelog: firmwareChangelog.trim() || undefined,
    });
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim()) {
      showNotification('Nama perangkat tidak boleh kosong', true);
      return;
    }
    if (!editRoomId) {
      showNotification('Silakan pilih ruangan', true);
      return;
    }

    updateDeviceMutation.mutate({
      name: editName.trim(),
      roomId: editRoomId,
      macAddress: editMacAddress.trim() || undefined,
      pairingCode: editPairingCode.trim() || undefined,
    });
  };

  // Find active and previous firmwares
  const activeFirmware = useMemo(() => firmwares.find((f) => f.isCurrent || f.status === 'ACTIVE'), [firmwares]);
  const previousFirmware = useMemo(
    () =>
      firmwares.find((f) => f.status === 'PREVIOUS') ||
      firmwares.find((f) => !f.isCurrent && f.deployedAt !== null),
    [firmwares],
  );

  if (isDeviceLoading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center gap-3 text-primary">
        <span className="material-symbols-outlined text-4xl animate-spin">progress_activity</span>
        <p className="text-sm font-semibold">Memuat Data Perangkat...</p>
      </div>
    );
  }

  if (deviceError || !device) {
    return (
      <div className="py-16 text-center space-y-4">
        <span className="material-symbols-outlined text-5xl text-error">error_outline</span>
        <h2 className="text-xl font-bold text-on-surface">Perangkat Tidak Ditemukan</h2>
        <p className="text-sm text-outline">Perangkat dengan ID #{deviceId} tidak terdaftar di sistem.</p>
        <button
          onClick={() => navigate('/devices')}
          className="px-4 py-2 bg-primary text-on-primary rounded-xl text-sm font-bold shadow-sm"
        >
          Kembali ke Daftar Perangkat
        </button>
      </div>
    );
  }

  const rssiBadge = getRssiBadge(diag.rssi);

  // Flash Memory Percentage
  const flashUsed = diag.sketchSize || 0;
  const flashTotal = diag.flashChipSize || 4194304; // default 4MB
  const flashPercent = Math.min(100, Math.round((flashUsed / flashTotal) * 100));

  return (
    <div className="space-y-6 pb-12">
      {/* Top Breadcrumb Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/devices')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80 transition-colors cursor-pointer"
        >
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          <span>Kembali ke Devices Inventory</span>
        </button>

        {/* Real-time Status Badge */}
        <div className="flex items-center gap-2">
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
            {device.status === 'ONLINE' ? 'ONLINE (Aktif)' : 'OFFLINE'}
          </span>
          <span className="text-xs text-outline font-data-mono">
            Last seen: {device.lastSeenAt ? new Date(device.lastSeenAt).toLocaleTimeString() : '-'}
          </span>
        </div>
      </div>

      {/* Notifications Alert Banner */}
      {successMessage && (
        <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center justify-between animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">check_circle</span>
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-700 dark:text-emerald-300 hover:opacity-75">
            ✕
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center justify-between animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">error</span>
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-rose-700 dark:text-rose-300 hover:opacity-75">
            ✕
          </button>
        </div>
      )}

      {/* Hero Header Card */}
      <div className="bg-surface border border-outline-variant rounded-2xl p-6 shadow-xs relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="p-3.5 rounded-2xl bg-primary/10 text-primary border border-primary/20 shrink-0 shadow-xs">
              <span className="material-symbols-outlined text-[36px]">{getDeviceIcon(device.deviceType)}</span>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl font-bold text-on-surface">{device.name}</h1>
                <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-primary/10 text-primary border border-primary/20 font-data-mono uppercase">
                  {device.deviceType}
                </span>
                <span className="px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-surface-container-highest text-on-surface-variant">
                  📍 {device.room?.name || `Room #${device.roomId}`} ({device.room?.home?.name || 'Home'})
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-on-surface-variant flex-wrap font-data-mono">
                <span>
                  UID: <strong className="text-on-surface">{device.deviceUid}</strong>
                </span>
                <span>&bull;</span>
                <span>
                  Pairing Code: <strong className="text-primary">{device.pairingCode || 'None'}</strong>
                </span>
                <span>&bull;</span>
                <span>
                  MAC: <strong className="text-on-surface">{diag.macAddress || device.macAddress || '-'}</strong>
                </span>
                <span>&bull;</span>
                <span>
                  IP:{' '}
                  <strong className="text-on-surface">
                    {diag.ipAddress ? (
                      <a
                        href={`http://${diag.ipAddress}`}
                        target="_blank"
                        rel="noreferrer"
                        className="underline hover:text-primary"
                      >
                        {diag.ipAddress}
                      </a>
                    ) : (
                      '-'
                    )}
                  </strong>
                </span>
                <span>&bull;</span>
                <span>
                  Firmware:{' '}
                  <strong className="text-emerald-600 font-bold">
                    v{diag.firmwareVersion || device.firmwareVersion || '1.0.0'}
                  </strong>
                </span>
              </div>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <button
              onClick={() => refreshDiagMutation.mutate(device.id)}
              disabled={refreshDiagMutation.isPending || isRefreshingDiag}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-surface-container-high border border-outline-variant text-on-surface hover:bg-surface-container-highest rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95 disabled:opacity-50"
              title="Minta update metrik terbaru dari ESP via MQTT"
            >
              <span
                className={`material-symbols-outlined text-[16px] ${
                  refreshDiagMutation.isPending || isRefreshingDiag ? 'animate-spin' : ''
                }`}
              >
                sync
              </span>
              <span>{refreshDiagMutation.isPending || isRefreshingDiag ? 'Refreshing...' : 'Refresh Info'}</span>
            </button>

            <button
              onClick={() => setIsRestartConfirmOpen(true)}
              disabled={restartMutation.isPending}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95 disabled:opacity-50"
              title="Kirim sinyal restart reboot ke modul ESP"
            >
              <span className="material-symbols-outlined text-[16px]">power_settings_new</span>
              <span>Restart ESP</span>
            </button>

            <button
              onClick={() => setIsConfigPortalConfirmOpen(true)}
              disabled={openConfigMutation.isPending}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-primary text-on-primary hover:bg-primary/90 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95 disabled:opacity-50"
              title="Aktifkan Web Config Portal pada ESP untuk ubah WiFi/MQTT"
            >
              <span className="material-symbols-outlined text-[16px]">wifi_tethering</span>
              <span>Web Config</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation Menu */}
        <div className="flex gap-1 border-b border-outline-variant mt-6 -mb-6 overflow-x-auto">
          {[
            { id: 'overview', label: 'Ringkasan & Telemetri', icon: 'dashboard' },
            {
              id: 'firmware',
              label: 'Manajemen Firmware & OTA',
              icon: 'system_update',
              badge: firmwares.length > 0 ? firmwares.length : undefined,
            },
            { id: 'diagnostics', label: 'Diagnostik Hardware ESP', icon: 'memory' },
            { id: 'settings', label: 'Pengaturan Perangkat', icon: 'tune' },
            { id: 'history', label: 'Riwayat Perintah', icon: 'receipt_long' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-primary text-primary bg-primary/5 rounded-t-lg'
                  : 'border-transparent text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high/40'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">{tab.icon}</span>
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-primary/20 text-primary font-mono">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: OVERVIEW & LIVE TELEMETRY                         */}
      {/* ======================================================== */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Firmware Version Card */}
            <div className="p-4 bg-surface border border-outline-variant rounded-2xl shadow-xs space-y-2">
              <div className="flex justify-between items-center text-outline text-xs font-semibold">
                <span>Versi Firmware Aktif</span>
                <span className="material-symbols-outlined text-primary text-[20px]">system_update</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold font-data-mono text-on-surface">
                  v{diag.firmwareVersion || device.firmwareVersion || '1.0.0'}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#ecfdf5] text-[#059669] border border-[#10b981]/20">
                  ACTIVE
                </span>
              </div>
              <p className="text-[11px] text-outline">
                {activeFirmware?.deployedAt
                  ? `Di-flash: ${new Date(activeFirmware.deployedAt).toLocaleDateString()}`
                  : 'Firmware default build'}
              </p>
            </div>

            {/* 2. WiFi Signal RSSI Card */}
            <div className="p-4 bg-surface border border-outline-variant rounded-2xl shadow-xs space-y-2">
              <div className="flex justify-between items-center text-outline text-xs font-semibold">
                <span>Kekuatan Sinyal WiFi</span>
                <span className="material-symbols-outlined text-[20px]">{rssiBadge.icon}</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-bold font-data-mono text-on-surface">
                  {diag.rssi !== null && diag.rssi !== undefined ? `${diag.rssi} dBm` : '-'}
                </span>
              </div>
              <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${rssiBadge.color}`}>
                {rssiBadge.label}
              </span>
            </div>

            {/* 3. IP & Network Card */}
            <div className="p-4 bg-surface border border-outline-variant rounded-2xl shadow-xs space-y-2">
              <div className="flex justify-between items-center text-outline text-xs font-semibold">
                <span>Alamat IP Node</span>
                <span className="material-symbols-outlined text-[20px]">lan</span>
              </div>
              <div className="font-data-mono font-bold text-base text-on-surface truncate">
                {diag.ipAddress || <span className="text-outline italic">Belum terdeteksi</span>}
              </div>
              <p className="text-[11px] text-outline font-data-mono">
                MAC: {diag.macAddress || device.macAddress || '-'}
              </p>
            </div>

            {/* 4. Uptime Card */}
            <div className="p-4 bg-surface border border-outline-variant rounded-2xl shadow-xs space-y-2">
              <div className="flex justify-between items-center text-outline text-xs font-semibold">
                <span>Uptime Perangkat</span>
                <span className="material-symbols-outlined text-[20px]">schedule</span>
              </div>
              <div className="text-lg font-bold font-data-mono text-on-surface">
                {formatUptime(diag.uptime)}
              </div>
              <p className="text-[11px] text-outline">
                Boot Reason: {diag.resetReason || 'Normal Power On'}
              </p>
            </div>
          </div>

          {/* Domain Specific Live Telemetry Banner (e.g. Temp/Humidity, Exhaust Fan) */}
          {device.deviceType === 'TEMP_HUMIDITY' && (
            <div className="p-5 bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-purple-500/10 border border-blue-500/20 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-500 text-white rounded-xl shadow-md">
                  <span className="material-symbols-outlined text-[32px]">device_thermostat</span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-on-surface">Monitoring Sensor DHT22 Suhu &amp; Kelembaban</h3>
                  <p className="text-xs text-on-surface-variant">
                    Node ini aktif memancarkan telemetri time-series suhu dan kelembaban ruangan ke MQTT broker.
                  </p>
                </div>
              </div>
              <Link
                to={`/monitoring/temp-humidity/${device.deviceUid}`}
                className="px-4 py-2.5 bg-primary text-on-primary font-bold text-xs rounded-xl shadow-sm hover:bg-primary/90 transition-all flex items-center gap-2 shrink-0"
              >
                <span>Buka Dashboard Analitik Suhu</span>
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </Link>
            </div>
          )}

          {device.deviceType === 'EXHAUST_FAN' && (
            <div className="p-5 bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-cyan-500/10 border border-emerald-500/20 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-emerald-600 text-white rounded-xl shadow-md">
                  <span className="material-symbols-outlined text-[32px]">mode_fan</span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-on-surface">Exhaust Fan Smart Controller</h3>
                  <p className="text-xs text-on-surface-variant">
                    Kendali exhaust fan dual-direction (Intake / Exhaust) dengan dukungan automasi kelembaban.
                  </p>
                </div>
              </div>
              <Link
                to={`/monitoring/exhaust-fan/${device.deviceUid}`}
                className="px-4 py-2.5 bg-primary text-on-primary font-bold text-xs rounded-xl shadow-sm hover:bg-primary/90 transition-all flex items-center gap-2 shrink-0"
              >
                <span>Buka Kendali Exhaust Fan</span>
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </Link>
            </div>
          )}

          {/* Quick Hardware Diagnostic Preview */}
          <div className="p-5 bg-surface border border-outline-variant rounded-2xl space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">memory</span>
                <span>Status Memori &amp; Resource Hardware</span>
              </h3>
              <button
                onClick={() => setActiveTab('diagnostics')}
                className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
              >
                <span>Lihat 12 Metrik Lengkap</span>
                <span className="material-symbols-outlined text-[14px]">chevron_right</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-3.5 bg-surface-container-low rounded-xl border border-outline-variant/60 space-y-1.5">
                <div className="flex justify-between text-xs text-outline">
                  <span>Free RAM Heap</span>
                  <span className="font-data-mono font-bold text-on-surface">
                    {diag.freeHeap ? formatBytes(diag.freeHeap) : '-'}
                  </span>
                </div>
                <div className="w-full bg-surface-container-highest h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full rounded-full transition-all"
                    style={{ width: diag.freeHeap ? `${Math.min(100, (diag.freeHeap / 81920) * 100)}%` : '0%' }}
                  />
                </div>
              </div>

              <div className="p-3.5 bg-surface-container-low rounded-xl border border-outline-variant/60 space-y-1.5">
                <div className="flex justify-between text-xs text-outline">
                  <span>Flash Program Size</span>
                  <span className="font-data-mono font-bold text-on-surface">{flashPercent}%</span>
                </div>
                <div className="w-full bg-surface-container-highest h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-indigo-500 h-full rounded-full transition-all"
                    style={{ width: `${flashPercent}%` }}
                  />
                </div>
              </div>

              <div className="p-3.5 bg-surface-container-low rounded-xl border border-outline-variant/60 space-y-1.5">
                <div className="flex justify-between text-xs text-outline">
                  <span>CPU Clock Frequency</span>
                  <span className="font-data-mono font-bold text-on-surface">
                    {diag.cpuFreq ? `${diag.cpuFreq} MHz` : '80 MHz'}
                  </span>
                </div>
                <p className="text-[10px] text-outline">Espressif Standard Frequency</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: FIRMWARE MANAGEMENT & OTA UPDATE (FITUR UTAMA)    */}
      {/* ======================================================== */}
      {activeTab === 'firmware' && (
        <div className="space-y-6">
          {/* Section 1: Active Firmware & Quick Rollback Banner */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Active Firmware Info Card */}
            <div className="lg:col-span-2 p-5 bg-gradient-to-br from-surface to-surface-container-low border border-emerald-500/30 rounded-2xl shadow-xs space-y-3 relative overflow-hidden">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                    <span className="material-symbols-outlined text-[24px]">verified</span>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-on-surface">Firmware Aktif di ESP Node</h3>
                    <p className="text-xs text-outline font-data-mono">
                      Versi yang sedang berjalan di mikrokontroler
                    </p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  ACTIVE
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                <div className="p-2.5 bg-surface rounded-xl border border-outline-variant/60">
                  <p className="text-[11px] text-outline">Versi Firmware</p>
                  <p className="text-base font-bold font-data-mono text-emerald-600">
                    v{diag.firmwareVersion || device.firmwareVersion || activeFirmware?.version || '1.0.0'}
                  </p>
                </div>
                <div className="p-2.5 bg-surface rounded-xl border border-outline-variant/60">
                  <p className="text-[11px] text-outline">Nama File</p>
                  <p className="text-xs font-semibold text-on-surface truncate font-data-mono" title={activeFirmware?.fileName || '-'}>
                    {activeFirmware?.fileName || 'default.bin'}
                  </p>
                </div>
                <div className="p-2.5 bg-surface rounded-xl border border-outline-variant/60">
                  <p className="text-[11px] text-outline">Ukuran Binary</p>
                  <p className="text-xs font-semibold font-data-mono text-on-surface">
                    {activeFirmware?.fileSize ? formatBytes(activeFirmware.fileSize) : '-'}
                  </p>
                </div>
                <div className="p-2.5 bg-surface rounded-xl border border-outline-variant/60">
                  <p className="text-[11px] text-outline">Tanggal Update ke ESP</p>
                  <p className="text-xs font-semibold text-on-surface font-data-mono">
                    {activeFirmware?.deployedAt
                      ? new Date(activeFirmware.deployedAt).toLocaleDateString()
                      : 'Default Setup'}
                  </p>
                </div>
              </div>

              {activeFirmware?.checksum && (
                <div className="text-[11px] text-outline font-data-mono bg-surface-container-high/40 p-2 rounded-lg truncate">
                  SHA-256 Checksum: <span className="text-on-surface">{activeFirmware.checksum}</span>
                </div>
              )}
            </div>

            {/* Quick Rollback Action Card */}
            <div className="p-5 bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/30 rounded-2xl shadow-xs flex flex-col justify-between space-y-3">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-bold text-sm">
                  <span className="material-symbols-outlined text-[22px]">history</span>
                  <span>1-Click Rollback Firmware</span>
                </div>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  Kembalikan firmware ke versi sebelumnya secara instan jika ada bug atau kendala pada firmware terbaru.
                </p>
              </div>

              {previousFirmware ? (
                <div className="space-y-2">
                  <div className="p-2 bg-surface/80 rounded-lg text-xs font-data-mono flex justify-between items-center border border-amber-500/20">
                    <span className="text-outline">Versi Sebelumnya:</span>
                    <span className="font-bold text-amber-700 dark:text-amber-300">
                      v{previousFirmware.version}
                    </span>
                  </div>
                  <button
                    onClick={() => setIsRollbackConfirmOpen(true)}
                    disabled={rollbackFirmwareMutation.isPending}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-[16px]">undo</span>
                    <span>
                      {rollbackFirmwareMutation.isPending
                        ? 'Memproses Rollback...'
                        : `Rollback ke v${previousFirmware.version}`}
                    </span>
                  </button>
                </div>
              ) : (
                <div className="p-3 bg-surface/50 rounded-xl text-center text-xs text-outline border border-outline-variant/40">
                  <span className="material-symbols-outlined text-[20px] block mb-1">info</span>
                  Belum ada riwayat firmware sebelumnya untuk rollback.
                </div>
              )}
            </div>
          </div>

          {/* Section 2: Upload New Firmware (.bin) */}
          <div className="p-5 bg-surface border border-outline-variant rounded-2xl shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-outline-variant pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[22px]">upload_file</span>
                <div>
                  <h3 className="text-sm font-bold text-on-surface">Upload Firmware Baru (.bin)</h3>
                  <p className="text-xs text-outline">
                    Unggah file binary hasil build PlatformIO / Arduino IDE untuk disimpan ke database
                  </p>
                </div>
              </div>
            </div>

            <form onSubmit={handleUploadSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* File Dropzone */}
                <div>
                  <label className="block text-xs font-bold text-on-surface mb-1.5">
                    File Binary (.bin) <span className="text-error">*</span>
                  </label>
                  <div className="relative border-2 border-dashed border-outline-variant hover:border-primary rounded-xl p-4 text-center cursor-pointer transition-colors bg-surface-container-low/40">
                    <input
                      type="file"
                      accept=".bin"
                      onChange={handleFileChange}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                    <div className="space-y-1">
                      <span className="material-symbols-outlined text-[32px] text-primary">cloud_upload</span>
                      {firmwareFile ? (
                        <div>
                          <p className="text-xs font-bold text-on-surface font-data-mono">{firmwareFile.name}</p>
                          <p className="text-[11px] text-outline font-data-mono">{formatBytes(firmwareFile.size)}</p>
                        </div>
                      ) : (
                        <div>
                          <p className="text-xs font-semibold text-on-surface">Klik atau seret file .bin ke sini</p>
                          <p className="text-[11px] text-outline">Format .bin (maksimal 10MB)</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Form Fields: Version & Changelog */}
                <div className="space-y-3">
                  <div>
                    <label htmlFor="fw_version" className="block text-xs font-bold text-on-surface mb-1">
                      Nomor Versi Firmware <span className="text-error">*</span>
                    </label>
                    <input
                      id="fw_version"
                      type="text"
                      placeholder="Contoh: 1.0.1 atau 2.0.0"
                      value={firmwareVersion}
                      onChange={(e) => setFirmwareVersion(e.target.value)}
                      required
                      className="w-full px-3.5 py-2 text-xs bg-surface-container-low border border-outline-variant rounded-xl text-on-surface font-data-mono focus:border-primary outline-none"
                    />
                  </div>

                  <div>
                    <label htmlFor="fw_changelog" className="block text-xs font-bold text-on-surface mb-1">
                      Catatan Rilis / Changelog (Opsional)
                    </label>
                    <textarea
                      id="fw_changelog"
                      rows={2}
                      placeholder="Contoh: Perbaikan kalibrasi DHT22 dan stabilitas WiFi auto-reconnect..."
                      value={firmwareChangelog}
                      onChange={(e) => setFirmwareChangelog(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs bg-surface-container-low border border-outline-variant rounded-xl text-on-surface focus:border-primary outline-none resize-none"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="submit"
                  disabled={!firmwareFile || !firmwareVersion || isUploadingFirmware || uploadFirmwareMutation.isPending}
                  className="flex items-center gap-2 px-5 py-2.5 bg-primary text-on-primary font-bold text-xs rounded-xl shadow-sm hover:bg-primary/90 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[16px]">
                    {isUploadingFirmware ? 'sync' : 'save'}
                  </span>
                  <span>{isUploadingFirmware ? 'Mengunggah Firmware...' : 'Simpan Firmware ke Database'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Section 3: Firmware Inventory & History Table */}
          <div className="p-5 bg-surface border border-outline-variant rounded-2xl shadow-xs space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[20px]">inventory_2</span>
                  <span>Daftar Inventaris Firmware Tersimpan ({firmwares.length})</span>
                </h3>
                <p className="text-xs text-outline">
                  Pilih firmware mana yang ingin dipasang ke ESP dengan klik tombol <strong>Update Firmware</strong>
                </p>
              </div>
              <button
                onClick={() => refetchFirmware()}
                className="text-xs text-primary hover:underline font-semibold flex items-center gap-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[14px]">refresh</span>
                Refresh List
              </button>
            </div>

            {isLoadingFirmware ? (
              <p className="text-center py-8 text-xs text-outline">Memuat daftar firmware...</p>
            ) : firmwares.length === 0 ? (
              <div className="text-center py-10 text-outline text-xs bg-surface-container-low rounded-xl border border-outline-variant/60 space-y-1">
                <span className="material-symbols-outlined text-[36px] text-outline block mb-1">
                  folder_open
                </span>
                <p className="font-semibold text-on-surface">Belum ada firmware yang diunggah</p>
                <p className="text-[11px]">Silakan unggah file .bin di atas untuk memulai manajemen versi.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-outline-variant/70">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-surface-container-high/60 border-b border-outline-variant text-on-surface-variant uppercase text-[11px] font-bold tracking-wider">
                    <tr>
                      <th className="px-4 py-3">Versi &amp; File</th>
                      <th className="px-4 py-3">Tanggal Upload</th>
                      <th className="px-4 py-3">Tanggal Update ke ESP</th>
                      <th className="px-4 py-3">Ukuran File</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/50">
                    {firmwares.map((fw) => (
                      <tr
                        key={fw.id}
                        className={`hover:bg-surface-container-low/60 transition-colors ${
                          fw.isCurrent ? 'bg-emerald-500/5' : ''
                        }`}
                      >
                        {/* Version & File Name */}
                        <td className="px-4 py-3.5">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-on-surface font-data-mono text-sm">
                                v{fw.version}
                              </span>
                              {fw.isCurrent && (
                                <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-[#ecfdf5] text-[#059669] border border-[#10b981]/30">
                                  CURRENT
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-outline font-data-mono truncate max-w-[200px]" title={fw.fileName}>
                              {fw.fileName}
                            </p>
                            {fw.changelog && (
                              <p className="text-[11px] text-on-surface-variant italic truncate max-w-[250px]" title={fw.changelog}>
                                &ldquo;{fw.changelog}&rdquo;
                              </p>
                            )}
                          </div>
                        </td>

                        {/* Upload Date */}
                        <td className="px-4 py-3.5 text-on-surface-variant font-data-mono text-[11px]">
                          <div>{new Date(fw.uploadedAt).toLocaleDateString()}</div>
                          <div className="text-outline text-[10px]">{new Date(fw.uploadedAt).toLocaleTimeString()}</div>
                        </td>

                        {/* Deployed to ESP Date */}
                        <td className="px-4 py-3.5 text-on-surface-variant font-data-mono text-[11px]">
                          {fw.deployedAt ? (
                            <div>
                              <div className="text-emerald-700 dark:text-emerald-400 font-semibold">
                                {new Date(fw.deployedAt).toLocaleDateString()}
                              </div>
                              <div className="text-outline text-[10px]">
                                {new Date(fw.deployedAt).toLocaleTimeString()}
                              </div>
                            </div>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-surface-container-highest text-outline">
                              Belum pernah di-flash
                            </span>
                          )}
                        </td>

                        {/* File Size */}
                        <td className="px-4 py-3.5 text-on-surface-variant font-data-mono">
                          {formatBytes(fw.fileSize)}
                        </td>

                        {/* Status Badge */}
                        <td className="px-4 py-3.5">
                          {fw.status === 'FLASHING' ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950 dark:text-blue-300 animate-pulse">
                              <span className="material-symbols-outlined text-[13px] animate-spin">sync</span>
                              Flashing OTA...
                            </span>
                          ) : fw.status === 'FAILED' ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border bg-red-50 text-red-700 border-red-300 dark:bg-red-950 dark:text-red-300" title="Proses flashing gagal. ESP tetap menggunakan firmware sebelumnya.">
                              <span className="material-symbols-outlined text-[13px]">error</span>
                              Gagal Flash
                            </span>
                          ) : fw.isCurrent || fw.status === 'ACTIVE' ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              Active
                            </span>
                          ) : fw.status === 'PREVIOUS' ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950 dark:text-amber-300">
                              ↺ Previous
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300">
                              Ready
                            </span>
                          )}
                        </td>

                        {/* Action Buttons */}
                        <td className="px-4 py-3.5 text-right space-x-1.5 whitespace-nowrap">
                          {/* Download Binary Button */}
                          <a
                            href={firmwareApi.getDownloadUrl(fw.id)}
                            download={fw.fileName}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-surface-container-high hover:bg-surface-container-highest text-on-surface rounded-lg text-xs font-semibold border border-outline-variant transition-colors"
                            title="Unduh file .bin ke komputer"
                          >
                            <span className="material-symbols-outlined text-[14px]">download</span>
                          </a>

                          {/* Deploy / Update Button */}
                          {!fw.isCurrent && fw.status !== 'ACTIVE' && (
                            <button
                              onClick={() => setSelectedFirmwareToDeploy(fw)}
                              disabled={deployFirmwareMutation.isPending || fw.status === 'FLASHING' || device.status === 'OFFLINE'}
                              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold shadow-xs transition-all cursor-pointer active:scale-95 disabled:opacity-50 ${
                                fw.status === 'FLASHING'
                                  ? 'bg-blue-600 text-white cursor-not-allowed'
                                  : 'bg-primary text-on-primary hover:bg-primary/90'
                              }`}
                              title={
                                device.status === 'OFFLINE'
                                  ? 'Perangkat sedang Offline. Nyalakan ESP terlebih dahulu sebelum update OTA.'
                                  : fw.status === 'FLASHING'
                                    ? 'Sedang dalam proses flashing...'
                                    : 'Flash / Pasang versi firmware ini ke ESP via OTA'
                              }
                            >
                              <span className="material-symbols-outlined text-[14px]">
                                {fw.status === 'FLASHING' ? 'sync' : 'system_update_alt'}
                              </span>
                              <span>{fw.status === 'FLASHING' ? 'Flashing...' : 'Update Firmware'}</span>
                            </button>
                          )}

                          {/* Delete Button */}
                          {!fw.isCurrent && fw.status !== 'ACTIVE' && fw.status !== 'FLASHING' && (
                            <button
                              onClick={() => deleteFirmwareMutation.mutate(fw.id)}
                              disabled={deleteFirmwareMutation.isPending}
                              className="inline-flex items-center p-1.5 text-error hover:bg-error-container/40 rounded-lg transition-colors cursor-pointer"
                              title="Hapus firmware ini dari database"
                            >
                              <span className="material-symbols-outlined text-[16px]">delete</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: ESP HARDWARE SYSTEM DIAGNOSTICS (12 METRICS)     */}
      {/* ======================================================== */}
      {activeTab === 'diagnostics' && (
        <div className="space-y-6">
          <div className="p-5 bg-surface border border-outline-variant rounded-2xl shadow-xs space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[20px]">memory</span>
                  <span>12 Parameter Diagnostik Internal ESP32 / ESP8266</span>
                </h3>
                <p className="text-xs text-outline">
                  Data diagnostik diterima secara real-time dari ESP melalui topik MQTT <code className="font-mono">iot/diagnostics</code>
                </p>
              </div>
              <button
                onClick={() => refreshDiagMutation.mutate(device.id)}
                disabled={refreshDiagMutation.isPending || isRefreshingDiag}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary hover:text-on-primary rounded-lg text-xs font-bold transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[14px]">sync</span>
                Refresh Diagnostik
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {/* 1. Free Heap */}
              <div className="p-3.5 bg-surface-container-low rounded-xl border border-outline-variant/60">
                <span className="text-outline text-xs">Free Heap RAM</span>
                <p className="font-bold text-base text-on-surface font-data-mono mt-1">
                  {diag.freeHeap ? formatBytes(diag.freeHeap) : '-'}
                </p>
              </div>

              {/* 2. Min Free Heap */}
              <div className="p-3.5 bg-surface-container-low rounded-xl border border-outline-variant/60">
                <span className="text-outline text-xs">Lowest Recorded Free Heap</span>
                <p className="font-bold text-base text-on-surface font-data-mono mt-1">
                  {diag.minFreeHeap ? formatBytes(diag.minFreeHeap) : '-'}
                </p>
              </div>

              {/* 3. Flash Chip Size */}
              <div className="p-3.5 bg-surface-container-low rounded-xl border border-outline-variant/60">
                <span className="text-outline text-xs">Flash Chip Capacity</span>
                <p className="font-bold text-base text-on-surface font-data-mono mt-1">
                  {diag.flashChipSize ? formatBytes(diag.flashChipSize) : '4 MB'}
                </p>
              </div>

              {/* 4. Sketch Size */}
              <div className="p-3.5 bg-surface-container-low rounded-xl border border-outline-variant/60">
                <span className="text-outline text-xs">Program Binary (Sketch) Size</span>
                <p className="font-bold text-base text-on-surface font-data-mono mt-1">
                  {diag.sketchSize ? formatBytes(diag.sketchSize) : '-'}
                </p>
              </div>

              {/* 5. CPU Frequency */}
              <div className="p-3.5 bg-surface-container-low rounded-xl border border-outline-variant/60">
                <span className="text-outline text-xs">CPU Frequency</span>
                <p className="font-bold text-base text-on-surface font-data-mono mt-1">
                  {diag.cpuFreq ? `${diag.cpuFreq} MHz` : '80 MHz'}
                </p>
              </div>

              {/* 6. WiFi RSSI Signal */}
              <div className="p-3.5 bg-surface-container-low rounded-xl border border-outline-variant/60">
                <span className="text-outline text-xs">WiFi RSSI Strength</span>
                <p className="font-bold text-base text-on-surface font-data-mono mt-1">
                  {diag.rssi ? `${diag.rssi} dBm` : '-'}
                </p>
              </div>

              {/* 7. Internal ESP Temperature */}
              <div className="p-3.5 bg-surface-container-low rounded-xl border border-outline-variant/60">
                <span className="text-outline text-xs">Internal Core Temp (ESP32)</span>
                <p className="font-bold text-base text-on-surface font-data-mono mt-1">
                  {diag.internalTemp ? `${diag.internalTemp} °C` : 'N/A (ESP8266)'}
                </p>
              </div>

              {/* 8. Reset Reason */}
              <div className="p-3.5 bg-surface-container-low rounded-xl border border-outline-variant/60">
                <span className="text-outline text-xs">Last Reset Reason</span>
                <p className="font-bold text-xs text-on-surface font-data-mono mt-1 truncate" title={diag.resetReason || ''}>
                  {diag.resetReason || 'POWERON_RESET'}
                </p>
              </div>

              {/* 9. Uptime */}
              <div className="p-3.5 bg-surface-container-low rounded-xl border border-outline-variant/60">
                <span className="text-outline text-xs">System Uptime</span>
                <p className="font-bold text-base text-on-surface font-data-mono mt-1">
                  {formatUptime(diag.uptime)}
                </p>
              </div>

              {/* 10. Firmware Version */}
              <div className="p-3.5 bg-surface-container-low rounded-xl border border-outline-variant/60">
                <span className="text-outline text-xs">Firmware Version Reported</span>
                <p className="font-bold text-base text-emerald-600 font-data-mono mt-1">
                  v{diag.firmwareVersion || device.firmwareVersion || '1.0.0'}
                </p>
              </div>

              {/* 11. Hardware MAC Address */}
              <div className="p-3.5 bg-surface-container-low rounded-xl border border-outline-variant/60">
                <span className="text-outline text-xs">Hardware MAC Address</span>
                <p className="font-bold text-xs text-on-surface font-data-mono mt-1">
                  {diag.macAddress || device.macAddress || '-'}
                </p>
              </div>

              {/* 12. Local IP Address */}
              <div className="p-3.5 bg-surface-container-low rounded-xl border border-outline-variant/60">
                <span className="text-outline text-xs">Local IP Address</span>
                <p className="font-bold text-xs text-on-surface font-data-mono mt-1">
                  {diag.ipAddress || device.ipAddress || '-'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 4: GENERAL SETTINGS & MAINTENANCE                    */}
      {/* ======================================================== */}
      {activeTab === 'settings' && (
        <div className="space-y-6">
          {/* Edit General Settings Form */}
          <div className="p-5 bg-surface border border-outline-variant rounded-2xl shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[20px]">edit</span>
              <span>Edit Identitas &amp; Ruangan Perangkat</span>
            </h3>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="edit_name" className="block text-xs font-bold text-on-surface mb-1">
                    Nama Perangkat <span className="text-error">*</span>
                  </label>
                  <input
                    id="edit_name"
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    required
                    className="w-full px-3.5 py-2 text-xs bg-surface-container-low border border-outline-variant rounded-xl text-on-surface focus:border-primary outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="edit_room" className="block text-xs font-bold text-on-surface mb-1">
                    Ruangan <span className="text-error">*</span>
                  </label>
                  <select
                    id="edit_room"
                    value={editRoomId}
                    onChange={(e) => setEditRoomId(parseInt(e.target.value, 10))}
                    required
                    className="w-full px-3.5 py-2 text-xs bg-surface-container-low border border-outline-variant rounded-xl text-on-surface focus:border-primary outline-none"
                  >
                    <option value={0} disabled>
                      Pilih Ruangan...
                    </option>
                    {allRooms.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} ({r.homeName})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="edit_pairing" className="block text-xs font-bold text-on-surface mb-1">
                    Pairing Code Token
                  </label>
                  <input
                    id="edit_pairing"
                    type="text"
                    value={editPairingCode}
                    onChange={(e) => setEditPairingCode(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs bg-surface-container-low border border-outline-variant rounded-xl text-on-surface font-data-mono focus:border-primary outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="edit_mac" className="block text-xs font-bold text-on-surface mb-1">
                    Hardware MAC Address
                  </label>
                  <input
                    id="edit_mac"
                    type="text"
                    value={editMacAddress}
                    onChange={(e) => setEditMacAddress(e.target.value)}
                    placeholder="Auto-bound saat ESP pertama kali terhubung"
                    className="w-full px-3.5 py-2 text-xs bg-surface-container-low border border-outline-variant rounded-xl text-on-surface font-data-mono focus:border-primary outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={updateDeviceMutation.isPending}
                  className="px-5 py-2 bg-primary text-on-primary font-bold text-xs rounded-xl shadow-xs hover:bg-primary/90 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  {updateDeviceMutation.isPending ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>

          {/* Maintenance & Dangerous Actions */}
          <div className="p-5 bg-surface border border-outline-variant rounded-2xl shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-on-surface">Tindakan Pemeliharaan &amp; Reset</h3>

            <div className="space-y-3">
              {/* Web Config Portal Action */}
              <div className="p-4 bg-surface-container-low rounded-xl border border-outline-variant/60 flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-bold text-on-surface flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-primary text-[18px]">wifi_tethering</span>
                    Web Configuration Portal
                  </p>
                  <p className="text-xs text-outline mt-0.5">
                    Aktifkan portal web internal ESP untuk konfigurasi ulang WiFi, MQTT, dan Pairing Code.
                  </p>
                </div>
                <button
                  onClick={() => setIsConfigPortalConfirmOpen(true)}
                  disabled={openConfigMutation.isPending}
                  className="px-3.5 py-2 bg-primary text-on-primary hover:bg-primary/90 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95 disabled:opacity-50 whitespace-nowrap"
                >
                  Buka Web Config
                </button>
              </div>

              {/* Restart Action */}
              <div className="p-4 bg-surface-container-low rounded-xl border border-outline-variant/60 flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-bold text-on-surface flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-amber-600 text-[18px]">restart_alt</span>
                    Restart ESP Microcontroller
                  </p>
                  <p className="text-xs text-outline mt-0.5">
                    Kirim sinyal remote reboot melalui MQTT ke perangkat.
                  </p>
                </div>
                <button
                  onClick={() => setIsRestartConfirmOpen(true)}
                  disabled={restartMutation.isPending}
                  className="px-3.5 py-2 bg-amber-600 text-white hover:bg-amber-700 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95 disabled:opacity-50 whitespace-nowrap"
                >
                  Restart ESP
                </button>
              </div>

              {/* Unlink MAC Action */}
              {device.macAddress && (
                <div className="p-4 bg-surface-container-low rounded-xl border border-outline-variant/60 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[18px]">link_off</span>
                      Unlink Hardware MAC Binding
                    </p>
                    <p className="text-xs text-outline mt-0.5">
                      Lepaskan ikatan MAC ({device.macAddress}) agar modul ESP pengganti baru dapat terhubung.
                    </p>
                  </div>
                  <button
                    onClick={() => setIsResetAuthConfirmOpen(true)}
                    disabled={resetAuthMutation.isPending}
                    className="px-3.5 py-2 border border-amber-600/40 text-amber-700 dark:text-amber-300 hover:bg-amber-50 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-95 disabled:opacity-50 whitespace-nowrap"
                  >
                    Unlink MAC
                  </button>
                </div>
              )}

              {/* Delete Device Action */}
              <div className="p-4 bg-error-container/10 rounded-xl border border-error/20 flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-bold text-error flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[18px]">delete_forever</span>
                    Hapus Perangkat Permanen
                  </p>
                  <p className="text-xs text-outline mt-0.5">
                    Menghapus perangkat beserta seluruh riwayat telemetri &amp; firmware tersimpan.
                  </p>
                </div>
                <button
                  onClick={() => setIsDeleteConfirmOpen(true)}
                  disabled={deleteDeviceMutation.isPending}
                  className="px-3.5 py-2 bg-error text-on-error hover:bg-error/90 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95 disabled:opacity-50 whitespace-nowrap"
                >
                  Delete Device
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 5: COMMAND HISTORY LOG                               */}
      {/* ======================================================== */}
      {activeTab === 'history' && (
        <div className="p-5 bg-surface border border-outline-variant rounded-2xl shadow-xs space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-bold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">receipt_long</span>
                <span>Riwayat Perintah Terakhir (20 Terakhir)</span>
              </h3>
              <p className="text-xs text-outline">Daftar perintah yang dikirim dari server ke perangkat ESP</p>
            </div>
            <button
              onClick={() => queryClient.invalidateQueries({ queryKey: ['deviceCommands', deviceId] })}
              className="text-xs font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[14px]">refresh</span>
              Refresh Log
            </button>
          </div>

          {isLoadingHistory ? (
            <p className="text-center py-8 text-xs text-outline">Memuat log perintah...</p>
          ) : commandHistory.length === 0 ? (
            <div className="text-center py-10 text-outline text-xs bg-surface-container-low rounded-xl border border-outline-variant/60">
              <span className="material-symbols-outlined text-[36px] block mb-1">receipt_long</span>
              Belum ada riwayat perintah untuk perangkat ini.
            </div>
          ) : (
            <div className="space-y-2">
              {commandHistory.map((cmd: DeviceCommand) => (
                <div
                  key={cmd.id}
                  className="p-3.5 bg-surface-container-low rounded-xl border border-outline-variant/70 flex justify-between items-center text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-on-surface uppercase font-data-mono text-sm">
                        {cmd.command}
                      </span>
                      {cmd.payload && (
                        <span className="text-[11px] text-outline font-data-mono truncate max-w-[300px]">
                          {JSON.stringify(cmd.payload)}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-outline">
                      {new Date(cmd.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
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

      {/* ======================================================== */}
      {/* CONFIRMATION & WARNING MODALS                            */}
      {/* ======================================================== */}

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

      {/* 2. Web Config Portal Warning Dialog */}
      {isConfigPortalConfirmOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-outline-variant rounded-2xl max-w-md w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-outline-variant/60 bg-surface-container-low flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 border border-amber-500/20">
                <span className="material-symbols-outlined text-[24px]">wifi_tethering</span>
              </div>
              <div>
                <h3 className="text-base font-bold text-on-surface">Buka Web Config Portal ESP</h3>
                <p className="text-xs text-outline">{device.name} ({device.deviceUid})</p>
              </div>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-200 space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-xs text-amber-700 dark:text-amber-300">
                  <span className="material-symbols-outlined text-[18px]">warning</span>
                  <span>PERINGATAN: FUNGSI PERANGKAT AKAN DIJEDA</span>
                </div>
                <p className="leading-relaxed">
                  Ketika Web Config dibuka, ESP akan beralih ke mode Access Point khusus. <strong>Semua fungsi operasional normal (pembacaan sensor, telemetri, otomatisasi, dan komunikasi MQTT) akan DIHENTIKAN SEMENTARA</strong> sampai konfigurasi disimpan atau dibatalkan dan ESP me-reboot.
                </p>
              </div>

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
                    <span>Ubah konfigurasi WiFi, MQTT, atau Pairing Code lalu klik <em>Save & Restart</em>.</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-outline-variant bg-surface-container-low flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsConfigPortalConfirmOpen(false)}
                disabled={openConfigMutation.isPending}
                className="px-4 py-2 border border-outline-variant rounded-xl text-xs font-semibold text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer"
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

      {/* 3. Deploy Firmware Confirmation Dialog */}
      {selectedFirmwareToDeploy && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-outline-variant rounded-2xl max-w-md w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-outline-variant/60 bg-surface-container-low flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20">
                <span className="material-symbols-outlined text-[24px]">system_update_alt</span>
              </div>
              <div>
                <h3 className="text-base font-bold text-on-surface">Update Firmware ESP Node</h3>
                <p className="text-xs text-outline">{device.name} ({device.deviceUid})</p>
              </div>
            </div>

            <div className="p-5 space-y-3 text-xs">
              <p className="text-on-surface leading-relaxed">
                Anda akan memasang firmware <strong>v{selectedFirmwareToDeploy.version}</strong> ({selectedFirmwareToDeploy.fileName}) ke modul ESP melalui OTA (Over-The-Air).
              </p>

              <div className="p-3 bg-surface-container-low rounded-xl border border-outline-variant/50 space-y-1 font-data-mono">
                <div className="flex justify-between">
                  <span className="text-outline">Ukuran Binary:</span>
                  <span className="text-on-surface font-semibold">{formatBytes(selectedFirmwareToDeploy.fileSize)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-outline">Checksum SHA-256:</span>
                  <span className="text-on-surface truncate max-w-[180px]">{selectedFirmwareToDeploy.checksum || '-'}</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-700 dark:text-blue-300">
                ESP akan mengunduh binary dari server dan me-reflash dirinya secara otomatis. Proses biasanya memakan waktu 10-30 detik.
              </div>
            </div>

            <div className="p-4 border-t border-outline-variant bg-surface-container-low flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelectedFirmwareToDeploy(null)}
                disabled={deployFirmwareMutation.isPending}
                className="px-4 py-2 border border-outline-variant rounded-xl text-xs font-semibold text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => deployFirmwareMutation.mutate(selectedFirmwareToDeploy.id)}
                disabled={deployFirmwareMutation.isPending}
                className="flex items-center gap-1.5 px-4 py-2 bg-primary text-on-primary hover:bg-primary/90 text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[16px]">
                  {deployFirmwareMutation.isPending ? 'sync' : 'system_update_alt'}
                </span>
                {deployFirmwareMutation.isPending ? 'Mengirim OTA Command...' : 'Ya, Pasang Firmware Sekarang'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Rollback Firmware Confirmation Dialog */}
      <ConfirmDialog
        isOpen={isRollbackConfirmOpen}
        title="Rollback ke Firmware Sebelumnya"
        message={
          previousFirmware
            ? `Kembalikan firmware perangkat "${device.name}" ke versi sebelumnya (v${previousFirmware.version} - ${previousFirmware.fileName})? ESP akan di-flash ulang melalui OTA.`
            : 'Apakah Anda yakin ingin melakukan rollback firmware?'
        }
        confirmLabel="Ya, Rollback Sekarang"
        isDestructive={false}
        isLoading={rollbackFirmwareMutation.isPending}
        onConfirm={() => rollbackFirmwareMutation.mutate()}
        onCancel={() => setIsRollbackConfirmOpen(false)}
      />

      {/* 5. Reset Auth / Unlink MAC Dialog */}
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

      {/* 6. Delete Device Dialog */}
      <ConfirmDialog
        isOpen={isDeleteConfirmOpen}
        title="Hapus Perangkat Permanen"
        message={`Apakah Anda yakin ingin menghapus perangkat "${device.name}" (${device.deviceUid}) secara permanen beserta seluruh riwayat firmware?`}
        confirmLabel="Ya, Hapus Perangkat"
        isDestructive={true}
        isLoading={deleteDeviceMutation.isPending}
        onConfirm={() => deleteDeviceMutation.mutate(device.id)}
        onCancel={() => setIsDeleteConfirmOpen(false)}
      />
    </div>
  );
};
