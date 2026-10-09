import 'dart:async';
import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../../core/theme/design_system.dart';
import '../../../data/repositories/supabase_finance_repository.dart';

class PresupuestoScreen extends StatefulWidget {
  const PresupuestoScreen({super.key});

  @override
  State<PresupuestoScreen> createState() => _PresupuestoScreenState();
}

class _PresupuestoScreenState extends State<PresupuestoScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabs;
  final _repo = SupabaseFinanceRepository.instance;

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: NinaColors.background,
      body: SafeArea(
        child: Column(
          children: [
            _buildHeader(),
            _buildTabBar(),
            Expanded(
              child: TabBarView(
                controller: _tabs,
                children: [
                  _PresupuestoTab(repo: _repo),
                  _SuscripcionesTab(repo: _repo),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 8),
      child: Row(
        children: [
          GestureDetector(
            onTap: () => context.pop(),
            child: const Icon(Icons.arrow_back_rounded,
                color: NinaColors.textPrimary),
          ),
          const SizedBox(width: 12),
          Text(
            'Presupuesto & Suscripciones',
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  fontWeight: FontWeight.w800,
                  fontSize: 22,
                  letterSpacing: -0.5,
                ),
          ),
        ],
      ),
    );
  }

  Widget _buildTabBar() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 4),
      child: Container(
        height: 44,
        decoration: BoxDecoration(
          color: NinaColors.surface,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: NinaColors.border),
        ),
        child: TabBar(
          controller: _tabs,
          indicator: BoxDecoration(
            color: NinaColors.primary,
            borderRadius: BorderRadius.circular(11),
          ),
          indicatorSize: TabBarIndicatorSize.tab,
          dividerColor: Colors.transparent,
          labelColor: Colors.white,
          unselectedLabelColor: NinaColors.textSecondary,
          labelStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
          tabs: const [
            Tab(text: 'Presupuesto'),
            Tab(text: 'Suscripciones'),
          ],
        ),
      ),
    );
  }
}

// ─── PRESUPUESTO TAB ──────────────────────────────────────────────────────────

class _PresupuestoTab extends StatefulWidget {
  final SupabaseFinanceRepository repo;
  const _PresupuestoTab({required this.repo});

  @override
  State<_PresupuestoTab> createState() => _PresupuestoTabState();
}

class _PresupuestoTabState extends State<_PresupuestoTab> {
  late Future<_BudgetData> _dataFuture;
  StreamSubscription<List<Map<String, dynamic>>>? _txSubscription;

  @override
  void initState() {
    super.initState();
    _dataFuture = _load();
    _txSubscription = widget.repo.watchTransactions().listen((_) {
      if (mounted) setState(() => _dataFuture = _load());
    });
  }

  @override
  void dispose() {
    _txSubscription?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<_BudgetData>(
      future: _dataFuture,
      builder: (context, snap) {
        if (snap.connectionState == ConnectionState.waiting) {
          return const Center(
              child: CircularProgressIndicator(color: NinaColors.primary));
        }
        if (snap.hasError) {
          return Center(
              child: Text(snap.error.toString(),
                  style: const TextStyle(color: NinaColors.textSecondary)));
        }
        final data = snap.data!;
        return _buildContent(context, data);
      },
    );
  }

  Future<_BudgetData> _load() async {
    final repo = widget.repo;
    final month = repo.currentMonth();
    final now = DateTime.now();
    final daysInMonth = DateTime(now.year, now.month + 1, 0).day;
    final daysElapsed = now.day;
    final daysRemaining = daysInMonth - daysElapsed;

    final budgets = await repo.getBudgets(month);
    final expenses = await repo.getExpenses(month: month);

    final budgetLimit = budgets.fold(
      0.0,
      (s, b) => s + SupabaseFinanceRepository.budgetLimit(b),
    );
    final totalSpent =
        expenses.fold(0.0, (s, e) => s + (e['amount'] as num).toDouble());

    // Daily totals
    final dailyTotals = List<double>.filled(daysInMonth, 0);
    for (final e in expenses) {
      final d = DateTime.tryParse(e['date'] as String? ?? '');
      if (d != null && d.month == now.month && d.year == now.year) {
        dailyTotals[d.day - 1] += (e['amount'] as num).toDouble();
      }
    }

    // Category breakdown
    final catSpent = <String, double>{};
    for (final e in expenses) {
      final cat = e['category'] as String? ?? 'Otros';
      catSpent[cat] = (catSpent[cat] ?? 0) + (e['amount'] as num).toDouble();
    }

    final catBudgets = budgets.map((b) {
      final cat = b['category'] as String? ?? 'Otros';
      return _CatBudget(
        category: cat,
        limit: SupabaseFinanceRepository.budgetLimit(b),
        spent: catSpent[cat] ?? 0,
      );
    }).toList()
      ..sort((a, b) => b.spent.compareTo(a.spent));

    final projection = daysElapsed > 0
        ? (totalSpent / daysElapsed) * daysInMonth
        : 0.0;

    final dailyAllowance =
        daysRemaining > 0 ? (budgetLimit - totalSpent) / daysRemaining : 0.0;

    return _BudgetData(
      budgetLimit: budgetLimit,
      totalSpent: totalSpent,
      dailyTotals: dailyTotals,
      catBudgets: catBudgets,
      projection: projection,
      dailyAllowance: dailyAllowance,
      daysInMonth: daysInMonth,
      today: now.day,
    );
  }

