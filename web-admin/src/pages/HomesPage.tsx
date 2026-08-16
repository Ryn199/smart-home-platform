import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { homesApi } from '../api/homes';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Home } from '../types';

export const HomesPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingHome, setEditingHome] = useState<Home | null>(null);
  const [homeToDelete, setHomeToDelete] = useState<Home | null>(null);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { data: homes = [], isLoading } = useQuery({
    queryKey: ['homes'],
    queryFn: homesApi.getAll,
  });

  const createMutation = useMutation({
    mutationFn: homesApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['homes'] });
      closeModal();
    },
    onError: (err: any) => {
      setErrorMessage(err?.message || 'Failed to create home');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { name?: string; address?: string } }) =>
      homesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['homes'] });
      closeModal();
    },
    onError: (err: any) => {
      setErrorMessage(err?.message || 'Failed to update home');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: homesApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['homes'] });
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      setHomeToDelete(null);
    },
    onError: (err: any) => {
      setErrorMessage(`Delete failed: ${err?.message || 'Unknown error'}`);
      setHomeToDelete(null);
    },
  });

  const openCreateModal = () => {
    setEditingHome(null);
    setName('');
    setAddress('');
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const openEditModal = (home: Home) => {
    setEditingHome(home);
    setName(home.name);
    setAddress(home.address || '');
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingHome(null);
    setName('');
    setAddress('');
    setErrorMessage(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (editingHome) {
      updateMutation.mutate({
        id: editingHome.id,
        data: { name: name.trim(), address: address.trim() || undefined },
      });
    } else {
      createMutation.mutate({
        name: name.trim(),
        address: address.trim() || undefined,
      });
    }
  };

  const handleConfirmDelete = () => {
    if (homeToDelete) {
      deleteMutation.mutate(homeToDelete.id);
    }
  };

  return (
    <div className="space-y-lg">
      {/* Action Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="font-headline-lg text-headline-lg text-on-surface font-bold">
            Homes
          </h2>
          <p className="text-sm text-on-surface-variant">
            Manage registered smart homes and residential properties.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-xs px-4 py-2 bg-primary text-on-primary font-body-md rounded-lg hover:bg-primary/90 transition-colors shadow-sm cursor-pointer active:scale-98"
        >
          <span className="material-symbols-outlined text-[20px]">add</span>
          Add Home
        </button>
      </div>

      {/* Homes Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-md">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="bg-surface border border-outline-variant rounded-xl p-lg h-[180px] animate-pulse"
            />
          ))}
        </div>
      ) : homes.length === 0 ? (
        <div className="bg-surface border border-outline-variant rounded-xl p-xl text-center flex flex-col items-center justify-center gap-md">
          <span className="material-symbols-outlined text-outline text-5xl">
            home
          </span>
          <p className="text-on-surface-variant font-medium">No homes found.</p>
          <button
            onClick={openCreateModal}
            className="px-4 py-2 bg-primary text-on-primary rounded-lg text-sm cursor-pointer"
          >
            Create Your First Home
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-md">
          {homes.map((home: Home) => (
            <div
              key={home.id}
              className="bg-surface border border-outline-variant rounded-xl p-lg flex flex-col justify-between group hover:border-outline transition-colors shadow-sm shadow-black/5"
            >
              <div>
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-sm">
                    <span className="material-symbols-outlined text-primary text-2xl">
                      home
                    </span>
                    <h3 className="font-headline-md text-headline-md text-on-surface font-semibold">
                      {home.name}
                    </h3>
                  </div>
                  <span className="text-xs text-outline font-data-mono">
                    ID #{home.id}
                  </span>
                </div>
                {home.address && (
                  <p className="text-sm text-on-surface-variant mt-2 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px]">
                      location_on
                    </span>
                    {home.address}
                  </p>
                )}
              </div>

              <div className="mt-lg pt-md border-t border-outline-variant flex justify-between items-center">
                <div className="flex items-center gap-xs font-label-caps text-label-caps text-on-surface-variant">
                  <span className="material-symbols-outlined text-[16px]">
                    grid_view
                  </span>
                  <span>{home.rooms?.length || 0} Rooms</span>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEditModal(home)}
                    className="text-on-surface-variant hover:text-primary hover:bg-surface-container-high p-1.5 rounded-lg transition-colors cursor-pointer"
                    title="Edit Home"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      edit
                    </span>
                  </button>
                  <button
                    onClick={() => setHomeToDelete(home)}
                    className="text-error hover:bg-error-container/20 p-1.5 rounded-lg transition-colors cursor-pointer"
                    title="Delete Home"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      delete
                    </span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-outline-variant rounded-xl p-lg max-w-md w-full shadow-lg space-y-md animate-in fade-in zoom-in-95 duration-150">
            <h3 className="font-headline-md text-headline-md text-on-surface font-semibold">
              {editingHome ? 'Edit Home' : 'Create New Home'}
            </h3>

            {errorMessage && (
              <div className="p-2.5 bg-error-container/40 border border-error/20 rounded-lg text-error text-xs">
                {errorMessage}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-md">
              <div>
                <label className="block text-xs font-semibold text-on-surface-variant uppercase mb-1">
                  Home Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Main Residence, Beach House"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-outline-variant rounded-lg bg-surface text-on-surface focus:outline-none focus:border-primary text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface-variant uppercase mb-1">
                  Address (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 123 Smart Boulevard"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
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
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="px-4 py-2 bg-primary text-on-primary rounded-lg text-sm hover:bg-primary/90 disabled:opacity-50 cursor-pointer"
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? 'Saving...'
                    : editingHome
                      ? 'Update Home'
                      : 'Save Home'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom In-App Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!homeToDelete}
        title="Delete Home"
        message={`Are you sure you want to delete "${homeToDelete?.name}"? All associated rooms, automations, and device assignments will also be deleted.`}
        confirmLabel="Yes, Delete Home"
        isDestructive={true}
        isLoading={deleteMutation.isPending}
        onConfirm={handleConfirmDelete}
        onCancel={() => setHomeToDelete(null)}
      />
    </div>
  );
};
