import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:intl/intl.dart';
import '../../../core/theme/design_system.dart';
import '../../../data/repositories/mock_finance_repository.dart';
import '../../../domain/models/transaction.dart';
import '../../../data/services/insight_engine.dart';
import '../../home/widgets/transaction_tile.dart';

class TransactionsPage extends StatefulWidget {
  const TransactionsPage({super.key});

  @override
  State<TransactionsPage> createState() => _TransactionsPageState();
}

class _TransactionsPageState extends State<TransactionsPage> {
  final _repo = MockFinanceRepository();
  List<Transaction>? _txs;
  TransactionCategory? _filter;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final data = await _repo.getTransactions();
    if (mounted) setState(() => _txs = data);
  }

  List<Transaction> get _filtered {
    if (_filter == null) return _txs ?? [];
    return (_txs ?? []).where((t) => t.category == _filter).toList();
  }

  Map<String, List<Transaction>> get _grouped {
    final result = <String, List<Transaction>>{};
    for (final t in _filtered) {
      final key = _dateGroup(t.date);
      result.putIfAbsent(key, () => []).add(t);
    }
    return result;
  }

  String _dateGroup(DateTime d) {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final date = DateTime(d.year, d.month, d.day);
    if (date == today) return 'Hoy';
    if (date == today.subtract(const Duration(days: 1))) return 'Ayer';
    return DateFormat('d MMMM', 'es').format(d);
  }

  // Nina insight banner
  String? get _insightBanner {
    if (_txs == null) return null;
    final food = _txs!
        .where((t) =>
            t.category == TransactionCategory.food &&
            !t.isIncome &&
            t.date.isAfter(DateTime.now().subtract(const Duration(days: 7))))
        .fold(0.0, (s, t) => s + t.amount);
    if (food > 200) {
      return '⚠️ Gastas \$${food.toStringAsFixed(0)} en comida esta semana — 40% por encima de tu promedio.';
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: NinaColors.background,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildHeader(context),
            _buildFilterChips(),
            if (_insightBanner != null) _buildBanner(),
            Expanded(child: _buildList()),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 8),
      child: Text('Movimientos',
          style: Theme.of(context).textTheme.titleLarge?.copyWith(
                fontWeight: FontWeight.w800,
                fontSize: 26,
              )),
    );
  }

  Widget _buildFilterChips() {
    final cats = [null, ...TransactionCategory.values];
    return SizedBox(
      height: 44,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 20),
        itemCount: cats.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (context, i) {
          final cat = cats[i];
          final selected = _filter == cat;
          final label = cat == null ? 'Todos' : InsightEngine.categoryLabel(cat);
          return GestureDetector(
            onTap: () => setState(() => _filter = cat),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              decoration: BoxDecoration(
                color: selected ? NinaColors.primary : NinaColors.surface,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(
                  color: selected ? NinaColors.primary : NinaColors.border,
                ),
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
        },
      ),
    );
  }

  Widget _buildBanner() {
    return Container(
      margin: const EdgeInsets.fromLTRB(20, 12, 20, 0),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: NinaColors.warning.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: NinaColors.warning.withValues(alpha: 0.4)),
      ),
      child: Text(
        _insightBanner!,
        style: const TextStyle(color: NinaColors.warning, fontSize: 13, height: 1.4),
      ),
    ).animate().fadeIn().slideY(begin: -0.1, end: 0);
  }

  Widget _buildList() {
    if (_txs == null) {
      return const Center(child: CircularProgressIndicator(color: NinaColors.primary));
    }
    final groups = _grouped;
    final keys = groups.keys.toList();
    return ListView.builder(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
      itemCount: keys.length,
      itemBuilder: (context, i) {
        final key = keys[i];
        final items = groups[key]!;
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: EdgeInsets.only(bottom: 8, top: i > 0 ? 20 : 0),
              child: Text(
                key,
                style: Theme.of(context).textTheme.labelMedium?.copyWith(
                      color: NinaColors.textTertiary,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 0.8,
                    ),
              ),
            ),
            ...items.map((t) => TransactionTile(tx: t)
                .animate()
                .fadeIn(delay: Duration(milliseconds: 40 * items.indexOf(t)))
                .slideX(begin: 0.05, end: 0)),
          ],
        );
      },
    );
  }
}
