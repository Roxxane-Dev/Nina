import 'package:flutter/material.dart';
import '../../../core/theme/design_system.dart';
import '../../../core/utils/money.dart';
import '../bloc/chat_message.dart';

export '../../../core/utils/money.dart' show formatSoles;

/// Figures card under Nina's answer (FDS §6.4) with "Cómo lo calculé".
/// Every number comes from the backend card (engine), never from LLM text.
class AnswerCardView extends StatelessWidget {
  const AnswerCardView({super.key, required this.card});

  final ChatCard card;

  Color _tone(String? tone) {
    switch (tone) {
      case 'positive':
        return NinaColors.success;
      case 'negative':
        return NinaColors.error;
      default:
        return NinaColors.textPrimary;
    }
  }

  @override
  Widget build(BuildContext context) {
    final highlight = card.highlight;
    return Container(
      margin: const EdgeInsets.only(top: 8),
      padding: const EdgeInsets.all(16),
      constraints: const BoxConstraints(maxWidth: 340),
      decoration: BoxDecoration(
        color: NinaColors.surfaceSubtle,
        borderRadius: BorderRadius.circular(NinaRadii.md),
        border: Border.all(color: NinaColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(card.title, style: NinaText.bodyMStrong()),
          const SizedBox(height: 2),
          Text(card.subtitle,
              style: NinaText.bodyS(color: NinaColors.textTertiary)),
          if (highlight != null) ...[
            const SizedBox(height: 12),
            Text(highlight.label, style: NinaText.bodyS()),
            Text(
              formatSoles(highlight.amount),
              style: NinaText.displayM(
                color: highlight.tone == 'neutral'
                    ? NinaColors.textPrimary
                    : _tone(highlight.tone),
              ),
            ),
          ],
          if (card.rows.isNotEmpty) const SizedBox(height: 8),
          for (final row in card.rows)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: Row(
                children: [
                  Expanded(child: Text(row.label, style: NinaText.bodyS())),
                  Text(formatSoles(row.amount),
                      style: NinaText.bodySStrong(color: _tone(row.tone))),
                ],
              ),
            ),
          if (card.confidence == 'low' || card.confidence == 'insufficient')
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text(
                'Pocos movimientos registrados: las cifras pueden cambiar.',
                style: NinaText.bodyS(color: NinaColors.warning),
              ),
            ),
          Theme(
            data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
            child: ExpansionTile(
              tilePadding: EdgeInsets.zero,
              childrenPadding: const EdgeInsets.only(bottom: 4),
              dense: true,
              leading: const Icon(Icons.calculate_outlined,
                  size: 18, color: NinaColors.accent),
              title: Text('Cómo lo calculé',
                  style: NinaText.bodySStrong(color: NinaColors.accent)),
              children: [
                Align(
                  alignment: Alignment.centerLeft,
                  child: Text(card.howCalculated,
                      style: NinaText.bodyS(color: NinaColors.textSecondary)),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
