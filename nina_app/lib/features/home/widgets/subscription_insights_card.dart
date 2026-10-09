import 'package:flutter/material.dart';
import '../../../core/theme/design_system.dart';
import '../../../domain/models/home_intelligence.dart';

class SubscriptionInsightsCard extends StatelessWidget {
  final SubscriptionBurden subscriptions;

  const SubscriptionInsightsCard({super.key, required this.subscriptions});

  @override
  Widget build(BuildContext context) {
    final isHigh = subscriptions.percentageOfIncome > 15;

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: NinaColors.surface,
        borderRadius: BorderRadius.circular(28),
        border: Border.all(
          color: isHigh ? NinaColors.primary.withAlpha(50) : NinaColors.border,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: NinaColors.primary.withAlpha(30),
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.subscriptions_rounded,
                  color: NinaColors.primaryLight,
                  size: 20,
                ),
              ),
              const SizedBox(width: 12),
              const Text(
                'Suscripciones',
                style: TextStyle(
                  color: NinaColors.textPrimary,
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const Spacer(),
              Text(
                '${subscriptions.count} activas',
                style: const TextStyle(
                  color: NinaColors.textSecondary,
                  fontSize: 12,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Text(
            'Consumen el ${subscriptions.percentageOfIncome.toStringAsFixed(1)}% de tus ingresos.',
            style: const TextStyle(
              color: NinaColors.textSecondary,
              fontSize: 14,
            ),
          ),
          if (subscriptions.opportunities.isNotEmpty) ...[
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: NinaColors.accent.withAlpha(20),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                children: [
                  const Icon(Icons.auto_awesome_rounded, color: NinaColors.accent, size: 16),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      subscriptions.opportunities.first,
                      style: const TextStyle(
                        color: NinaColors.accent,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}
