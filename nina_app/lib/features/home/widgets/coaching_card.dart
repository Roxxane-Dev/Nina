import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../../../core/theme/design_system.dart';
import '../../../domain/models/home_intelligence.dart';

class CoachingCard extends StatelessWidget {
  final CoachingPayload coaching;

  const CoachingCard({super.key, required this.coaching});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: NinaColors.surfaceAlt.withAlpha(150),
        borderRadius: BorderRadius.circular(32),
        border: Border.all(color: NinaColors.border),
        boxShadow: const [NinaShadows.soft],
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildNinaAvatar(),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'CONSEJO DE NINA',
                  style: TextStyle(
                    color: NinaColors.primaryLight,
                    fontSize: 10,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 1.2,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  coaching.message,
                  style: const TextStyle(
                    color: NinaColors.textPrimary,
                    fontSize: 16,
                    height: 1.5,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildNinaAvatar() {
    return Container(
      width: 48,
      height: 48,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: NinaColors.surface,
        border: Border.all(color: NinaColors.border),
      ),
      child: const Icon(
        Icons.auto_awesome_rounded,
        color: NinaColors.primaryLight,
        size: 24,
      ),
    ).animate(onPlay: (controller) => controller.repeat())
     .shimmer(duration: 2.seconds, color: NinaColors.primaryLight.withAlpha(100));
  }
}
