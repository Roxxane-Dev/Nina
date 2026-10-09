import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../../../core/theme/design_system.dart';
import '../../../data/repositories/mock_finance_repository.dart';
import '../../../domain/models/insight.dart';
import '../../home/widgets/insight_card.dart';

class InsightsPage extends StatefulWidget {
  const InsightsPage({super.key});

  @override
  State<InsightsPage> createState() => _InsightsPageState();
}

class _InsightsPageState extends State<InsightsPage> {
  final _repo = MockFinanceRepository();
  List<Insight>? _insights;
  List<double>? _trend;
  Map<String, double>? _breakdown;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final summary = await _repo.getFinancialSummary();
    final insights = await _repo.getInsights();
    if (mounted) {
      setState(() {
        _insights = insights;
        _trend = summary.weeklyTrend;
        _breakdown = summary.categoryBreakdown;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: NinaColors.background,
      body: SafeArea(
        child: _insights == null
            ? const Center(child: CircularProgressIndicator(color: NinaColors.primary))
            : CustomScrollView(
                physics: const BouncingScrollPhysics(),
                slivers: [
                  SliverToBoxAdapter(child: _buildHeader(context)),
                  SliverToBoxAdapter(child: _buildTrendChart()),
                  SliverToBoxAdapter(child: _buildCategoryBreakdown()),
                  SliverPadding(
                    padding: const EdgeInsets.fromLTRB(20, 0, 20, 32),
                    sliver: SliverList(
                      delegate: SliverChildBuilderDelegate(
                        (context, i) => Padding(
                          padding: const EdgeInsets.only(bottom: 12),
                          child: InsightCard(insight: _insights![i]),
                        ).animate().fadeIn(delay: Duration(milliseconds: 80 * i)),
                        childCount: _insights!.length,
                      ),
                    ),
                  ),
                ],
              ),
      ),
    );
  }

  Widget _buildHeader(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Análisis',
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    fontWeight: FontWeight.w800,
                    fontSize: 26,
                  )),
          const SizedBox(height: 4),
          Text('Nina detectó ${_insights?.length ?? 0} patrones en tus finanzas.',
              style: Theme.of(context).textTheme.bodyMedium),
        ],
      ),
    );
  }

  Widget _buildTrendChart() {
    if (_trend == null) return const SizedBox();
    final maxY = (_trend!.reduce((a, b) => a > b ? a : b) * 1.3).ceilToDouble();
    final spots = _trend!.asMap().entries.map((e) => FlSpot(e.key.toDouble(), e.value)).toList();

    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 28),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('TENDENCIA SEMANAL',
              style: Theme.of(context).textTheme.labelMedium?.copyWith(
                    letterSpacing: 1.2,
                    fontWeight: FontWeight.w700,
                    color: NinaColors.textTertiary,
                  )),
          const SizedBox(height: 12),
          Container(
            height: 160,
            padding: const EdgeInsets.fromLTRB(8, 16, 16, 8),
            decoration: BoxDecoration(
              color: NinaColors.surface,
              borderRadius: BorderRadius.circular(NinaRadii.card),
              border: Border.all(color: NinaColors.border),
            ),
            child: LineChart(
              LineChartData(
                gridData: FlGridData(
                  show: true,
                  drawVerticalLine: false,
                  getDrawingHorizontalLine: (_) => const FlLine(
                    color: NinaColors.border,
                    strokeWidth: 1,
                    dashArray: [4, 4],
                  ),
                ),
                titlesData: FlTitlesData(
                  rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                  topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                  leftTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                  bottomTitles: AxisTitles(
                    sideTitles: SideTitles(
                      showTitles: true,
                      getTitlesWidget: (v, _) {
                        final labels = ['S-4', 'S-3', 'S-2', 'Esta'];
                        return Text(labels[v.toInt()],
                            style: const TextStyle(color: NinaColors.textTertiary, fontSize: 11));
                      },
                    ),
                  ),
                ),
                borderData: FlBorderData(show: false),
                minY: 0,
                maxY: maxY,
                lineBarsData: [
                  LineChartBarData(
                    spots: spots,
                    isCurved: true,
                    gradient: const LinearGradient(
                      colors: [NinaColors.primary, NinaColors.data],
                    ),
                    barWidth: 3,
                    isStrokeCapRound: true,
                    dotData: FlDotData(
                      show: true,
                      getDotPainter: (_, __, ___, ____) => FlDotCirclePainter(
                        radius: 4,
                        color: NinaColors.data,
                        strokeWidth: 0,
                      ),
                    ),
                    belowBarData: BarAreaData(
                      show: true,
                      gradient: LinearGradient(
                        colors: [
                          NinaColors.primary.withValues(alpha: 0.3),
                          NinaColors.primary.withValues(alpha: 0),
                        ],
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    ).animate().fadeIn(delay: 150.ms);
  }

  Widget _buildCategoryBreakdown() {
    if (_breakdown == null || _breakdown!.isEmpty) return const SizedBox();
    final total = _breakdown!.values.fold(0.0, (s, v) => s + v);
    final sorted = _breakdown!.entries.toList()..sort((a, b) => b.value.compareTo(a.value));

    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 28),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('DESGLOSE POR CATEGORÍA',
              style: Theme.of(context).textTheme.labelMedium?.copyWith(
                    letterSpacing: 1.2,
                    fontWeight: FontWeight.w700,
                    color: NinaColors.textTertiary,
                  )),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: NinaColors.surface,
              borderRadius: BorderRadius.circular(NinaRadii.card),
              border: Border.all(color: NinaColors.border),
            ),
            child: Column(
              children: sorted.map((e) {
                final pct = e.value / total;
                return Padding(
                  padding: const EdgeInsets.only(bottom: 14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(e.key, style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: NinaColors.textPrimary)),
                          Text('${(pct * 100).toStringAsFixed(0)}%',
                              style: Theme.of(context).textTheme.labelMedium?.copyWith(fontWeight: FontWeight.w700)),
                        ],
                      ),
                      const SizedBox(height: 6),
                      ClipRRect(
                        borderRadius: BorderRadius.circular(4),
                        child: LinearProgressIndicator(
                          value: pct,
                          minHeight: 5,
                          backgroundColor: NinaColors.surfaceAlt,
                          valueColor: const AlwaysStoppedAnimation(NinaColors.primary),
                        ),
                      ),
                    ],
                  ),
                );
              }).toList(),
            ),
          ),
        ],
      ),
    ).animate().fadeIn(delay: 200.ms);
  }
}
