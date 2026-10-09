import 'package:flutter/material.dart';
import '../../../core/theme/design_system.dart';
import '../../../domain/models/home_intelligence.dart';

class PreventionCard extends StatelessWidget {
  final PreventionIntelligence prevention;

  const PreventionCard({super.key, required this.prevention});

  @override
  Widget build(BuildContext context) {
    if (prevention.relapseRisk.riskLevel == 'low' && prevention.trajectory == 'stabilizing') {
      return const SizedBox.shrink();
    }

    final isHighRisk = prevention.relapseRisk.riskLevel == 'high' || prevention.relapseRisk.riskLevel == 'critical';

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: isHighRisk ? NinaColors.primary.withAlpha(15) : NinaColors.surface,
        borderRadius: BorderRadius.circular(28),
        border: Border.all(color: isHighRisk ? NinaColors.primary.withAlpha(40) : NinaColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: isHighRisk ? NinaColors.primary.withAlpha(30) : NinaColors.surface,
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  isHighRisk ? Icons.auto_awesome_rounded : Icons.shield_rounded,
                  color: isHighRisk ? NinaColors.primary : NinaColors.textSecondary,
                  size: 20,
                ),
              ),
              const SizedBox(width: 12),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Prevención Inteligente',
                    style: TextStyle(
                      color: NinaColors.textPrimary,
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  Text(
                    'Trayectoria: ${prevention.trajectory.replaceAll('_', ' ').toUpperCase()}',
                    style: TextStyle(
                      color: isHighRisk ? NinaColors.primary : NinaColors.textSecondary,
                      fontSize: 10,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 16),
          Text(
            prevention.relapseRisk.preventionRecommendation,
            style: const TextStyle(
              color: NinaColors.textPrimary,
              fontSize: 14,
              height: 1.5,
            ),
          ),
          if (prevention.predictiveSignals.isNotEmpty) ...[
            const SizedBox(height: 16),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: prevention.predictiveSignals.take(2).map((signal) => _buildSignalChip(signal)).toList(),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildSignalChip(PredictiveSignalInfo signal) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: NinaColors.background,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: NinaColors.border),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.timer_outlined, size: 12, color: NinaColors.textSecondary),
          const SizedBox(width: 6),
          Text(
            signal.window,
            style: const TextStyle(color: NinaColors.textSecondary, fontSize: 11, fontWeight: FontWeight.bold),
          ),
        ],
      ),
    );
  }
}
