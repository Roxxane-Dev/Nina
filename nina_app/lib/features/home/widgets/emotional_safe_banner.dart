import 'package:flutter/material.dart';
import '../../../core/theme/design_system.dart';

class EmotionalSafeBanner extends StatelessWidget {
  final String message;
  final IconData icon;
  final Color? color;

  const EmotionalSafeBanner({
    super.key,
    required this.message,
    this.icon = Icons.favorite_rounded,
    this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
      decoration: BoxDecoration(
        color: (color ?? NinaColors.primary).withAlpha(15),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: (color ?? NinaColors.primary).withAlpha(30)),
      ),
      child: Row(
        children: [
          Icon(icon, color: color ?? NinaColors.primary, size: 20),
          const SizedBox(width: 16),
          Expanded(
            child: Text(
              message,
              style: const TextStyle(
                color: NinaColors.textPrimary,
                fontSize: 14,
                height: 1.4,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
