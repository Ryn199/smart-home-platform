import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { homesApi } from '../api/homes';
import { roomsApi } from '../api/rooms';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Room } from '../types';

export const RoomsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [selectedHomeId, setSelectedHomeId] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [roomToDelete, setRoomToDelete] = useState<Room | null>(null);
  const [name, setName] = useState('');
  const [targetHomeId, setTargetHomeId] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { data: homes = [] } = useQuery({
    queryKey: ['homes'],
    queryFn: homesApi.getAll,
  });

  const { data: rooms = [], isLoading } = useQuery({
    queryKey: ['rooms'],
    queryFn: roomsApi.getAll,
  });

  // Automatically sync targetHomeId with available homes
  useEffect(() => {
    if (homes.length > 0 && (!targetHomeId || !homes.some((h) => h.id === targetHomeId))) {
      setTargetHomeId(selectedHomeId ?? homes[0].id);
    }
  }, [homes, selectedHomeId, targetHomeId]);

  const filteredRooms = selectedHomeId
    ? rooms.filter((r) => r.homeId === selectedHomeId)
    : rooms;

  const createRoomMutation = useMutation({
    mutationFn: ({ homeId, name }: { homeId: number; name: string }) =>
      roomsApi.create({ homeId, name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['homes'] });
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      closeModal();
    },
    onError: (err: any) => {
      setErrorMessage(err?.message || 'Failed to create room');
    },
  });

  const updateRoomMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { name?: string; homeId?: number } }) =>
      roomsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['homes'] });
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      closeModal();
    },
    onError: (err: any) => {
      setErrorMessage(err?.message || 'Failed to update room');
    },
  });

  const deleteRoomMutation = useMutation({
    mutationFn: roomsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['homes'] });
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      setRoomToDelete(null);
    },
    onError: (err: any) => {
      setErrorMessage(`Delete failed: ${err?.message || 'Unknown error'}`);
      setRoomToDelete(null);
    },
  });

  const openCreateModal = () => {
    setEditingRoom(null);
    setName('');
    setErrorMessage(null);
    const initialHomeId = selectedHomeId ?? (homes.length > 0 ? homes[0].id : 0);
    setTargetHomeId(initialHomeId);
    setIsModalOpen(true);
  };

  const openEditModal = (room: Room) => {
    setEditingRoom(room);
    setName(room.name);
    setTargetHomeId(room.homeId);
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingRoom(null);
    setName('');
    setErrorMessage(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (!targetHomeId) {
      setErrorMessage('Please select a valid home.');
      return;
    }

    if (editingRoom) {
      updateRoomMutation.mutate({
        id: editingRoom.id,
        data: { name: name.trim(), homeId: targetHomeId },
      });
    } else {
      createRoomMutation.mutate({ homeId: targetHomeId, name: name.trim() });
    }
  };

  const handleConfirmDelete = () => {
    if (roomToDelete) {
      deleteRoomMutation.mutate(roomToDelete.id);
    }
  };

  return (
    <div className="space-y-lg">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="font-headline-lg text-headline-lg text-on-surface font-bold">
            Rooms
          </h2>
          <p className="text-sm text-on-surface-variant">
            Organize devices by room across all registered homes.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          disabled={homes.length === 0}
          className="flex items-center gap-xs px-4 py-2 bg-primary text-on-primary font-body-md rounded-lg hover:bg-primary/90 transition-colors shadow-sm cursor-pointer active:scale-98 disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-[20px]">add</span>
          Add Room
        </button>
      </div>

      {homes.length === 0 && (
        <div className="p-4 bg-primary-container/10 border border-primary/20 rounded-xl text-primary text-sm flex items-center gap-2">
          <span className="material-symbols-outlined">info</span>
          <span>Please create at least one Home in the Homes page before creating rooms.</span>
        </div>
      )}

      {/* Filter by Home Tabs */}
      {homes.length > 0 && (
        <div className="flex items-center gap-md overflow-x-auto pb-sm no-scrollbar border-b border-outline-variant/50">
          <span className="font-label-caps text-label-caps text-on-surface-variant whitespace-nowrap">
            Filter Home:
          </span>
          <button
            onClick={() => setSelectedHomeId(null)}
            className={`font-body-md text-body-md px-4 py-1.5 rounded-full whitespace-nowrap border transition-colors cursor-pointer ${
              selectedHomeId === null
                ? 'bg-primary text-on-primary border-primary'
                : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-highest border-outline-variant'
            }`}
          >
            All Homes
          </button>
          {homes.map((home) => (
            <button
              key={home.id}
              onClick={() => setSelectedHomeId(home.id)}
              className={`font-body-md text-body-md px-4 py-1.5 rounded-full whitespace-nowrap border transition-colors cursor-pointer ${
                selectedHomeId === home.id
                  ? 'bg-primary text-on-primary border-primary'
                  : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-highest border-outline-variant'
              }`}
            >
              {home.name}
            </button>
          ))}
        </div>
      )}

      {/* Rooms Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-md">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="bg-surface border border-outline-variant rounded-xl p-lg h-[180px] animate-pulse"
            />
          ))}
        </div>
      ) : filteredRooms.length === 0 ? (
        <div className="bg-surface border border-outline-variant rounded-xl p-xl text-center flex flex-col items-center justify-center gap-md">
          <span className="material-symbols-outlined text-outline text-5xl">
            grid_view
          </span>
          <p className="text-on-surface-variant font-medium">No rooms found.</p>
          {homes.length > 0 && (
            <button
              onClick={openCreateModal}
              className="px-4 py-2 bg-primary text-on-primary rounded-lg text-sm cursor-pointer"
            >
              Add Your First Room
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-md">
          {filteredRooms.map((room) => {
            const homeName = homes.find((h) => h.id === room.homeId)?.name || `Home #${room.homeId}`;
            return (
              <div
                key={room.id}
                className="bg-surface border border-outline-variant rounded-xl p-lg flex flex-col justify-between group hover:border-outline transition-colors shadow-sm shadow-black/5"
              >
                <div>
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-sm">
                      <span className="material-symbols-outlined text-primary text-2xl">
                        meeting_room
                      </span>
                      <h3 className="font-headline-md text-headline-md text-on-surface font-semibold">
                        {room.name}
                      </h3>
                    </div>
                    <span className="text-xs text-outline font-data-mono">
                      ID #{room.id}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-primary mt-2 uppercase tracking-wide">
                    {homeName}
                  </p>
                </div>

                <div className="mt-lg pt-md border-t border-outline-variant flex justify-between items-center">
                  <div className="flex items-center gap-xs font-label-caps text-label-caps text-on-surface-variant">
                    <span className="material-symbols-outlined text-[16px]">
                      devices
                    </span>
                    <span>{room.devices?.length || 0} Devices</span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditModal(room)}
                      className="text-on-surface-variant hover:text-primary hover:bg-surface-container-high p-1.5 rounded-lg transition-colors cursor-pointer"
                      title="Edit Room"
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        edit
                      </span>
                    </button>
                    <button
                      onClick={() => setRoomToDelete(room)}
                      className="text-error hover:bg-error-container/20 p-1.5 rounded-lg transition-colors cursor-pointer"
                      title="Delete Room"
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        delete
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Room Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-outline-variant rounded-xl p-lg max-w-md w-full shadow-lg space-y-md animate-in fade-in zoom-in-95 duration-150">
            <h3 className="font-headline-md text-headline-md text-on-surface font-semibold">
              {editingRoom ? 'Edit Room' : 'Create New Room'}
            </h3>

            {errorMessage && (
              <div className="p-2.5 bg-error-container/40 border border-error/20 rounded-lg text-error text-xs">
                {errorMessage}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-md">
              <div>
                <label className="block text-xs font-semibold text-on-surface-variant uppercase mb-1">
                  Assign Home *
                </label>
                <select
                  value={targetHomeId}
                  onChange={(e) => setTargetHomeId(parseInt(e.target.value, 10))}
                  className="w-full px-3 py-2 border border-outline-variant rounded-lg bg-surface text-on-surface focus:outline-none focus:border-primary text-sm"
                >
                  {homes.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name} (ID: #{h.id})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface-variant uppercase mb-1">
                  Room Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Living Room, Master Bedroom, Garage"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-outline-variant rounded-lg bg-surface text-on-surface focus:outline-none focus:border-primary text-sm"
                />
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
                  disabled={createRoomMutation.isPending || updateRoomMutation.isPending}
                  className="px-4 py-2 bg-primary text-on-primary rounded-lg text-sm hover:bg-primary/90 disabled:opacity-50 cursor-pointer"
                >
                  {createRoomMutation.isPending || updateRoomMutation.isPending
                    ? 'Saving...'
                    : editingRoom
                      ? 'Update Room'
                      : 'Save Room'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!roomToDelete}
        title="Delete Room"
        message={`Are you sure you want to delete room "${roomToDelete?.name}"? All devices inside this room will also be deleted.`}
        confirmLabel="Yes, Delete Room"
        isDestructive={true}
        isLoading={deleteRoomMutation.isPending}
        onConfirm={handleConfirmDelete}
        onCancel={() => setRoomToDelete(null)}
      />
    </div>
  );
};
