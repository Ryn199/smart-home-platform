import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { devicesApi } from '../api/devices';
import { sensorsApi } from '../api/sensors';
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
import { Sensor } from '../types';

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

export const SensorsPage: React.FC = () => {
  const [selectedSensorId, setSelectedSensorId] = useState<number | null>(null);
  const [timeRange, setTimeRange] = useState<'1h' | '24h' | '7d'>('24h');

  // Fetch CUSTOM_SENSOR devices
  const { data: devices = [] } = useQuery({
    queryKey: ['devices', 'CUSTOM_SENSOR'],
    queryFn: () => devicesApi.getAll({ deviceType: 'CUSTOM_SENSOR' }),
  });

  const allSensors: (Sensor & { deviceName: string })[] = devices.flatMap((d) =>
    (d.sensors || []).map((s) => ({ ...s, deviceName: d.name })),
  );

  const activeSensorId = selectedSensorId ?? (allSensors[0]?.id || null);

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

  const readings = readingsResponse?.readings || [];
  const activeSensor = allSensors.find((s) => s.id === activeSensorId);

  // Stats calculation
  const values = readings.map((r) => r.value);
  const latestValue = values[0] ?? 0;
  const minValue = values.length ? Math.min(...values) : 0;
  const maxValue = values.length ? Math.max(...values) : 0;
  const avgValue = values.length
    ? (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1)
    : '0';

  // Chart dataset preparation
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

  return (
    <div className="space-y-lg">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="font-headline-lg text-headline-lg text-on-surface font-bold">
            Sensors & Telemetry
          </h2>
          <p className="text-sm text-on-surface-variant">
            Historical environmental metrics and telemetry insights.
          </p>
        </div>
      </div>

      {/* Sensor Picker Bar */}
      <div className="flex items-center gap-md overflow-x-auto pb-sm no-scrollbar border-b border-outline-variant/50">
        <span className="font-label-caps text-label-caps text-on-surface-variant whitespace-nowrap">
          Sensor:
        </span>
        {allSensors.map((sensor) => (
          <button
            key={sensor.id}
            onClick={() => setSelectedSensorId(sensor.id)}
            className={`font-body-md text-body-md px-4 py-1.5 rounded-full whitespace-nowrap border transition-colors cursor-pointer ${
              activeSensorId === sensor.id
                ? 'bg-primary text-on-primary border-primary'
                : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-highest border-outline-variant'
            }`}
          >
            {sensor.deviceName} — {sensor.name}
          </button>
        ))}
      </div>

      {allSensors.length === 0 ? (
        <div className="bg-surface border border-outline-variant rounded-xl p-xl text-center flex flex-col items-center justify-center gap-md">
          <span className="material-symbols-outlined text-outline text-5xl">
            sensors
          </span>
          <p className="text-on-surface-variant font-medium">
            No active custom sensors discovered yet. Telemetry will automatically register here upon MQTT receipt.
          </p>
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
                <span className="text-base text-on-surface-variant ml-1">
                  {activeSensor?.unit}
                </span>
              </div>
            </div>
            <div className="bg-surface border border-outline-variant rounded-xl p-md shadow-sm">
              <span className="font-label-caps text-label-caps text-on-surface-variant block mb-1">
                Average ({timeRange})
              </span>
              <div className="font-display-stat text-display-stat text-on-surface">
                {avgValue}
                <span className="text-base text-on-surface-variant ml-1">
                  {activeSensor?.unit}
                </span>
              </div>
            </div>
            <div className="bg-surface border border-outline-variant rounded-xl p-md shadow-sm">
              <span className="font-label-caps text-label-caps text-on-surface-variant block mb-1">
                Min ({timeRange})
              </span>
              <div className="font-display-stat text-display-stat text-on-surface">
                {minValue}
                <span className="text-base text-on-surface-variant ml-1">
                  {activeSensor?.unit}
                </span>
              </div>
            </div>
            <div className="bg-surface border border-outline-variant rounded-xl p-md shadow-sm">
              <span className="font-label-caps text-label-caps text-on-surface-variant block mb-1">
                Max ({timeRange})
              </span>
              <div className="font-display-stat text-display-stat text-on-surface">
                {maxValue}
                <span className="text-base text-on-surface-variant ml-1">
                  {activeSensor?.unit}
                </span>
              </div>
            </div>
          </div>

          {/* Chart Container */}
          <div className="bg-surface border border-outline-variant rounded-xl p-lg shadow-sm shadow-black/5 space-y-md">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-headline-md text-headline-md font-semibold text-on-surface">
                  {activeSensor?.name} Over Time
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
                    className={`px-3 py-1 text-xs font-semibold rounded ${
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

            <div className="h-[300px] w-full">
              {isLoadingReadings ? (
                <div className="h-full flex items-center justify-center text-outline text-sm">
                  Loading telemetry...
                </div>
              ) : readings.length === 0 ? (
                <div className="h-full flex items-center justify-center text-outline text-sm">
                  No readings available for this time range.
                </div>
              ) : (
                <Line data={chartData} options={chartOptions} />
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
