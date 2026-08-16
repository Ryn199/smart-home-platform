import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sensorsApi } from '../api/sensors';
import { devicesApi } from '../api/devices';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { Device, Sensor } from '../types';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
);

const PRESET_TYPES = [
  { label: 'Temperature (°C)', type: 'temperature', unit: '°C' },
  { label: 'Humidity (%)', type: 'humidity', unit: '%' },
  { label: 'Pressure (hPa)', type: 'pressure', unit: 'hPa' },
  { label: 'Air Quality / Gas (ppm)', type: 'gas', unit: 'ppm' },
  { label: 'Light (lx)', type: 'light', unit: 'lx' },
  { label: 'Motion', type: 'motion', unit: '' },
  { label: 'Voltage (V)', type: 'voltage', unit: 'V' },
  { label: 'Current (A)', type: 'current', unit: 'A' },
  { label: 'Power (W)', type: 'power', unit: 'W' },
];

export const SensorsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [selectedSensorId, setSelectedSensorId] = useState<number | null>(null);
  const [timeRange, setTimeRange] = useState<'1h' | '24h' | '7d'>('24h');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSensor, setEditingSensor] = useState<Sensor | null>(null);
  const [sensorToDelete, setSensorToDelete] = useState<Sensor | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [sensorType, setSensorType] = useState('temperature');
  const [unit, setUnit] = useState('°C');
  const [deviceId, setDeviceId] = useState<number>(0);

  // Fetch all devices
  const { data: devices = [] } = useQuery({
    queryKey: ['devices'],
    queryFn: () => devicesApi.getAll(),
  });

  // Fetch all sensors
  const { data: sensors = [], isLoading: isLoadingSensors } = useQuery({
    queryKey: ['sensors'],
    queryFn: sensorsApi.getAll,
  });

  const activeSensorId =
    selectedSensorId ?? (sensors.length > 0 ? sensors[0].id : null);
  const activeSensor = sensors.find((s) => s.id === activeSensorId);

  // Compute 'from' timestamp based on selected timeRange
  const getFromDate = () => {
    const d = new Date();
    if (timeRange === '1h') d.setHours(d.getHours() - 1);
    else if (timeRange === '24h') d.setHours(d.getHours() - 24);
    else if (timeRange === '7d') d.setDate(d.getDate() - 7);
    return d.toISOString();
  };

  // Fetch historical readings for active sensor
  const { data: readingsResponse, isLoading: isLoadingReadings } = useQuery({
    queryKey: ['sensorReadings', activeSensorId, timeRange],
    queryFn: () =>
      activeSensorId
        ? sensorsApi.getReadings(activeSensorId, { from: getFromDate(), limit: 200 })
        : null,
    enabled: !!activeSensorId,
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: sensorsApi.create,
    onSuccess: (newSensor) => {
      queryClient.invalidateQueries({ queryKey: ['sensors'] });
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      setSelectedSensorId(newSensor.id);
      closeModal();
    },
    onError: (err: any) => {
      setErrorMessage(err?.message || 'Failed to register sensor');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      sensorsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sensors'] });
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      closeModal();
    },
    onError: (err: any) => {
      setErrorMessage(err?.message || 'Failed to update sensor');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: sensorsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sensors'] });
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      if (activeSensorId === sensorToDelete?.id) {
        setSelectedSensorId(null);
      }
      setSensorToDelete(null);
    },
    onError: (err: any) => {
      setErrorMessage(`Delete failed: ${err?.message || 'Unknown error'}`);
      setSensorToDelete(null);
    },
  });

  const openCreateModal = () => {
    setEditingSensor(null);
    setName('');
    setSensorType('temperature');
    setUnit('°C');
    if (devices.length > 0) setDeviceId(devices[0].id);
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const openEditModal = (sensor: Sensor) => {
    setEditingSensor(sensor);
    setName(sensor.name);
    setSensorType(sensor.type);
    setUnit(sensor.unit || '');
    setDeviceId(sensor.deviceId);
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingSensor(null);
    setName('');
    setErrorMessage(null);
  };

  const handleTypeChange = (typeVal: string) => {
    setSensorType(typeVal);
    const preset = PRESET_TYPES.find((p) => p.type === typeVal);
    if (preset) {
      setUnit(preset.unit);
      if (!name || PRESET_TYPES.some((p) => p.label.startsWith(name))) {
        setName(preset.type.charAt(0).toUpperCase() + preset.type.slice(1));
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (editingSensor) {
      updateMutation.mutate({
        id: editingSensor.id,
        data: {
          name: name.trim(),
          type: sensorType.trim(),
          unit: unit.trim(),
          deviceId,
        },
      });
    } else {
      createMutation.mutate({
        deviceId,
        name: name.trim(),
        type: sensorType.trim(),
        unit: unit.trim(),
      });
    }
  };

  const handleConfirmDelete = () => {
    if (sensorToDelete) {
      deleteMutation.mutate(sensorToDelete.id);
    }
  };

  // Stats calculation
  const readings = readingsResponse?.readings || [];
  const values = readings.map((r) => r.value);
  const latestValue = activeSensor?.readings?.[0]?.value ?? (values[0] ?? '-');
  const minValue = values.length ? Math.min(...values) : '-';
  const maxValue = values.length ? Math.max(...values) : '-';
  const avgValue = values.length
    ? (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1)
    : '-';

  // Chart dataset
  const sortedForChart = [...readings].reverse();
  const chartData = {
    labels: sortedForChart.map((r) =>
      new Date(r.recordedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    ),
    datasets: [
      {
        fill: true,
        label: `${activeSensor?.name || 'Sensor'} (${activeSensor?.unit || ''})`,
        data: sortedForChart.map((r) => r.value),
        borderColor: '#00288e',
        backgroundColor: 'rgba(0, 40, 142, 0.08)',
        borderWidth: 2,
        tension: 0.35,
        pointRadius: sortedForChart.length > 50 ? 0 : 3,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1a1b22',
        titleFont: { family: 'Inter' },
        bodyFont: { family: 'JetBrains Mono' },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { maxTicksLimit: 8, color: '#757684', font: { family: 'Inter', size: 11 } },
      },
      y: {
        grid: { color: 'rgba(196, 197, 213, 0.3)' },
        ticks: { color: '#757684', font: { family: 'JetBrains Mono', size: 11 } },
      },
    },
  };

  const filteredSensors = sensors.filter((s) => {
    if (typeFilter !== 'ALL' && s.type.toLowerCase() !== typeFilter.toLowerCase()) return false;
    return true;
  });

  return (
    <div className="space-y-lg">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="font-headline-lg text-headline-lg text-on-surface font-bold">
            Sensors & Telemetry
          </h2>
          <p className="text-sm text-on-surface-variant">
            Environmental telemetry, real-time metrics, and sensor hardware registry.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          disabled={devices.length === 0}
          className="flex items-center gap-xs px-4 py-2 bg-primary text-on-primary font-body-md rounded-lg hover:bg-primary/90 transition-colors shadow-sm cursor-pointer active:scale-98 disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-[20px]">add</span>
          Add Sensor
        </button>
      </div>

      {devices.length === 0 && (
        <div className="p-4 bg-primary-container/10 border border-primary/20 rounded-xl text-primary text-sm flex items-center gap-2">
          <span className="material-symbols-outlined">info</span>
          <span>Please register at least one device before creating sensors.</span>
        </div>
      )}

      {/* Sensor Picker Bar */}
      {sensors.length > 0 && (
        <div className="flex items-center gap-md overflow-x-auto pb-sm no-scrollbar border-b border-outline-variant/50">
          <span className="font-label-caps text-label-caps text-on-surface-variant whitespace-nowrap">
            Active Chart:
          </span>
          {sensors.map((sensor) => (
            <button
              key={sensor.id}
              onClick={() => setSelectedSensorId(sensor.id)}
              className={`font-body-md text-body-md px-4 py-1.5 rounded-full whitespace-nowrap border transition-colors cursor-pointer ${
                activeSensorId === sensor.id
                  ? 'bg-primary text-on-primary border-primary'
                  : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-highest border-outline-variant'
              }`}
            >
              {sensor.device?.name || `Device #${sensor.deviceId}`} — {sensor.name}
            </button>
          ))}
        </div>
      )}

      {sensors.length === 0 ? (
        <div className="bg-surface border border-outline-variant rounded-xl p-xl text-center flex flex-col items-center justify-center gap-md">
          <span className="material-symbols-outlined text-outline text-5xl">
            sensors
          </span>
          <p className="text-on-surface-variant font-medium">
            No active custom sensors registered yet. Click &quot;Add Sensor&quot; or send telemetry via MQTT to register automatically.
          </p>
          {devices.length > 0 && (
            <button
              onClick={openCreateModal}
              className="px-4 py-2 bg-primary text-on-primary rounded-lg text-sm cursor-pointer"
            >
              Register First Sensor
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Stat Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-md">
            <div className="bg-surface border border-outline-variant rounded-xl p-md shadow-sm">
              <span className="font-label-caps text-label-caps text-on-surface-variant block mb-1">
                Latest Reading
              </span>
              <div className="font-display-stat text-display-stat text-on-surface">
                {latestValue}
                {activeSensor?.unit && (
                  <span className="text-base text-on-surface-variant ml-1">
                    {activeSensor.unit}
                  </span>
                )}
              </div>
            </div>
            <div className="bg-surface border border-outline-variant rounded-xl p-md shadow-sm">
              <span className="font-label-caps text-label-caps text-on-surface-variant block mb-1">
                Average ({timeRange})
              </span>
              <div className="font-display-stat text-display-stat text-on-surface">
                {avgValue}
                {activeSensor?.unit && (
                  <span className="text-base text-on-surface-variant ml-1">
                    {activeSensor.unit}
                  </span>
                )}
              </div>
            </div>
            <div className="bg-surface border border-outline-variant rounded-xl p-md shadow-sm">
              <span className="font-label-caps text-label-caps text-on-surface-variant block mb-1">
                Min ({timeRange})
              </span>
              <div className="font-display-stat text-display-stat text-on-surface">
                {minValue}
                {activeSensor?.unit && (
                  <span className="text-base text-on-surface-variant ml-1">
                    {activeSensor.unit}
                  </span>
                )}
              </div>
            </div>
            <div className="bg-surface border border-outline-variant rounded-xl p-md shadow-sm">
              <span className="font-label-caps text-label-caps text-on-surface-variant block mb-1">
                Max ({timeRange})
              </span>
              <div className="font-display-stat text-display-stat text-on-surface">
                {maxValue}
                {activeSensor?.unit && (
                  <span className="text-base text-on-surface-variant ml-1">
                    {activeSensor.unit}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Historical Telemetry Chart */}
          <div className="bg-surface border border-outline-variant rounded-xl p-lg shadow-sm shadow-black/5 space-y-md">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-headline-md text-headline-md font-semibold text-on-surface">
                  {activeSensor?.name} Telemetry History
                </h3>
                <span className="text-xs text-outline font-data-mono">
                  {readings.length} data points loaded
                </span>
              </div>
              <div className="flex items-center gap-1 bg-surface-container-low p-1 rounded-lg border border-outline-variant">
                {(['1h', '24h', '7d'] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setTimeRange(r)}
                    className={`px-3 py-1 text-xs font-semibold rounded cursor-pointer transition-colors ${
                      timeRange === r
                        ? 'bg-primary text-on-primary'
                        : 'text-on-surface-variant hover:bg-surface-container-highest'
                    }`}
                  >
                    {r.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div className="h-[280px] w-full">
              {isLoadingReadings ? (
                <div className="h-full flex items-center justify-center text-outline text-sm">
                  Loading telemetry...
                </div>
              ) : readings.length === 0 ? (
                <div className="h-full flex items-center justify-center text-outline text-sm">
                  No readings available for this timeframe.
                </div>
              ) : (
                <Line data={chartData} options={chartOptions} />
              )}
            </div>
          </div>

          {/* Sensors Inventory Table */}
          <div className="space-y-md">
            <div className="flex justify-between items-center">
              <h3 className="font-headline-md text-headline-md text-on-surface font-semibold">
                Sensor Hardware Registry ({filteredSensors.length})
              </h3>

              {/* Type Filter */}
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="px-3 py-1.5 border border-outline-variant rounded-lg bg-surface text-sm focus:outline-none"
              >
                <option value="ALL">All Sensor Types</option>
                <option value="temperature">Temperature</option>
                <option value="humidity">Humidity</option>
                <option value="pressure">Pressure</option>
                <option value="gas">Gas / Air Quality</option>
                <option value="light">Light</option>
                <option value="motion">Motion</option>
              </select>
            </div>

            <div className="bg-surface border border-outline-variant rounded-xl overflow-hidden shadow-sm shadow-black/5">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-surface-container-low border-b border-outline-variant text-on-surface-variant font-label-caps text-label-caps uppercase">
                    <tr>
                      <th className="px-lg py-md">Sensor Name</th>
                      <th className="px-lg py-md">Type</th>
                      <th className="px-lg py-md">Unit</th>
                      <th className="px-lg py-md">Assigned Device</th>
                      <th className="px-lg py-md">Latest Value</th>
                      <th className="px-lg py-md text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/60">
                    {isLoadingSensors ? (
                      <tr>
                        <td colSpan={6} className="px-lg py-xl text-center text-outline">
                          Loading sensors...
                        </td>
                      </tr>
                    ) : filteredSensors.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-lg py-xl text-center text-outline">
                          No sensors match the selected filter.
                        </td>
                      </tr>
                    ) : (
                      filteredSensors.map((sensor: Sensor) => {
                        const isSelected = sensor.id === activeSensorId;
                        const latest = sensor.readings?.[0]?.value ?? '-';

                        return (
                          <tr
                            key={sensor.id}
                            className={`hover:bg-surface-container-low/50 transition-colors ${
                              isSelected ? 'bg-primary-fixed-dim/10' : ''
                            }`}
                          >
                            <td className="px-lg py-md font-semibold text-on-surface">
                              <div className="flex items-center gap-sm">
                                <span className="material-symbols-outlined text-primary text-[20px]">
                                  sensors
                                </span>
                                {sensor.name}
                              </div>
                            </td>
                            <td className="px-lg py-md">
                              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-surface-container-highest text-on-surface-variant font-data-mono uppercase">
                                {sensor.type}
                              </span>
                            </td>
                            <td className="px-lg py-md font-data-mono text-outline">
                              {sensor.unit || '—'}
                            </td>
                            <td className="px-lg py-md text-on-surface-variant">
                              {sensor.device?.name || `Device #${sensor.deviceId}`}
                              {sensor.device?.room?.name && (
                                <span className="text-xs text-outline block">
                                  {sensor.device.room.name}
                                </span>
                              )}
                            </td>
                            <td className="px-lg py-md font-bold text-on-surface font-data-mono">
                              {latest !== '-' ? `${latest} ${sensor.unit || ''}` : 'No data'}
                            </td>
                            <td className="px-lg py-md text-right space-x-1">
                              <button
                                onClick={() => setSelectedSensorId(sensor.id)}
                                className={`text-xs px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                                  isSelected
                                    ? 'bg-primary text-on-primary'
                                    : 'text-primary hover:bg-primary-container/20'
                                }`}
                              >
                                {isSelected ? 'Viewing' : 'Inspect'}
                              </button>
                              <button
                                onClick={() => openEditModal(sensor)}
                                className="text-on-surface-variant hover:text-primary hover:bg-surface-container-high p-1.5 rounded-lg transition-colors cursor-pointer"
                                title="Edit Sensor"
                              >
                                <span className="material-symbols-outlined text-[18px]">
                                  edit
                                </span>
                              </button>
                              <button
                                onClick={() => setSensorToDelete(sensor)}
                                className="text-error hover:bg-error-container/20 p-1.5 rounded-lg transition-colors cursor-pointer"
                                title="Delete Sensor"
                              >
                                <span className="material-symbols-outlined text-[18px]">
                                  delete
                                </span>
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Create / Edit Sensor Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-outline-variant rounded-xl p-lg max-w-md w-full shadow-lg space-y-md animate-in fade-in zoom-in-95 duration-150">
            <h3 className="font-headline-md text-headline-md text-on-surface font-semibold">
              {editingSensor ? 'Edit Sensor' : 'Register New Sensor'}
            </h3>

            {errorMessage && (
              <div className="p-2.5 bg-error-container/40 border border-error/20 rounded-lg text-error text-xs">
                {errorMessage}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-md">
              <div>
                <label className="block text-xs font-semibold text-on-surface-variant uppercase mb-1">
                  Assign Device *
                </label>
                <select
                  value={deviceId}
                  onChange={(e) => setDeviceId(parseInt(e.target.value, 10))}
                  className="w-full px-3 py-2 border border-outline-variant rounded-lg bg-surface text-on-surface focus:outline-none focus:border-primary text-sm"
                >
                  {devices.map((d: Device) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.deviceUid})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface-variant uppercase mb-1">
                  Sensor Type / Metric Preset
                </label>
                <select
                  value={sensorType}
                  onChange={(e) => handleTypeChange(e.target.value)}
                  className="w-full px-3 py-2 border border-outline-variant rounded-lg bg-surface text-on-surface focus:outline-none focus:border-primary text-sm"
                >
                  {PRESET_TYPES.map((p) => (
                    <option key={p.type} value={p.type}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface-variant uppercase mb-1">
                  Sensor Name / Label *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Temperature Sensor, Main Room Humidity"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-outline-variant rounded-lg bg-surface text-on-surface focus:outline-none focus:border-primary text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface-variant uppercase mb-1">
                  Measurement Unit
                </label>
                <input
                  type="text"
                  placeholder="e.g. °C, %, hPa, ppm, lx, V, W"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="w-full px-3 py-2 border border-outline-variant rounded-lg bg-surface text-on-surface focus:outline-none focus:border-primary text-sm font-data-mono"
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
                    : editingSensor
                      ? 'Update Sensor'
                      : 'Register Sensor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!sensorToDelete}
        title="Delete Sensor"
        message={`Are you sure you want to delete sensor "${sensorToDelete?.name}"? All historical telemetry readings associated with this sensor will also be permanently deleted.`}
        confirmLabel="Yes, Delete Sensor"
        isDestructive={true}
        isLoading={deleteMutation.isPending}
        onConfirm={handleConfirmDelete}
        onCancel={() => setSensorToDelete(null)}
      />
    </div>
  );
};
