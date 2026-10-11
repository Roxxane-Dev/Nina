import 'dart:async';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../core/theme/design_system.dart';
import '../../../core/utils/category_utils.dart';
import '../../../core/utils/money.dart';
import '../../../core/utils/transaction_display.dart';
import '../../../data/repositories/supabase_finance_repository.dart';
import '../../../data/services/finance_api_service.dart';
import '../../../domain/models/overview.dart';
import '../../../shared/widgets/add_transaction_sheet.dart';

enum _PeriodFilter { current, previous, all }

enum _TypeFilter { all, income, expense }

/// Movimientos (US-22, US-23, US-25, US-26).
/// The list is read from Supabase (RLS); the header totals come from the
/// engine (GET /v1/overview), never from summing rows here.
class MovimientosScreen extends StatefulWidget {
  const MovimientosScreen(
      {super.key, this.api, this.loadTransactions, this.watchChanges});

  final FinanceApiService? api;
  final Future<List<Map<String, dynamic>>> Function()? loadTransactions;
  final Stream<Object?> Function()? watchChanges;

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

  _PeriodFilter _period = _PeriodFilter.current;
  _TypeFilter _type = _TypeFilter.all;
  String? _category; // display label, null = all

  @override
  void initState() {
    super.initState();
    _searchCtrl.addListener(() => setState(() {}));
    _load();
    final watch = widget.watchChanges ??
        SupabaseFinanceRepository.instance.watchTransactions;
    _changes = watch().listen((_) => _load());
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
  Future<void> _changeCategory(Map<String, dynamic> row) async {
    final options =
        row['type'] == 'income' ? incomeCategories : expenseCategories;
    final picked = await showModalBottomSheet<String>(
      context: context,
      backgroundColor: NinaColors.surface,
      builder: (ctx) => SafeArea(
        child: ListView(
          shrinkWrap: true,
          children: [
            const Padding(
              padding: EdgeInsets.all(16),
              child: Text('Cambiar categoría',
                  style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: NinaColors.textPrimary)),
            ),
            for (final e in options.entries)
              ListTile(
                title: Text(e.value),
                trailing: categoryLabel(row['category'] as String?) == e.value
                    ? const Icon(Icons.check, color: NinaColors.accent)
                    : null,
                onTap: () => Navigator.pop(ctx, e.key),
              ),
          ],
        ),
      ),
    );
    if (picked == null || !mounted) return;
    try {
      final remembered =
          await _api.updateCategory(row['id'].toString(), picked);
      if (!mounted) return;
      final note = (row['description'] as String?)?.trim();
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(remembered && note != null && note.isNotEmpty
            ? 'Listo. La próxima vez que registres "$note" usaré esta categoría.'
            : 'Categoría actualizada.'),
      ));
      _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(financeErrorMessage(e))));
      }
    }
  }

  // ── UI ────────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: NinaColors.background,
      floatingActionButton: FloatingActionButton(
        key: const Key('movimientos-add'),
        heroTag: 'movimientos-add',
        tooltip: 'Agregar movimiento',
        backgroundColor: NinaColors.accent,
        foregroundColor: NinaColors.background,
        onPressed: _add,
        child: const Icon(Icons.add),
      ),
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildHeader(),
            _buildSearch(),
            _buildChips<_PeriodFilter>(
              {
                _PeriodFilter.current: 'Este mes',
                _PeriodFilter.previous: 'Mes anterior',
                _PeriodFilter.all: 'Todo'
              },
              _period,
              (v) {
                setState(() => _period = v);
                _load();
              },
            ),
            _buildChips<_TypeFilter>(
              {
                _TypeFilter.all: 'Todos',
                _TypeFilter.income: 'Ingresos',
                _TypeFilter.expense: 'Gastos'
              },
              _type,
              (v) => setState(() => _type = v),
            ),
            if (_categoryOptions.length > 1)
              _buildChips<String?>(
                {
                  null: 'Todas las categorías',
                  for (final c in _categoryOptions) c: c
                },
                _category,
                (v) => setState(() => _category = v),
              ),
            Expanded(child: _buildList()),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader() {
    final o = _overview;
    final figures = <Widget>[];
    if (o != null) {
      if (_period == _PeriodFilter.all) {
        figures.add(
            _Figure('Saldo', formatSoles(o.balance), NinaColors.textSecondary));
      } else {
        figures
          ..add(_Figure(
              'Gastos', '−${formatSoles(o.expenses)}', NinaColors.errorLight))
          ..add(_Figure(
              'Ingresos', '+${formatSoles(o.income)}', NinaColors.success))
          ..add(_Figure('Disponible', formatSoles(o.available),
              NinaColors.textSecondary));
      }
    }
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 20, 16, 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Movimientos',
              style: TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.w500,
                  color: NinaColors.textPrimary)),
          const SizedBox(height: 8),
          Wrap(spacing: 12, runSpacing: 4, children: figures),
        ],
      ),
    );
  }

  Widget _buildSearch() => Padding(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
        child: TextField(
          controller: _searchCtrl,
          decoration: const InputDecoration(
            isDense: true,
            prefixIcon: Icon(Icons.search, size: 18),
            hintText: 'Buscar por nota o categoría',
          ),
        ),
      );

  Widget _buildChips<T>(
      Map<T, String> options, T selected, ValueChanged<T> onSelect) {
    return SizedBox(
      height: 40,
      child: ListView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        children: [
          for (final e in options.entries)
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: ChoiceChip(
                label: Text(e.value, style: const TextStyle(fontSize: 11)),
                selected: e.key == selected,
                onSelected: (_) => onSelect(e.key),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildList() {
    if (_error != null && _rows == null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(_error!,
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: NinaColors.textSecondary)),
              const SizedBox(height: 12),
              OutlinedButton(onPressed: _load, child: const Text('Reintentar')),
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
          padding: const EdgeInsets.all(24),
          child: Text(
            (_rows ?? const []).isEmpty
                ? 'Aún no tienes movimientos. Toca + o cuéntaselo a Nina.'
                : 'No hay movimientos con estos filtros.',
            textAlign: TextAlign.center,
            style: const TextStyle(color: NinaColors.textTertiary),
          ),
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
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 96),
        children: [
          for (final g in groups.entries) ...[
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: Text(
                g.key,
                style: const TextStyle(
                    color: NinaColors.textTertiary,
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 1),
              ),
            ),
            for (final r in g.value) _buildRow(r),
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

  Widget _buildRow(Map<String, dynamic> r) {
    final isIncome = r['type'] == 'income';
    final amount = ((r['amount'] as num?) ?? 0).toDouble();
    final cat = categoryLabel(r['category'] as String?);
    final note = (r['description'] as String?)?.trim();
    return Dismissible(
      key: ValueKey('tx-${r['id']}'),
      direction: DismissDirection.endToStart,
      confirmDismiss: (_) => _confirmDelete(r),
      background: Container(
        alignment: Alignment.centerRight,
        padding: const EdgeInsets.only(right: 16),
        color: NinaColors.error.withAlpha(60),
        child: const Icon(Icons.delete_outline, color: NinaColors.errorLight),
      ),
      child: ListTile(
        onTap: () => _changeCategory(r),
        contentPadding: EdgeInsets.zero,
        leading: Text(
            CategoryUtils.categoryEmoji((r['category'] ?? '').toString()),
            style: const TextStyle(fontSize: 20)),
        title: Text(note?.isNotEmpty == true ? note! : cat,
            style:
                const TextStyle(fontSize: 13, color: NinaColors.textPrimary)),
        subtitle: Text(cat,
            style:
                const TextStyle(fontSize: 11, color: NinaColors.textTertiary)),
        trailing: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              '${isIncome ? '+' : '−'}${formatSoles(amount)}',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: isIncome ? NinaColors.success : NinaColors.errorLight,
              ),
            ),
            IconButton(
              tooltip: 'Eliminar',
              icon: const Icon(Icons.delete_outline,
                  size: 18, color: NinaColors.textTertiary),
              onPressed: () => _confirmDelete(r),
            ),
          ],
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
  Widget build(BuildContext context) => RichText(
        text: TextSpan(children: [
          TextSpan(
              text: '$label ',
              style: const TextStyle(
                  fontSize: 11, color: NinaColors.textTertiary)),
          TextSpan(
              text: value,
              style: TextStyle(
                  fontSize: 11, color: color, fontWeight: FontWeight.w600)),
        ]),
      );
}
