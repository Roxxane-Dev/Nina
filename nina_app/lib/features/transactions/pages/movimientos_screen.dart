import 'dart:async';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../core/theme/design_system.dart';
import '../../../core/utils/money.dart';
import '../../../core/utils/transaction_display.dart';
import '../../../data/repositories/supabase_finance_repository.dart';
import '../../../data/services/accounts_api_service.dart';
import '../../../data/services/finance_api_service.dart';
import '../../../domain/models/overview.dart';
import '../../../shared/widgets/add_transaction_sheet.dart';
import '../../../shared/widgets/nina_ui.dart';
import '../widgets/edit_transaction_sheet.dart';
import '../widgets/transaction_row.dart';

enum _PeriodFilter { current, previous, all }

enum _TypeFilter { all, income, expense }

/// Movimientos (US-22, US-23, US-25, US-26).
/// The list is read from Supabase (RLS); the header totals come from the
/// engine (GET /v1/overview), never from summing rows here.
class MovimientosScreen extends StatefulWidget {
  const MovimientosScreen(
      {super.key,
      this.api,
      this.loadTransactions,
      this.watchChanges,
      this.loadAccounts,
      this.initialPeriod});

  final FinanceApiService? api;
  final Future<List<Map<String, dynamic>>> Function()? loadTransactions;
  final Stream<Object?> Function()? watchChanges;
  final Future<List<Account>> Function()? loadAccounts;

  /// 'current' | 'previous' | 'all'; anything else means the current month.
  final String? initialPeriod;

  @override
  State<MovimientosScreen> createState() => _MovimientosScreenState();
}

class _MovimientosScreenState extends State<MovimientosScreen> {
  late final FinanceApiService _api = widget.api ?? FinanceApiService.instance;
  final _searchCtrl = TextEditingController();
  StreamSubscription<Object?>? _changes;

  List<Map<String, dynamic>>? _rows;
  Overview? _overview;
  String? _error;

  late _PeriodFilter _period = switch (widget.initialPeriod) {
    'previous' => _PeriodFilter.previous,
    'all' => _PeriodFilter.all,
    _ => _PeriodFilter.current,
  };
  _TypeFilter _type = _TypeFilter.all;
  String? _category; // display label, null = all
  String? _accountId; // US-41 filter, null = all
  List<Account> _accounts = const [];

  @override
  void initState() {
    super.initState();
    _searchCtrl.addListener(() => setState(() {}));
    _load();
    final watch = widget.watchChanges ??
        SupabaseFinanceRepository.instance.watchTransactions;
    _changes = watch().listen((_) => _load());
    final loadAccounts =
        widget.loadAccounts ?? AccountsApiService.instance.list;
    // Accounts are optional (and not enabled before migration 019): ignore errors.
    loadAccounts().then((list) {
      if (mounted) setState(() => _accounts = list);
    }).catchError((_) {});
  }

  @override
  void dispose() {
    _changes?.cancel();
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final loadRows = widget.loadTransactions ??
        () => SupabaseFinanceRepository.instance.getTransactions();
    try {
      final rows = await loadRows();
      final overview = _period == _PeriodFilter.all
          ? await _api.getOverview()
          : await _api.getOverview(
              period: _period == _PeriodFilter.current
                  ? OverviewPeriod.current
                  : OverviewPeriod.previous);
      if (!mounted) return;
      setState(() {
        _rows = rows;
        _overview = overview;
        _error = null;
      });
    } catch (e) {
      if (mounted) setState(() => _error = financeErrorMessage(e));
    }
  }

  // ── Filters (US-23). Filtering only selects rows to display. ──────────────

  bool _inPeriod(DateTime? day) {
    if (_period == _PeriodFilter.all) return true;
    if (day == null) return false;
    final now = DateTime.now();
    final target = _period == _PeriodFilter.current
        ? DateTime(now.year, now.month)
        : DateTime(now.year, now.month - 1);
    return day.year == target.year && day.month == target.month;
  }

  List<Map<String, dynamic>> get _filtered {
    final q = _searchCtrl.text.trim().toLowerCase();
    return (_rows ?? const []).where((r) {
      if (_type == _TypeFilter.income && r['type'] != 'income') return false;
      if (_type == _TypeFilter.expense && r['type'] != 'expense') return false;
      if (_accountId != null && r['account_id'] != _accountId) return false;
      if (_category != null &&
          categoryLabel(r['category'] as String?) != _category) {
        return false;
      }
      if (!_inPeriod(storedDay(r['date'] as String?))) return false;
      if (q.isNotEmpty) {
        final text =
            '${r['description'] ?? ''} ${categoryLabel(r['category'] as String?)}'
                .toLowerCase();
        if (!text.contains(q)) return false;
      }
      return true;
    }).toList()
      ..sort((a, b) {
        final da = storedDay(a['date'] as String?) ?? DateTime(1970);
        final db = storedDay(b['date'] as String?) ?? DateTime(1970);
        return db.compareTo(da);
      });
  }

