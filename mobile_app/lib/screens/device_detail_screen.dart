import 'package:flutter/material.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:provider/provider.dart';
import '../config/app_theme.dart';
import '../models/device.dart';
import '../models/telemetry.dart';
import '../providers/device_provider.dart';
import '../widgets/app_card.dart';
import '../widgets/status_chip.dart';

class DeviceDetailScreen extends StatefulWidget {
  final Device device;
  const DeviceDetailScreen({super.key, required this.device});

  @override
  State<DeviceDetailScreen> createState() => _DeviceDetailScreenState();
}

class _DeviceDetailScreenState extends State<DeviceDetailScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabCtrl;
  String _selectedPeriod = '1h';
  final _periodOptions = ['1h', '6h', '24h', '7d'];

  @override
  void initState() {
    super.initState();
    _tabCtrl = TabController(length: 2, vsync: this);
    _loadTelemetry();
  }

  @override
  void dispose() {
    _tabCtrl.dispose();
    super.dispose();
  }

  void _loadTelemetry() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<DeviceProvider>().fetchTelemetry(
            widget.device.deviceUid,
            period: _selectedPeriod,
          );
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surfaceContainerLow,
      body: CustomScrollView(
        slivers: [
          _buildAppBar(context),
          SliverPadding(
            padding: const EdgeInsets.all(16),
            sliver: SliverList(
              delegate: SliverChildListDelegate([
                // Device info card
                _buildDeviceInfoCard(),
                const SizedBox(height: 16),

                // Current reading card
                _CurrentReadingCard(deviceUid: widget.device.deviceUid),
                const SizedBox(height: 16),

                // Period selector
                _buildPeriodSelector(),
                const SizedBox(height: 12),

                // Charts
                _TempChartCard(deviceUid: widget.device.deviceUid),
                const SizedBox(height: 12),
                _HumChartCard(deviceUid: widget.device.deviceUid),
                const SizedBox(height: 12),

                // Stats table
                _StatsTableCard(deviceUid: widget.device.deviceUid),
                const SizedBox(height: 24),
              ]),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAppBar(BuildContext context) {
    return SliverAppBar(
      pinned: true,
      backgroundColor: AppColors.surface,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      leading: IconButton(
        icon: const Icon(Icons.arrow_back_rounded, color: AppColors.onSurface),
        onPressed: () => Navigator.pop(context),
      ),
      title: Text(widget.device.name,
          style: const TextStyle(
              fontSize: 17, fontWeight: FontWeight.w600, color: AppColors.onSurface)),
      actions: [
        IconButton(
          icon: Consumer<DeviceProvider>(
            builder: (_, p, _) => Icon(
              p.isPinned(widget.device.id) ? Icons.push_pin : Icons.push_pin_outlined,
              color: p.isPinned(widget.device.id) ? AppColors.primary : AppColors.onSurfaceVariant,
            ),
          ),
          onPressed: () => context.read<DeviceProvider>().togglePin(widget.device.id),
          tooltip: 'Pin device',
        ),
        const SizedBox(width: 4),
      ],
      bottom: PreferredSize(
        preferredSize: const Size.fromHeight(1),
        child: const Divider(height: 1, color: AppColors.outlineVariant),
      ),
    );
  }

  Widget _buildDeviceInfoCard() {
    return AppCard(
      padding: const EdgeInsets.all(16),
      child: Row(
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: AppColors.tempContainer,
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Icon(Icons.thermostat, color: AppColors.tempColor, size: 24),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(widget.device.name,
                    style: const TextStyle(
                        fontSize: 15, fontWeight: FontWeight.w600, color: AppColors.onSurface)),
                const SizedBox(height: 3),
                Text(
                  widget.device.room?.name ?? 'No Room',
                  style: const TextStyle(fontSize: 12, color: AppColors.onSurfaceVariant),
                ),
                const SizedBox(height: 3),
                Text(
                  'UID: ${widget.device.deviceUid}',
                  style: const TextStyle(
                      fontSize: 11, color: AppColors.outline, fontFamily: 'monospace'),
                ),
              ],
            ),
          ),
          StatusChip(status: widget.device.status),
        ],
      ),
    );
  }

  Widget _buildPeriodSelector() {
    return Row(
      children: [
        const Text('Period:',
            style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: AppColors.onSurfaceVariant,
                letterSpacing: 0.3)),
        const SizedBox(width: 10),
        ..._periodOptions.map((p) {
          final isSelected = p == _selectedPeriod;
          return Padding(
            padding: const EdgeInsets.only(right: 8),
            child: GestureDetector(
              onTap: () {
                setState(() => _selectedPeriod = p);
                context.read<DeviceProvider>().fetchTelemetry(
                      widget.device.deviceUid,
                      period: p,
                    );
              },
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 150),
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                decoration: BoxDecoration(
                  color: isSelected ? AppColors.primary : AppColors.surface,
                  borderRadius: BorderRadius.circular(50),
                  border: Border.all(
                    color: isSelected ? AppColors.primary : AppColors.outlineVariant,
                  ),
                ),
                child: Text(p,
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: isSelected ? AppColors.onPrimary : AppColors.onSurfaceVariant,
                    )),
              ),
            ),
          );
        }),
      ],
    );
  }
}

