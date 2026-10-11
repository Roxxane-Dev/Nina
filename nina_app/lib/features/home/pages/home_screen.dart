import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../../core/theme/design_system.dart';
import '../../../core/utils/category_utils.dart';
import '../../../core/utils/money.dart';
import '../../../core/utils/transaction_display.dart';
import '../../../data/repositories/supabase_finance_repository.dart';
import '../../../data/services/finance_api_service.dart';
import '../../../domain/models/nina_user_profile.dart';
import '../../../domain/models/overview.dart';
import '../../../shared/widgets/add_transaction_sheet.dart';

/// Inicio (US-18 to US-21, US-04). Every figure comes from GET /v1/overview
/// (the backend engine); the app never sums transactions itself.
class HomeScreen extends StatefulWidget {
  const HomeScreen(
      {super.key,
      this.api,
      this.loadRecent,
      this.loadProfile,
      this.watchChanges});

  /// Injectable for tests.
  final FinanceApiService? api;
  final Future<List<Map<String, dynamic>>> Function()? loadRecent;
  final Future<NinaUserProfile> Function()? loadProfile;
  final Stream<Object?> Function()? watchChanges;

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeData {
  const _HomeData(this.overview, this.recent);
  final Overview overview;
  final List<Map<String, dynamic>> recent;
}

class _HomeScreenState extends State<HomeScreen> with WidgetsBindingObserver {
  late final FinanceApiService _api = widget.api ?? FinanceApiService.instance;
  late Future<_HomeData> _dataFuture;
  StreamSubscription<Object?>? _changes;
  NinaUserProfile? _profile;
  OverviewPeriod _period = OverviewPeriod.current;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _dataFuture = _loadData();
    _refreshProfile();
    final watch = widget.watchChanges ??
        SupabaseFinanceRepository.instance.watchTransactions;
    _changes = watch().listen((_) => _reload());
  }

