import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../core/theme/design_system.dart';
import '../bloc/chat_message.dart';

final _money =
    NumberFormat.currency(locale: 'en_US', symbol: 'S/ ', decimalDigits: 2);

String formatSoles(double amount) =>
    amount < 0 ? '-${_money.format(-amount)}' : _money.format(amount);

/// Figures card under Nina's answer (FDS §6.4) with "Cómo lo calculé".
class AnswerCardView extends StatelessWidget {
  const AnswerCardView({super.key, required this.card});

  final ChatCard card;

  Color _tone(String? tone) {
    switch (tone) {
      case 'positive':
        return NinaColors.success;
      case 'negative':
        return NinaColors.errorLight;
      default:
        return NinaColors.textPrimary;
    }
  }

  @override
  Widget build(BuildContext context) {
    final highlight = card.highlight;
    return Container(
      margin: const EdgeInsets.only(top: 6),
      padding: const EdgeInsets.all(14),
      constraints: const BoxConstraints(maxWidth: 340),
      decoration: BoxDecoration(
        color: NinaColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: NinaColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(card.title,
              style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: NinaColors.textPrimary)),
          const SizedBox(height: 2),
          Text(card.subtitle,
              style: const TextStyle(
                  fontSize: 11, color: NinaColors.textTertiary)),
          if (highlight != null) ...[
            const SizedBox(height: 10),
            Text(highlight.label,
                style: const TextStyle(
                    fontSize: 11, color: NinaColors.textSecondary)),
            Text(
              formatSoles(highlight.amount),
              style: TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.w700,
                color: highlight.tone == 'neutral'
                    ? NinaColors.accent
                    : _tone(highlight.tone),
              ),
            ),
          ],
          if (card.rows.isNotEmpty) const SizedBox(height: 8),
          for (final row in card.rows)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 3),
              child: Row(
                children: [
                  Expanded(
                    child: Text(row.label,
                        style: const TextStyle(
                            fontSize: 12, color: NinaColors.textSecondary)),
                  ),
                  Text(formatSoles(row.amount),
                      style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: _tone(row.tone))),
                ],
              ),
            ),
          if (card.confidence == 'low' || card.confidence == 'insufficient')
            const Padding(
              padding: EdgeInsets.only(top: 8),
              child: Text(
                'Pocos movimientos registrados: las cifras pueden cambiar.',
                style: TextStyle(fontSize: 11, color: NinaColors.warning),
              ),
            ),
          Theme(
            data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
            child: ExpansionTile(
              tilePadding: EdgeInsets.zero,
              childrenPadding: const EdgeInsets.only(bottom: 4),
              dense: true,
              title: const Text('Cómo lo calculé',
                  style:
                      TextStyle(fontSize: 11, color: NinaColors.primaryLight)),
              children: [
                Text(card.howCalculated,
                    style: const TextStyle(
                        fontSize: 11,
                        color: NinaColors.textTertiary,
                        height: 1.4)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