  List<String> get _categoryOptions {
    final set = <String>{
      for (final r in _rows ?? const []) categoryLabel(r['category'] as String?)
    };
    return set.toList()..sort();
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  Future<void> _add() async {
    if (await showAddTransactionSheet(context, api: _api)) _load();
  }

  /// US-25: delete with confirmation; totals refresh from the engine.
  Future<bool> _confirmDelete(Map<String, dynamic> row) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Eliminar movimiento'),
        content: Text(
          '¿Eliminar ${formatSoles(((row['amount'] as num?) ?? 0).toDouble())} de ${categoryLabel(row['category'] as String?)}? '
          'Dejará de contar en tu saldo y en tus totales.',
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Cancelar')),
          FilledButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('Eliminar')),
        ],
      ),
    );
    if (ok != true) return false;
    try {
      await _api.deleteTransaction(row['id'].toString());
      setState(
          () => _rows = _rows?.where((r) => r['id'] != row['id']).toList());
      _load();
      return true;
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(financeErrorMessage(e))));
      }
      return false;
    }
  }

  /// US-24: pick the right category; Nina remembers it for similar descriptions.
  /// HOME-03: amount, date, note and (except contributions) category.
  Future<void> _edit(Map<String, dynamic> row) async {
    final result = await showEditTransactionSheet(context, row: row, api: _api);
    if (result == null || !mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(result.remembered && result.note.isNotEmpty
          ? 'Listo. La próxima vez que registres "${result.note}" usaré esta categoría.'
          : 'Movimiento actualizado.'),
    ));
    _load();
  }

  // ── UI ────────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      floatingActionButton: Padding(
        // Keep the button above the floating tab bar.
        padding: const EdgeInsets.only(bottom: 88),
        child: FloatingActionButton(
          key: const Key('movimientos-add'),
          heroTag: 'movimientos-add',
          tooltip: 'Agregar movimiento',
          backgroundColor: NinaColors.cocoa,
          foregroundColor: NinaColors.textInverse,
          shape: const CircleBorder(),
          onPressed: _add,
          child: const Icon(Icons.add),
        ),
      ),
      body: SafeArea(
        bottom: false,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildHeader(),
            _buildSearch(),
            NinaChipRow<_PeriodFilter>(
              options: const {
                _PeriodFilter.current: 'Este mes',
                _PeriodFilter.previous: 'Mes anterior',
                _PeriodFilter.all: 'Todo'
              },
              selected: _period,
              onSelect: (v) {
                setState(() => _period = v);
                _load();
              },
            ),
            const SizedBox(height: 8),
            Expanded(child: _buildList()),
          ],
        ),
      ),
    );
  }

  /// How many extra filters (type, account, category) are on.
  int get _activeFilters =>
      (_type != _TypeFilter.all ? 1 : 0) +
      (_accountId != null ? 1 : 0) +
      (_category != null ? 1 : 0);

  Widget _buildHeader() {
    final o = _overview;
    final figures = <Widget>[];
    if (o != null) {
      if (_period == _PeriodFilter.all) {
        figures.add(
            _Figure('Saldo', formatSoles(o.balance), NinaColors.textPrimary));
      } else {
        figures
          ..add(_Figure(
              'Gastos',
              '${o.expenses > 0 ? '−' : ''}${formatSoles(o.expenses)}',
              NinaColors.textPrimary))
          ..add(_Figure(
              'Ingresos',
              '${o.income > 0 ? '+' : ''}${formatSoles(o.income)}',
              NinaColors.success))
          ..add(_Figure(
              'Disponible',
              formatSoles(o.available),
              o.available >= 0 || o.negativeFromSetAside
                  ? NinaColors.textPrimary
                  : NinaColors.error));
      }
    }
    return Padding(
      padding:
          const EdgeInsets.fromLTRB(NinaSpace.gutter, 16, NinaSpace.gutter, 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Expanded(child: Text('Movimientos', style: NinaText.displayM())),
            NinaCircleButton(
              key: const Key('movimientos-import'),
              icon: Icons.upload_outlined,
              tooltip: 'Importar CSV',
              onTap: () async {
                await context.push('/import');
                if (mounted) _load();
              },
            ),
          ]),
          if (figures.isNotEmpty) ...[
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.symmetric(vertical: 10),
              decoration: BoxDecoration(
                color: NinaColors.surface,
                borderRadius: BorderRadius.circular(NinaRadii.md),
                border: Border.all(color: NinaColors.border),
              ),
              child: Row(
                children: [for (final f in figures) Expanded(child: f)],
              ),
            ),
            // HOME-02: without this line the three figures do not add up.
            if (o != null && _period != _PeriodFilter.all && o.setAside != 0)
              Padding(
                padding: const EdgeInsets.only(top: 6, left: 4),
                child: Text(
                  o.setAside > 0
                      ? 'El disponible descuenta ${formatSoles(o.setAside)} apartados para tus metas'
                      : 'El disponible suma ${formatSoles(-o.setAside)} retirados de tus metas',
                  key: const Key('movimientos-set-aside'),
                  style: NinaText.bodyS(color: NinaColors.textTertiary),
                ),
              ),
          ],
        ],
      ),
    );
  }

  /// Type, account and category live in a sheet so the list keeps the screen.
  Future<void> _openFilters() async {
    await showModalBottomSheet<void>(
      useRootNavigator: true,
      context: context,
      isScrollControlled: true,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheet) {
          void update(VoidCallback change) {
            setState(change);
            setSheet(() {});
          }

          Widget group(String title, List<Widget> chips) => Padding(
                padding: const EdgeInsets.only(bottom: 18),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: NinaText.caps()),
                    const SizedBox(height: 8),
                    Wrap(spacing: 8, runSpacing: 8, children: chips),
                  ],
                ),
              );

          return SafeArea(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(24, 0, 24, 16),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(children: [
                    Expanded(
                        child: Text('Filtros', style: NinaText.displayM())),
                    if (_activeFilters > 0)
                      TextButton(
                        key: const Key('filters-clear'),
                        onPressed: () => update(() {
                          _type = _TypeFilter.all;
                          _accountId = null;
                          _category = null;
                        }),
                        child: const Text('Limpiar'),
                      ),
                  ]),
                  const SizedBox(height: 12),
                  group('Tipo', [
                    for (final e in const {
                      _TypeFilter.all: 'Todos',
                      _TypeFilter.income: 'Ingresos',
                      _TypeFilter.expense: 'Gastos'
                    }.entries)
                      NinaChip(
                        key: Key('filter-type-${e.key.name}'),
                        label: e.value,
                        selected: _type == e.key,
                        onTap: () => update(() => _type = e.key),
                      ),
                  ]),
                  if (_accounts.isNotEmpty)
                    group('Cuenta', [
                      NinaChip(
                        label: 'Todas',
                        selected: _accountId == null,
                        onTap: () => update(() => _accountId = null),
                      ),
                      for (final a in _accounts)
                        NinaChip(
                          label: a.name,
                          selected: _accountId == a.id,
                          onTap: () => update(() => _accountId = a.id),
                        ),
                    ]),
                  if (_categoryOptions.length > 1)
                    group('Categoría', [
                      NinaChip(
                        label: 'Todas',
                        selected: _category == null,
                        onTap: () => update(() => _category = null),
                      ),
                      for (final c in _categoryOptions)
                        NinaChip(
                          key: Key('filter-category-$c'),
                          label: c,
                          icon: categoryIcon(c),
                          selected: _category == c,
                          onTap: () => update(() => _category = c),
                        ),
                    ]),
                  NinaButton(
                    key: const Key('filters-apply'),
                    label: 'Ver movimientos',
                    onPressed: () => Navigator.of(ctx).pop(),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildSearch() => Padding(
        padding: const EdgeInsets.fromLTRB(
            NinaSpace.gutter, 0, NinaSpace.gutter, 10),
        child: Row(children: [
          Expanded(
            child: TextField(
              controller: _searchCtrl,
              style: NinaText.bodyM(color: NinaColors.textPrimary),
              decoration: InputDecoration(
                isDense: true,
                prefixIcon: const Icon(Icons.search,
                    size: 20, color: NinaColors.textTertiary),
                hintText: 'Buscar',
                hintStyle: NinaText.bodyM(color: NinaColors.textTertiary),
                border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(NinaRadii.pill),
                    borderSide: const BorderSide(color: NinaColors.border)),
                enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(NinaRadii.pill),
                    borderSide: const BorderSide(color: NinaColors.border)),
              ),
            ),
          ),
          const SizedBox(width: 8),
          Badge(
            isLabelVisible: _activeFilters > 0,
            label: Text('$_activeFilters'),
            backgroundColor: NinaColors.accent,
            child: NinaCircleButton(
              key: const Key('movimientos-filters'),
              icon: Icons.tune_rounded,
              tooltip: 'Filtros',
              size: 48,
              filled: _activeFilters > 0,
              onTap: _openFilters,
            ),
          ),
        ]),
      );

  Widget _buildList() {
    if (_error != null && _rows == null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(_error!,
                  textAlign: TextAlign.center, style: NinaText.bodyM()),
              const SizedBox(height: 12),
              NinaButton(
                  label: 'Reintentar',
                  variant: NinaButtonVariant.secondary,
                  expand: false,
                  onPressed: _load),
            ],
          ),
        ),
      );
    }
    if (_rows == null) return const Center(child: CircularProgressIndicator());

    final rows = _filtered;
    if (rows.isEmpty) {
      return Center(
        key: const Key('movimientos-empty'),
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            const NinaIconBox(
                icon: Icons.receipt_long_outlined,
                size: 56,
                background: NinaColors.peachSoft),
            const SizedBox(height: 14),
            Text(
              (_rows ?? const []).isEmpty
                  ? 'Aún no tienes movimientos. Toca + o cuéntaselo a Nina.'
                  : 'No hay movimientos con estos filtros.',
              textAlign: TextAlign.center,
              style: NinaText.bodyM(),
            ),
          ]),
        ),
      );
    }

    final groups = <String, List<Map<String, dynamic>>>{};
    for (final r in rows) {
      groups
          .putIfAbsent(_dayGroup(storedDay(r['date'] as String?)), () => [])
          .add(r);
    }
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(
            NinaSpace.gutter, 4, NinaSpace.gutter, 180),
        children: [
          for (final g in groups.entries) ...[
            Padding(
              padding: const EdgeInsets.fromLTRB(4, 12, 4, 8),
              child: Text(g.key, style: NinaText.caps()),
            ),
            NinaCard(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 2),
              child: Column(children: [
                for (var i = 0; i < g.value.length; i++) ...[
                  if (i > 0) const Divider(height: 1),
                  _buildRow(g.value[i]),
                ],
              ]),
            ),
          ],
        ],
      ),
    );
  }

  String _dayGroup(DateTime? d) {
    if (d == null) return 'SIN FECHA';
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    if (d == today) return 'HOY';
    if (d == today.subtract(const Duration(days: 1))) return 'AYER';
    return DateFormat("d 'de' MMM yyyy", 'es').format(d).toUpperCase();
  }

  static final _goalMovementPrefix = RegExp(r'^(Apartado|Retiro) · ');

  Widget _buildRow(Map<String, dynamic> r) {
    final isIncome = r['type'] == 'income';
    final amount = ((r['amount'] as num?) ?? 0).toDouble();
    final cat = movementLabel(r);
    final note = (r['description'] as String?)?.trim();
    return Dismissible(
      key: ValueKey('tx-${r['id']}'),
      direction: DismissDirection.endToStart,
      confirmDismiss: (_) => _confirmDelete(r),
      background: Container(
        alignment: Alignment.centerRight,
        padding: const EdgeInsets.only(right: 16),
        color: NinaColors.errorSoft,
        child: const Icon(Icons.delete_outline, color: NinaColors.error),
      ),
      child: TransactionRow(
        // A contribution is named by its goal, the part a long title would cut.
        title: note?.isNotEmpty == true
            ? note!.replaceFirst(_goalMovementPrefix, '')
            : cat,
        meta: cat,
        amount: amount,
        isIncome: isIncome,
        neutral: isGoalWithdrawal(r),
        category: r['category'] as String?,
        onTap: () => _edit(r),
        trailing: IconButton(
          tooltip: 'Eliminar',
          visualDensity: VisualDensity.compact,
          icon: const Icon(Icons.delete_outline,
              size: 18, color: NinaColors.textTertiary),
          onPressed: () => _confirmDelete(r),
        ),
      ),
    );
  }
}

class _Figure extends StatelessWidget {
  const _Figure(this.label, this.value, this.color);
  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) => Column(children: [
        Text(label, style: NinaText.bodyS(color: NinaColors.textTertiary)),
        const SizedBox(height: 2),
        FittedBox(
          fit: BoxFit.scaleDown,
          child: Text(value, style: NinaText.bodyMStrong(color: color)),
        ),
      ]);
}
