import 'package:flutter/material.dart';
import '../../../core/theme/design_system.dart';
import '../../../core/utils/money.dart';
import '../../../core/utils/transaction_display.dart';
import '../../../shared/widgets/nina_ui.dart';

/// List/Transaction Row from the design system. Amounts are shown as stored.
class TransactionRow extends StatelessWidget {
  const TransactionRow({
    super.key,
    required this.title,
    required this.meta,
    required this.amount,
    required this.isIncome,
    this.category,
    this.neutral = false,
    this.onTap,
    this.trailing,
  });

  final String title;
  final String meta;
  final double amount;
  final bool isIncome;
  final String? category;

  /// Money back from a goal: it comes in, but it is not income (no green).
  final bool neutral;
  final VoidCallback? onTap;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final green = isIncome && !neutral;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(NinaRadii.sm),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 12),
        child: Row(children: [
          NinaIconBox(
            icon: categoryIcon(category),
            background: green ? NinaColors.successSoft : NinaColors.surfaceAlt,
            foreground: green ? NinaColors.success : NinaColors.textPrimary,
          ),
          const SizedBox(width: 14),
          Expanded(
            child:
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: NinaText.bodyMStrong()),
              const SizedBox(height: 2),
              Text(meta,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: NinaText.bodyS(color: NinaColors.textTertiary)),
            ]),
          ),
          const SizedBox(width: 8),
          Text(
            '${isIncome ? '+' : '−'}${formatSoles(amount)}',
            style: NinaText.number(
                color: green ? NinaColors.success : NinaColors.textPrimary),
          ),
          if (trailing != null) trailing!,
        ]),
      ),
    );
  }
}
