import 'dart:async';
import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import '../../../core/theme/design_system.dart';
import '../../../core/utils/money.dart';
import '../../../data/repositories/supabase_finance_repository.dart';
import '../../../data/services/finance_api_service.dart';
import '../../../domain/models/overview.dart';

/// Análisis (US-27, US-28). Category breakdown from GET /v1/overview and the
/// monthly trend from GET /v1/trends — both computed by the backend engine.
class AnalisisScreen extends StatefulWidget {
  const AnalisisScreen({super.key, this.api, this.watchChanges});

  final FinanceApiService? api;
  final Stream<Object?> Function()? watchChanges;

  @override
  State<AnalisisScreen> createState() => _AnalisisScreenState();
}

class _AnalisisData {
  const _AnalisisData(this.overview, this.trend);
  final Overview overview;
  final List<TrendPoint> trend;
}

/// Category colors (palette order, highest spend first).
const _palette = [
  Color(0xFF7B61FF),
  Color(0xFFB8F53A),
  Color(0xFF5DCAA5),
  Color(0xFFEF9F27),
  Color(0xFFF09595),
  Color(0xFFC4B5FD),
];

class _AnalisisScreenState extends State<AnalisisScreen> {
  late final FinanceApiService _api = widget.api ?? FinanceApiService.instance;
  late Future<_AnalisisData> _future;
  StreamSubscription<Object?>? _changes;
  OverviewPeriod _period = OverviewPeriod.current;

  @override
  void initState() {
    super.initState();
    _future = _load();
    final watch = widget.watchChanges ??
        SupabaseFinanceRepository.instance.watchTransactions;
    _changes = watch().listen((_) => _reload());
  }

  @override
  void dispose() {
    _changes?.cancel();
    super.dispose();
  }

  void _reload() {
    if (mounted)
      setState(() {
        _future = _load();
      });
  }

  Future<_AnalisisData> _load() async {
    final results = await Future.wait(
        [_api.getOverview(period: _period), _api.getTrends(months: 6)]);
    return _AnalisisData(
        results[0] as Overview, results[1] as List<TrendPoint>);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: NinaColors.background,
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () async {
            _reload();
            await _future
                .catchError((_) => const _AnalisisData(_noOverview, []));
          },
          child: FutureBuilder<_AnalisisData>(
            future: _future,
            builder: (context, snap) {
              final children = <Widget>[
                const Padding(
                  padding: EdgeInsets.fromLTRB(16, 20, 16, 12),
                  child: Text('Análisis',
                      style: TextStyle(
                          fontSize: 22,
                          fontWeight: FontWeight.w500,
                          color: NinaColors.textPrimary)),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                  child: SegmentedButton<OverviewPeriod>(
                    segments: [
                      for (final p in OverviewPeriod.values)
                        ButtonSegment(value: p, label: Text(p.label))
                    ],
                    selected: {_period},
                    onSelectionChanged: (s) => setState(() {
                      _period = s.first;
                      _future = _load();
                    }),
                  ),
                ),
              ];
              if (snap.connectionState == ConnectionState.waiting) {
                children.add(const Padding(
                    padding: EdgeInsets.all(40),
                    child: Center(child: CircularProgressIndicator())));
              } else if (snap.hasError) {
                children.add(Padding(
                  padding: const EdgeInsets.all(24),
                  child: Column(children: [
                    Text(financeErrorMessage(snap.error!),
                        textAlign: TextAlign.center,
                        style:
                            const TextStyle(color: NinaColors.textSecondary)),
                    const SizedBox(height: 12),
                    OutlinedButton(
                        onPressed: _reload, child: const Text('Reintentar')),
                  ]),
                ));
              } else {
                final d = snap.data!;
                if (!d.overview.hasHistory) {
                  children.add(const Padding(
                    key: Key('analisis-empty'),
                    padding: EdgeInsets.all(24),
                    child: Text(
                      'Cuando registres tus primeros movimientos verás aquí en qué gastas y cómo cambia mes a mes.',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: NinaColors.textTertiary),
                    ),
                  ));
                } else {
                  children
                    ..add(_CategoryChart(overview: d.overview))
                    ..add(_TrendChart(points: d.trend));
                }
              }
              children.add(const SizedBox(height: 120));
              return ListView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  children: children);
            },
          ),
        ),
      ),
    );
  }
}

const _noOverview = Overview(
  periodLabel: '',
  from: '',
  to: '',
  hasHistory: false,
  txnCount: 0,
  income: 0,
  expenses: 0,
  available: 0,
  balance: 0,
  categories: [],
  previousLabel: '',
  previousExpenses: 0,
  expensesChange: 0,
);

class _Card extends StatelessWidget {
  const _Card({required this.title, required this.child});
  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) => Container(
        margin: const EdgeInsets.fromLTRB(16, 0, 16, 14),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: NinaColors.surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: NinaColors.border, width: 0.5),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title,
                style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: NinaColors.textPrimary)),
            const SizedBox(height: 12),
            child,
          ],
        ),
      );
}

/// US-27: ring by category with an exact-figure legend.
class _CategoryChart extends StatelessWidget {
  const _CategoryChart({required this.overview});
  final Overview overview;

