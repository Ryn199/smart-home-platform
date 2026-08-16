import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { devicesApi } from '../../api/devices';
import { tempHumidityApi, TempHumidityReading } from '../../api/tempHumidity';
import { useWebSocket } from '../../websocket/socket';
import { usePinnedDevices } from '../../hooks/usePinnedDevices';
import { TempHumidityState } from '../../types';
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

interface TelemetryPoint {
  id?: number;
  timestamp: string;
  timeLabel: string;
  temperature: number;
  humidity: number;
}

export const TempHumidityMonitoringPage: React.FC = () => {
  const { deviceUid } = useParams<{ deviceUid: string }>();
  const navigate = useNavigate();
  const { deviceStates } = useWebSocket();
  const { isPinned, togglePin } = usePinnedDevices();

  const [timeframe, setTimeframe] = useState<'1h' | '24h' | '7d' | 'all'>('1h');
  const [telemetryHistory, setTelemetryHistory] = useState<TelemetryPoint[]>([]);

  // 1. Fetch devices list to resolve this device
  const { data: devices = [], isLoading: isLoadingDevice } = useQuery({
    queryKey: ['devices'],
    queryFn: () => devicesApi.getAll(),
  });

  const device = devices.find((d) => d.deviceUid === deviceUid);

  // 2. Fetch historical database telemetry readings
  const { data: dbHistory = [], isLoading: isLoadingHistory } = useQuery({
    queryKey: ['tempHumidityHistory', deviceUid, timeframe],
    queryFn: () => (deviceUid ? tempHumidityApi.getHistory(deviceUid, timeframe, 200) : []),
    enabled: !!deviceUid,
  });

  // 3. Fetch 24h aggregated statistics from database
  const { data: dbStats } = useQuery({
    queryKey: ['tempHumidityStats', deviceUid],
    queryFn: () => (deviceUid ? tempHumidityApi.getStats(deviceUid) : null),
    enabled: !!deviceUid,
    refetchInterval: 10000,
  });

  // 4. Initialize telemetry history when database records load
  useEffect(() => {
    if (dbHistory.length > 0) {
      const mapped: TelemetryPoint[] = dbHistory.map((item: TempHumidityReading) => {
        const d = new Date(item.recordedAt);
        return {
          id: item.id,
          timestamp: item.recordedAt,
          timeLabel: d.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          }),
          temperature: item.temperature,
          humidity: item.humidity,
        };
      });
      setTelemetryHistory(mapped);
    }
  }, [dbHistory]);

  // 5. Read live metadata from WebSocket or database
  const liveState = (
    deviceUid && deviceStates[deviceUid]
      ? deviceStates[deviceUid]
      : device?.metadata || { temperature: 26.5, humidity: 55 }
  ) as unknown as TempHumidityState;

  const currentTemp = typeof liveState.temperature === 'number' ? liveState.temperature : null;
  const currentHum = typeof liveState.humidity === 'number' ? liveState.humidity : null;

  // 6. Append incoming WebSocket telemetry to the live chart in real time
  useEffect(() => {
    if (currentTemp !== null && currentHum !== null) {
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });

      setTelemetryHistory((prev) => {
        // If empty and no DB records loaded yet, start initial array
        if (prev.length === 0) {
          return [
            {
              timestamp: now.toISOString(),
              timeLabel: timeStr,
              temperature: currentTemp,
              humidity: currentHum,
            },
          ];
        }

        const last = prev[prev.length - 1];
        // Don't add duplicate reading if values & minute match
        if (
          last &&
          last.temperature === currentTemp &&
          last.humidity === currentHum &&
          last.timeLabel === timeStr
        ) {
          return prev;
        }

        const next = [
          ...prev,
          {
            timestamp: now.toISOString(),
            timeLabel: timeStr,
            temperature: currentTemp,
            humidity: currentHum,
          },
        ];
        // Keep at most 200 points for smooth rendering
        return next.slice(-200);
      });
    }
  }, [currentTemp, currentHum]);

  // Comfort Index Calculation
  const comfortInfo = useMemo(() => {
    if (currentTemp === null || currentHum === null) {
      return { status: 'Unknown', color: 'text-outline', bg: 'bg-surface-container-highest', desc: 'No data' };
    }

    if (currentTemp >= 20 && currentTemp <= 26 && currentHum >= 40 && currentHum <= 60) {
      return { status: 'Optimal Comfort', color: 'text-[#059669]', bg: 'bg-[#ecfdf5]', desc: 'Ideal temperature and humidity balance' };
    }
    if (currentTemp > 28 || currentHum > 70) {
      return { status: 'Warm & Humid', color: 'text-amber-600', bg: 'bg-amber-50', desc: 'Exhaust fan recommended' };
    }
    if (currentTemp < 20) {
      return { status: 'Cool Environment', color: 'text-blue-600', bg: 'bg-blue-50', desc: 'Lower temperature range' };
    }
    return { status: 'Moderate', color: 'text-primary', bg: 'bg-primary-container/20', desc: 'Normal ambient conditions' };
  }, [currentTemp, currentHum]);

  // Combined Stats: Database aggregate or session calculation
  const stats = useMemo(() => {
    if (dbStats?.stats && dbStats.stats.totalReadings > 0) {
      return {
        tempMin: dbStats.stats.tempMin !== null ? dbStats.stats.tempMin.toFixed(1) : '--',
        tempMax: dbStats.stats.tempMax !== null ? dbStats.stats.tempMax.toFixed(1) : '--',
        tempAvg: dbStats.stats.tempAvg !== null ? dbStats.stats.tempAvg.toFixed(1) : '--',
        humMin: dbStats.stats.humMin !== null ? dbStats.stats.humMin.toFixed(1) : '--',
        humMax: dbStats.stats.humMax !== null ? dbStats.stats.humMax.toFixed(1) : '--',
        humAvg: dbStats.stats.humAvg !== null ? dbStats.stats.humAvg.toFixed(1) : '--',
        totalCount: dbStats.stats.totalReadings,
      };
    }

    if (telemetryHistory.length === 0) {
      return {
        tempMin: currentTemp !== null ? currentTemp.toFixed(1) : '--',
        tempMax: currentTemp !== null ? currentTemp.toFixed(1) : '--',
        tempAvg: currentTemp !== null ? currentTemp.toFixed(1) : '--',
        humMin: currentHum !== null ? currentHum.toFixed(1) : '--',
        humMax: currentHum !== null ? currentHum.toFixed(1) : '--',
        humAvg: currentHum !== null ? currentHum.toFixed(1) : '--',
        totalCount: 0,
      };
    }

    const temps = telemetryHistory.map((p) => p.temperature);
    const hums = telemetryHistory.map((p) => p.humidity);

    return {
      tempMin: Math.min(...temps).toFixed(1),
      tempMax: Math.max(...temps).toFixed(1),
      tempAvg: (temps.reduce((a, b) => a + b, 0) / temps.length).toFixed(1),
      humMin: Math.min(...hums).toFixed(1),
      humMax: Math.max(...hums).toFixed(1),
      humAvg: (hums.reduce((a, b) => a + b, 0) / hums.length).toFixed(1),
      totalCount: telemetryHistory.length,
    };
  }, [dbStats, telemetryHistory, currentTemp, currentHum]);

  // Chart configuration
  const chartData = {
    labels: telemetryHistory.map((p) => p.timeLabel),
    datasets: [
      {
        label: 'Temperature (°C)',
        data: telemetryHistory.map((p) => p.temperature),
        borderColor: '#0284c7',
        backgroundColor: 'rgba(2, 132, 199, 0.08)',
        borderWidth: 2.5,
        tension: 0.35,
        fill: true,
        pointRadius: telemetryHistory.length > 50 ? 0 : 3,
        pointHoverRadius: 5,
        pointBackgroundColor: '#0284c7',
        yAxisID: 'yTemp',
      },
      {
        label: 'Humidity (%)',
        data: telemetryHistory.map((p) => p.humidity),
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.08)',
        borderWidth: 2.5,
        tension: 0.35,
        fill: true,
        pointRadius: telemetryHistory.length > 50 ? 0 : 3,
        pointHoverRadius: 5,
        pointBackgroundColor: '#10b981',
        yAxisID: 'yHum',
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 300,
    },
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          usePointStyle: true,
          boxWidth: 8,
          font: { family: 'inherit', size: 12, weight: 600 },
        },
      },
      tooltip: {
        backgroundColor: '#1e293b',
        padding: 12,
        titleFont: { size: 12, weight: 'bold' as const },
        bodyFont: { size: 12 },
        cornerRadius: 8,
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { font: { size: 11 }, maxTicksLimit: 8 },
      },
      yTemp: {
        type: 'linear' as const,
        display: true,
        position: 'left' as const,
        title: {
          display: true,
          text: 'Temperature (°C)',
          font: { size: 11, weight: 'bold' as const },
          color: '#0284c7',
        },
        grid: { color: 'rgba(0, 0, 0, 0.04)' },
      },
      yHum: {
        type: 'linear' as const,
        display: true,
        position: 'right' as const,
        title: {
          display: true,
          text: 'Humidity (%)',
          font: { size: 11, weight: 'bold' as const },
          color: '#10b981',
        },
        grid: { drawOnChartArea: false },
      },
    },
  };

  if (isLoadingDevice) {
    return (
      <div className="p-xl text-center text-outline">
        Loading temperature & humidity monitoring node...
      </div>
    );
  }

  if (!device && !isLoadingDevice) {
    return (
      <div className="p-xl bg-surface border border-outline-variant rounded-xl text-center space-y-md">
        <span className="material-symbols-outlined text-4xl text-error">error</span>
        <h3 className="font-headline-md text-headline-md text-on-surface font-bold">
          Device Not Found
        </h3>
        <p className="text-sm text-on-surface-variant">
          No device with UID &ldquo;{deviceUid}&rdquo; is registered in your system.
        </p>
        <button
          onClick={() => navigate('/monitoring')}
          className="px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-semibold cursor-pointer"
        >
          Back to Device Monitoring
        </button>
      </div>
    );
  }

  const pinned = isPinned(device?.deviceUid || '');

  return (
    <div className="space-y-lg">
      {/* Breadcrumb & Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-on-surface-variant">
          <Link to="/monitoring" className="hover:text-primary transition-colors">
            Device Monitoring
          </Link>
          <span className="material-symbols-outlined text-[16px] text-outline">chevron_right</span>
          <span className="font-semibold text-on-surface">{device?.name}</span>
        </div>

        <div className="flex items-center gap-sm">
          {/* Pin Button */}
          <button
            onClick={() => device && togglePin(device.deviceUid)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
              pinned
                ? 'bg-primary-container/20 border-primary text-primary'
                : 'bg-surface border-outline-variant text-on-surface-variant hover:bg-surface-container-low'
            }`}
          >
            <span
              className="material-symbols-outlined text-[16px]"
              style={{ fontVariationSettings: pinned ? "'FILL' 1" : "'FILL' 0" }}
            >
              push_pin
            </span>
            {pinned ? 'Pinned' : 'Pin to Top'}
          </button>

          <Link
            to="/monitoring"
            className="flex items-center gap-1 px-3 py-1.5 bg-surface border border-outline-variant rounded-lg text-xs font-semibold text-on-surface-variant hover:bg-surface-container-low"
          >
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            Back
          </Link>
        </div>
      </div>

      {/* Hero Header */}
      <div className="bg-surface border border-outline-variant rounded-xl p-lg flex flex-col md:flex-row md:items-center justify-between gap-md shadow-sm">
        <div className="flex items-center gap-md">
          <div className="p-3 rounded-2xl bg-primary-container/25 text-primary">
            <span className="material-symbols-outlined text-3xl">device_thermostat</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-headline-lg text-headline-lg text-on-surface font-bold">
                {device?.name}
              </h2>
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${
                  device?.status === 'ONLINE'
                    ? 'text-[#059669] bg-[#ecfdf5]'
                    : 'text-error bg-error-container/40'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    device?.status === 'ONLINE' ? 'bg-[#10b981] animate-pulse' : 'bg-error'
                  }`}
                />
                {device?.status}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-outline font-data-mono">
              <span>UID: {device?.deviceUid}</span>
              <span>Room: {device?.room?.name || 'Unassigned'}</span>
              <span>Type: TEMP_HUMIDITY</span>
            </div>
          </div>
        </div>

        {/* Comfort Pill */}
        <div className={`px-4 py-3 rounded-xl ${comfortInfo.bg} flex items-center gap-3 border border-outline-variant/30`}>
          <span className={`material-symbols-outlined text-2xl ${comfortInfo.color}`}>
            sentiment_satisfied
          </span>
          <div>
            <div className={`text-xs font-bold uppercase ${comfortInfo.color}`}>
              {comfortInfo.status}
            </div>
            <div className="text-xs text-on-surface-variant font-medium">
              {comfortInfo.desc}
            </div>
          </div>
        </div>
      </div>

      {/* Live Readout Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-md">
        {/* Current Temperature */}
        <div className="bg-surface border border-outline-variant rounded-xl p-lg flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between text-on-surface-variant">
            <span className="font-label-caps text-label-caps uppercase">Temperature</span>
            <span className="material-symbols-outlined text-[#0284c7] text-[20px]">thermostat</span>
          </div>
          <div className="my-3 flex items-baseline gap-1">
            <span className="font-display-stat text-display-stat text-on-surface font-extrabold">
              {currentTemp !== null ? currentTemp : '--'}
            </span>
            <span className="text-lg font-bold text-outline">°C</span>
          </div>
          <div className="pt-2 border-t border-outline-variant/60 flex justify-between text-xs text-outline font-data-mono">
            <span>Min: {stats.tempMin}°C</span>
            <span>Avg: {stats.tempAvg}°C</span>
            <span>Max: {stats.tempMax}°C</span>
          </div>
        </div>

        {/* Current Humidity */}
        <div className="bg-surface border border-outline-variant rounded-xl p-lg flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between text-on-surface-variant">
            <span className="font-label-caps text-label-caps uppercase">Relative Humidity</span>
            <span className="material-symbols-outlined text-[#10b981] text-[20px]">humidity_mid</span>
          </div>
          <div className="my-3 flex items-baseline gap-1">
            <span className="font-display-stat text-display-stat text-on-surface font-extrabold">
              {currentHum !== null ? currentHum : '--'}
            </span>
            <span className="text-lg font-bold text-outline">%</span>
          </div>
          <div className="pt-2 border-t border-outline-variant/60 flex justify-between text-xs text-outline font-data-mono">
            <span>Min: {stats.humMin}%</span>
            <span>Avg: {stats.humAvg}%</span>
            <span>Max: {stats.humMax}%</span>
          </div>
        </div>

        {/* Dew Point Estimate */}
        <div className="bg-surface border border-outline-variant rounded-xl p-lg flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between text-on-surface-variant">
            <span className="font-label-caps text-label-caps uppercase">Est. Dew Point</span>
            <span className="material-symbols-outlined text-primary text-[20px]">water_drop</span>
          </div>
          <div className="my-3 flex items-baseline gap-1">
            <span className="font-display-stat text-display-stat text-on-surface font-extrabold">
              {currentTemp !== null && currentHum !== null
                ? (currentTemp - (100 - currentHum) / 5).toFixed(1)
                : '--'}
            </span>
            <span className="text-lg font-bold text-outline">°C</span>
          </div>
          <div className="pt-2 border-t border-outline-variant/60 text-xs text-outline">
            Condensation threshold index
          </div>
        </div>

        {/* Database & Telemetry Health */}
        <div className="bg-surface border border-outline-variant rounded-xl p-lg flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between text-on-surface-variant">
            <span className="font-label-caps text-label-caps uppercase">Telemetry Storage</span>
            <span className="material-symbols-outlined text-primary text-[20px]">database</span>
          </div>
          <div className="my-3 space-y-1">
            <div className="text-sm font-bold text-on-surface flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#10b981] animate-ping" />
              <span>PostgreSQL &amp; WebSocket</span>
            </div>
            <div className="text-xs text-outline font-data-mono">
              Total Records: {stats.totalCount} points
            </div>
          </div>
          <div className="pt-2 border-t border-outline-variant/60 text-xs text-outline">
            Updated {liveState.lastUpdated ? new Date(liveState.lastUpdated).toLocaleTimeString() : 'Just now'}
          </div>
        </div>
      </div>

      {/* Telemetry Chart Section */}
      <div className="bg-surface border border-outline-variant rounded-xl p-lg space-y-md shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-md border-b border-outline-variant pb-md">
          <div>
            <h3 className="font-headline-md text-headline-md text-on-surface font-bold flex items-center gap-2">
              <span>Environmental Telemetry Trends</span>
              {isLoadingHistory && (
                <span className="material-symbols-outlined text-primary text-sm animate-spin">
                  progress_activity
                </span>
              )}
            </h3>
            <p className="text-xs text-on-surface-variant">
              Historical database records combined with live zero-latency WebSocket stream.
            </p>
          </div>

          {/* Timeframe selector */}
          <div className="flex items-center p-1 bg-surface-container-low border border-outline-variant rounded-lg text-xs font-semibold">
            {(['1h', '24h', '7d', 'all'] as const).map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-3 py-1 rounded-md transition-colors uppercase cursor-pointer ${
                  timeframe === tf
                    ? 'bg-primary text-on-primary shadow-xs'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>

        {/* Chart Canvas */}
        <div className="h-[320px] w-full pt-2">
          {telemetryHistory.length === 0 ? (
            <div className="h-full flex items-center justify-center text-outline text-sm">
              Waiting for telemetry data from MQTT / Database...
            </div>
          ) : (
            <Line data={chartData} options={chartOptions} />
          )}
        </div>
      </div>

      {/* Telemetry Database & Stream Table */}
      <div className="bg-surface border border-outline-variant rounded-xl overflow-hidden shadow-sm">
        <div className="p-md bg-surface-container-low border-b border-outline-variant flex justify-between items-center">
          <h4 className="font-headline-md text-headline-md text-on-surface font-bold">
            Historical Telemetry Logs ({timeframe.toUpperCase()})
          </h4>
          <span className="text-xs text-outline font-data-mono">
            {telemetryHistory.length} readings loaded
          </span>
        </div>

        <div className="overflow-x-auto max-h-[260px] overflow-y-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-container-low/60 border-b border-outline-variant text-on-surface-variant font-label-caps text-label-caps uppercase sticky top-0 bg-surface">
              <tr>
                <th className="px-lg py-2.5">Time</th>
                <th className="px-lg py-2.5">Temperature</th>
                <th className="px-lg py-2.5">Humidity</th>
                <th className="px-lg py-2.5">Estimated Dew Point</th>
                <th className="px-lg py-2.5 text-right">Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/60">
              {telemetryHistory
                .slice()
                .reverse()
                .map((point, idx) => (
                  <tr key={idx} className="hover:bg-surface-container-low/40">
                    <td className="px-lg py-2 font-data-mono text-xs text-outline">
                      {point.timeLabel}
                    </td>
                    <td className="px-lg py-2 font-semibold text-[#0284c7]">
                      {point.temperature}°C
                    </td>
                    <td className="px-lg py-2 font-semibold text-[#10b981]">
                      {point.humidity}%
                    </td>
                    <td className="px-lg py-2 text-on-surface-variant text-xs font-data-mono">
                      {(point.temperature - (100 - point.humidity) / 5).toFixed(1)}°C
                    </td>
                    <td className="px-lg py-2 text-right">
                      <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-[#ecfdf5] text-[#059669]">
                        {point.id ? 'POSTGRES_DB' : 'LIVE_MQTT'}
                      </span>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
