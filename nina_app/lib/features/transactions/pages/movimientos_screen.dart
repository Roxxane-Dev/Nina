import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../core/theme/design_system.dart';
import '../../../core/utils/category_utils.dart';
import '../../../data/repositories/supabase_finance_repository.dart';
import '../../../data/services/intelligence_api_service.dart';
import '../../../domain/models/nina_snapshot.dart';
import '../../../shared/widgets/nina_glass_card.dart';

class MovimientosScreen extends StatefulWidget {
  const MovimientosScreen({super.key});

  @override
  State<MovimientosScreen> createState() => _MovimientosScreenState();
}

class _MovimientosScreenState extends State<MovimientosScreen> {
  final _repo = SupabaseFinanceRepository.instance;
  final _intelligence = IntelligenceApiService.instance;
  final _searchCtrl = TextEditingController();
  
  String _selectedFilter = 'Todos';
  List<Map<String, dynamic>>? _transactions;
  NinaSnapshot? _snapshot;
  StreamSubscription<List<Map<String, dynamic>>>? _txSubscription;

  static const _filters = [
    'Todos',
    'Ingresos',
    'Gastos',
    '#Fijos',
    '#Variables',
    '#Hormiga',
  ];

  @override
  void initState() {
    super.initState();
    _searchCtrl.addListener(() => setState(() {}));
    _load();
    _txSubscription = _repo.watchTransactions().listen((_) {
      _intelligence.invalidate();
      _load();
    });
  }

  @override
  void dispose() {
    _txSubscription?.cancel();
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final data = await _repo.getTransactions();
    final snap = await _intelligence.fetchSnapshot(forceRefresh: true);
    if (!mounted) return;
    setState(() {
      _transactions = data;
      _snapshot = snap;
    });
  }

  bool get _hasSearchQuery => _searchCtrl.text.trim().isNotEmpty;

  List<Map<String, dynamic>> get _filtered {
    if (_transactions == null) return [];
    var list = _transactions!;
    
    switch (_selectedFilter) {
      case 'Ingresos':
        list = list.where((e) => e['type'] == 'income').toList();
        break;
      case 'Gastos':
        list = list.where((e) => e['type'] == 'expense').toList();
        break;
      case '#Fijos':
        list = list.where((e) => CategoryUtils.getTxTag(e) == '#Fijo').toList();
        break;
      case '#Variables':
        list = list.where((e) => CategoryUtils.getTxTag(e) == '#Variable').toList();
        break;
      case '#Hormiga':
        list = list.where((e) => CategoryUtils.getTxTag(e) == '#Hormiga').toList();
        break;
      default:
        break;
    }

    final q = _searchCtrl.text.trim().toLowerCase();
    if (q.isNotEmpty) {
      list = list.where((e) {
        final desc = (e['description'] as String? ?? '').toLowerCase();
        final cat = (e['category'] as String? ?? '').toLowerCase();
        return desc.contains(q) || cat.contains(q);
      }).toList();
    }
    return list;
  }

  Map<String, List<Map<String, dynamic>>> get _grouped {
    final result = <String, List<Map<String, dynamic>>>{};
    for (final e in _filtered) {
      final key = _dateGroup(e['date'] as String? ?? '');
      result.putIfAbsent(key, () => []).add(e);
    }
    for (final list in result.values) {
      list.sort((a, b) {
        final da = DateTime.tryParse(a['date'] as String? ?? '') ?? DateTime(1970);
        final db = DateTime.tryParse(b['date'] as String? ?? '') ?? DateTime(1970);
        return db.compareTo(da);
      });
    }
    return result;
  }

  String _dateGroup(String dateStr) {
    final d = DateTime.tryParse(dateStr);
    if (d == null) return 'Anterior';
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final date = DateTime(d.year, d.month, d.day);
    if (date == today) return 'HOY';
    if (date == today.subtract(const Duration(days: 1))) return 'AYER';
    return DateFormat('d MMM', 'es').format(d).toUpperCase();
  }

  int _groupOrder(String key) {
    if (key == 'HOY') return 0;
    if (key == 'AYER') return 1;
    return 2; 
  }

  String _fmt(double v) => NumberFormat('#,##0.00', 'es').format(v);