  Widget _buildContent(BuildContext context, _BudgetData data) {
    final fmt = NumberFormat('#,##0.00', 'es');
    final pct = data.budgetLimit > 0
        ? (data.totalSpent / data.budgetLimit).clamp(0.0, 1.0)
        : 0.0;
    final pctInt = (pct * 100).toInt();
    final isWarning = pct > 0.8;
    final isDanger = pct > 1.0;
    final barColor = isDanger
        ? NinaColors.error
        : isWarning
            ? NinaColors.warning
            : NinaColors.accent;

    return RefreshIndicator(
      color: NinaColors.primary,
      backgroundColor: NinaColors.surface,
      onRefresh: () async {},
      child: CustomScrollView(
        physics: const BouncingScrollPhysics(),
        slivers: [
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 100),
            sliver: SliverList(
              delegate: SliverChildListDelegate([
                // Overview card
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: NinaColors.surface,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: NinaColors.border),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text('Gastado',
                                  style: TextStyle(
                                      color: NinaColors.textTertiary,
                                      fontSize: 11)),
                              Text('S/ ${fmt.format(data.totalSpent)}',
                                  style: TextStyle(
                                    color: barColor,
                                    fontSize: 22,
                                    fontWeight: FontWeight.w800,
                                  )),
                            ],
                          ),
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              const Text('Límite',
                                  style: TextStyle(
                                      color: NinaColors.textTertiary,
                                      fontSize: 11)),
                              Text(
                                'S/ ${fmt.format(data.budgetLimit)}',
                                style: const TextStyle(
                                  color: NinaColors.textSecondary,
                                  fontSize: 18,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      ClipRRect(
                        borderRadius: BorderRadius.circular(6),
                        child: LinearProgressIndicator(
                          value: pct,
                          minHeight: 10,
                          backgroundColor: NinaColors.surfaceAlt,
                          valueColor: AlwaysStoppedAnimation(barColor),
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text('$pctInt% del presupuesto usado',
                          style: const TextStyle(
                              color: NinaColors.textTertiary, fontSize: 11)),
                    ],
                  ),
                ).animate().fadeIn(delay: 50.ms),

                const SizedBox(height: 10),

                // Warning if > 80%
                if (isWarning)
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: NinaColors.warning.withAlpha(20),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(
                          color: NinaColors.warning.withAlpha(80)),
                    ),
                    child: Row(
                      children: [
                        const Text('⚠️', style: TextStyle(fontSize: 16)),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            'Alcanzaste el $pctInt% de tu presupuesto mensual.',
                            style: const TextStyle(
                              color: NinaColors.warning,
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ).animate().fadeIn(delay: 100.ms),

                const SizedBox(height: 10),

                // Metrics row
                Row(
                  children: [
                    Expanded(
                      child: _MetricCard(
                        label: 'Proyección mensual',
                        value: 'S/ ${fmt.format(data.projection)}',
                        valueColor: data.projection > data.budgetLimit
                            ? NinaColors.error
                            : NinaColors.accent,
                        icon: Icons.trending_up_rounded,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: _MetricCard(
                        label: 'Disponible hoy',
                        value: 'S/ ${fmt.format(data.dailyAllowance.clamp(0, double.infinity))}',
                        valueColor: data.dailyAllowance > 0
                            ? NinaColors.accent
                            : NinaColors.error,
                        icon: Icons.calendar_today_rounded,
                      ),
                    ),
                  ],
                ).animate().fadeIn(delay: 100.ms),

                const SizedBox(height: 16),

                // Daily bar chart
                const _SectionLabel('GASTO DIARIO ESTE MES'),
                const SizedBox(height: 10),
                Container(
                  height: 140,
                  padding:
                      const EdgeInsets.fromLTRB(0, 8, 16, 8),
                  decoration: BoxDecoration(
                    color: NinaColors.surface,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: NinaColors.border),
                  ),
                  child: data.dailyTotals.every((v) => v == 0)
                      ? const Center(
                          child: Text('Sin gastos aún',
                              style: TextStyle(
                                  color: NinaColors.textTertiary)))
                      : BarChart(
                          BarChartData(
                            alignment: BarChartAlignment.spaceAround,
                            gridData: const FlGridData(show: false),
                            titlesData: FlTitlesData(
                              topTitles: const AxisTitles(
                                  sideTitles:
                                      SideTitles(showTitles: false)),
                              rightTitles: const AxisTitles(
                                  sideTitles:
                                      SideTitles(showTitles: false)),
                              leftTitles: const AxisTitles(
                                  sideTitles:
                                      SideTitles(showTitles: false)),
                              bottomTitles: AxisTitles(
                                sideTitles: SideTitles(
                                  showTitles: true,
                                  interval: 7,
                                  getTitlesWidget: (v, _) => Text(
                                    '${v.toInt() + 1}',
                                    style: const TextStyle(
                                      color: NinaColors.textTertiary,
                                      fontSize: 9,
                                    ),
                                  ),
                                ),
                              ),
                            ),
                            borderData: FlBorderData(show: false),
                            barGroups: data.dailyTotals
                                .asMap()
                                .entries
                                .map((e) => BarChartGroupData(
                                      x: e.key,
                                      barRods: [
                                        BarChartRodData(
                                          toY: e.value,
                                          color: e.key == data.today - 1
                                              ? NinaColors.accent
                                              : NinaColors.primary
                                                  .withAlpha(160),
                                          width: 6,
                                          borderRadius:
                                              BorderRadius.circular(3),
                                        ),
                                      ],
                                    ))
                                .toList(),
                          ),
                        ),
                ).animate().fadeIn(delay: 150.ms),

                const SizedBox(height: 16),

                // Category breakdown
                const _SectionLabel('POR CATEGORÍA'),
                const SizedBox(height: 10),
                ...data.catBudgets.map((cb) => _CatBudgetRow(item: cb)
                    .animate()
                    .fadeIn(delay: 200.ms)),

                const SizedBox(height: 12),

                // Edit limits button
                GestureDetector(
                  onTap: () => context.push('/chat'),
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    decoration: BoxDecoration(
                      color: NinaColors.surface,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: NinaColors.border),
                    ),
                    child: const Center(
                      child: Text(
                        'Editar Límites',
                        style: TextStyle(
                          color: NinaColors.primaryLight,
                          fontWeight: FontWeight.w700,
                          fontSize: 14,
                        ),
                      ),
                    ),
                  ),
                ).animate().fadeIn(delay: 250.ms),
              ]),
            ),
          ),
        ],
      ),
    );
  }
}

