import 'package:flutter/material.dart';
import '../config/app_theme.dart';

/// Pill chip online/offline status — matches web admin style
class StatusChip extends StatelessWidget {
  final String status;
  final bool compact;

  const StatusChip({super.key, required this.status, this.compact = false});

  @override
  Widget build(BuildContext context) {
    final isOnline = status.toUpperCase() == 'ONLINE';
    final isUnknown = status.toUpperCase() == 'UNKNOWN';

    final Color bgColor = isOnline
        ? AppColors.onlineContainer
        : isUnknown
            ? AppColors.unknownContainer
            : AppColors.offlineContainer;
    final Color textColor = isOnline
        ? AppColors.online
        : isUnknown
            ? AppColors.unknown
            : AppColors.offline;
    final Color dotColor = isOnline ? AppColors.online : isUnknown ? AppColors.unknown : AppColors.offline;

    return Container(
      padding: compact
          ? const EdgeInsets.symmetric(horizontal: 8, vertical: 3)
          : const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(50),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (isOnline) ...[
            Container(
              width: 6,
              height: 6,
              decoration: BoxDecoration(color: dotColor, shape: BoxShape.circle),
            ),
            const SizedBox(width: 4),
          ],
          Text(
            isOnline ? 'Online' : isUnknown ? 'Unknown' : 'Offline',
            style: TextStyle(
              fontSize: compact ? 10 : 11,
              fontWeight: FontWeight.w600,
              color: textColor,
              letterSpacing: 0.3,
            ),
          ),
        ],
      ),
    );
  }
}
