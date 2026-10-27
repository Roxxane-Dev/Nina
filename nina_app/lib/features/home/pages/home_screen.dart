import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../../core/theme/design_system.dart';
import '../../../core/utils/money.dart';
import '../../../core/utils/transaction_display.dart';
import '../../../data/repositories/supabase_finance_repository.dart';
import '../../../data/services/finance_api_service.dart';
import '../../../domain/models/nina_user_profile.dart';
import '../../../domain/models/overview.dart';
import '../../../shared/widgets/add_transaction_sheet.dart';
import '../../../shared/widgets/nina_ui.dart';
import '../../transactions/widgets/transaction_row.dart';
import '../widgets/audit_sheet.dart';

/// Inicio (US-18 to US-21, US-04). Every figure comes from GET /v1/overview
/// (the backend engine); the app never sums transactions itself.
class HomeScreen extends StatefulWidget {
  const HomeScreen(
      {super.key,
      this.api,
      this.loadRecent,
      this.loadProfile,
      this.watchChanges,
      this.onOpenTransactions});

  /// Injectable for tests.
  final FinanceApiService? api;
  final Future<List<Map<String, dynamic>>> Function()? loadRecent;
  final Future<NinaUserProfile> Function()? loadProfile;
  final Stream<Object?> Function()? watchChanges;

  /// Opens Movimientos filtered to a period ('current' | 'previous'). Default: router.
  final void Function(String period)? onOpenTransactions;

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
    if (mounted) {
      setState(() {
        _dataFuture = _loadData();
      });
    }
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