// ─── SUSCRIPCIONES TAB ────────────────────────────────────────────────────────

class _SuscripcionesTab extends StatefulWidget {
  final SupabaseFinanceRepository repo;
  const _SuscripcionesTab({required this.repo});

  @override
  State<_SuscripcionesTab> createState() => _SuscripcionesTabState();
}

class _SuscripcionesTabState extends State<_SuscripcionesTab> {
  String? _catFilter;

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<Map<String, dynamic>>>(
      future: widget.repo.getSubscriptions(),
      builder: (context, snap) {
        if (snap.connectionState == ConnectionState.waiting) {
          return const Center(
              child: CircularProgressIndicator(color: NinaColors.primary));
        }
        if (snap.hasError) {
          return Center(
              child: Text(snap.error.toString(),
                  style:
                      const TextStyle(color: NinaColors.textSecondary)));
        }
        final all = snap.data ?? [];
        if (all.isEmpty) {
          return _buildEmpty();
        }
        final cats = all
            .map((s) => s['category'] as String? ?? '')
            .where((c) => c.isNotEmpty)
            .toSet()
            .toList()
          ..sort();
        final filtered = _catFilter == null
            ? all
            : all
                .where((s) => s['category'] == _catFilter)
                .toList();
        final monthly = all.fold(
            0.0, (s, sub) => s + (sub['amount'] as num).toDouble());

        return CustomScrollView(
          physics: const BouncingScrollPhysics(),
          slivers: [
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 100),
              sliver: SliverList(
                delegate: SliverChildListDelegate([
                  _buildMetrics(monthly).animate().fadeIn(delay: 50.ms),
                  const SizedBox(height: 12),
                  _buildCatFilters(cats).animate().fadeIn(delay: 100.ms),
                  const SizedBox(height: 12),
                  if (filtered.isEmpty)
                    const Center(
                      child: Padding(
                        padding: EdgeInsets.all(24),
                        child: Text('Sin suscripciones en esta categoría',
                            style:
                                TextStyle(color: NinaColors.textTertiary)),
                      ),
                    )
                  else
                    ...filtered.asMap().entries.map((entry) =>
                        _SubCard(sub: entry.value)
                            .animate()
                            .fadeIn(
                                delay: Duration(
                                    milliseconds: 100 * entry.key))),
                  const SizedBox(height: 16),
                  _buildCoupleCTA(context).animate().fadeIn(delay: 300.ms),
                ]),
              ),
            ),
          ],
        );
      },
    );
  }

  Widget _buildMetrics(double monthly) {
    final fmt = NumberFormat('#,##0.00', 'es');
    return Row(
      children: [
        Expanded(
          child: _MetricCard(
            label: 'Mensual',
            value: 'S/ ${fmt.format(monthly)}',
            valueColor: NinaColors.error,
            icon: Icons.credit_card_rounded,
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: _MetricCard(
            label: 'Anual',
            value: 'S/ ${fmt.format(monthly * 12)}',
            valueColor: NinaColors.warning,
            icon: Icons.calendar_month_rounded,
          ),
        ),
      ],
    );
  }

  Widget _buildCatFilters(List<String> cats) {
    return SizedBox(
      height: 40,
      child: ListView(
        scrollDirection: Axis.horizontal,
        children: [
          _FilterChip(
            label: 'Todas',
            selected: _catFilter == null,
            onTap: () => setState(() => _catFilter = null),
          ),
          const SizedBox(width: 8),
          ...cats.map((c) => Padding(
                padding: const EdgeInsets.only(right: 8),
                child: _FilterChip(
                  label: c,
                  selected: _catFilter == c,
                  onTap: () =>
                      setState(() => _catFilter = _catFilter == c ? null : c),
                ),
              )),
        ],
      ),
    );
  }

  Widget _buildCoupleCTA(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF4C3AFF), Color(0xFF7B61FF)],
        ),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        children: [
          const Text('👫', style: TextStyle(fontSize: 28)),
          const SizedBox(width: 12),
          Expanded(
            child: const Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Comparte con tu pareja',
                    style: TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w700,
                      fontSize: 15,
                    )),
                SizedBox(height: 2),
                Text('Activa el modo En Pareja para gestionar suscripciones juntos.',
                    style: TextStyle(
                      color: Colors.white70,
                      fontSize: 12,
                      height: 1.4,
                    )),
              ],
            ),
          ),
          const Icon(Icons.arrow_forward_ios_rounded,
              color: Colors.white70, size: 16),
        ],
      ),
    );
  }

  Widget _buildEmpty() {
    return const Center(
      child: Padding(
        padding: EdgeInsets.all(40),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text('📱', style: TextStyle(fontSize: 48)),
            SizedBox(height: 16),
            Text(
              'Aún no tienes suscripciones registradas.\nCuéntale a Nina cuáles tienes.',
              style:
                  TextStyle(color: NinaColors.textSecondary, fontSize: 14),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}

// ─── SHARED WIDGETS ───────────────────────────────────────────────────────────

class _MetricCard extends StatelessWidget {
  final String label;
  final String value;
  final Color valueColor;
  final IconData icon;

  const _MetricCard({
    required this.label,
    required this.value,
    required this.valueColor,
    required this.icon,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: NinaColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: NinaColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: valueColor, size: 20),
          const SizedBox(height: 8),
          Text(value,
              style: TextStyle(
                color: valueColor,
                fontSize: 16,
                fontWeight: FontWeight.w800,
              )),
          const SizedBox(height: 2),
          Text(label,
              style: const TextStyle(
                color: NinaColors.textTertiary,
                fontSize: 11,
              )),
        ],
      ),
    );
  }
}

