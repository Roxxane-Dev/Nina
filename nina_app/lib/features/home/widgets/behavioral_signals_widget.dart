import 'package:flutter/material.dart';
import '../../../core/theme/design_system.dart';

class BehavioralSignalsWidget extends StatelessWidget {
  final List<String> signals;

  const BehavioralSignalsWidget({super.key, required this.signals});

  @override
  Widget build(BuildContext context) {
    if (signals.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Padding(
          padding: EdgeInsets.symmetric(horizontal: 24),
          child: Text(
            'Señales Conductuales',
            style: TextStyle(
              color: NinaColors.textPrimary,
              fontSize: 16,
              fontWeight: FontWeight.bold,
            ),
          ),
        ),
        const SizedBox(height: 12),
        SizedBox(
          height: 36,
          child: ListView.separated(
            padding: const EdgeInsets.symmetric(horizontal: 24),
            scrollDirection: Axis.horizontal,
            itemCount: signals.length,
            separatorBuilder: (_, __) => const SizedBox(width: 8),
            itemBuilder: (context, index) {
              final signal = signals[index];
              return _buildSignalChip(signal);
            },
          ),
        ),
      ],
    );
  }

  Widget _buildSignalChip(String signal) {
    final label = signal.replaceAll('_', ' ').toUpperCase();
    final isNegative = signal.contains('stress') || signal.contains('impulse');

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      decoration: BoxDecoration(
        color: isNegative ? NinaColors.primary.withAlpha(20) : NinaColors.accent.withAlpha(20),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isNegative ? NinaColors.primary.withAlpha(50) : NinaColors.accent.withAlpha(50),
        ),
      ),
      child: Text(
        '#$label',
        style: TextStyle(
          color: isNegative ? NinaColors.primaryLight : NinaColors.accent,
          fontSize: 10,
          fontWeight: FontWeight.w800,
          letterSpacing: 0.5,
        ),
      ),
    );
  }
}
