import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { homesApi } from '../api/homes';
import { devicesApi } from '../api/devices';
import { useWebSocket } from '../websocket/socket';
import { DeviceCardRenderer } from '../device-types/DeviceCardRenderer';
import { Device } from '../types';

export const OverviewPage: React.FC = () => {
  const { activities } = useWebSocket();
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);

  // 1. Fetch homes with rooms
  const { data: homes = [] } = useQuery({
    queryKey: ['homes'],
    queryFn: homesApi.getAll,
  });

  // 2. Fetch all devices
  const { data: devices = [], isLoading: isLoadingDevices } = useQuery({
    queryKey: ['devices'],
    queryFn: () => devicesApi.getAll(),
  });

  // Extract all rooms across homes
  const allRooms = homes.flatMap((h) => (h.rooms || []).map((r) => ({ ...r, homeName: h.name })));

  // Filter devices by selected room
  const filteredDevices = selectedRoomId
    ? devices.filter((d) => d.roomId === selectedRoomId)
    : devices;

  // Stats calculation
  const totalHomes = homes.length || 1;
  const totalRooms = allRooms.length || 1;
  const totalDevices = devices.length;
  const onlineDevices = devices.filter((d) => d.status === 'ONLINE').length;

  return (
    <div className="space-y-lg">
      {/* 1. Summary Stats */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-md">
        {/* Homes */}
        <div className="bg-surface border border-outline-variant rounded-xl p-md flex flex-col gap-sm shadow-sm shadow-black/5">
          <div className="flex justify-between items-start text-on-surface-variant">
            <span className="font-label-caps text-label-caps">Homes</span>
            <span className="material-symbols-outlined text-outline">home</span>
          </div>
          <div className="font-display-stat text-display-stat text-on-surface">
            {totalHomes}
          </div>
        </div>

        {/* Rooms */}
        <div className="bg-surface border border-outline-variant rounded-xl p-md flex flex-col gap-sm shadow-sm shadow-black/5">
          <div className="flex justify-between items-start text-on-surface-variant">
            <span className="font-label-caps text-label-caps">Rooms</span>
            <span className="material-symbols-outlined text-outline">grid_view</span>
          </div>
          <div className="font-display-stat text-display-stat text-on-surface">
            {totalRooms}
          </div>
        </div>

        {/* Devices */}
        <div className="bg-surface border border-outline-variant rounded-xl p-md flex flex-col gap-sm shadow-sm shadow-black/5">
          <div className="flex justify-between items-start text-on-surface-variant">
            <span className="font-label-caps text-label-caps">Devices</span>
            <span className="material-symbols-outlined text-outline">devices</span>
          </div>
          <div className="font-display-stat text-display-stat text-on-surface">
            {totalDevices}
          </div>
        </div>

        {/* Online Status */}
        <div className="bg-surface border border-outline-variant rounded-xl p-md flex flex-col gap-sm shadow-sm shadow-black/5">
          <div className="flex justify-between items-start text-on-surface-variant">
            <span className="font-label-caps text-label-caps">Online</span>
            <div
              className={`flex items-center gap-xs text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                onlineDevices > 0
                  ? 'text-[#059669] bg-[#ecfdf5]'
                  : 'text-outline bg-surface-container-highest'
              }`}
            >
              {onlineDevices > 0 && (
                <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] animate-pulse" />
              )}
              {onlineDevices > 0 ? 'Healthy' : 'No Devices Online'}
            </div>
          </div>
          <div className="font-display-stat text-display-stat text-on-surface">
            {onlineDevices}
            <span className="text-headline-lg text-on-surface-variant">
              /{totalDevices}
            </span>
          </div>
        </div>
      </section>

      {/* Main Grid: Device Controls & Activity Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-lg">
        {/* Left Column (Room Selector & Device Cards) */}
        <div className="lg:col-span-8 xl:col-span-9 space-y-lg">
          {/* 2. Room Selector */}
          <section className="flex items-center gap-md overflow-x-auto pb-sm no-scrollbar border-b border-outline-variant/50">
            <span className="font-label-caps text-label-caps text-on-surface-variant whitespace-nowrap">
              Rooms:
            </span>
            <button
              onClick={() => setSelectedRoomId(null)}
              className={`font-body-md text-body-md px-4 py-1.5 rounded-full whitespace-nowrap border transition-colors cursor-pointer ${
                selectedRoomId === null
                  ? 'bg-primary text-on-primary border-primary'
                  : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-highest border-outline-variant'
              }`}
            >
              All Rooms
            </button>
            {allRooms.map((room) => (
              <button
                key={room.id}
                onClick={() => setSelectedRoomId(room.id)}
                className={`font-body-md text-body-md px-4 py-1.5 rounded-full whitespace-nowrap border transition-colors cursor-pointer ${
                  selectedRoomId === room.id
                    ? 'bg-primary text-on-primary border-primary'
                    : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-highest border-outline-variant'
                }`}
              >
                {room.name}
              </button>
            ))}
          </section>

          {/* 3. Device Grid */}
          {isLoadingDevices ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
              {[1, 2, 3, 4].map((n) => (
                <div
                  key={n}
                  className="bg-surface border border-outline-variant rounded-xl p-md h-[160px] animate-pulse"
                />
              ))}
            </div>
          ) : filteredDevices.length === 0 ? (
            <div className="bg-surface border border-outline-variant rounded-xl p-xl text-center flex flex-col items-center justify-center gap-md min-h-[220px]">
              <span className="material-symbols-outlined text-outline text-4xl">
                devices
              </span>
              <p className="text-on-surface-variant font-medium">
                No devices found in this view.
              </p>
            </div>
          ) : (
            <section className="grid grid-cols-1 md:grid-cols-2 gap-md">
              {filteredDevices.map((device: Device) => (
                <DeviceCardRenderer key={device.id} device={device} />
              ))}
            </section>
          )}
        </div>

        {/* Right Column (Recent Live Activity Stream) */}
        <div className="lg:col-span-4 xl:col-span-3">
          <div className="bg-surface border border-outline-variant rounded-xl flex flex-col h-full min-h-[360px] overflow-hidden shadow-sm shadow-black/5">
            <div className="p-md border-b border-outline-variant flex items-center justify-between bg-surface-bright">
              <h2 className="font-headline-md text-headline-md text-on-surface">
                Recent Activity
              </h2>
              <span className="material-symbols-outlined text-outline-variant text-[20px]">
                history
              </span>
            </div>
            <div className="p-md flex-1 overflow-y-auto max-h-[500px]">
              <ul className="space-y-4 relative before:absolute before:inset-y-0 before:left-[11px] before:w-px before:bg-outline-variant/50 ml-1">
                {activities.map((act) => (
                  <li key={act.id} className="relative pl-6">
                    <div className="absolute left-[-5px] top-1 w-2 h-2 rounded-full bg-primary border-2 border-surface" />
                    <p className="font-body-md text-body-md text-on-surface">
                      {act.message}
                    </p>
                    <span className="font-label-caps text-label-caps text-outline-variant">
                      {act.time}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
