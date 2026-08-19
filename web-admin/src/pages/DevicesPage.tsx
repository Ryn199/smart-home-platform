import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { devicesApi } from '../api/devices';
import { homesApi } from '../api/homes';
import { Device, DeviceType } from '../types';

export const DevicesPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [deviceUid, setDeviceUid] = useState('');
  const [macAddress, setMacAddress] = useState('');
  const [pairingCode, setPairingCode] = useState('');
  const [deviceType, setDeviceType] = useState<DeviceType | ''>('');
  const [roomId, setRoomId] = useState<number>(0);

  // Fetch homes to extract rooms
  const { data: homes = [] } = useQuery({
    queryKey: ['homes'],
    queryFn: homesApi.getAll,
  });

  const allRooms = homes.flatMap((h) => (h.rooms || []).map((r) => ({ ...r, homeName: h.name })));

  // Fetch devices
  const { data: devices = [], isLoading } = useQuery({
    queryKey: ['devices'],
    queryFn: () => devicesApi.getAll(),
  });

  const registerMutation = useMutation({
    mutationFn: devicesApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      closeModal();
      setSuccessMessage('Device registered successfully!');
      setTimeout(() => setSuccessMessage(null), 5000);
    },
    onError: (err: any) => {
      setErrorMessage(err?.message || 'Failed to register device');
    },
  });

  const openCreateModal = () => {
    setName('');
    setDeviceUid('');
    setPairingCode('');
    setDeviceType('');
    setRoomId(0);
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setName('');
    setDeviceUid('');
    setPairingCode('');
    setDeviceType('');
    setRoomId(0);
    setErrorMessage(null);
  };

  const filteredDevices = devices.filter((d) => {
    if (selectedType !== 'ALL' && d.deviceType !== selectedType) return false;
    if (selectedStatus !== 'ALL' && d.status !== selectedStatus) return false;
    return true;
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMessage('Nama perangkat wajib diisi');
      return;
    }
    if (!deviceUid.trim()) {
      setErrorMessage('UID perangkat wajib diisi');
      return;
    }
    if (!deviceType) {
      setErrorMessage('Silakan pilih tipe perangkat');
      return;
    }
    if (!roomId || roomId === 0) {
      setErrorMessage('Silakan pilih ruangan');
      return;
    }

    registerMutation.mutate({
      name: name.trim(),
      deviceUid: deviceUid.trim(),
      macAddress: macAddress.trim() || undefined,
      pairingCode: pairingCode.trim() || undefined,
      deviceType: deviceType as DeviceType,
      roomId,
    });
  };

  return (
    <div className="space-y-lg">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="font-headline-lg text-headline-lg text-on-surface font-bold">
            Devices Inventory
          </h2>
          <p className="text-sm text-on-surface-variant">
            Register and manage ESP IoT nodes. Devices authenticate using Pairing Codes with automatic hardware MAC binding.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          disabled={allRooms.length === 0}
          className="flex items-center gap-xs px-4 py-2 bg-primary text-on-primary font-body-md rounded-lg hover:bg-primary/90 transition-colors shadow-sm cursor-pointer active:scale-98 disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-[20px]">add</span>
          Register Device
        </button>
      </div>

      {/* Global Success Banner */}
      {successMessage && (
        <div className="p-3 bg-[#ecfdf5] border border-[#10b981]/30 rounded-xl text-[#059669] text-sm flex items-center justify-between shadow-sm animate-in fade-in">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-lg">check_circle</span>
            <span className="font-semibold">{successMessage}</span>
          </div>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-[#059669] hover:opacity-75 cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>
      )}

      {/* Global Error Banner */}
      {errorMessage && (
        <div className="p-3 bg-error-container/30 border border-error/20 rounded-xl text-error text-sm flex items-center justify-between shadow-sm animate-in fade-in">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-lg">error</span>
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-error hover:opacity-75 cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>
      )}

      {allRooms.length === 0 && (
        <div className="p-4 bg-primary-container/10 border border-primary/20 rounded-xl text-primary text-sm flex items-center gap-2">
          <span className="material-symbols-outlined">info</span>
          <span>Please create at least one Home &amp; Room before registering devices.</span>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center gap-md p-md bg-surface border border-outline-variant rounded-xl shadow-sm">
        <div className="flex items-center gap-sm">
          <span className="text-xs font-semibold text-on-surface-variant uppercase">
            Type:
          </span>
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="px-3 py-1.5 border border-outline-variant rounded-lg bg-surface text-sm focus:outline-none"
          >
            <option value="ALL">All Device Types</option>
            <option value="TEMP_HUMIDITY">Temperature &amp; Humidity Node</option>
            <option value="SMART_DOOR">Smart Door</option>
            <option value="SMART_CURTAIN">Smart Curtain</option>
            <option value="EXHAUST_FAN">Smart Exhaust Fan</option>
          </select>
        </div>

        <div className="flex items-center gap-sm">
          <span className="text-xs font-semibold text-on-surface-variant uppercase">
            Status:
          </span>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-1.5 border border-outline-variant rounded-lg bg-surface text-sm focus:outline-none"
          >
            <option value="ALL">All Statuses</option>
            <option value="ONLINE">Online</option>
            <option value="OFFLINE">Offline</option>
            <option value="UNKNOWN">Unknown</option>
          </select>
        </div>
      </div>

      {/* Table of Devices */}
      <div className="bg-surface border border-outline-variant rounded-xl overflow-hidden shadow-sm shadow-black/5">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-container-low border-b border-outline-variant text-on-surface-variant font-label-caps text-label-caps uppercase">
              <tr>
                <th className="px-lg py-md">Device Name &amp; UID</th>
                <th className="px-lg py-md">Pairing Code</th>
                <th className="px-lg py-md">Hardware MAC Binding</th>
                <th className="px-lg py-md">Type</th>
                <th className="px-lg py-md">Room</th>
                <th className="px-lg py-md">Presence</th>
                <th className="px-lg py-md text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/60">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-lg py-xl text-center text-outline">
                    Loading devices...
                  </td>
                </tr>
              ) : filteredDevices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-lg py-xl text-center text-outline">
                    No devices match the selected filters.
                  </td>
                </tr>
              ) : (
                filteredDevices.map((device: Device) => (
                  <tr key={device.id} className="hover:bg-surface-container-low/50">
                    <td className="px-lg py-md">
                      <div className="font-semibold text-on-surface">{device.name}</div>
                      <div className="font-data-mono text-xs text-outline">{device.deviceUid}</div>
                    </td>

                    {/* Pairing Code */}
                    <td className="px-lg py-md">
                      {device.pairingCode ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-data-mono font-bold bg-primary-container/20 text-primary border border-primary/20">
                          <span className="material-symbols-outlined text-[14px]">key</span>
                          {device.pairingCode}
                        </span>
                      ) : (
                        <span className="text-outline text-xs italic">None</span>
                      )}
                    </td>

                    {/* Hardware MAC Binding Status */}
                    <td className="px-lg py-md">
                      {device.macAddress ? (
                        <div className="flex items-center gap-1.5">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-data-mono font-semibold bg-[#ecfdf5] text-[#059669] border border-[#10b981]/20">
                            <span className="material-symbols-outlined text-[14px]">verified</span>
                            {device.macAddress}
                          </span>
                        </div>
                      ) : device.pairingCode ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                          <span className="material-symbols-outlined text-[14px] animate-pulse">
                            sensors
                          </span>
                          Waiting for ESP connection...
                        </span>
                      ) : (
                        <span className="text-outline text-xs italic">Unpaired</span>
                      )}
                    </td>

                    <td className="px-lg py-md">
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-surface-container-highest text-on-surface-variant font-data-mono">
                        {device.deviceType}
                      </span>
                    </td>

                    <td className="px-lg py-md text-on-surface-variant">
                      {device.room?.name || `Room #${device.roomId}`}
                    </td>

                    <td className="px-lg py-md">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          device.status === 'ONLINE'
                            ? 'text-[#059669] bg-[#ecfdf5]'
                            : 'text-error bg-error-container/40'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            device.status === 'ONLINE'
                              ? 'bg-[#10b981] animate-pulse'
                              : 'bg-error'
                          }`}
                        />
                        {device.status}
                      </span>
                    </td>

                    {/* Action Column: Single Unified Setting Button */}
                    <td className="px-lg py-md text-right">
                      <button
                        onClick={() => navigate(`/devices/${device.id}`)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary hover:text-on-primary rounded-lg text-xs font-bold border border-primary/20 transition-all cursor-pointer shadow-xs active:scale-95"
                        title="Buka Halaman Pengaturan, Diagnostik &amp; Firmware"
                      >
                        <span className="material-symbols-outlined text-[16px]">settings</span>
                        Setting &amp; OTA
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Register New Device Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-outline-variant rounded-xl p-lg max-w-md w-full shadow-lg space-y-md animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <h3 className="font-headline-md text-headline-md text-on-surface font-semibold">
              Register New Device
            </h3>

            {errorMessage && (
              <div className="p-2.5 bg-error-container/40 border border-error/20 rounded-lg text-error text-xs">
                {errorMessage}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-md">
              <div>
                <label className="block text-xs font-semibold text-on-surface-variant uppercase mb-1">
                  Device Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Nama perangkat (e.g. DHT22 Ruang Tamu)"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-outline-variant rounded-lg bg-surface text-on-surface focus:outline-none focus:border-primary text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface-variant uppercase mb-1">
                  Device Unique Identifier (UID) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="UID unik perangkat (e.g. th-001)"
                  value={deviceUid}
                  onChange={(e) => setDeviceUid(e.target.value)}
                  className="w-full px-3 py-2 border border-outline-variant rounded-lg bg-surface text-on-surface focus:outline-none focus:border-primary text-sm font-data-mono"
                />
              </div>

              {/* Hardware Security: Pairing Code */}
              <div className="p-md bg-surface-container-low rounded-xl border border-outline-variant/60 space-y-sm">
                <div className="flex items-center gap-1.5 text-xs font-bold text-primary uppercase">
                  <span className="material-symbols-outlined text-[16px]">lock</span>
                  <span>ESP Authentication &amp; Pairing</span>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-on-surface-variant uppercase mb-1">
                    Pairing Code *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Pairing code (e.g. TH-7788)"
                    value={pairingCode}
                    onChange={(e) => setPairingCode(e.target.value)}
                    className="w-full px-3 py-1.5 border border-outline-variant rounded-lg bg-surface text-on-surface focus:outline-none focus:border-primary text-xs font-data-mono font-bold"
                  />
                  <span className="text-[10px] text-outline block mt-1 leading-relaxed">
                    Hardcode kode ini pada firmware ESP Anda. Saat ESP pertama kali terhubung, MAC address ESP akan otomatis terikat.
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface-variant uppercase mb-1">
                  Device Type *
                </label>
                <select
                  value={deviceType}
                  onChange={(e) => setDeviceType(e.target.value as DeviceType)}
                  className="w-full px-3 py-2 border border-outline-variant rounded-lg bg-surface text-on-surface focus:outline-none focus:border-primary text-sm"
                >
                  <option value="" disabled>
                    Pilih tipe perangkat
                  </option>
                  <option value="TEMP_HUMIDITY">TEMP_HUMIDITY (Temperature &amp; Humidity)</option>
                  <option value="SMART_DOOR">SMART_DOOR (Lock/Unlock)</option>
                  <option value="SMART_CURTAIN">SMART_CURTAIN (Motor Position)</option>
                  <option value="EXHAUST_FAN">EXHAUST_FAN (Speed &amp; Power)</option>
                </select>
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
                      {r.name} ({r.homeName})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-sm pt-sm">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 border border-outline-variant rounded-lg text-sm hover:bg-surface-container-low cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={registerMutation.isPending}
                  className="px-4 py-2 bg-primary text-on-primary rounded-lg text-sm hover:bg-primary/90 disabled:opacity-50 cursor-pointer"
                >
                  {registerMutation.isPending ? 'Registering...' : 'Register Device'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