// ─── Current Reading Card ─────────────────────────────────────────────────────
class _CurrentReadingCard extends StatelessWidget {
  final String deviceUid;
  const _CurrentReadingCard({required this.deviceUid});

  @override
  Widget build(BuildContext context) {
    return Consumer<DeviceProvider>(
      builder: (_, provider, _) {
        final stats = provider.getStatsFor(deviceUid);
        if (provider.isLoadingTelemetry) {
          return const AppCard(
            child: Center(
              child: Padding(
                padding: EdgeInsets.all(24),
                child: CircularProgressIndicator(color: AppColors.primary),
              ),
            ),
          );
        }

        final temp = stats?.currentTemp;
        final hum = stats?.currentHum;
        final updatedAt = stats?.currentRecordedAt;

        return Row(
          children: [
            Expanded(
              child: AppCard(
                padding: const EdgeInsets.all(20),
                color: AppColors.tempContainer,
                borderColor: AppColors.tempColor.withValues(alpha: 0.2),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Row(children: [
                      Icon(Icons.thermostat, size: 16, color: AppColors.tempColor),
                      SizedBox(width: 6),
                      Text('Temperature',
                          style: TextStyle(
                              fontSize: 11,
                              color: AppColors.tempColor,
                              fontWeight: FontWeight.w600)),
                    ]),
                    const SizedBox(height: 8),
                    Text(
                      temp != null ? '${temp.toStringAsFixed(1)}°C' : '—',
                      style: const TextStyle(
                          fontSize: 32,
                          fontWeight: FontWeight.w700,
                          color: AppColors.tempColor,
                          height: 1),
                    ),
                    if (updatedAt != null)
                      Text(_formatTime(updatedAt),
                          style: const TextStyle(fontSize: 10, color: AppColors.tempColor)),
                  ],
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: AppCard(
                padding: const EdgeInsets.all(20),
                color: AppColors.humContainer,
                borderColor: AppColors.humColor.withValues(alpha: 0.2),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Row(children: [
                      Icon(Icons.water_drop_outlined, size: 16, color: AppColors.humColor),
                      SizedBox(width: 6),
                      Text('Humidity',
                          style: TextStyle(
                              fontSize: 11,
                              color: AppColors.humColor,
                              fontWeight: FontWeight.w600)),
                    ]),
                    const SizedBox(height: 8),
                    Text(
                      hum != null ? '${hum.toStringAsFixed(1)}%' : '—',
                      style: const TextStyle(
                          fontSize: 32,
                          fontWeight: FontWeight.w700,
                          color: AppColors.humColor,
                          height: 1),
                    ),
                    if (updatedAt != null)
                      Text(_formatTime(updatedAt),
                          style: const TextStyle(fontSize: 10, color: AppColors.humColor)),
                  ],
                ),
              ),
            ),
          ],
        );
      },
    );
  }

  String _formatTime(DateTime dt) {
    final now = DateTime.now();
    final diff = now.difference(dt);
    if (diff.inMinutes < 1) return 'Just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    return '${diff.inHours}h ago';
  }
}

// ─── Chart Cards ─────────────────────────────────────────────────────────────
class _TempChartCard extends StatelessWidget {
  final String deviceUid;
  const _TempChartCard({required this.deviceUid});