  @override
  void dispose() {
    _changes?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) _reload();
  }

  void _reload() {
    if (mounted) setState(() => _dataFuture = _loadData());
  }

  Future<void> _refreshProfile() async {
    final load =
        widget.loadProfile ?? SupabaseFinanceRepository.instance.getCurrentUser;
    try {
      final p = await load();
      if (mounted) setState(() => _profile = p);
    } catch (_) {
      // The greeting falls back to "Hola"; nothing else depends on the profile.
    }
  }

  Future<_HomeData> _loadData() async {
    final loadRecent = widget.loadRecent ??
        () => SupabaseFinanceRepository.instance.getActivityFeed(limit: 5);
    final results =
        await Future.wait([_api.getOverview(period: _period), loadRecent()]);
    return _HomeData(
        results[0] as Overview, results[1] as List<Map<String, dynamic>>);
  }

  Future<void> _addManually() async {
    if (await showAddTransactionSheet(context, api: _api)) _reload();
  }

  String _greeting() {
    final hour = DateTime.now().hour;
    if (hour < 12) return 'Buenos días';
    if (hour < 18) return 'Buenas tardes';
    return 'Buenas noches';
  }

  String _displayName() {
    final full = _profile?.fullName?.trim();
    if (full != null && full.isNotEmpty) return full.split(' ').first;
    final email = _profile?.email;
    if (email != null && email.contains('@')) {
      final local = email.split('@').first;
      if (local.isNotEmpty) return local[0].toUpperCase() + local.substring(1);
    }
    return '';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: NinaColors.background,
      body: SafeArea(
        child: RefreshIndicator(
          color: NinaColors.accent,
          backgroundColor: NinaColors.surface,
          onRefresh: () async {
            await _refreshProfile();
            _reload();
            await _dataFuture
                .catchError((_) => const _HomeData(_emptyOverview, []));
          },
          child: FutureBuilder<_HomeData>(
            future: _dataFuture,
            builder: (context, snap) {
              final slivers = <Widget>[
                SliverToBoxAdapter(child: _buildHeader())
              ];
              if (snap.connectionState == ConnectionState.waiting) {
                slivers.add(const SliverToBoxAdapter(child: _Skeleton()));
              } else if (snap.hasError) {
                slivers
                    .add(SliverToBoxAdapter(child: _buildError(snap.error!)));
              } else {
                final data = snap.data!;
                if (!data.overview.hasHistory) {
                  slivers.add(SliverToBoxAdapter(child: _buildEmptyState()));
                } else {
                  slivers.addAll([
                    SliverToBoxAdapter(child: _buildPeriodSelector()),
                    SliverToBoxAdapter(child: _buildHero(data.overview)),
                    SliverToBoxAdapter(child: _buildCategories(data.overview)),
                    SliverToBoxAdapter(child: _buildRecent(data.recent)),
                  ]);
                }
              }
              slivers
                  .add(const SliverToBoxAdapter(child: SizedBox(height: 120)));
              return CustomScrollView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  slivers: slivers);
            },
          ),
        ),
      ),
    );
  }

  // 1. Header: greeting + quick add.
  Widget _buildHeader() {
    final name = _displayName();
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Expanded(
            child: Text(
              name.isEmpty ? '${_greeting()} 👋' : '${_greeting()} 👋,\n$name',
              style: const TextStyle(
                fontSize: 28,
                fontWeight: FontWeight.w800,
                color: NinaColors.textPrimary,
                height: 1.15,
                letterSpacing: -0.5,
              ),
            ),
          ),
          IconButton.filledTonal(
            key: const Key('home-add'),
            tooltip: 'Agregar movimiento',
            onPressed: _addManually,
            icon: const Icon(Icons.add, color: NinaColors.accent),
          ),
        ],
      ),
    ).animate().fadeIn(duration: 300.ms);
  }

  // 2. Period selector (US-20).
  Widget _buildPeriodSelector() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
      child: SegmentedButton<OverviewPeriod>(
        segments: [
          for (final p in OverviewPeriod.values)
            ButtonSegment(value: p, label: Text(p.label)),
        ],
        selected: {_period},
        onSelectionChanged: (s) {
          setState(() {
            _period = s.first;
            _dataFuture = _loadData();
          });
        },
      ),
    );
  }

  // 3. Hero (US-18): balance, available, income and expenses of the period.
  Widget _buildHero(Overview o) {
    final change = o.expensesChange;
    final changeText = change == 0
        ? 'Igual que ${o.previousLabel}'
        : '${change > 0 ? '+' : '−'}${formatSoles(change.abs())} en gastos vs. ${o.previousLabel}';
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Container(
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            colors: [Color(0xFF5C3DCC), Color(0xFF4228A6)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(20),
        ),
        padding: const EdgeInsets.all(18),
        margin: const EdgeInsets.only(bottom: 14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const _HeroLabel('SALDO SEGÚN TUS MOVIMIENTOS'),
            const SizedBox(height: 6),
            Text(
              formatSoles(o.balance),
              key: const Key('home-balance'),
              style: const TextStyle(
                  fontSize: 32,
                  fontWeight: FontWeight.w700,
                  color: Colors.white,
                  height: 1),
            ),
            const SizedBox(height: 14),
            Container(height: 1, color: Colors.white.withAlpha(40)),
            const SizedBox(height: 12),
            _HeroLabel('DISPONIBLE · ${o.periodLabel.toUpperCase()}'),
            const SizedBox(height: 4),
            Text(
              formatSoles(o.available),
              key: const Key('home-available'),
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w700,
                color: o.available >= 0
                    ? NinaColors.accent
                    : NinaColors.errorLight,
              ),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                    child: _HeroFigure(label: 'INGRESOS', value: o.income)),
                Container(
                    width: 1, height: 32, color: Colors.white.withAlpha(40)),
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.only(left: 16),
                    child: _HeroFigure(label: 'GASTOS', value: o.expenses),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Text(changeText,
                style: TextStyle(
                    fontSize: 11, color: Colors.white.withAlpha(190))),
          ],
        ),
      ),
    ).animate().fadeIn(delay: 100.ms).slideY(begin: 0.05, end: 0);
  }

  // 4. Spend by category (US-19).
  Widget _buildCategories(Overview o) {
    return _Section(
      title: 'En qué gastas · ${o.periodLabel}',
      child: o.categories.isEmpty
          ? Text(
              'No tienes gastos registrados en ${o.periodLabel}.',
              style:
                  const TextStyle(color: NinaColors.textTertiary, fontSize: 12),
            )
          : Column(
              children: [
                for (final c in o.categories.take(5))
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 6),
                    child: Column(
                      children: [
                        Row(
                          children: [
                            Text(CategoryUtils.categoryEmoji(c.slug),
                                style: const TextStyle(fontSize: 14)),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(c.label,
                                  style: const TextStyle(
                                      color: NinaColors.textPrimary,
                                      fontSize: 13)),
                            ),
                            Text(
                              '${formatSoles(c.amount)} · ${c.sharePct}%',
                              style: const TextStyle(
                                  color: NinaColors.textSecondary,
                                  fontSize: 12),
                            ),
                          ],
                        ),
                        const SizedBox(height: 6),
                        ClipRRect(
                          borderRadius: BorderRadius.circular(4),
                          child: LinearProgressIndicator(
                            value: c.sharePct / 100,
                            minHeight: 6,
                            backgroundColor: NinaColors.surfaceAlt,
                            color: NinaColors.primaryLight,
                          ),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
    );
  }

  // 5. Latest movements (list only).
  Widget _buildRecent(List<Map<String, dynamic>> rows) {
    return _Section(
      title: 'Últimos movimientos',
      trailing: TextButton(
          onPressed: () => context.go('/transactions'),
          child: const Text('Ver todos')),
      child: Column(
        children: [
          for (final r in rows)
            ListTile(
              dense: true,
              contentPadding: EdgeInsets.zero,
              leading: Text(
                  CategoryUtils.categoryEmoji((r['category'] ?? '').toString()),
                  style: const TextStyle(fontSize: 18)),
              title: Text(
                (r['description'] as String?)?.trim().isNotEmpty == true
                    ? r['description'] as String
                    : categoryLabel(r['category'] as String?),
                style: const TextStyle(
                    color: NinaColors.textPrimary, fontSize: 13),
              ),
              subtitle: Text(
                _dayLabel(r['date'] as String?),
                style: const TextStyle(
                    color: NinaColors.textTertiary, fontSize: 11),
              ),
              trailing: Text(
                '${r['type'] == 'income' ? '+' : '−'}${formatSoles(((r['amount'] as num?) ?? 0).toDouble())}',
                style: TextStyle(
                  color: r['type'] == 'income'
                      ? NinaColors.success
                      : NinaColors.textPrimary,
                  fontWeight: FontWeight.w600,
                  fontSize: 13,
                ),
              ),
            ),
        ],
      ),
    );
  }

  String _dayLabel(String? raw) {
    final d = storedDay(raw);
    return d == null ? '' : DateFormat("d 'de' MMM", 'es').format(d);
  }

  // Empty state (US-21, US-04): invite to the first movement.
  Widget _buildEmptyState() {
    return Padding(
      key: const Key('home-empty'),
      padding: const EdgeInsets.all(16),
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: NinaColors.surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: NinaColors.border),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Aún no tienes movimientos',
              style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                  color: NinaColors.textPrimary),
            ),
            const SizedBox(height: 8),
            const Text(
              'Registra tu primer ingreso o gasto y Nina empezará a mostrarte en qué se va tu plata. '
              'Puedes contárselo como a una amiga: "me pagaron 3500" o "gasté 25 en taxi".',
              style: TextStyle(color: NinaColors.textSecondary, height: 1.4),
            ),
            const SizedBox(height: 16),
            FilledButton.icon(
              onPressed: () => context.go('/chat'),
              icon: const Icon(Icons.auto_awesome),
              label: const Text('Contárselo a Nina'),
            ),
            const SizedBox(height: 8),
            OutlinedButton.icon(
              onPressed: _addManually,
              icon: const Icon(Icons.edit_note),
              label: const Text('Agregar manualmente'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildError(Object error) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          Text(financeErrorMessage(error),
              textAlign: TextAlign.center,
              style: const TextStyle(color: NinaColors.textSecondary)),
          const SizedBox(height: 12),
          OutlinedButton(onPressed: _reload, child: const Text('Reintentar')),
        ],
      ),
    );
  }
}

