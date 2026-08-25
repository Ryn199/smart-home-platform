import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../config/app_theme.dart';
import '../providers/auth_provider.dart';
import '../providers/device_provider.dart';
import '../widgets/app_card.dart';
import '../widgets/device_card.dart';


class DashboardScreen extends StatelessWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surfaceContainerLow,
      body: RefreshIndicator(
        color: AppColors.primary,
        onRefresh: () => context.read<DeviceProvider>().fetchDevices(),
        child: CustomScrollView(
          slivers: [
            _buildAppBar(context),
            SliverPadding(
              padding: const EdgeInsets.all(16),
              sliver: SliverList(
                delegate: SliverChildListDelegate([
                  // Stats section
                  _StatsSection(),
                  const SizedBox(height: 20),

                  // Avg Temp & Humidity banner
                  _EnvBannerSection(),
                  const SizedBox(height: 20),

                  // Pinned Devices
                  _PinnedDevicesSection(),
                  const SizedBox(height: 20),

                  // Recent devices (temp/humidity)
                  _TempHumiditySection(),
                  const SizedBox(height: 16),
                ]),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildAppBar(BuildContext context) {
    return SliverAppBar(
      floating: true,
      snap: true,
      pinned: false,
      backgroundColor: AppColors.surface,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      title: Consumer<AuthProvider>(
        builder: (_, auth, _) => Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Smart Home',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w700,
                color: AppColors.onSurface,
              ),
            ),
            if (auth.user != null)
              Text(
                'Hello, ${auth.user!.name}',
                style: const TextStyle(
                  fontSize: 12,
                  color: AppColors.onSurfaceVariant,
                  fontWeight: FontWeight.w400,
                ),
              ),
          ],
        ),
      ),
      bottom: PreferredSize(
        preferredSize: const Size.fromHeight(1),
        child: Divider(
          height: 1,
          thickness: 1,
          color: AppColors.outlineVariant,
        ),
      ),
      actions: [
        IconButton(
          icon: const Icon(Icons.refresh_rounded, color: AppColors.onSurfaceVariant),
          onPressed: () => context.read<DeviceProvider>().fetchDevices(),
          tooltip: 'Refresh',
        ),
        IconButton(
          icon: const Icon(Icons.logout_rounded, color: AppColors.onSurfaceVariant),
          onPressed: () => _confirmLogout(context),
          tooltip: 'Logout',
        ),
        const SizedBox(width: 4),
      ],
    );
  }

  void _confirmLogout(BuildContext context) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.surface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Logout',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600,
                color: AppColors.onSurface)),
        content: const Text('Apakah Anda yakin ingin logout?',
            style: TextStyle(fontSize: 14, color: AppColors.onSurfaceVariant)),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Batal',
                style: TextStyle(color: AppColors.onSurfaceVariant)),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(ctx);
              context.read<AuthProvider>().logout();
            },
            child: const Text('Logout'),
          ),
        ],
      ),
    );
  }
}

// ─── Stats Section ──────────────────────────────────────────────────────────
class _StatsSection extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Consumer<DeviceProvider>(
      builder: (_, provider, _) {
        final total = provider.devices.length;
        final online = provider.onlineCount;
        final offline = provider.offlineCount;
        final pinned = provider.pinnedDevices.length;

        return GridView.count(
          crossAxisCount: 2,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          crossAxisSpacing: 12,
          mainAxisSpacing: 12,
          childAspectRatio: 1.6,
          children: [
            _StatCard(
              label: 'Total Devices',
              value: '$total',
              icon: Icons.devices_rounded,
              iconColor: AppColors.primary,
              iconBg: AppColors.primaryFixed,
            ),
            _StatCard(
              label: 'Online',
              value: '$online',
              icon: Icons.wifi_rounded,
              iconColor: AppColors.online,
              iconBg: AppColors.onlineContainer,
              badge: online > 0 ? 'Active' : null,
            ),
            _StatCard(
              label: 'Offline',
              value: '$offline',
              icon: Icons.wifi_off_rounded,
              iconColor: AppColors.offline,
              iconBg: AppColors.offlineContainer,
            ),
            _StatCard(
              label: 'Pinned',
              value: '$pinned',
              icon: Icons.push_pin_rounded,
              iconColor: AppColors.secondary,
              iconBg: AppColors.primaryFixed,
            ),
          ],
        );
      },
    );
  }
}

class _StatCard extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  final Color iconColor;
  final Color iconBg;
  final String? badge;

  const _StatCard({
    required this.label,
    required this.value,
    required this.icon,
    required this.iconColor,
    required this.iconBg,
    this.badge,
  });

  @override
  Widget build(BuildContext context) {
    return AppCard(
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(label,
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: AppColors.onSurfaceVariant,
                    letterSpacing: 0.3,
                  )),
              Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(color: iconBg, borderRadius: BorderRadius.circular(8)),
                child: Icon(icon, size: 16, color: iconColor),
              ),
            ],
          ),
          Text(value,
              style: const TextStyle(
                fontSize: 28,
                fontWeight: FontWeight.w700,
                color: AppColors.onSurface,
                height: 1,
              )),
        ],
      ),
    );
  }
}

