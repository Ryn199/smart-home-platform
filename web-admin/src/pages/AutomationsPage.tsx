import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { automationsApi } from '../api/automations';
import { homesApi } from '../api/homes';
import { devicesApi } from '../api/devices';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Automation, SensorTriggerConfig, AutomationActionConfig } from '../types';

export const AutomationsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAutomation, setEditingAutomation] = useState<Automation | null>(null);
  const [automationToDelete, setAutomationToDelete] = useState<Automation | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form states
  const [homeId, setHomeId] = useState<number>(1);
  const [name, setName] = useState('');
  const [sensorType, setSensorType] = useState('temperature');
  const [operator, setOperator] = useState<'>' | '<' | '>=' | '<=' | '=='>('>');
  const [thresholdValue, setThresholdValue] = useState<number>(30);
  const [targetDeviceId, setTargetDeviceId] = useState<number>(1);
  const [actionName, setActionName] = useState<string>('set_speed');
  const [actionParam, setActionParam] = useState<number>(2);

  // Fetch data
  const { data: homes = [] } = useQuery({ queryKey: ['homes'], queryFn: homesApi.getAll });
  const { data: devices = [] } = useQuery({ queryKey: ['devices'], queryFn: () => devicesApi.getAll() });
  const { data: automations = [], isLoading } = useQuery({
    queryKey: ['automations'],
    queryFn: () => automationsApi.getAll(),
  });

  const createMutation = useMutation({
    mutationFn: automationsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automations'] });
      closeModal();
    },
    onError: (err: any) => {
      setErrorMessage(err?.message || 'Failed to create automation');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      automationsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automations'] });
      closeModal();
    },
    onError: (err: any) => {
      setErrorMessage(err?.message || 'Failed to update automation');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: automationsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automations'] });
      setAutomationToDelete(null);
    },
    onError: (err: any) => {
      setErrorMessage(`Delete failed: ${err?.message || 'Unknown error'}`);
      setAutomationToDelete(null);
    },
  });

  const openCreateModal = () => {
    setEditingAutomation(null);
    setName('');
    setSensorType('temperature');
    setOperator('>');
    setThresholdValue(30);
    setActionName('set_speed');
    setActionParam(2);
    if (homes.length > 0) setHomeId(homes[0].id);
    if (devices.length > 0) setTargetDeviceId(devices[0].id);
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const openEditModal = (auto: Automation) => {
    setEditingAutomation(auto);
    setName(auto.name);
    setHomeId(auto.homeId);

    const trigger = auto.configuration?.trigger as SensorTriggerConfig | undefined;
    const action = auto.configuration?.action as AutomationActionConfig | undefined;

    if (trigger) {
      setSensorType(trigger.sensorType || 'temperature');
      setOperator(trigger.operator as any || '>');
      setThresholdValue(trigger.value ?? 30);
    }

    if (action) {
      setTargetDeviceId(action.deviceId);
      setActionName(action.action);
      setActionParam(action.speed ?? action.position ?? 1);
    }

    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingAutomation(null);
    setName('');
    setErrorMessage(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const trigger: SensorTriggerConfig = {
      type: 'sensor_threshold',
      sensorType,
      operator,
      value: thresholdValue,
    };

    const action: AutomationActionConfig = {
      deviceId: targetDeviceId,
      action: actionName,
      ...(actionName === 'set_speed' ? { speed: actionParam } : {}),
      ...(actionName === 'set_position' ? { position: actionParam } : {}),
    };

    if (editingAutomation) {
      updateMutation.mutate({
        id: editingAutomation.id,
        data: {
          name: name.trim(),
          configuration: { trigger, action },
        },
      });
    } else {
      createMutation.mutate({
        homeId,
        name: name.trim(),
        enabled: true,
        configuration: { trigger, action },
      });
    }
  };

  const handleConfirmDelete = () => {
    if (automationToDelete) {
      deleteMutation.mutate(automationToDelete.id);
    }
  };

  return (
    <div className="space-y-lg">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="font-headline-lg text-headline-lg text-on-surface font-bold">
            Automation Rules
          </h2>
          <p className="text-sm text-on-surface-variant">
            Define sensor threshold triggers and automatic appliance controls.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-xs px-4 py-2 bg-primary text-on-primary font-body-md rounded-lg hover:bg-primary/90 transition-colors shadow-sm cursor-pointer active:scale-98"
        >
          <span className="material-symbols-outlined text-[20px]">add</span>
          Create Rule
        </button>
      </div>

      {/* Rules List */}
      {isLoading ? (
        <div className="space-y-md">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="bg-surface border border-outline-variant rounded-xl p-lg h-[90px] animate-pulse"
            />
          ))}
        </div>
      ) : automations.length === 0 ? (
        <div className="bg-surface border border-outline-variant rounded-xl p-xl text-center flex flex-col items-center justify-center gap-md">
          <span className="material-symbols-outlined text-outline text-5xl">
            auto_mode
          </span>
          <p className="text-on-surface-variant font-medium">
            No automation rules created yet.
          </p>
          <button
            onClick={openCreateModal}
            className="px-4 py-2 bg-primary text-on-primary rounded-lg text-sm cursor-pointer"
          >
            Create Your First Rule
          </button>
        </div>
      ) : (
        <div className="space-y-md">
          {automations.map((auto: Automation) => {
            const trigger = auto.configuration?.trigger as SensorTriggerConfig | undefined;
            const action = auto.configuration?.action as AutomationActionConfig | undefined;
            const targetDev = devices.find((d) => d.id === action?.deviceId);

            return (
              <div
                key={auto.id}
                className="bg-surface border border-outline-variant rounded-xl p-lg flex flex-col sm:flex-row sm:items-center justify-between gap-md shadow-sm shadow-black/5"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-sm">
                    <h3 className="font-headline-md text-headline-md text-on-surface font-semibold">
                      {auto.name}
                    </h3>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                        auto.enabled
                          ? 'text-[#059669] bg-[#ecfdf5]'
                          : 'text-outline bg-surface-container-highest'
                      }`}
                    >
                      {auto.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>

                  <p className="text-sm text-on-surface-variant flex flex-wrap items-center gap-1 font-data-mono">
                    <span className="font-semibold text-primary">IF</span>
                    <span>
                      {trigger?.sensorType || 'sensor'} {trigger?.operator}{' '}
                      {trigger?.value}
                    </span>
                    <span className="font-semibold text-primary ml-2">THEN</span>
                    <span>
                      {targetDev?.name || `Device #${action?.deviceId}`} →{' '}
                      {action?.action}
                      {action?.speed !== undefined ? ` (Speed: ${action.speed})` : ''}
                      {action?.position !== undefined
                        ? ` (Pos: ${action.position}%)`
                        : ''}
                    </span>
                  </p>
                </div>

                <div className="flex items-center gap-md">
                  {/* Toggle Pill */}
                  <button
                    onClick={() =>
                      updateMutation.mutate({ id: auto.id, data: { enabled: !auto.enabled } })
                    }
                    title={auto.enabled ? 'Disable rule' : 'Enable rule'}
                    className={`w-12 h-6 rounded-full relative cursor-pointer transition-colors ${
                      auto.enabled ? 'bg-primary' : 'bg-outline-variant'
                    }`}
                  >
                    <div
                      className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-all ${
                        auto.enabled ? 'right-1' : 'left-1'
                      }`}
                    />
                  </button>

                  <button
                    onClick={() => openEditModal(auto)}
                    className="text-on-surface-variant hover:text-primary hover:bg-surface-container-high p-1.5 rounded-lg transition-colors cursor-pointer"
                    title="Edit Rule"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      edit
                    </span>
                  </button>

                  <button
                    onClick={() => setAutomationToDelete(auto)}
                    className="text-error hover:bg-error-container/20 p-1.5 rounded-lg transition-colors cursor-pointer"
                    title="Delete Rule"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      delete
                    </span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Automation Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-outline-variant rounded-xl p-lg max-w-lg w-full shadow-lg space-y-md max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
            <h3 className="font-headline-md text-headline-md text-on-surface font-semibold">
              {editingAutomation ? 'Edit Automation Rule' : 'Create Automation Rule'}
            </h3>

            {errorMessage && (
              <div className="p-2.5 bg-error-container/40 border border-error/20 rounded-lg text-error text-xs">
                {errorMessage}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-md">
              <div>
                <label className="block text-xs font-semibold text-on-surface-variant uppercase mb-1">
                  Rule Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Turn On Fan When Temperature > 30°C"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-outline-variant rounded-lg bg-surface text-on-surface focus:outline-none focus:border-primary text-sm"
                />
              </div>

              {!editingAutomation && (
                <div>
                  <label className="block text-xs font-semibold text-on-surface-variant uppercase mb-1">
                    Select Home *
                  </label>
                  <select
                    value={homeId}
                    onChange={(e) => setHomeId(parseInt(e.target.value, 10))}
                    className="w-full px-3 py-2 border border-outline-variant rounded-lg bg-surface text-on-surface text-sm"
                  >
                    {homes.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Trigger Config */}
              <div className="p-md bg-surface-container-low rounded-xl border border-outline-variant space-y-sm">
                <span className="text-xs font-bold text-primary uppercase">
                  Trigger Condition (IF)
                </span>
                <div className="grid grid-cols-3 gap-sm">
                  <div>
                    <label className="block text-[11px] text-outline mb-1">
                      Sensor Type
                    </label>
                    <select
                      value={sensorType}
                      onChange={(e) => setSensorType(e.target.value)}
                      className="w-full p-2 border border-outline-variant rounded-lg bg-surface text-xs"
                    >
                      <option value="temperature">Temperature</option>
                      <option value="humidity">Humidity</option>
                      <option value="pressure">Pressure</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-outline mb-1">
                      Operator
                    </label>
                    <select
                      value={operator}
                      onChange={(e) => setOperator(e.target.value as any)}
                      className="w-full p-2 border border-outline-variant rounded-lg bg-surface text-xs"
                    >
                      <option value=">">&gt; (Greater Than)</option>
                      <option value=">=">&gt;= (Greater or Equal)</option>
                      <option value="<">&lt; (Less Than)</option>
                      <option value="<=">&lt;= (Less or Equal)</option>
                      <option value="==">== (Equal)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-outline mb-1">
                      Value
                    </label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={thresholdValue}
                      onChange={(e) => setThresholdValue(parseFloat(e.target.value))}
                      className="w-full p-2 border border-outline-variant rounded-lg bg-surface text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Action Config */}
              <div className="p-md bg-surface-container-low rounded-xl border border-outline-variant space-y-sm">
                <span className="text-xs font-bold text-primary uppercase">
                  Action Executed (THEN)
                </span>
                <div className="grid grid-cols-2 gap-sm">
                  <div>
                    <label className="block text-[11px] text-outline mb-1">
                      Target Device
                    </label>
                    <select
                      value={targetDeviceId}
                      onChange={(e) => setTargetDeviceId(parseInt(e.target.value, 10))}
                      className="w-full p-2 border border-outline-variant rounded-lg bg-surface text-xs"
                    >
                      {devices.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name} ({d.deviceType})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] text-outline mb-1">
                      Command Action
                    </label>
                    <select
                      value={actionName}
                      onChange={(e) => setActionName(e.target.value)}
                      className="w-full p-2 border border-outline-variant rounded-lg bg-surface text-xs"
                    >
                      <option value="set_speed">set_speed (Exhaust Fan)</option>
                      <option value="set_position">set_position (Curtain)</option>
                      <option value="unlock">unlock (Door)</option>
                      <option value="lock">lock (Door)</option>
                      <option value="open">open (Curtain)</option>
                      <option value="close">close (Curtain)</option>
                      <option value="on">on (Fan)</option>
                      <option value="off">off (Fan)</option>
                    </select>
                  </div>
                </div>

                {(actionName === 'set_speed' || actionName === 'set_position') && (
                  <div>
                    <label className="block text-[11px] text-outline mb-1">
                      {actionName === 'set_speed' ? 'Speed Level (1-3)' : 'Position (0-100%)'}
                    </label>
                    <input
                      type="number"
                      value={actionParam}
                      onChange={(e) => setActionParam(parseInt(e.target.value, 10))}
                      min={0}
                      max={actionName === 'set_speed' ? 3 : 100}
                      className="w-full p-2 border border-outline-variant rounded-lg bg-surface text-xs"
                    />
                  </div>
                )}
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
                    : editingAutomation
                      ? 'Update Rule'
                      : 'Save Automation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!automationToDelete}
        title="Delete Automation Rule"
        message={`Are you sure you want to delete automation rule "${automationToDelete?.name}"?`}
        confirmLabel="Yes, Delete Rule"
        isDestructive={true}
        isLoading={deleteMutation.isPending}
        onConfirm={handleConfirmDelete}
        onCancel={() => setAutomationToDelete(null)}
      />
    </div>
  );
};