class _CatBudgetRow extends StatelessWidget {
  final _CatBudget item;
  const _CatBudgetRow({required this.item});

  @override
  Widget build(BuildContext context) {
    final fmt = NumberFormat('#,##0.00', 'es');
    final pct = item.limit > 0
        ? (item.spent / item.limit).clamp(0.0, 1.0)
        : 0.0;
    final pctInt = (pct * 100).toInt();
    final barColor = pct > 0.85
        ? NinaColors.error
        : pct > 0.6
            ? NinaColors.warning
            : NinaColors.accent;

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: NinaColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: NinaColors.border),
      ),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(item.category,
                  style: const TextStyle(
                    color: NinaColors.textPrimary,
                    fontWeight: FontWeight.w600,
                    fontSize: 13,
                  )),
              Text(
                'S/ ${fmt.format(item.spent)} / S/ ${fmt.format(item.limit)}',
                style: TextStyle(
                  color: barColor,
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: pct,
              minHeight: 6,
              backgroundColor: NinaColors.surfaceAlt,
              valueColor: AlwaysStoppedAnimation(barColor),
            ),
          ),
          const SizedBox(height: 4),
          Align(
            alignment: Alignment.centerRight,
            child: Text('$pctInt%',
                style: TextStyle(
                  color: barColor,
                  fontSize: 10,
                  fontWeight: FontWeight.w700,
                )),
          ),
        ],
      ),
    );
  }
}

