import 'package:flutter/material.dart';
import '../../../core/theme/design_system.dart';
import '../../../core/utils/money.dart';
import '../../../domain/models/overview.dart';
import '../../../shared/widgets/nina_ui.dart';

/// "Cómo calculé esto" (PRD-AUD-06): shows the engine's own explanation of the
/// available figure. Every number here comes from `Overview.audit`; nothing is
/// recomputed in the app.
Future<void> showAuditSheet(
  BuildContext context, {
  required OverviewAudit audit,
  required VoidCallback onViewTransactions,
}) {
  return showModalBottomSheet<void>(
    useRootNavigator: true,
    context: context,
    isScrollControlled: true,
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
        padding: const EdgeInsets.fromLTRB(24, 0, 24, 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Cómo calculé esto',
                key: const Key('audit-title'), style: NinaText.displayM()),
            const SizedBox(height: 8),
            Text(audit.formula,
                key: const Key('audit-formula'), style: NinaText.bodyM()),
            const SizedBox(height: 18),
            NinaCard(
              padding: const EdgeInsets.all(6),
              shadow: false,
              child: Column(children: [
                _Row(Icons.south_west_rounded, 'Ingresos', audit.income,
                    color: NinaColors.success),
                _Row(Icons.receipt_long_outlined, '− Gastos', audit.expenses),
                if (audit.setAside != 0)
                  _Row(
                      Icons.savings_outlined,
                      audit.setAside > 0
                          ? '− Apartado para metas'
                          : '+ Retirado de metas',
                      audit.setAside.abs(),
                      key: const Key('audit-set-aside')),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                  decoration: BoxDecoration(
                    color: NinaColors.peachSoft,
                    borderRadius: BorderRadius.circular(18),
                  ),
                  child: Row(children: [
                    Expanded(
                        child: Text('= Disponible',
                            style: NinaText.bodyMStrong())),
                    Text(formatSoles(audit.available),
                        style: NinaText.titleL()),
                  ]),
                ),
              ]),
            ),
            const SizedBox(height: 14),
            Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Icon(Icons.info_outline,
                  size: 18, color: NinaColors.textTertiary),
              const SizedBox(width: 10),
              Expanded(
                child: Text(basis,
                    key: const Key('audit-basis'), style: NinaText.bodyS()),
              ),
            ]),
            if (count > 0) ...[
              const SizedBox(height: 18),
              NinaButton(
                key: const Key('audit-view-transactions'),
                label: 'Ver estos movimientos',
                variant: NinaButtonVariant.secondary,
                onPressed: onViewTransactions,
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _Row extends StatelessWidget {
  const _Row(this.icon, this.label, this.value,
      {super.key, this.color = NinaColors.textPrimary});
  final IconData icon;
  final String label;
  final double value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(12),
      child: Row(
        children: [
          NinaIconBox(icon: icon, size: 36),
          const SizedBox(width: 12),
          Expanded(child: Text(label, style: NinaText.bodyM())),
          Text(formatSoles(value), style: NinaText.number(color: color)),
        ],
      ),
    );
  }
}