  Widget _buildHeader() {
    var expenses = 0.0;
    var income = 0.0;

    if (_transactions != null && _transactions!.isNotEmpty) {
      final now = DateTime.now();
      var hasCurrentMonthData = false;

      // First check if current month has data
      for (final t in _transactions!) {
        final d = DateTime.tryParse(t['date'] as String? ?? '');
        if (d != null && d.year == now.year && d.month == now.month) {
          hasCurrentMonthData = true;
          break;
        }
      }

      // If current month has no data, use ALL transactions
      // Otherwise, use only current month transactions
      for (final t in _transactions!) {
        final d = DateTime.tryParse(t['date'] as String? ?? '');
        if (d != null) {
          if (!hasCurrentMonthData || (d.year == now.year && d.month == now.month)) {
            final a = (t['amount'] as num?)?.toDouble() ?? 0;
            if (t['type'] == 'expense') expenses += a;
            else if (t['type'] == 'income') income += a;
          }
        }
      }
    }
    final savings = income - expenses;

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 20, 16, 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Movimientos',
            style: TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.w500,
              color: NinaColors.textPrimary,
            ),
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              RichText(
                text: TextSpan(
                  children: [
                    const TextSpan(
                      text: 'Gastos ',
                      style: TextStyle(fontSize: 11, color: NinaColors.textTertiary),
                    ),
                    TextSpan(
                      text: '−S/ ${_fmt(expenses)}',
                      style: const TextStyle(
                        fontSize: 11,
                        color: NinaColors.errorLight,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              RichText(
                text: TextSpan(
                  children: [
                    const TextSpan(
                      text: 'Ingresos ',
                      style: TextStyle(fontSize: 11, color: NinaColors.textTertiary),
                    ),
                    TextSpan(
                      text: '+S/ ${_fmt(income)}',
                      style: const TextStyle(
                        fontSize: 11,
                        color: NinaColors.success,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              RichText(
                text: TextSpan(
                  children: [
                    const TextSpan(
                      text: 'Ahorro ',
                      style: TextStyle(fontSize: 11, color: NinaColors.textTertiary),
                    ),
                    TextSpan(
                      text: 'S/ ${_fmt(savings)}',
                      style: const TextStyle(
                        fontSize: 11,
                        color: NinaColors.textSecondary,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  String _getPatronDelMes() {
    if (_transactions == null || _transactions!.isEmpty) return 'Registra más movimientos para ver patrones completos.';

    final now = DateTime.now();
    final expenses = _transactions!.where((t) {
      final d = DateTime.tryParse(t['date'] as String? ?? '');
      return t['type'] == 'expense' && d != null && d.year == now.year && d.month == now.month;
    }).toList();

    if (expenses.isEmpty) return 'Tu patrón es excelente, aún no hay gastos registrados.';

    final byCat = <String, double>{};
    for (final e in expenses) {
      final cat = (e['category'] as String? ?? 'otros').toLowerCase();
      final a = (e['amount'] as num?)?.toDouble() ?? 0;
      byCat[cat] = (byCat[cat] ?? 0) + a;
    }

    if (byCat.length == 1) {
      return 'Solo tienes 1 categoría activa. Registrar más gastos le da a Nina mejor contexto para ayudarte.';
    }

    // Check for gastos hormiga
    final hormiga = expenses.where((t) {
      final a = (t['amount'] as num?)?.toDouble() ?? 0;
      return a < 30;
    }).toList();

    if (hormiga.length >= 3) {
      final totalHormiga = hormiga.fold<double>(0, (sum, t) => sum + ((t['amount'] as num?)?.toDouble() ?? 0));
      return 'Detecté ${hormiga.length} gastos hormiga que suman S/ ${_fmt(totalHormiga)}.';
    }

    final top = byCat.entries.reduce((a, b) => a.value > b.value ? a : b);
    if (top.key.toLowerCase() == 'otros' && top.value == 0) {
      return 'Registra más movimientos para ver patrones completos.';
    }
    return 'Tu categoría de mayor gasto es ${CategoryUtils.capitalizar(top.key)} con S/ ${_fmt(top.value)}.';
  }

  Widget _buildNinaCard() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
      child: Container(
        decoration: BoxDecoration(
          color: NinaColors.surface,
          border: Border.all(color: NinaColors.border, width: 0.5),
          borderRadius: BorderRadius.circular(14),
        ),
        padding: const EdgeInsets.all(12).copyWith(right: 14),
        margin: const EdgeInsets.only(bottom: 12),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 28,
              height: 28,
              decoration: const BoxDecoration(shape: BoxShape.circle, color: NinaColors.accent),
              child: const Icon(Icons.auto_awesome_rounded, size: 14, color: NinaColors.background),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    "NINA — PATRÓN DEL MES",
                    style: TextStyle(
                      fontSize: 9,
                      color: NinaColors.accent,
                      fontWeight: FontWeight.w500,
                      letterSpacing: 0.45,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    _getPatronDelMes(),
                    style: const TextStyle(
                      fontSize: 12,
                      color: NinaColors.textSecondary,
                      height: 1.5,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFilters() {
    return SizedBox(
      height: 40,
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        physics: const BouncingScrollPhysics(),
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: _filters.length,
        itemBuilder: (ctx, i) {
          final filter = _filters[i];
          final selected = _selectedFilter == filter;
          return Padding(
            padding: const EdgeInsets.only(right: 8),
            child: GestureDetector(
              onTap: () => setState(() => _selectedFilter = filter),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
                decoration: BoxDecoration(
                  color: selected ? NinaColors.accent : Colors.transparent,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(
                    color: selected ? NinaColors.accent : NinaColors.border,
                    width: 0.5,
                  ),
                ),
                child: Text(
                  filter,
                  style: TextStyle(
                    color: selected ? NinaColors.background : NinaColors.textTertiary,
                    fontSize: 11,
                    fontWeight: selected ? FontWeight.w500 : FontWeight.normal,
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildList() {
    if (_transactions == null) {
      return ListView.builder(
        padding: const EdgeInsets.all(20),
        itemCount: 5,
        itemBuilder: (ctx, i) => Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: Container(
            height: 70,
            decoration: BoxDecoration(
              color: NinaColors.surface,
              borderRadius: BorderRadius.circular(12),
            ),
          ).animate(onPlay: (c) => c.repeat()).shimmer(
            duration: 1200.ms,
            color: NinaColors.surfaceAlt.withAlpha(80),
          ),
        ),
      );
    }

    final groups = _grouped;
    if (groups.isEmpty) return _buildEmptyState();

    final keys = groups.keys.toList()
      ..sort((a, b) {
        final oa = _groupOrder(a);
        final ob = _groupOrder(b);
        if (oa != ob) return oa.compareTo(ob);
        return 0;
      });

    return RefreshIndicator(
      color: NinaColors.primary,
      backgroundColor: NinaColors.surface,
      onRefresh: _load,
      child: ListView.builder(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
        itemCount: keys.length,
        itemBuilder: (ctx, i) {
          final key = keys[i];
          final items = groups[key]!;
          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 8),
                child: Text(
                  key,
                  style: const TextStyle(
                    color: NinaColors.textTertiary,
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 1.0,
                  ),
                ),
              ),
              ...items.map((tx) => _buildTxItem(tx)),
            ],
          );
        },
      ),
    );
  }

  Widget _buildTxItem(Map<String, dynamic> tx) {
    final isIncome = tx['type'] == 'income';
    final isExpense = !isIncome;
    final amount = (tx['amount'] as num).toDouble();
    final cat = tx['category'] as String? ?? 'otros';
    final desc = tx['description'] as String? ?? (isIncome ? 'Ingreso' : 'Gasto');
    final tag = CategoryUtils.getTxTag(tx);
    final date = tx['date'] as String? ?? '';

    // Check if this is an anomaly
    bool esAnomalia = false;
    if (_snapshot != null && _snapshot!.anomalias.isNotEmpty) {
      for (final a in _snapshot!.anomalias) {
        if (a.categoria.toLowerCase() == cat.toLowerCase()) {
          esAnomalia = true;
          break;
        }
      }
    }

    return Container(
      padding: const EdgeInsets.symmetric(vertical: 10),
      decoration: BoxDecoration(
        border: Border(
          bottom: BorderSide(color: const Color(0xFF1E1535), width: 0.5),
        ),
      ),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: isExpense ? const Color(0xFF1E1535) : const Color(0xFF0A1F12),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(
              isExpense
                  ? _getCategoryIcon(cat)
                  : Icons.arrow_downward_rounded,
              size: 16,
              color: isExpense ? NinaColors.primaryLight : NinaColors.success,
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  desc,
                  style: const TextStyle(
                    fontSize: 13,
                    color: NinaColors.textPrimary,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                Text(
                  "${CategoryUtils.capitalizar(cat)} · ${CategoryUtils.formatShortDate(date)} · $tag",
                  style: const TextStyle(fontSize: 10, color: NinaColors.textTertiary),
                ),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                "${isExpense ? '−' : '+'}S/ ${_fmt(amount)}",
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w500,
                  color: isExpense ? NinaColors.errorLight : NinaColors.success,
                ),
              ),
              if (esAnomalia)
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.warning_amber_rounded, size: 10, color: NinaColors.warning),
                    const SizedBox(width: 3),
                    const Text(
                      "anomalía detectada",
                      style: TextStyle(fontSize: 9, color: NinaColors.warning),
                    ),
                  ],
                ),
            ],
          ),
        ],
      ),
    );
  }

  IconData _getCategoryIcon(String cat) {
    final c = cat.toLowerCase();
    if (c.contains('food') || c.contains('comida')) return Icons.restaurant_rounded;
    if (c.contains('transport')) return Icons.directions_car_rounded;
    if (c.contains('shopping')) return Icons.shopping_bag_rounded;
    if (c.contains('entertainment')) return Icons.movie_rounded;
    if (c.contains('health') || c.contains('salud')) return Icons.medical_services_rounded;
    if (c.contains('utilities') || c.contains('servicios')) return Icons.settings_rounded;
    return Icons.receipt_long_rounded;
  }

  Widget _buildEmptyState() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Column(
        children: [
          const SizedBox(height: 20),
          Container(
            margin: const EdgeInsets.only(top: 20),
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: NinaColors.surface,
              border: Border.all(color: NinaColors.border, width: 0.5),
              borderRadius: BorderRadius.circular(14),
            ),
            child: const Column(
              children: [
                Icon(Icons.receipt_long_outlined, size: 28, color: Color(0xFF3D2F70)),
                SizedBox(height: 8),
                Text(
                  "Registra más movimientos para ver patrones completos",
                  style: TextStyle(fontSize: 12, color: NinaColors.textTertiary),
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: NinaColors.background,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildHeader(),
            if (!_hasSearchQuery) _buildNinaCard(),
            _buildFilters(),
            const SizedBox(height: 8),
            Expanded(child: _buildList()),
          ],
        ),
      ),
    );
  }
}