class _SubCard extends StatelessWidget {
  final Map<String, dynamic> sub;
  const _SubCard({required this.sub});

  @override
  Widget build(BuildContext context) {
    final fmt = NumberFormat('#,##0.00', 'es');
    final dateFmt = DateFormat('d MMM yyyy', 'es');
    final amount = (sub['amount'] as num).toDouble();
    final nextDate = DateTime.tryParse(sub['next_billing_date'] as String? ?? '');
    final daysLeft = nextDate?.difference(DateTime.now()).inDays ?? 0;
    final category = sub['category'] as String? ?? '';

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: NinaColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: NinaColors.border),
      ),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: NinaColors.primary.withAlpha(30),
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Center(
                child: Text('📱', style: TextStyle(fontSize: 20))),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(sub['name'] as String? ?? '',
                    style: const TextStyle(
                      color: NinaColors.textPrimary,
                      fontWeight: FontWeight.w700,
                      fontSize: 14,
                    )),
                const SizedBox(height: 2),
                Text(
                  category.isNotEmpty ? category : 'Suscripción',
                  style: const TextStyle(
                    color: NinaColors.textTertiary,
                    fontSize: 11,
                  ),
                ),
                if (nextDate != null)
                  Text(
                    'Próximo cobro: ${dateFmt.format(nextDate)} ($daysLeft días)',
                    style: TextStyle(
                      color: daysLeft <= 3
                          ? NinaColors.warning
                          : NinaColors.textTertiary,
                      fontSize: 11,
                    ),
                  ),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                'S/ ${fmt.format(amount)}',
                style: const TextStyle(
                  color: NinaColors.error,
                  fontWeight: FontWeight.w700,
                  fontSize: 14,
                ),
              ),
              const Text('/mes',
                  style: TextStyle(
                    color: NinaColors.textTertiary,
                    fontSize: 10,
                  )),
            ],
          ),
        ],
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;

  const _FilterChip(
      {required this.label, required this.selected, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: selected ? NinaColors.primary : NinaColors.surface,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
              color: selected ? NinaColors.primary : NinaColors.border),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: selected ? Colors.white : NinaColors.textSecondary,
            fontSize: 13,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
    );
  }
}

class _SectionLabel extends StatelessWidget {
  final String text;
  const _SectionLabel(this.text);

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: const TextStyle(
        color: NinaColors.textTertiary,
        fontSize: 11,
        fontWeight: FontWeight.w700,
        letterSpacing: 1.0,
      ),
    );
  }
}

// ─── DATA MODELS ─────────────────────────────────────────────────────────────

class _BudgetData {
  final double budgetLimit;
  final double totalSpent;
  final List<double> dailyTotals;
  final List<_CatBudget> catBudgets;
  final double projection;
  final double dailyAllowance;
  final int daysInMonth;
  final int today;

  const _BudgetData({
    required this.budgetLimit,
    required this.totalSpent,
    required this.dailyTotals,
    required this.catBudgets,
    required this.projection,
    required this.dailyAllowance,
    required this.daysInMonth,
    required this.today,
  });
}

class _CatBudget {
  final String category;
  final double limit;
  final double spent;
  const _CatBudget(
      {required this.category, required this.limit, required this.spent});
}
