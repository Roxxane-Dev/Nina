import 'package:flutter/material.dart';
import '../../../core/theme/design_system.dart';
import '../../../domain/models/home_intelligence.dart';

class RiskTimeline extends StatelessWidget {
  final List<PredictiveSignalInfo> signals;

  const RiskTimeline({super.key, required this.signals});

  @override
  Widget build(BuildContext context) {
    if (signals.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Padding(
          padding: EdgeInsets.symmetric(horizontal: 24),
          child: Text(
            'Radar de Riesgo Futuro',
            style: TextStyle(color: NinaColors.textPrimary, fontSize: 18, fontWeight: FontWeight.bold),
          ),
        ),
        const SizedBox(height: 16),
        SizedBox(
          height: 160,
          child: ListView.separated(
            padding: const EdgeInsets.symmetric(horizontal: 24),
            scrollDirection: Axis.horizontal,
            itemCount: signals.length,
            separatorBuilder: (_, __) => const SizedBox(width: 16),
            itemBuilder: (context, index) {
              final signal = signals[index];
              final isHigh = signal.probability > 0.6;

              return Container(
                width: 200,
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: isHigh ? NinaColors.primary.withAlpha(10) : NinaColors.surface,
                  borderRadius: BorderRadius.circular(24),
                  border: Border.all(color: isHigh ? NinaColors.primary.withAlpha(50) : NinaColors.border),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Icon(
                          Icons.radar_rounded,
                          size: 16,
                          color: isHigh ? NinaColors.primary : NinaColors.textSecondary,
                        ),
                        const SizedBox(width: 8),
                        Text(
                          signal.window,
                          style: TextStyle(
                            color: isHigh ? NinaColors.primary : NinaColors.textSecondary,
                            fontSize: 12,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                    const Spacer(),
                    Text(
                      signal.type,
                      style: const TextStyle(color: NinaColors.textPrimary, fontSize: 16, fontWeight: FontWeight.w900),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Probabilidad: ${(signal.probability * 100).toInt()}%',
                      style: const TextStyle(color: NinaColors.textSecondary, fontSize: 11),
                    ),
                  ],
                ),
              );
            },
          ),
        ),
      ],
    );
  }
}