// ─── Environment Banner ──────────────────────────────────────────────────────
class _EnvBannerSection extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Consumer<DeviceProvider>(
      builder: (_, provider, _) {
        final avgTemp = provider.averageTemperature;
        final avgHum = provider.averageHumidity;
        if (avgTemp == null && avgHum == null) return const SizedBox.shrink();

        return Row(
          children: [
            if (avgTemp != null)
              Expanded(
                child: AppCard(
                  padding: const EdgeInsets.all(16),
                  color: AppColors.tempContainer,
                  borderColor: AppColors.tempColor.withValues(alpha: 0.2),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(children: [
                        const Icon(Icons.thermostat, size: 16, color: AppColors.tempColor),
                        const SizedBox(width: 6),
                        const Text('Avg Temperature',
                            style: TextStyle(
                                fontSize: 11,
                                color: AppColors.tempColor,
                                fontWeight: FontWeight.w600)),
                      ]),
                      const SizedBox(height: 6),
                      Text('${avgTemp.toStringAsFixed(1)}°C',
                          style: const TextStyle(
                              fontSize: 26,
                              fontWeight: FontWeight.w700,
                              color: AppColors.tempColor)),
                    ],
                  ),
                ),
              ),
            if (avgTemp != null && avgHum != null) const SizedBox(width: 12),
            if (avgHum != null)
              Expanded(
                child: AppCard(
                  padding: const EdgeInsets.all(16),
                  color: AppColors.humContainer,
                  borderColor: AppColors.humColor.withValues(alpha: 0.2),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(children: [
                        const Icon(Icons.water_drop_outlined, size: 16, color: AppColors.humColor),
                        const SizedBox(width: 6),
                        const Text('Avg Humidity',
                            style: TextStyle(
                                fontSize: 11,
                                color: AppColors.humColor,
                                fontWeight: FontWeight.w600)),
                      ]),
                      const SizedBox(height: 6),
                      Text('${avgHum.toStringAsFixed(1)}%',
                          style: const TextStyle(
                              fontSize: 26,
                              fontWeight: FontWeight.w700,
                              color: AppColors.humColor)),
                    ],
                  ),
                ),
              ),
          ],
        );
      },
    );
  }
}

// ─── Pinned Devices ──────────────────────────────────────────────────────────
class _PinnedDevicesSection extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Consumer<DeviceProvider>(
      builder: (_, provider, _) {
        final pinned = provider.pinnedDevices;
        if (pinned.isEmpty) return const SizedBox.shrink();

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _SectionHeader(
              title: 'Pinned Devices',
              icon: Icons.push_pin_rounded,
              count: pinned.length,
            ),
            const SizedBox(height: 10),
            ListView.separated(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: pinned.length,
              separatorBuilder: (_, _) => const SizedBox(height: 8),
              itemBuilder: (ctx, i) {
                final device = pinned[i];
                return DeviceCard(
                  device: device,
                  isPinned: true,
                  onTogglePin: () => provider.togglePin(device.id),
                  onTap: () => Navigator.pushNamed(
                    ctx,
                    '/device-detail',
                    arguments: device,
                  ),
                );
              },
            ),
          ],
        );
      },
    );
  }
}

// ─── Temp Humidity Section ───────────────────────────────────────────────────
class _TempHumiditySection extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Consumer<DeviceProvider>(
      builder: (_, provider, _) {
        if (provider.isLoading) {
          return const Center(
              child: Padding(
            padding: EdgeInsets.all(32),
            child: CircularProgressIndicator(color: AppColors.primary),
          ));
        }

        final devices = provider.tempHumidityDevices;
        if (devices.isEmpty) {
          return AppCard(
            padding: const EdgeInsets.all(32),
            child: Center(
              child: Column(
                children: const [
                  Icon(Icons.thermostat_outlined, size: 36, color: AppColors.outline),
                  SizedBox(height: 8),
                  Text('No temperature/humidity devices',
                      style: TextStyle(color: AppColors.onSurfaceVariant, fontSize: 13)),
                ],
              ),
            ),
          );
        }

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _SectionHeader(
              title: 'Temp & Humidity',
              icon: Icons.thermostat_rounded,
              count: devices.length,
            ),
            const SizedBox(height: 10),
            ListView.separated(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: devices.length,
              separatorBuilder: (_, _) => const SizedBox(height: 8),
              itemBuilder: (ctx, i) {
                final d = devices[i];
                return DeviceCard(
                  device: d,
                  isPinned: provider.isPinned(d.id),
                  onTogglePin: () => provider.togglePin(d.id),
                  onTap: () => Navigator.pushNamed(ctx, '/device-detail', arguments: d),
                );
              },
            ),
          ],
        );
      },
    );
  }
}

class _SectionHeader extends StatelessWidget {
  final String title;
  final IconData icon;
  final int? count;

  const _SectionHeader({required this.title, required this.icon, this.count});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, size: 16, color: AppColors.onSurfaceVariant),
        const SizedBox(width: 6),
        Text(title,
            style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w700,
              color: AppColors.onSurface,
              letterSpacing: 0.2,
            )),
        if (count != null) ...[
          const SizedBox(width: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
            decoration: BoxDecoration(
              color: AppColors.surfaceContainerHigh,
              borderRadius: BorderRadius.circular(50),
            ),
            child: Text('$count',
                style: const TextStyle(
                    fontSize: 11, fontWeight: FontWeight.w600, color: AppColors.onSurfaceVariant)),
          ),
        ],
      ],
    );
  }
}
