import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../config/app_theme.dart';
import '../models/device.dart';
import '../providers/device_provider.dart';

import '../widgets/device_card.dart';

class DeviceListScreen extends StatelessWidget {
  const DeviceListScreen({super.key});

  static const _filterOptions = ['ALL', 'TEMP_HUMIDITY', 'SMART_DOOR'];
  static const _filterLabels = {'ALL': 'Semua', 'TEMP_HUMIDITY': 'Suhu & Kelembapan', 'SMART_DOOR': 'Smart Door'};

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surfaceContainerLow,
      body: Column(
        children: [
          _buildTopBar(context),
          Expanded(
            child: Consumer<DeviceProvider>(
              builder: (ctx, provider, _) {
                if (provider.isLoading) {
                  return const Center(
                    child: CircularProgressIndicator(color: AppColors.primary),
                  );
                }
                if (provider.errorMessage != null) {
                  return _buildError(ctx, provider.errorMessage!);
                }
                final devices = provider.filteredDevices;
                if (devices.isEmpty) {
                  return _buildEmpty();
                }
                return _buildDeviceList(ctx, devices, provider);
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTopBar(BuildContext context) {
    return Container(
      color: AppColors.surface,
      child: Column(
        children: [
          // AppBar area
          SafeArea(
            bottom: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
              child: Row(
                children: [
                  const Text('Devices',
                      style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w700,
                          color: AppColors.onSurface)),
                  const Spacer(),
                  IconButton(
                    icon: const Icon(Icons.refresh_rounded, color: AppColors.onSurfaceVariant),
                    onPressed: () => context.read<DeviceProvider>().fetchDevices(),
                    tooltip: 'Refresh',
                  ),
                ],
              ),
            ),
          ),

          // Search bar
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Consumer<DeviceProvider>(
              builder: (_, provider, _) => TextField(
                onChanged: provider.setSearchQuery,
                decoration: InputDecoration(
                  hintText: 'Search devices…',
                  prefixIcon: const Icon(Icons.search, size: 18, color: AppColors.outline),
                  contentPadding: const EdgeInsets.symmetric(vertical: 10, horizontal: 12),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(50),
                    borderSide: const BorderSide(color: AppColors.outlineVariant),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(50),
                    borderSide: const BorderSide(color: AppColors.outlineVariant),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(50),
                    borderSide: const BorderSide(color: AppColors.primary, width: 1.5),
                  ),
                  fillColor: AppColors.surfaceContainerLow,
                  filled: true,
                ),
              ),
            ),
          ),
          const SizedBox(height: 10),

          // Filter chips
          Consumer<DeviceProvider>(
            builder: (_, provider, _) => SizedBox(
              height: 36,
              child: ListView.separated(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                scrollDirection: Axis.horizontal,
                itemCount: _filterOptions.length,
                separatorBuilder: (_, _) => const SizedBox(width: 8),
                itemBuilder: (_, i) {
                  final filter = _filterOptions[i];
                  final isSelected = provider.selectedFilter == filter;
                  return GestureDetector(
                    onTap: () => provider.setFilter(filter),
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 150),
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
                      decoration: BoxDecoration(
                        color: isSelected ? AppColors.primary : AppColors.surfaceContainerLow,
                        borderRadius: BorderRadius.circular(50),
                        border: Border.all(
                          color: isSelected ? AppColors.primary : AppColors.outlineVariant,
                        ),
                      ),
                      child: Text(
                        _filterLabels[filter] ?? filter,
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: isSelected ? AppColors.onPrimary : AppColors.onSurfaceVariant,
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),
          ),
          const SizedBox(height: 10),
          const Divider(height: 1, color: AppColors.outlineVariant),
        ],
      ),
    );
  }

  Widget _buildDeviceList(
      BuildContext context, List<Device> devices, DeviceProvider provider) {
    return ListView.separated(
      padding: const EdgeInsets.all(16),
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
    );
  }

  Widget _buildEmpty() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: const [
            Icon(Icons.devices_other_rounded, size: 48, color: AppColors.outline),
            SizedBox(height: 12),
            Text('Tidak ada device ditemukan',
                style: TextStyle(fontSize: 14, color: AppColors.onSurfaceVariant)),
          ],
        ),
      ),
    );
  }

  Widget _buildError(BuildContext context, String error) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.error_outline_rounded, size: 48, color: AppColors.error),
            const SizedBox(height: 12),
            Text(error,
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 13, color: AppColors.onSurfaceVariant)),
            const SizedBox(height: 16),
            OutlinedButton.icon(
              onPressed: () => context.read<DeviceProvider>().fetchDevices(),
              icon: const Icon(Icons.refresh),
              label: const Text('Retry'),
            ),
          ],
        ),
      ),
    );
  }
}