const _emptyOverview = Overview(
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

class _HeroLabel extends StatelessWidget {
  const _HeroLabel(this.text);
  final String text;

  @override
  Widget build(BuildContext context) => Text(
        text,
        style: const TextStyle(
            fontSize: 10,
            color: Color(0xB3E2DDF5),
            letterSpacing: 0.8,
            fontWeight: FontWeight.w600),
      );
}

class _HeroFigure extends StatelessWidget {
  const _HeroFigure({required this.label, required this.value});
  final String label;
  final double value;

  @override
  Widget build(BuildContext context) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _HeroLabel(label),
          const SizedBox(height: 4),
          Text(formatSoles(value),
              style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  color: Colors.white)),
        ],
      );
}

class _Section extends StatelessWidget {
  const _Section({required this.title, required this.child, this.trailing});
  final String title;
  final Widget child;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 14),
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: NinaColors.surface,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: NinaColors.border, width: 0.5),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(title,
                        style: const TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                            color: NinaColors.textPrimary)),
                  ),
                  if (trailing != null) trailing!,
                ],
              ),
              const SizedBox(height: 8),
              child,
            ],
          ),
        ),
      );
}

class _Skeleton extends StatelessWidget {
  const _Skeleton();

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            for (final h in [180.0, 140.0, 120.0])
              Container(
                height: h,
                margin: const EdgeInsets.only(bottom: 14),
                decoration: BoxDecoration(
                    color: NinaColors.surface,
                    borderRadius: BorderRadius.circular(16)),
              ),
          ],
        ),
      );
}
