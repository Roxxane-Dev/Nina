import 'package:flutter/material.dart';
import '../../../core/theme/design_system.dart';
import '../../../domain/models/home_intelligence.dart';

class RecoveryCard extends StatelessWidget {
  final RecoveryInfo recovery;

  const RecoveryCard({super.key, required this.recovery});

  @override
  Widget build(BuildContext context) {
    if (!recovery.isRecovering) return const SizedBox.shrink();

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: NinaColors.accent.withAlpha(15),
        borderRadius: BorderRadius.circular(28),
        border: Border.all(color: NinaColors.accent.withAlpha(40)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: NinaColors.accent.withAlpha(30),
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.favorite_rounded,
                  color: NinaColors.accent,
                  size: 20,
                ),
              ),
              const SizedBox(width: 12),
              const Text(
                'Fase de Recuperación',
                style: TextStyle(
                  color: NinaColors.textPrimary,
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Text(
            recovery.supportiveMessage,
            style: const TextStyle(
              color: NinaColors.textSecondary,
              fontSize: 14,
            ),
          ),
          const SizedBox(height: 16),
          LinearProgressIndicator(
            value: recovery.improvementPercentage / 100,
            backgroundColor: NinaColors.accent.withAlpha(20),
            color: NinaColors.accent,
            minHeight: 8,
            borderRadius: BorderRadius.circular(4),
          ),
        ],
      ),
    );
  }
}
