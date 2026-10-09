import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../core/theme/design_system.dart';
import '../../../domain/models/home_intelligence.dart';

class IntelligenceTimeline extends StatelessWidget {
  final List<IntelligenceEvent> events;

  const IntelligenceTimeline({super.key, required this.events});

  @override
  Widget build(BuildContext context) {
    if (events.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Padding(
          padding: EdgeInsets.symmetric(horizontal: 24, vertical: 16),
          child: Text(
            'Línea de tiempo de inteligencia',
            style: TextStyle(
              color: NinaColors.textPrimary,
              fontSize: 18,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
        ListView.separated(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          padding: const EdgeInsets.symmetric(horizontal: 24),
          itemCount: events.length,
          separatorBuilder: (_, __) => const SizedBox(height: 12),
          itemBuilder: (context, index) {
            final event = events[index];
            return _buildTimelineCard(event);
          },
        ),
      ],
    );
  }

  Widget _buildTimelineCard(IntelligenceEvent event) {
    final isAnomaly = event.type == 'anomaly';
    final color = isAnomaly ? NinaColors.primaryLight : NinaColors.accent;
    final icon = isAnomaly ? Icons.warning_amber_rounded : Icons.insights_rounded;

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: NinaColors.surface,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: NinaColors.border),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: color.withAlpha(20),
              shape: BoxShape.circle,
            ),
            child: Icon(icon, color: color, size: 20),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      event.title,
                      style: TextStyle(
                        color: color,
                        fontSize: 14,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    Text(
                      _formatDate(event.createdAt),
                      style: const TextStyle(
                        color: NinaColors.textTertiary,
                        fontSize: 11,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                Text(
                  event.body,
                  style: const TextStyle(
                    color: NinaColors.textPrimary,
                    fontSize: 14,
                    height: 1.4,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  String _formatDate(DateTime date) {
    final now = DateTime.now();
    final diff = now.difference(date);
    if (diff.inHours < 24) return 'Hoy, ${DateFormat.Hm().format(date)}';
    return DateFormat('d MMM').format(date);
  }
}