  @override
  Widget build(BuildContext context) {
    return Consumer<DeviceProvider>(
      builder: (_, provider, _) {
        final history = provider.getHistoryFor(deviceUid) ?? [];
        return AppCard(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(children: [
                const Icon(Icons.show_chart_rounded, size: 16, color: AppColors.tempColor),
                const SizedBox(width: 6),
                const Text('Temperature Trend',
                    style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: AppColors.onSurface)),
              ]),
              const SizedBox(height: 16),
              SizedBox(
                height: 140,
                child: history.isEmpty
                    ? const Center(
                        child: Text('No data', style: TextStyle(color: AppColors.outline)))
                    : _buildLineChart(history, isTemp: true),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _HumChartCard extends StatelessWidget {
  final String deviceUid;
  const _HumChartCard({required this.deviceUid});

  @override
  Widget build(BuildContext context) {
    return Consumer<DeviceProvider>(
      builder: (_, provider, _) {
        final history = provider.getHistoryFor(deviceUid) ?? [];
        return AppCard(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(children: [
                const Icon(Icons.water_drop_rounded, size: 16, color: AppColors.humColor),
                const SizedBox(width: 6),
                const Text('Humidity Trend',
                    style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: AppColors.onSurface)),
              ]),
              const SizedBox(height: 16),
              SizedBox(
                height: 140,
                child: history.isEmpty
                    ? const Center(
                        child: Text('No data', style: TextStyle(color: AppColors.outline)))
                    : _buildLineChart(history, isTemp: false),
              ),
            ],
          ),
        );
      },
    );
  }
}

LineChart _buildLineChart(List<TempHumidityReading> history, {required bool isTemp}) {
  final color = isTemp ? AppColors.tempColor : AppColors.humColor;
  final spots = history.asMap().entries.map((e) {
    final val = isTemp ? e.value.temperature : e.value.humidity;
    return FlSpot(e.key.toDouble(), val);
  }).toList();

  final minY = spots.map((s) => s.y).reduce((a, b) => a < b ? a : b) - 1;
  final maxY = spots.map((s) => s.y).reduce((a, b) => a > b ? a : b) + 1;

  return LineChart(
    LineChartData(
      minY: minY,
      maxY: maxY,
      gridData: FlGridData(
        show: true,
        drawVerticalLine: false,
        horizontalInterval: (maxY - minY) / 4,
        getDrawingHorizontalLine: (_) => FlLine(
          color: AppColors.outlineVariant.withValues(alpha: 0.5),
          strokeWidth: 1,
          dashArray: [4, 4],
        ),
      ),
      borderData: FlBorderData(show: false),
      titlesData: FlTitlesData(
        leftTitles: AxisTitles(
          sideTitles: SideTitles(
            showTitles: true,
            reservedSize: 40,
            getTitlesWidget: (val, _) => Text(
              val.toStringAsFixed(1),
              style: const TextStyle(fontSize: 10, color: AppColors.outline),
            ),
          ),
        ),
        bottomTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
        topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
        rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
      ),
      lineBarsData: [
        LineChartBarData(
          spots: spots,
          isCurved: true,
          color: color,
          barWidth: 2,
          dotData: const FlDotData(show: false),
          belowBarData: BarAreaData(
            show: true,
            gradient: LinearGradient(
              colors: [
                color.withValues(alpha: 0.15),
                color.withValues(alpha: 0.0),
              ],
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
            ),
          ),
        ),
      ],
    ),
  );
}

// ─── Stats Table Card ─────────────────────────────────────────────────────────
class _StatsTableCard extends StatelessWidget {
  final String deviceUid;
  const _StatsTableCard({required this.deviceUid});

  @override
  Widget build(BuildContext context) {
    return Consumer<DeviceProvider>(
      builder: (_, provider, _) {
        final stats = provider.getStatsFor(deviceUid);
        if (stats == null) return const SizedBox.shrink();

        return AppCard(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Statistics',
                  style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: AppColors.onSurface)),
              const SizedBox(height: 14),
              Table(
                columnWidths: const {
                  0: FlexColumnWidth(2),
                  1: FlexColumnWidth(2),
                  2: FlexColumnWidth(2),
                  3: FlexColumnWidth(2),
                },
                children: [
                  _tableHeader(),
                  _tableRow('Temperature', stats.tempMin, stats.tempMax, stats.tempAvg, '°C',
                      AppColors.tempColor),
                  _tableRow('Humidity', stats.humMin, stats.humMax, stats.humAvg, '%',
                      AppColors.humColor),
                ],
              ),
              if (stats.totalReadings > 0) ...[
                const SizedBox(height: 10),
                Text('${stats.totalReadings} readings total',
                    style: const TextStyle(fontSize: 11, color: AppColors.outline)),
              ],
            ],
          ),
        );
      },
    );
  }

  TableRow _tableHeader() {
    return TableRow(
      decoration: BoxDecoration(
          color: AppColors.surfaceContainerLow,
          borderRadius: BorderRadius.circular(6)),
      children: ['Metric', 'Min', 'Max', 'Avg'].map((h) {
        return Padding(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 7),
          child: Text(h,
              style: const TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  color: AppColors.onSurfaceVariant,
                  letterSpacing: 0.3)),
        );
      }).toList(),
    );
  }

  TableRow _tableRow(
      String metric, double? min, double? max, double? avg, String unit, Color color) {
    String fmt(double? v) => v != null ? '${v.toStringAsFixed(1)}$unit' : '—';
    return TableRow(
      decoration: const BoxDecoration(
          border: Border(bottom: BorderSide(color: AppColors.outlineVariant))),
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
          child: Text(metric,
              style: TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: color)),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
          child: Text(fmt(min),
              style: const TextStyle(fontSize: 12, color: AppColors.onSurface)),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
          child: Text(fmt(max),
              style: const TextStyle(fontSize: 12, color: AppColors.onSurface)),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
          child: Text(fmt(avg),
              style: const TextStyle(
                  fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.onSurface)),
        ),
      ],
    );
  }
}
