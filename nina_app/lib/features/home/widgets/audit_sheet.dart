import 'package:flutter/material.dart';
import '../../../core/theme/design_system.dart';
import '../../../core/utils/money.dart';
import '../../../domain/models/overview.dart';

/// "Cómo calculé esto" (PRD-AUD-06): shows the engine's own explanation of the
/// available figure. Every number here comes from `Overview.audit`; nothing is
/// recomputed in the app.
Future<void> showAuditSheet(
  BuildContext context, {
  required OverviewAudit audit,
  required VoidCallback onViewTransactions,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: NinaColors.surface,
    shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
    builder: (ctx) => AuditSheet(
      audit: audit,
      onViewTransactions: () {
        Navigator.of(ctx).pop();
        onViewTransactions();
      },
    ),
  );
}

class AuditSheet extends StatelessWidget {
  const AuditSheet(
      {super.key, required this.audit, required this.onViewTransactions});

  final OverviewAudit audit;
  final VoidCallback onViewTransactions;

  @override
  Widget build(BuildContext context) {
    final count = audit.txnCount;
    final basis = count == 0
        ? 'Todavía no hay movimientos en ${audit.periodLabel}.'
        : 'Calculado con $count ${count == 1 ? 'movimiento' : 'movimientos'} de ${audit.periodLabel}.';
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 18, 20, 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Cómo calculé esto',
                key: Key('audit-title'),
                style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                    color: NinaColors.textPrimary)),
            const SizedBox(height: 10),
            Text(audit.formula,
                key: const Key('audit-formula'),
                style: const TextStyle(
                    fontSize: 14, color: NinaColors.textSecondary)),
            const SizedBox(height: 16),
            _Row('Ingresos', audit.income),
            _Row('Gastos', audit.expenses),
            const Divider(height: 20),
            _Row('Disponible', audit.available, bold: true),
            const SizedBox(height: 12),
            Text(basis,
                key: const Key('audit-basis'),
                style: const TextStyle(
                    fontSize: 12, color: NinaColors.textSecondary)),
            if (count > 0) ...[
              const SizedBox(height: 14),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton(
                  key: const Key('audit-view-transactions'),
                  onPressed: onViewTransactions,
                  child: const Text('Ver estos movimientos'),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _Row extends StatelessWidget {
  const _Row(this.label, this.value, {this.bold = false});
  final String label;
  final double value;
  final bool bold;

  @override
  Widget build(BuildContext context) {
    final style = TextStyle(
        fontSize: 15,
        fontWeight: bold ? FontWeight.w700 : FontWeight.w400,
        color: NinaColors.textPrimary);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: style),
          Text(formatSoles(value), style: style),
        ],
      ),
    );
  }
}
