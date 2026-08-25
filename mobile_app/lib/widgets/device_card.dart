import 'package:flutter/material.dart';
import '../config/app_theme.dart';
import '../models/device.dart';
import 'app_card.dart';
import 'status_chip.dart';

/// Device card — MD3 style matching web admin DeviceCardRenderer
class DeviceCard extends StatelessWidget {
  final Device device;
  final bool isPinned;
  final VoidCallback? onTap;
  final VoidCallback? onTogglePin;

  const DeviceCard({
    super.key,
    required this.device,
    this.isPinned = false,
    this.onTap,
    this.onTogglePin,
  });

  @override
  Widget build(BuildContext context) {
    return AppCard(
      onTap: onTap,
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header row
          Row(
            children: [
              _DeviceTypeIcon(deviceType: device.deviceType),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      device.name,
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: AppColors.onSurface,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    if (device.room != null)
                      Text(
                        device.room!.name,
                        style: const TextStyle(
                          fontSize: 12,
                          color: AppColors.onSurfaceVariant,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                  ],
                ),
              ),
              // Pin button
              if (onTogglePin != null)
                GestureDetector(
                  onTap: onTogglePin,
                  child: Padding(
                    padding: const EdgeInsets.all(4),
                    child: Icon(
                      isPinned ? Icons.push_pin : Icons.push_pin_outlined,
                      size: 18,
                      color: isPinned ? AppColors.primary : AppColors.outline,
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 12),
          // Sensor reading row (for temp/humidity devices)
          if (device.deviceType == 'TEMP_HUMIDITY') ...[
            _TempHumidityRow(device: device),
            const SizedBox(height: 12),
          ],
          // Footer: status + last seen
          Row(
            children: [
              StatusChip(status: device.status, compact: true),
              const Spacer(),
              if (device.lastSeenAt != null)
                Text(
                  _formatLastSeen(device.lastSeenAt!),
                  style: const TextStyle(
                    fontSize: 11,
                    color: AppColors.outline,
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }

  String _formatLastSeen(DateTime dt) {
    final diff = DateTime.now().difference(dt);
    if (diff.inMinutes < 1) return 'Just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    return '${diff.inDays}d ago';
  }
}

class _TempHumidityRow extends StatelessWidget {
  final Device device;
  const _TempHumidityRow({required this.device});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: _ReadingBadge(
            icon: Icons.thermostat_outlined,
            label: 'Temp',
            value: device.currentTemperature != null
                ? '${device.currentTemperature!.toStringAsFixed(1)}°C'
                : '—',
            color: AppColors.tempColor,
            bgColor: AppColors.tempContainer,
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: _ReadingBadge(
            icon: Icons.water_drop_outlined,
            label: 'Humidity',
            value: device.currentHumidity != null
                ? '${device.currentHumidity!.toStringAsFixed(1)}%'
                : '—',
            color: AppColors.humColor,
            bgColor: AppColors.humContainer,
          ),
        ),
      ],
    );
  }
}

class _ReadingBadge extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final Color color;
  final Color bgColor;

  const _ReadingBadge({
    required this.icon,
    required this.label,
    required this.value,
    required this.color,
    required this.bgColor,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        children: [
          Icon(icon, size: 14, color: color),
          const SizedBox(width: 5),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label,
                  style: TextStyle(fontSize: 10, color: color, fontWeight: FontWeight.w500)),
              Text(value,
                  style: TextStyle(
                      fontSize: 13, color: color, fontWeight: FontWeight.w700)),
            ],
          ),
        ],
      ),
    );
  }
}

class _DeviceTypeIcon extends StatelessWidget {
  final String deviceType;
  const _DeviceTypeIcon({required this.deviceType});

  @override
  Widget build(BuildContext context) {
    IconData icon;
    Color color;
    Color bgColor;

    switch (deviceType) {
      case 'TEMP_HUMIDITY':
        icon = Icons.thermostat;
        color = AppColors.tempColor;
        bgColor = AppColors.tempContainer;
        break;
      case 'SMART_DOOR':
        icon = Icons.door_front_door_outlined;
        color = AppColors.primary;
        bgColor = AppColors.primaryFixed;
        break;
      default:
        icon = Icons.device_hub_outlined;
        color = AppColors.secondary;
        bgColor = AppColors.primaryFixed;
    }

    return Container(
      width: 40,
      height: 40,
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Icon(icon, size: 20, color: color),
    );
  }
}
