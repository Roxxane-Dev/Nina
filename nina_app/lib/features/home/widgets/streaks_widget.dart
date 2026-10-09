import 'package:flutter/material.dart';
import '../../../core/theme/design_system.dart';
import '../../../domain/models/home_intelligence.dart';

class StreaksWidget extends StatelessWidget {
  final List<FinancialStreak> streaks;

  const StreaksWidget({super.key, required this.streaks});

  @override
  Widget build(BuildContext context) {
    if (streaks.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Padding(
          padding: EdgeInsets.symmetric(horizontal: 24),
          child: Text(
            'Tus Rachas',
            style: TextStyle(
              color: NinaColors.textPrimary,
              fontSize: 16,
              fontWeight: FontWeight.bold,
            ),
          ),
        ),
        const SizedBox(height: 12),
        SizedBox(
          height: 100,
          child: ListView.separated(
            padding: const EdgeInsets.symmetric(horizontal: 24),
            scrollDirection: Axis.horizontal,
            itemCount: streaks.length,
            separatorBuilder: (_, __) => const SizedBox(width: 12),
            itemBuilder: (context, index) {
              final streak = streaks[index];
              return _buildStreakCard(streak);
            },
          ),
        ),
      ],
    );
  }

  Widget _buildStreakCard(FinancialStreak streak) {
    return Container(
      width: 140,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: NinaColors.surface,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: NinaColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.fireplace_rounded, color: NinaColors.primary, size: 20),
              const SizedBox(width: 8),
              Text(
                '${streak.length} d',
                style: const TextStyle(
                  color: NinaColors.textPrimary,
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
          const Spacer(),
          Text(
            streak.type.replaceAll('_', ' ').toUpperCase(),
            style: const TextStyle(
              color: NinaColors.textSecondary,
              fontSize: 9,
              fontWeight: FontWeight.w800,
            ),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }
}