  @override
  Widget build(BuildContext context) {
    final cats = overview.categories;
    return _Card(
      title: 'Gasto por categoría · ${overview.periodLabel}',
      child: cats.isEmpty
          ? Text('No tienes gastos registrados en ${overview.periodLabel}.',
              style:
                  const TextStyle(color: NinaColors.textTertiary, fontSize: 12))
          : Column(
              children: [
                SizedBox(
                  height: 180,
                  child: Stack(
                    alignment: Alignment.center,
                    children: [
                      PieChart(PieChartData(
                        centerSpaceRadius: 56,
                        sectionsSpace: 2,
                        sections: [
                          for (var i = 0; i < cats.length; i++)
                            PieChartSectionData(
                              value: cats[i].amount,
                              color: _palette[i % _palette.length],
                              radius: 22,
                              showTitle: false,
                            ),
                        ],
                      )),
                      Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Text('Gastos',
                              style: TextStyle(
                                  fontSize: 11,
                                  color: NinaColors.textTertiary)),
                          Text(formatSoles(overview.expenses),
                              key: const Key('analisis-total'),
                              style: const TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.w700,
                                  color: NinaColors.textPrimary)),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                for (var i = 0; i < cats.length; i++)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 4),
                    child: Row(
                      children: [
                        Container(
                            width: 10,
                            height: 10,
                            decoration: BoxDecoration(
                                color: _palette[i % _palette.length],
                                shape: BoxShape.circle)),
                        const SizedBox(width: 8),
                        Expanded(
                            child: Text(cats[i].label,
                                style: const TextStyle(
                                    fontSize: 12,
                                    color: NinaColors.textPrimary))),
                        Text(
                            '${formatSoles(cats[i].amount)} · ${cats[i].sharePct}%',
                            style: const TextStyle(
                                fontSize: 12, color: NinaColors.textSecondary)),
                      ],
                    ),
                  ),
              ],
            ),
    );
  }
}

/// US-28: income vs expenses for the last 6 months.
class _TrendChart extends StatelessWidget {
  const _TrendChart({required this.points});
  final List<TrendPoint> points;

  @override
  Widget build(BuildContext context) {
    final maxY = points.fold<double>(
        0, (m, p) => [m, p.income, p.expenses].reduce((a, b) => a > b ? a : b));
    final withData = points.where((p) => p.income > 0 || p.expenses > 0).length;
    return _Card(
      title: 'Mes a mes',
      child: withData < 2
          ? const Text(
              'Necesitas movimientos en al menos dos meses para ver la tendencia.',
              style: TextStyle(color: NinaColors.textTertiary, fontSize: 12))
          : Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SizedBox(
                  height: 180,
                  child: BarChart(BarChartData(
                    maxY: maxY * 1.15,
                    gridData: const FlGridData(show: false),
                    borderData: FlBorderData(show: false),
                    titlesData: FlTitlesData(
                      leftTitles: const AxisTitles(
                          sideTitles: SideTitles(showTitles: false)),
                      rightTitles: const AxisTitles(
                          sideTitles: SideTitles(showTitles: false)),
                      topTitles: const AxisTitles(
                          sideTitles: SideTitles(showTitles: false)),
                      bottomTitles: AxisTitles(
                        sideTitles: SideTitles(
                          showTitles: true,
                          getTitlesWidget: (v, _) => Padding(
                            padding: const EdgeInsets.only(top: 4),
                            child: Text(points[v.toInt()].label.substring(0, 3),
                                style: const TextStyle(
                                    fontSize: 10,
                                    color: NinaColors.textTertiary)),
                          ),
                        ),
                      ),
                    ),
                    barGroups: [
                      for (var i = 0; i < points.length; i++)
                        BarChartGroupData(x: i, barsSpace: 3, barRods: [
                          BarChartRodData(
                              toY: points[i].income,
                              color: NinaColors.success,
                              width: 7),
                          BarChartRodData(
                              toY: points[i].expenses,
                              color: NinaColors.primaryLight,
                              width: 7),
                        ]),
                    ],
                  )),
                ),
                const SizedBox(height: 8),
                const Row(children: [
                  _Legend(color: NinaColors.success, label: 'Ingresos'),
                  SizedBox(width: 16),
                  _Legend(color: NinaColors.primaryLight, label: 'Gastos'),
                ]),
                const SizedBox(height: 8),
                for (final p in points.reversed
                    .where((p) => p.income > 0 || p.expenses > 0)
                    .take(3))
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 2),
                    child: Text(
                      '${p.label}: gastos ${formatSoles(p.expenses)} · ingresos ${formatSoles(p.income)}',
                      style: const TextStyle(
                          fontSize: 11, color: NinaColors.textSecondary),
                    ),
                  ),
              ],
            ),
    );
  }
}

class _Legend extends StatelessWidget {
  const _Legend({required this.color, required this.label});
  final Color color;
  final String label;

  @override
  Widget build(BuildContext context) => Row(children: [
        Container(width: 10, height: 10, color: color),
        const SizedBox(width: 6),
        Text(label,
            style:
                const TextStyle(fontSize: 11, color: NinaColors.textTertiary)),
      ]);
}