  void _openTransactions() {
    final period = _period == OverviewPeriod.previous ? 'previous' : 'current';
    final open = widget.onOpenTransactions;
    if (open != null) {
      open(period);
    } else {
      context.go('/transactions?period=$period');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: RefreshIndicator(
          color: NinaColors.cocoa,
          onRefresh: () async {
            await _refreshProfile();
            _reload();
            await _dataFuture
                .catchError((_) => const _HomeData(_emptyOverview, []));
          },
          child: FutureBuilder<_HomeData>(
            future: _dataFuture,
            builder: (context, snap) {
              final children = <Widget>[_buildHeader()];
              if (snap.connectionState == ConnectionState.waiting) {
                children.add(const _Skeleton());
              } else if (snap.hasError) {
                children.add(_buildError(snap.error!));
              } else {
                final data = snap.data!;
                if (!data.overview.hasHistory) {
                  children.addAll([_buildEmptyState(), _buildAskNina()]);
                } else {
                  children.addAll([
                    _buildPeriodSelector(),
                    _buildHero(data.overview),
                    _buildAskNina(),
                    _buildQuickActions(),
                    _buildCategories(data.overview),
                    _buildRecent(data.recent),
                  ]);
                }
              }
              return ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.fromLTRB(
                    NinaSpace.gutter, 12, NinaSpace.gutter, 128),
                children: [
                  for (final c in children)
                    Padding(
                        padding: const EdgeInsets.only(bottom: 20), child: c),
                ],
              );
            },
          ),
        ),
      ),
    );
  }

  Widget _buildHeader() {
    final name = _displayName();
    final today = DateFormat("EEEE d 'de' MMMM", 'es').format(DateTime.now());
    return Row(
      children: [
        Expanded(
          child:
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(today[0].toUpperCase() + today.substring(1),
                style: NinaText.bodyS(color: NinaColors.textTertiary)),
            const SizedBox(height: 2),
            Text(name.isEmpty ? 'Hey 👋' : 'Hey, $name',
                key: const Key('home-greeting'), style: NinaText.displayM()),
          ]),
        ),
        GestureDetector(
          key: const Key('home-profile'),
          onTap: () => context.push('/profile'),
          child: NinaPersonAvatar(name: name.isEmpty ? 'N' : name),
        ),
      ],
    ).animate().fadeIn(duration: 300.ms);
  }

  Widget _buildPeriodSelector() {
    return Row(children: [
      for (final p in OverviewPeriod.values)
        Padding(
          padding: const EdgeInsets.only(right: 8),
          child: NinaChip(
            key: Key('home-period-${p.param}'),
            label: p.label,
            selected: _period == p,
            onTap: () => setState(() {
              _period = p;
              _dataFuture = _loadData();
            }),
          ),
        ),
    ]);
  }

  // Hero (US-18): available of the period, income/expenses and balance.
  Widget _buildHero(Overview o) {
    final positive = o.available >= 0;
    final change = o.expensesChange;
    final changeText = change == 0
        ? 'Gastos iguales que en ${o.previousLabel}'
        : '${change > 0 ? '+' : '−'}${formatSoles(change.abs())} en gastos vs. ${o.previousLabel}';
    return NinaCard(
      padding: const EdgeInsets.all(22),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Expanded(
            child: Text('DISPONIBLE · ${o.periodLabel.toUpperCase()}',
                style: NinaText.caps()),
          ),
          NinaPill(
            label: positive ? 'En positivo' : 'En rojo',
            tone: positive ? NinaTone.positive : NinaTone.negative,
          ),
        ]),
        const SizedBox(height: 10),
        FittedBox(
          fit: BoxFit.scaleDown,
          alignment: Alignment.centerLeft,
          child: Text(
            formatSoles(o.available),
            key: const Key('home-available'),
            style: NinaText.hero(
                color: positive ? NinaColors.textPrimary : NinaColors.error),
          ),
        ),
        const SizedBox(height: 16),
        Row(children: [
          Expanded(
              child: _HeroFigure(
                  label: 'Ingresos',
                  value: o.income,
                  color: NinaColors.success)),
          Expanded(child: _HeroFigure(label: 'Gastos', value: o.expenses)),
        ]),
        const SizedBox(height: 12),
        Text(changeText, style: NinaText.bodyS(color: NinaColors.textTertiary)),
        const SizedBox(height: 14),
        const Divider(height: 1),
        const SizedBox(height: 12),
        Row(children: [
          Text('Saldo según tus movimientos ',
              style: NinaText.bodyS(color: NinaColors.textTertiary)),
          Text(formatSoles(o.balance),
              key: const Key('home-balance'), style: NinaText.bodySStrong()),
        ]),
        if (o.audit != null) ...[
          const SizedBox(height: 6),
          InkWell(
            key: const Key('home-audit'),
            borderRadius: BorderRadius.circular(8),
            onTap: () => showAuditSheet(
              context,
              audit: o.audit!,
              onViewTransactions: _openTransactions,
            ),
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: Row(children: [
                const Icon(Icons.calculate_outlined,
                    size: 18, color: NinaColors.accent),
                const SizedBox(width: 8),
                Expanded(
                  child: Text('Cómo calculé esto',
                      style: NinaText.bodyMStrong(color: NinaColors.accent)),
                ),
                const Icon(Icons.chevron_right_rounded,
                    size: 20, color: NinaColors.accent),
              ]),
            ),
          ),
        ],
      ]),
    ).animate().fadeIn(delay: 100.ms).slideY(begin: 0.05, end: 0);
  }

  /// Entry point to the chat. No figures here: numbers live in the hero.
  Widget _buildAskNina() {
    return NinaCard(
      color: NinaColors.cocoa,
      border: false,
      onTap: () => context.go('/chat'),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          const NinaMark(size: 28),
          const SizedBox(width: 10),
          Text('Nina', style: NinaText.bodySStrong(color: NinaColors.peach)),
        ]),
        const SizedBox(height: 12),
        Text(
            '¿Me alcanza para eso que estás pensando? Pregúntame y te respondo con tus números.',
            style: NinaText.bodyL(color: NinaColors.textInverse)),
        const SizedBox(height: 14),
        Container(
          key: const Key('home-ask'),
          padding: const EdgeInsets.fromLTRB(16, 8, 8, 8),
          decoration: BoxDecoration(
            color: NinaColors.textInverse.withAlpha(26),
            borderRadius: BorderRadius.circular(NinaRadii.pill),
          ),
          child: Row(children: [
            const NinaSparkle(size: 16),
            const SizedBox(width: 10),
            Expanded(
              child: Text('Pregúntale a Nina…',
                  style: NinaText.bodyM(
                      color: NinaColors.textInverse.withAlpha(180))),
            ),
            Container(
              width: 32,
              height: 32,
              decoration: const BoxDecoration(
                  color: NinaColors.peach, shape: BoxShape.circle),
              child: const Icon(Icons.arrow_upward_rounded,
                  size: 16, color: NinaColors.cocoa),
            ),
          ]),
        ),
      ]),
    );
  }

  Widget _buildQuickActions() {
    Widget action(Key key, IconData icon, String label, VoidCallback onTap,
            {bool primary = false}) =>
        Expanded(
          child: Material(
            color: primary ? NinaColors.peachSoft : NinaColors.surface,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(20),
              side: BorderSide(
                  color: primary ? NinaColors.peach : NinaColors.border),
            ),
            child: InkWell(
              key: key,
              borderRadius: BorderRadius.circular(20),
              onTap: onTap,
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      NinaIconBox(
                        icon: icon,
                        size: 36,
                        background:
                            primary ? NinaColors.cocoa : NinaColors.surfaceAlt,
                        foreground: primary
                            ? NinaColors.textInverse
                            : NinaColors.textPrimary,
                      ),
                      const SizedBox(height: 8),
                      Text(label, style: NinaText.bodySStrong()),
                    ]),
              ),
            ),
          ),
        );
    return Row(children: [
      action(const Key('home-add'), Icons.add, 'Añadir gasto', _addManually,
          primary: true),
      const SizedBox(width: 10),
      action(const Key('home-spaces'), Icons.group_outlined, 'Espacio',
          () => context.go('/space')),
      const SizedBox(width: 10),
      action(const Key('home-goals'), Icons.track_changes_outlined, 'Metas',
          () => context.go('/goals')),
    ]);
  }

  // Spend by category (US-19).
  Widget _buildCategories(Overview o) {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      NinaSectionHeader(title: '¿En qué se va? · ${o.periodLabel}'),
      const SizedBox(height: 8),
      NinaCard(
        child: o.categories.isEmpty
            ? Text('No tienes gastos registrados en ${o.periodLabel}.',
                style: NinaText.bodyS())
            : Column(children: [
                for (final c in o.categories.take(5))
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    child: Column(children: [
                      Row(children: [
                        Icon(categoryIcon(c.slug),
                            size: 18, color: NinaColors.textSecondary),
                        const SizedBox(width: 10),
                        Expanded(
                            child:
                                Text(c.label, style: NinaText.bodyMStrong())),
                        Text('${formatSoles(c.amount)} · ${c.sharePct}%',
                            style: NinaText.bodySStrong()),
                      ]),
                      const SizedBox(height: 8),
                      NinaProgressBar(value: c.sharePct / 100, height: 6),
                    ]),
                  ),
              ]),
      ),
    ]);
  }

  // Latest movements (list only).
  Widget _buildRecent(List<Map<String, dynamic>> rows) {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      NinaSectionHeader(
        title: 'Últimos movimientos',
        action: 'Ver todos',
        onAction: () => context.go('/transactions'),
      ),
      const SizedBox(height: 8),
      NinaCard(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
        child: rows.isEmpty
            ? Padding(
                padding: const EdgeInsets.symmetric(vertical: 16),
                child:
                    Text('Sin movimientos recientes.', style: NinaText.bodyS()))
            : Column(children: [
                for (var i = 0; i < rows.length; i++) ...[
                  if (i > 0) const Divider(height: 1),
                  TransactionRow(
                    title: (rows[i]['description'] as String?)
                                ?.trim()
                                .isNotEmpty ==
                            true
                        ? rows[i]['description'] as String
                        : categoryLabel(rows[i]['category'] as String?),
                    meta:
                        '${categoryLabel(rows[i]['category'] as String?)} · ${_dayLabel(rows[i]['date'] as String?)}',
                    amount: ((rows[i]['amount'] as num?) ?? 0).toDouble(),
                    isIncome: rows[i]['type'] == 'income',
                    category: rows[i]['category'] as String?,
                  ),
                ],
              ]),
      ),
    ]);
  }

  String _dayLabel(String? raw) {
    final d = storedDay(raw);
    return d == null ? '' : DateFormat("d 'de' MMM", 'es').format(d);
  }

  // Empty state (US-21, US-04): invite to the first movement.
  Widget _buildEmptyState() {
    return NinaCard(
      key: const Key('home-empty'),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const NinaIconBox(
            icon: Icons.receipt_long_outlined,
            size: 56,
            background: NinaColors.peachSoft),
        const SizedBox(height: 16),
        Text('Aún no tienes movimientos', style: NinaText.titleL()),
        const SizedBox(height: 8),
        Text(
          'Registra tu primer ingreso o gasto y Nina empezará a mostrarte en qué se va tu plata. '
          'Puedes contárselo como a una amiga: "me pagaron 3500" o "gasté 25 en taxi".',
          style: NinaText.bodyM(),
        ),
        const SizedBox(height: 16),
        NinaButton(
          label: 'Contárselo a Nina',
          icon: Icons.auto_awesome_outlined,
          onPressed: () => context.go('/chat'),
        ),
        const SizedBox(height: 8),
        NinaButton(
          key: const Key('home-add'),
          label: 'Agregar manualmente',
          variant: NinaButtonVariant.secondary,
          onPressed: _addManually,
        ),
      ]),
    );
  }

  Widget _buildError(Object error) {
    return Column(children: [
      const SizedBox(height: 40),
      Text(financeErrorMessage(error),
          textAlign: TextAlign.center, style: NinaText.bodyM()),
      const SizedBox(height: 12),
      NinaButton(
          label: 'Reintentar',
          variant: NinaButtonVariant.secondary,
          expand: false,
          onPressed: _reload),
    ]);
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

class _HeroFigure extends StatelessWidget {
  const _HeroFigure(
      {required this.label,
      required this.value,
      this.color = NinaColors.textPrimary});
  final String label;
  final double value;
  final Color color;

  @override
  Widget build(BuildContext context) =>
      Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(label, style: NinaText.bodyS()),
        const SizedBox(height: 2),
        Text(formatSoles(value), style: NinaText.number(color: color)),
      ]);
}

class _Skeleton extends StatelessWidget {
  const _Skeleton();

  @override
  Widget build(BuildContext context) => Column(
        children: [
          for (final h in [220.0, 150.0, 120.0])
            Container(
              height: h,
              margin: const EdgeInsets.only(bottom: 16),
              decoration: BoxDecoration(
                  color: NinaColors.surfaceAlt,
                  borderRadius: BorderRadius.circular(NinaRadii.lg)),
            ),
        ],
      );
}
