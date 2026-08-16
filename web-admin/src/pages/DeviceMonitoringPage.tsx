import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { devicesApi } from '../api/devices';
import { homesApi } from '../api/homes';
import { useWebSocket } from '../websocket/socket';
import { usePinnedDevices } from '../hooks/usePinnedDevices';
import { Device, DeviceType, TempHumidityState, SmartDoorState, SmartCurtainState, ExhaustFanState } from '../types';

export const DeviceMonitoringPage: React.FC = () => {
  const navigate = useNavigate();
  const { deviceStates } = useWebSocket();
  const { isPinned, togglePin, pinnedUids } = usePinnedDevices();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  // Fetch homes to extract rooms
  const { data: homes = [] } = useQuery({
    queryKey: ['homes'],
    queryFn: homesApi.getAll,
  });

  const allRooms = homes.flatMap((h) => (h.rooms || []).map((r) => ({ ...r, homeName: h.name })));

  // Fetch all devices
  const { data: devices = [], isLoading } = useQuery({
    queryKey: ['devices'],
    queryFn: () => devicesApi.getAll(),
  });

  // Filter devices
  const filteredDevices = devices.filter((device) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = device.name.toLowerCase().includes(q);
      const matchUid = device.deviceUid.toLowerCase().includes(q);
      if (!matchName && !matchUid) return false;
    }
    if (selectedRoomId !== null && device.roomId !== selectedRoomId) return false;
    if (selectedType !== 'ALL' && device.deviceType !== selectedType) return false;
    if (selectedStatus !== 'ALL' && device.status !== selectedStatus) return false;
    return true;
  });

  // Split into pinned and unpinned
  const pinnedDevices = filteredDevices.filter((d) => isPinned(d.deviceUid));
  const unpinnedDevices = filteredDevices.filter((d) => !isPinned(d.deviceUid));

  const handleDeviceClick = (device: Device) => {
    if (device.deviceType === 'TEMP_HUMIDITY') {
      navigate(`/monitoring/temp-humidity/${device.deviceUid}`);
    } else if (device.deviceType === 'EXHAUST_FAN') {
      navigate(`/monitoring/exhaust-fan/${device.deviceUid}`);
    } else {
      // Direct to specific monitoring or fallback
      navigate(`/monitoring/${device.deviceUid}`);
    }
  };

  const renderLiveStatusBadge = (status: string) => (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold ${
        status === 'ONLINE'
          ? 'text-[#059669] bg-[#ecfdf5]'
          : 'text-error bg-error-container/40'
      }`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          status === 'ONLINE' ? 'bg-[#10b981] animate-pulse' : 'bg-error'
        }`}
      />
      {status}
    </span>
  );

  const renderDeviceSummary = (device: Device) => {
    const rawState = (deviceStates[device.deviceUid] || device.metadata || {}) as Record<string, unknown>;

    switch (device.deviceType) {
      case 'TEMP_HUMIDITY': {
        const state = rawState as unknown as TempHumidityState;
        const temp = state.temperature !== undefined ? `${state.temperature}°C` : '--';
        const hum = state.humidity !== undefined ? `${state.humidity}%` : '--';
        return (
          <div className="grid grid-cols-2 gap-2 mt-3 bg-surface-container-low p-2.5 rounded-lg border border-outline-variant/50">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[18px]">thermostat</span>
              <div>
                <div className="text-[10px] text-outline font-bold uppercase">Temp</div>
                <div className="text-sm font-bold text-on-surface">{temp}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#0284c7] text-[18px]">humidity_mid</span>
              <div>
                <div className="text-[10px] text-outline font-bold uppercase">Humidity</div>
                <div className="text-sm font-bold text-on-surface">{hum}</div>
              </div>
            </div>
          </div>
        );
      }

      case 'SMART_DOOR': {
        const state = rawState as unknown as SmartDoorState;
        return (
          <div className="mt-3 bg-surface-container-low p-2.5 rounded-lg border border-outline-variant/50 flex justify-between items-center text-xs">
            <span className="text-on-surface-variant font-medium">
              Lock: <strong className="text-on-surface capitalize">{state.lock || 'Unknown'}</strong>
            </span>
            <span className="text-on-surface-variant font-medium">
              Door: <strong className="text-on-surface capitalize">{state.door || 'Unknown'}</strong>
            </span>
          </div>
        );
      }

      case 'SMART_CURTAIN': {
        const state = rawState as unknown as SmartCurtainState;
        return (
          <div className="mt-3 bg-surface-container-low p-2.5 rounded-lg border border-outline-variant/50 flex justify-between items-center text-xs">
            <span className="text-on-surface-variant font-medium">
              Position: <strong className="text-on-surface">{state.position !== undefined ? `${state.position}%` : '--'}</strong>
            </span>
            <span className="text-on-surface-variant font-medium">
              Status: <strong className="text-on-surface capitalize">{state.state || 'stopped'}</strong>
            </span>
          </div>
        );
      }

      case 'EXHAUST_FAN': {
        const state = rawState as unknown as ExhaustFanState;
        const isRunning = state.operationState === 'RUNNING';
        const hasError = !!state.errorCode && state.errorCode !== 'NONE';
        const desiredPower = state.desiredPower ?? false;
        const actualDir = state.direction ?? state.desiredDirection ?? '—';
        return (
          <div className="mt-3 bg-surface-container-low p-2.5 rounded-lg border border-outline-variant/50 space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <span className="text-on-surface-variant font-medium">
                Power:
                <strong className={desiredPower ? 'text-primary ml-1' : 'text-outline ml-1'}>
                  {desiredPower ? 'ON' : 'OFF'}
                </strong>
              </span>
              <span className="text-on-surface-variant font-medium">
                Dir: <strong className="text-on-surface">{actualDir}</strong>
              </span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className={`font-semibold ${
                hasError ? 'text-error' : isRunning ? 'text-primary' : 'text-outline'
              }`}>
                {hasError ? `⚠ ${state.errorCode}` : (state.operationState ?? 'IDLE').replace(/_/g, ' ')}
              </span>
              <span className="text-on-surface-variant">
                Duct: <strong className="text-on-surface">{state.ductPosition ?? 'UNKNOWN'}</strong>
              </span>
            </div>
          </div>
        );
      }

      default:
        return null;
    }
  };

  const renderCard = (device: Device, pinned: boolean) => {
    return (
      <div
        key={device.id}
        onClick={() => handleDeviceClick(device)}
        className="group relative bg-surface border border-outline-variant rounded-xl p-md flex flex-col justify-between hover:border-primary hover:shadow-md hover:shadow-primary/5 transition-all duration-150 cursor-pointer"
      >
        <div>
          {/* Header & Pin Action */}
          <div className="flex justify-between items-start gap-2">
            <div className="flex items-center gap-sm">
              <div className="p-2 rounded-xl bg-primary-container/20 text-primary">
                <span className="material-symbols-outlined text-2xl">
                  {device.deviceType === 'TEMP_HUMIDITY'
                    ? 'device_thermostat'
                    : device.deviceType === 'SMART_DOOR'
                      ? 'door_front'
                      : device.deviceType === 'SMART_CURTAIN'
                        ? 'roller_shades'
                        : 'mode_fan'}
                </span>
              </div>
              <div>
                <h4 className="font-headline-md text-headline-md text-on-surface font-semibold group-hover:text-primary transition-colors line-clamp-1">
                  {device.name}
                </h4>
                <span className="text-xs text-outline font-data-mono">{device.deviceUid}</span>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Pin Toggle Button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  togglePin(device.deviceUid);
                }}
                title={pinned ? 'Unpin device' : 'Pin device to top'}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  pinned
                    ? 'text-primary bg-primary-container/20 hover:bg-primary-container/40'
                    : 'text-outline hover:text-on-surface hover:bg-surface-container-high'
                }`}
              >
                <span
                  className="material-symbols-outlined text-[18px]"
                  style={{ fontVariationSettings: pinned ? "'FILL' 1" : "'FILL' 0" }}
                >
                  push_pin
                </span>
              </button>

              {renderLiveStatusBadge(device.status)}
            </div>
          </div>

          {/* Quick Metrics Summary */}
          {renderDeviceSummary(device)}
        </div>

        {/* Footer */}
        <div className="pt-sm mt-sm border-t border-outline-variant/60 flex justify-between items-center text-xs text-on-surface-variant">
          <span className="flex items-center gap-1">
            <span className="material-symbols-outlined text-[15px] text-outline">meeting_room</span>
            {device.room?.name || 'Assigned Room'}
          </span>
          <div className="flex items-center gap-1 text-primary font-semibold text-xs group-hover:translate-x-0.5 transition-transform">
            <span>Monitor</span>
            <span className="material-symbols-outlined text-[16px]">chevron_right</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-lg">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-md">
        <div>
          <h2 className="font-headline-lg text-headline-lg text-on-surface font-bold">
            Device Monitoring
          </h2>
          <p className="text-sm text-on-surface-variant">
            Live telemetry, status tracking, and pinning for instant access.
          </p>
        </div>

        {pinnedDevices.length > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary-container/15 text-primary text-xs font-bold border border-primary/20 w-fit">
            <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>
              push_pin
            </span>
            <span>{pinnedDevices.length} Pinned Device{pinnedDevices.length > 1 ? 's' : ''}</span>
          </div>
        )}
      </div>

      {/* Filter Toolbar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-md p-md bg-surface border border-outline-variant rounded-xl shadow-sm">
        {/* Search */}
        <div className="relative">
          <span className="material-symbols-outlined absolute left-3 top-2.5 text-outline text-[18px]">
            search
          </span>
          <input
            type="text"
            placeholder="Search by name or UID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 border border-outline-variant rounded-lg bg-surface text-sm focus:outline-none focus:border-primary"
          />
        </div>

        {/* Room Filter */}
        <div>
          <select
            value={selectedRoomId === null ? '' : selectedRoomId}
            onChange={(e) => setSelectedRoomId(e.target.value === '' ? null : parseInt(e.target.value, 10))}
            className="w-full px-3 py-1.5 border border-outline-variant rounded-lg bg-surface text-sm focus:outline-none focus:border-primary"
          >
            <option value="">All Rooms</option>
            {allRooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} ({r.homeName})
              </option>
            ))}
          </select>
        </div>

        {/* Device Type Filter */}
        <div>
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="w-full px-3 py-1.5 border border-outline-variant rounded-lg bg-surface text-sm focus:outline-none focus:border-primary"
          >
            <option value="ALL">All Types</option>
            <option value="TEMP_HUMIDITY">Temperature & Humidity</option>
            <option value="SMART_DOOR">Smart Door</option>
            <option value="SMART_CURTAIN">Smart Curtain</option>
            <option value="EXHAUST_FAN">Smart Exhaust Fan</option>
          </select>
        </div>

        {/* Status Filter */}
        <div>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="w-full px-3 py-1.5 border border-outline-variant rounded-lg bg-surface text-sm focus:outline-none focus:border-primary"
          >
            <option value="ALL">All Statuses</option>
            <option value="ONLINE">Online</option>
            <option value="OFFLINE">Offline</option>
            <option value="UNKNOWN">Unknown</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="p-xl text-center text-outline">Loading devices for monitoring...</div>
      ) : filteredDevices.length === 0 ? (
        <div className="p-xl text-center bg-surface border border-outline-variant rounded-xl text-outline text-sm">
          No devices match your search and filter criteria.
        </div>
      ) : (
        <div className="space-y-xl">
          {/* 1. Pinned Section */}
          {pinnedDevices.length > 0 && (
            <section className="space-y-md">
              <div className="flex items-center gap-2 pb-1 border-b border-primary/20">
                <span
                  className="material-symbols-outlined text-primary text-[20px]"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  push_pin
                </span>
                <h3 className="font-headline-md text-headline-md text-primary font-bold">
                  Pinned Devices ({pinnedDevices.length})
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-md">
                {pinnedDevices.map((device) => renderCard(device, true))}
              </div>
            </section>
          )}

          {/* 2. All / Other Devices Section */}
          <section className="space-y-md">
            <div className="flex items-center gap-2 pb-1 border-b border-outline-variant">
              <span className="material-symbols-outlined text-outline text-[20px]">
                devices
              </span>
              <h3 className="font-headline-md text-headline-md text-on-surface font-bold">
                {pinnedDevices.length > 0 ? `Other Devices (${unpinnedDevices.length})` : `All Devices (${filteredDevices.length})`}
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-md">
              {unpinnedDevices.map((device) => renderCard(device, false))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
};
