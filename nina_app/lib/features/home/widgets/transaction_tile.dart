import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../core/theme/design_system.dart';
import '../../../domain/models/transaction.dart';
import '../../../data/services/insight_engine.dart';

class TransactionTile extends StatelessWidget {
  final Transaction tx;
  const TransactionTile({super.key, required this.tx});

  Color get _categoryColor {
    switch (tx.category) {
      case TransactionCategory.food:
        return const Color(0xFFFF8C42);
      case TransactionCategory.transport:
        return const Color(0xFF00C2FF);
      case TransactionCategory.entertainment:
        return const Color(0xFF7B61FF);
      case TransactionCategory.subscriptions:
        return const Color(0xFF4C3AFF);
      case TransactionCategory.shopping:
        return const Color(0xFFB6FF3B);
      case TransactionCategory.health:
        return const Color(0xFF00E5A0);
      case TransactionCategory.utilities:
        return const Color(0xFFFFB020);
      case TransactionCategory.other:
        return NinaColors.textSecondary;
    }
  }

  @override
  Widget build(BuildContext context) {
    final fmt = NumberFormat.currency(symbol: '\$', decimalDigits: 0);
    final dateFmt = DateFormat('d MMM', 'es');

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10),
      child: Row(
        children: [
          // Category dot + emoji
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: _categoryColor.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Center(
              child: Text(
                InsightEngine.categoryEmoji(tx.category),
                style: const TextStyle(fontSize: 18),
              ),
            ),
          ),
          const SizedBox(width: 12),
          // Description + date
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  tx.description,
                  style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                        fontWeight: FontWeight.w600,
                        color: NinaColors.textPrimary,
                      ),
                ),
                const SizedBox(height: 2),
                Text(
                  dateFmt.format(tx.date),
                  style: Theme.of(context).textTheme.labelMedium,
                ),
              ],
            ),
          ),
          // Amount
          Text(
            tx.isIncome ? '+${fmt.format(tx.amount)}' : '-${fmt.format(tx.amount)}',
            style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                  fontWeight: FontWeight.w700,
                  color: tx.isIncome ? NinaColors.accent : NinaColors.textPrimary,
                ),
          ),
        ],
      ),
    );
  }
}
