import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { devicesApi } from '../api/devices';
import { homesApi } from '../api/homes';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Device, DeviceCommand, DeviceType } from '../types';

export const DevicesPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [deviceToDelete, setDeviceToDelete] = useState<Device | null>(null);
  const [deviceToResetAuth, setDeviceToResetAuth] = useState<Device | null>(null);
  const [historyDeviceId, setHistoryDeviceId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [deviceUid, setDeviceUid] = useState('');
  const [macAddress, setMacAddress] = useState('');
  const [pairingCode, setPairingCode] = useState('');
  const [deviceType, setDeviceType] = useState<DeviceType>('TEMP_HUMIDITY');
  const [roomId, setRoomId] = useState<number>(1);

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

  // Fetch command history if selected
  const { data: commandHistory = [] } = useQuery({
    queryKey: ['deviceCommands', historyDeviceId],
    queryFn: () => (historyDeviceId ? devicesApi.getCommands(historyDeviceId) : []),
    enabled: !!historyDeviceId,
  });

  const registerMutation = useMutation({
    mutationFn: devicesApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      closeModal();
      setSuccessMessage('Device registered successfully! Flash the pairing code to your ESP.');
      setTimeout(() => setSuccessMessage(null), 5000);
    },
    onError: (err: any) => {
      setErrorMessage(err?.message || 'Failed to register device');
    },
  });

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
      closeModal();
      setSuccessMessage('Device updated successfully!');
      setTimeout(() => setSuccessMessage(null), 5000);
    },
    onError: (err: any) => {
      setErrorMessage(err?.message || 'Failed to update device');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: devicesApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      setDeviceToDelete(null);
      setSuccessMessage('Device deleted successfully.');
      setTimeout(() => setSuccessMessage(null), 5000);
    },
    onError: (err: any) => {
      setErrorMessage(`Delete failed: ${err?.message || 'Unknown error'}`);
      setDeviceToDelete(null);
    },
  });

  const resetAuthMutation = useMutation({
    mutationFn: (id: number) => devicesApi.resetAuth(id),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      setDeviceToResetAuth(null);
      setSuccessMessage(res.message || 'Device authentication reset. You can now pair a new ESP board.');
      setTimeout(() => setSuccessMessage(null), 6000);
    },
    onError: (err: any) => {
      setErrorMessage(`Reset auth failed: ${err?.message || 'Unknown error'}`);
      setDeviceToResetAuth(null);
    },
  });

  const openCreateModal = () => {
    setEditingDevice(null);
    setName('');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    setDeviceUid(`th-${randomSuffix}`);
    setMacAddress('');
    setPairingCode(`TH-${randomSuffix}`);
    setDeviceType('TEMP_HUMIDITY');
    if (allRooms.length > 0) setRoomId(allRooms[0].id);
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const openEditModal = (device: Device) => {
    setEditingDevice(device);
    setName(device.name);
    setDeviceUid(device.deviceUid);
    setMacAddress(device.macAddress || '');
    setPairingCode(device.pairingCode || '');
    setDeviceType(device.deviceType);
    setRoomId(device.roomId);
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingDevice(null);
    setName('');
    setDeviceUid('');
    setMacAddress('');
    setPairingCode('');
    setErrorMessage(null);
  };

  const filteredDevices = devices.filter((d) => {
    if (selectedType !== 'ALL' && d.deviceType !== selectedType) return false;
    if (selectedStatus !== 'ALL' && d.status !== selectedStatus) return false;
    return true;
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (editingDevice) {
      updateMutation.mutate({
        id: editingDevice.id,
        data: {
          name: name.trim(),
          roomId,
          macAddress: macAddress.trim() || undefined,
          pairingCode: pairingCode.trim() || undefined,
        },
      });
    } else {
      if (!deviceUid.trim()) return;
      registerMutation.mutate({
        name: name.trim(),
        deviceUid: deviceUid.trim(),
        macAddress: macAddress.trim() || undefined,
        pairingCode: pairingCode.trim() || undefined,
        deviceType,
        roomId,
      });
    }
  };

  const handleConfirmDelete = () => {
    if (deviceToDelete) {
      deleteMutation.mutate(deviceToDelete.id);
    }
  };

  const handleConfirmResetAuth = () => {
    if (deviceToResetAuth) {
      resetAuthMutation.mutate(deviceToResetAuth.id);
    }
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

                    <td className="px-lg py-md text-right space-x-1">
                      <button
                        onClick={() => setHistoryDeviceId(device.id)}
                        className="text-primary hover:underline font-semibold text-xs px-2 py-1 cursor-pointer"
                      >
                        History
                      </button>

                      {/* Reset Auth Button (Visible if MAC is bound) */}
                      {device.macAddress && (
                        <button
                          onClick={() => setDeviceToResetAuth(device)}
                          className="text-amber-600 hover:bg-amber-50 p-1 rounded transition-colors cursor-pointer"
                          title="Reset Auth / Unbind MAC (Allow new ESP board to connect)"
                        >
                          <span className="material-symbols-outlined text-[18px]">
                            link_off
                          </span>
                        </button>
                      )}

                      <button
                        onClick={() => openEditModal(device)}
                        className="text-on-surface-variant hover:text-primary hover:bg-surface-container-high p-1 rounded transition-colors cursor-pointer"
                        title="Edit Device"
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          edit
                        </span>
                      </button>
                      <button
                        onClick={() => setDeviceToDelete(device)}
                        className="text-error hover:bg-error-container/20 p-1 rounded transition-colors cursor-pointer"
                        title="Delete Device"
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          delete
                        </span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Register / Edit Device Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-outline-variant rounded-xl p-lg max-w-md w-full shadow-lg space-y-md animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <h3 className="font-headline-md text-headline-md text-on-surface font-semibold">
              {editingDevice ? 'Edit Device' : 'Register New Device'}
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
                  placeholder="e.g. Living Room DHT22, Front Door Lock, Kitchen Fan"
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
                  disabled={!!editingDevice}
                  placeholder="e.g. th-001, door-001, fan-001, curtain-001"
                  value={deviceUid}
                  onChange={(e) => setDeviceUid(e.target.value)}
                  className="w-full px-3 py-2 border border-outline-variant rounded-lg bg-surface text-on-surface focus:outline-none focus:border-primary text-sm font-data-mono disabled:opacity-50 disabled:bg-surface-container-low"
                />
              </div>

              {/* Hardware Security: Pairing Code (Primary) */}
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
                    placeholder="e.g. TH-7788, SENSOR-01"
                    value={pairingCode}
                    onChange={(e) => setPairingCode(e.target.value)}
                    className="w-full px-3 py-1.5 border border-outline-variant rounded-lg bg-surface text-on-surface focus:outline-none focus:border-primary text-xs font-data-mono font-bold"
                  />
                  <span className="text-[10px] text-outline block mt-1 leading-relaxed">
                    Hardcode this code into your ESP firmware (<code className="text-primary font-bold">#define PAIRING_CODE &quot;{pairingCode || 'YOUR_CODE'}&quot;</code>). On first connection, the backend will automatically bind the hardware MAC address of the ESP to this device.
                  </span>
                </div>

                {editingDevice && (
                  <div>
                    <label className="block text-[11px] font-semibold text-on-surface-variant uppercase mb-1">
                      Bound MAC Address
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        disabled
                        value={macAddress || 'Not yet bound (Waiting for ESP)'}
                        className="w-full px-3 py-1.5 border border-outline-variant rounded-lg bg-surface-container-highest text-on-surface-variant text-xs font-data-mono disabled:opacity-75"
                      />
                      {macAddress && (
                        <button
                          type="button"
                          onClick={() => setMacAddress('')}
                          className="px-2.5 py-1.5 text-xs border border-error/40 text-error hover:bg-error-container/20 rounded-lg cursor-pointer whitespace-nowrap"
                        >
                          Clear MAC
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface-variant uppercase mb-1">
                  Device Type
                </label>
                <select
                  disabled={!!editingDevice}
                  value={deviceType}
                  onChange={(e) => setDeviceType(e.target.value as DeviceType)}
                  className="w-full px-3 py-2 border border-outline-variant rounded-lg bg-surface text-on-surface focus:outline-none focus:border-primary text-sm disabled:opacity-50 disabled:bg-surface-container-low"
                >
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
                  disabled={registerMutation.isPending || updateMutation.isPending}
                  className="px-4 py-2 bg-primary text-on-primary rounded-lg text-sm hover:bg-primary/90 disabled:opacity-50 cursor-pointer"
                >
                  {registerMutation.isPending || updateMutation.isPending
                    ? 'Saving...'
                    : editingDevice
                      ? 'Update Device'
                      : 'Register'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Command History Modal */}
      {historyDeviceId && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-outline-variant rounded-xl p-lg max-w-lg w-full shadow-lg space-y-md max-h-[80vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center border-b border-outline-variant pb-sm">
              <h3 className="font-headline-md text-headline-md text-on-surface font-semibold">
                Command Execution History
              </h3>
              <button
                onClick={() => setHistoryDeviceId(null)}
                className="text-outline hover:text-on-surface cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-sm">
              {commandHistory.length === 0 ? (
                <p className="text-center py-lg text-outline text-sm">
                  No commands recorded for this device yet.
                </p>
              ) : (
                commandHistory.map((cmd: DeviceCommand) => (
                  <div
                    key={cmd.id}
                    className="p-md bg-surface-container-low rounded-lg border border-outline-variant flex justify-between items-center text-sm"
                  >
                    <div>
                      <span className="font-bold text-on-surface uppercase font-data-mono">
                        {cmd.command}
                      </span>
                      <p className="text-xs text-outline">
                        {new Date(cmd.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <span className="px-2 py-0.5 rounded text-xs font-bold bg-primary-fixed-dim/40 text-primary">
                      {cmd.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Reset Auth Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!deviceToResetAuth}
        title="Reset Hardware Authentication"
        message={`Are you sure you want to unbind MAC address "${deviceToResetAuth?.macAddress}" from device "${deviceToResetAuth?.name}"? Once reset, a new ESP board with pairing code "${deviceToResetAuth?.pairingCode}" can bind to this device.`}
        confirmLabel="Yes, Reset Auth"
        isDestructive={false}
        isLoading={resetAuthMutation.isPending}
        onConfirm={handleConfirmResetAuth}
        onCancel={() => setDeviceToResetAuth(null)}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!deviceToDelete}
        title="Delete Device"
        message={`Are you sure you want to delete device "${deviceToDelete?.name}" (${deviceToDelete?.deviceUid})?`}
        confirmLabel="Yes, Delete Device"
        isDestructive={true}
        isLoading={deleteMutation.isPending}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeviceToDelete(null)}
      />
    </div>
  );
};
