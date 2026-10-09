import 'package:flutter/material.dart';
import '../../../core/theme/design_system.dart';
import '../../../domain/models/insight.dart';

class InsightCard extends StatelessWidget {
  final Insight insight;
  final VoidCallback? onTap;

  const InsightCard({super.key, required this.insight, this.onTap});

  Color get _accentColor {
    switch (insight.severity) {
      case InsightSeverity.warning:
        return NinaColors.warning;
      case InsightSeverity.positive:
        return NinaColors.accent;
      case InsightSeverity.info:
        return NinaColors.data;
    }
  }

  String get _icon {
    switch (insight.type) {
      case InsightType.anomaly:
        return '⚠️';
      case InsightType.savings:
        return '💡';
      case InsightType.subscription:
        return '📱';
      case InsightType.trend:
        return '📊';
      case InsightType.recommendation:
        return '✨';
    }
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          color: NinaColors.surface,
          borderRadius: BorderRadius.circular(NinaRadii.card),
          border: Border(
            left: BorderSide(color: _accentColor, width: 3),
          ),
        ),
        padding: const EdgeInsets.all(16),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(_icon, style: const TextStyle(fontSize: 22)),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    insight.title,
                    style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                          fontWeight: FontWeight.w700,
                          color: NinaColors.textPrimary,
                        ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    insight.body,
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: NinaColors.textSecondary,
                          height: 1.4,
                        ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
