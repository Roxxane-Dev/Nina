import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../../core/theme/design_system.dart';

/// Animated thinking indicator shown while Nina is generating a response
class LoadingDots extends StatelessWidget {
  const LoadingDots({super.key, this.label = 'Nina está pensando...'});
  final String label;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 16,
            height: 16,
            decoration: const BoxDecoration(
              shape: BoxShape.circle,
              gradient: NinaColors.ninaAura,
            ),
          )
              .animate(onPlay: (c) => c.repeat(reverse: true))
              .fade(duration: 800.ms, begin: 1.0, end: 0.3),
          const SizedBox(width: 12),
          Text(
            label,
            style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                  color: NinaColors.textSecondary,
                  fontStyle: FontStyle.italic,
                ),
          )
              .animate(onPlay: (c) => c.repeat())
              .shimmer(duration: 1500.ms, color: NinaColors.primaryLight),
        ],
      ),
    );
  }
}
