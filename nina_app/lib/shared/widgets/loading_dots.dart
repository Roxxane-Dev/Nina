import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../../core/theme/design_system.dart';
import 'nina_ui.dart';

/// Animated thinking indicator shown while Nina is generating a response
class LoadingDots extends StatelessWidget {
  const LoadingDots({super.key, this.label = 'Nina está pensando...'});
  final String label;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 8),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const NinaMark(size: 24)
              .animate(onPlay: (c) => c.repeat(reverse: true))
              .fade(duration: 800.ms, begin: 1.0, end: 0.4),
          const SizedBox(width: 10),
          Text(label, style: NinaText.bodyS(color: NinaColors.textTertiary))
              .animate(onPlay: (c) => c.repeat())
              .shimmer(duration: 1500.ms, color: NinaColors.accentSoft),
        ],
      ),
    );
  }
}
