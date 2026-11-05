import 'package:flutter/material.dart';
import '../../../core/theme/design_system.dart';
import '../../../core/utils/money.dart';
import '../../../data/services/finance_api_service.dart';
import '../../../shared/widgets/nina_ui.dart';

/// INS-03: where the month is heading. Every figure and every line comes from
/// the engine (buildMonthOutlook); the app only lays them out.
class OutlookCard extends StatefulWidget {
  const OutlookCard({super.key, required this.outlook});
  final MonthOutlook outlook;

  @override
  State<OutlookCard> createState() => _OutlookCardState();
}

class _OutlookCardState extends State<OutlookCard> {
  bool _open = false;

  Widget _line(String label, String value, {Key? key}) => Padding(
        key: key,
        padding: const EdgeInsets.only(top: 6),
        child: Row(children: [
          Expanded(child: Text(label, style: NinaText.bodyS())),
          Text(value, style: NinaText.bodySStrong()),
        ]),
      );

  @override
  Widget build(BuildContext context) {
    final o = widget.outlook;
    return NinaCard(
      key: const Key('home-outlook'),
      child: InkWell(
        onTap: () => setState(() => _open = !_open),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Expanded(
                child: Text('Si sigues así', style: NinaText.bodySStrong())),
            Icon(_open ? Icons.expand_less : Icons.expand_more,
                color: NinaColors.textTertiary),
          ]),
          const SizedBox(height: 4),
          Text(
            o.projected >= 0
                ? 'Cerrarías ${o.monthLabel} con unos ${formatSoles(o.projected)}'
                : '${o.monthLabel[0].toUpperCase()}${o.monthLabel.substring(1)} cerraría en ${formatSoles(o.projected)}',
            key: const Key('home-outlook-figure'),
            style: NinaText.titleL(),
          ),
          if (o.overdueIncome > 0) ...[
            const SizedBox(height: 6),
            Text(
                'Sin contar tu ingreso de siempre (${formatSoles(o.overdueIncome)}): aún no está registrado.',
                key: const Key('home-outlook-overdue'),
                style: NinaText.bodyS(color: NinaColors.warning)),
          ],
          if (_open) ...[
            const SizedBox(height: 8),
            _line('Hoy tienes', formatSoles(o.availableNow)),
            if (o.expectedIncome > 0)
              _line(
                  o.incomeDay == null
                      ? '+ Ingreso que suele llegar'
                      : '+ Ingreso que suele llegar el día ${o.incomeDay}',
                  formatSoles(o.expectedIncome)),
            if (o.recurringUntilEnd > 0)
              _line('− Pagos fijos que se vienen',
                  formatSoles(o.recurringUntilEnd)),
            _line(
                '− Día a día (${formatSoles(o.dailySpend)} × ${o.daysLeft} ${o.daysLeft == 1 ? 'día' : 'días'})',
                formatSoles(o.discretionaryUntilEnd),
                key: const Key('home-outlook-daily')),
            const SizedBox(height: 8),
            Text('Es una estimación con lo que registraste, no una promesa.',
                style: NinaText.bodyS(color: NinaColors.textTertiary)),
          ],
        ]),
      ),
    );
  }
}

/// INS-01: fixed payments the history says are coming.
class UpcomingCard extends StatelessWidget {
  const UpcomingCard({super.key, required this.payments});
  final List<UpcomingPayment> payments;

  String _day(String iso) {
    final p = iso.split('-');
    return p.length == 3 ? '${int.parse(p[2])}/${int.parse(p[1])}' : iso;
  }

  @override
  Widget build(BuildContext context) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const NinaSectionHeader(title: 'Próximos pagos'),
          const SizedBox(height: 8),
          NinaCard(
            key: const Key('home-upcoming'),
            child: Column(children: [
              for (final p in payments.take(4))
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 6),
                  child: Row(children: [
                    SizedBox(
                        width: 48,
                        child: Text(_day(p.date),
                            style: NinaText.bodyS(
                                color: NinaColors.textTertiary))),
                    Expanded(
                        child: Text(p.name,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: NinaText.bodyMStrong())),
                    Text(formatSoles(p.amount), style: NinaText.bodyMStrong()),
                  ]),
                ),
            ]),
          ),
        ],
      );
}
