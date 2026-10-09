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

class AnalisisScreen extends StatefulWidget {
  const AnalisisScreen({super.key});

  @override
  State<AnalisisScreen> createState() => _AnalisisScreenState();
}

class _AnalisisScreenState extends State<AnalisisScreen> {
  final _repo = SupabaseFinanceRepository.instance;
  final _intelligence = IntelligenceApiService.instance;
  late List<String> _months;
  late String _selectedMonth;
  late Future<_AnalisisData> _dataFuture;
  StreamSubscription<List<Map<String, dynamic>>>? _txSubscription;

  @override
  void initState() {
    super.initState();
    _months = _repo.lastSixMonths();
    _selectedMonth = _months.first;
    _dataFuture = _loadData(_selectedMonth);
    _txSubscription = _repo.watchTransactions().listen((_) {
      if (mounted) setState(() => _dataFuture = _loadData(_selectedMonth));
    });
  }

  @override
  void dispose() {
    _txSubscription?.cancel();
    super.dispose();
  }

  Future<_AnalisisData> _loadData(String month) async {
    final expenses = await _repo.getExpenses(month: month);
    final allInsights = await _repo.getAiInsights(undismissedOnly: false);
    
    // Requested: Use `IntelligenceApiService.instance.getSnapshot()` for the snapshot data.
    final snapshot = await _intelligence.getSnapshot(forceRefresh: true); 

    final catTotals = <String, double>{};
    for (final e in expenses) {
      final cat = e['category'] as String? ?? 'Otros';
      catTotals[cat] = (catTotals[cat] ?? 0) + (e['amount'] as num).toDouble();
    }
    
    final totalSpent = catTotals.values.fold(0.0, (s, v) => s + v);

    final tagMap = <String, int>{};
    for (final ins in allInsights) {
      final tags = (ins['behavioral_tags'] as List<dynamic>?)?.map((t) => t.toString()) ?? [];
      for (final t in tags) {
        tagMap[t] = (tagMap[t] ?? 0) + 1;
      }
    }
    final sortedTags = tagMap.entries.toList()..sort((a, b) => b.value.compareTo(a.value));

    return _AnalisisData(
      totalSpent: totalSpent,
      catTotals: catTotals,
      snapshot: snapshot,
      behavioralTags: sortedTags,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: NinaColors.background,
      body: SafeArea(
        child: Column(
          children: [
            _buildHeader(),
            Expanded(
              child: FutureBuilder<_AnalisisData>(
                future: _dataFuture,
                builder: (context, snap) {
                  if (snap.connectionState == ConnectionState.waiting) {
                    return const Center(child: CircularProgressIndicator(color: NinaColors.primary));
                  }
                  if (snap.hasError) {
                    return Center(child: Text(snap.error.toString(), style: const TextStyle(color: NinaColors.textSecondary)));
                  }
                  final data = snap.data!;
                  return CustomScrollView(
                    physics: const BouncingScrollPhysics(),
                    slivers: [
                      // 2. Gasto por categoría
                      SliverToBoxAdapter(child: _buildCategoryBreakdown(data)),
                      
                      // 3. Anomalías del mes
                      if (data.snapshot != null && data.snapshot!.anomalias.isNotEmpty)
                        SliverToBoxAdapter(child: _buildAnomalies(data)),
                        
                      // 4. Patrones de comportamiento
                      if (data.behavioralTags.isNotEmpty || (data.snapshot != null && data.snapshot!.patrones.gastoHormigas.total > 0))
                        SliverToBoxAdapter(child: _buildBehavioralReport(data)),
                        
                      // 5. Salud financiera
                      SliverToBoxAdapter(child: _buildHealthScore(data)),
                      
                      // 6. Resumen Nina
                      SliverToBoxAdapter(child: _buildNinaSummary(data)),
                      
                      const SliverToBoxAdapter(child: SizedBox(height: 100)),
                    ],
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  // 1. Header with Period selector
  Widget _buildHeader() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 20, 16, 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          const Text(
            'Análisis',
            style: TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.w500,
              color: NinaColors.textPrimary,
            ),
          ),
          PopupMenuButton<String>(
            onSelected: (month) {
              setState(() {
                _selectedMonth = month;
                _dataFuture = _loadData(month);
              });
            },
            itemBuilder: (context) {
              return _months.map<PopupMenuEntry<String>>((m) {
                return PopupMenuItem<String>(
                  value: m,
                  child: Text(
                    _formatMonth(m),
                    style: const TextStyle(color: NinaColors.textPrimary, fontSize: 13),
                  ),
                );
              }).toList();
            },
            offset: const Offset(0, 32),
            color: NinaColors.surface,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
              side: const BorderSide(color: NinaColors.border, width: 0.5),
            ),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
              decoration: BoxDecoration(
                color: NinaColors.surface,
                border: Border.all(color: NinaColors.border, width: 0.5),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Row(
                children: [
                  Text(_formatMonth(_selectedMonth), style: const TextStyle(fontSize: 11, color: NinaColors.textSecondary)),
                  const SizedBox(width: 5),
                  const Icon(Icons.keyboard_arrow_down_rounded, size: 12, color: NinaColors.textSecondary),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  String _formatMonth(String month) {
    final parts = month.split('-');
    final d = DateTime(int.parse(parts[0]), int.parse(parts[1]));
    return DateFormat('MMM yyyy', 'es').format(d);
  }

  // 2. Gasto por categoría (Progress bars)
  Widget _buildCategoryBreakdown(_AnalisisData data) {
    final fmt = NumberFormat('#,##0', 'es');
    final tendencia = data.snapshot?.tendenciaCategorias ?? {};
    final total = data.totalSpent;

    final entries = tendencia.entries.toList()..sort((a, b) => b.value.mesActual.compareTo(a.value.mesActual));

    // If no AI trend data, fallback to raw categories from expenses
    if (entries.isEmpty) {
      final rawCats = data.catTotals.entries.toList()..sort((a, b) => b.value.compareTo(a.value));
      if (rawCats.isEmpty) {
        return Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
          child: _sectionCard(
            title: 'GASTO POR CATEGORÍA',
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 10),
              decoration: BoxDecoration(
                border: Border.all(color: NinaColors.border, width: 0.5),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Text(
                "Registra más gastos para ver todas las categorías",
                style: TextStyle(fontSize: 11, color: NinaColors.textTertiary),
                textAlign: TextAlign.center,
              ),
            ),
          ),
        ).animate().fadeIn(delay: 100.ms);
      }
      return Padding(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
        child: _sectionCard(
          title: 'GASTO POR CATEGORÍA',
          child: Column(
            children: rawCats.map((entry) {
              final cat = entry.key;
              final amount = entry.value;
              final maxMonto = rawCats.map((e) => e.value).reduce((a, b) => a > b ? a : b);
              final pct = maxMonto > 0 ? amount / maxMonto : 0.0;
              return Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Container(
                  decoration: BoxDecoration(
                    color: NinaColors.surface,
                    border: Border.all(color: NinaColors.border, width: 0.5),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 11),
                  margin: const EdgeInsets.only(bottom: 8),
                  child: Column(
                    children: [
                      Row(
                        children: [
                          Text(CategoryUtils.categoryEmoji(cat), style: const TextStyle(fontSize: 16)),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              CategoryUtils.capitalizar(cat),
                              style: const TextStyle(
                                fontSize: 13,
                                color: NinaColors.textPrimary,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ),
                          const SizedBox(width: 6),
                          const Text("→", style: TextStyle(fontSize: 11, color: NinaColors.textTertiary)),
                          const Spacer(),
                          Text("S/ ${fmt.format(amount)}", style: const TextStyle(fontSize: 13, color: NinaColors.textPrimary, fontWeight: FontWeight.w500)),
                        ],
                      ),
                      const SizedBox(height: 7),
                      Container(
                        height: 4,
                        decoration: BoxDecoration(
                          color: NinaColors.border,
                          borderRadius: BorderRadius.circular(2),
                        ),
                        child: FractionallySizedBox(
                          widthFactor: pct.clamp(0.0, 1.0),
                          alignment: Alignment.centerLeft,
                          child: Container(
                            decoration: BoxDecoration(
                              color: NinaColors.primaryLight,
                              borderRadius: BorderRadius.circular(2),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              );
            }).toList(),
          ),
        ),
      ).animate().fadeIn(delay: 100.ms);
    }

    final maxMonto = entries.map((e) => e.value.mesActual).fold<double>(0, (max, e) => e > max ? e : max);

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      child: _sectionCard(
        title: 'GASTO POR CATEGORÍA',
        child: Column(
          children: entries.map((entry) {
            final cat = entry.key;
            final t = entry.value;
            final amount = t.mesActual;
            final pct = maxMonto > 0 ? amount / maxMonto : 0.0;
            final pctCambio = t.pctCambio;

            String trendText;
            Color trendColor;
            Color barColor;

            if (pctCambio > 5) {
              trendText = "↑ +${pctCambio.toInt()}%";
              trendColor = NinaColors.errorLight;
              barColor = NinaColors.error;
            } else if (pctCambio < -5) {
              trendText = "↓ ${pctCambio.toInt()}%";
              trendColor = NinaColors.success;
              barColor = NinaColors.success;
            } else {
              trendText = "→";
              trendColor = NinaColors.textTertiary;
              barColor = NinaColors.primaryLight;
            }

            return Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Container(
                decoration: BoxDecoration(
                  color: NinaColors.surface,
                  border: Border.all(color: NinaColors.border, width: 0.5),
                  borderRadius: BorderRadius.circular(12),
                ),
                padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 11),
                margin: const EdgeInsets.only(bottom: 8),
                child: Column(
                  children: [
                    Row(
                      children: [
                        Text(CategoryUtils.categoryEmoji(cat), style: const TextStyle(fontSize: 16)),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            CategoryUtils.capitalizar(cat),
                            style: const TextStyle(
                              fontSize: 13,
                              color: NinaColors.textPrimary,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ),
                        const SizedBox(width: 6),
                        Text(trendText, style: TextStyle(fontSize: 11, color: trendColor)),
                        const Spacer(),
                        Text("S/ ${fmt.format(amount)}", style: const TextStyle(fontSize: 13, color: NinaColors.textPrimary, fontWeight: FontWeight.w500)),
                      ],
                    ),
                    const SizedBox(height: 7),
                    Container(
                      height: 4,
                      decoration: BoxDecoration(
                        color: NinaColors.border,
                        borderRadius: BorderRadius.circular(2),
                      ),
                      child: FractionallySizedBox(
                        widthFactor: pct.clamp(0.0, 1.0),
                        alignment: Alignment.centerLeft,
                        child: Container(
                          decoration: BoxDecoration(
                            color: barColor,
                            borderRadius: BorderRadius.circular(2),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            );
          }).toList(),
        ),
      ),
    ).animate().fadeIn(delay: 100.ms);
  }

  // 3. Anomalías del mes
  Widget _buildAnomalies(_AnalisisData data) {
    final fmt = NumberFormat('#,##0', 'es');
    final list = data.snapshot!.anomalias;
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      child: _sectionCard(
        title: 'ANOMALÍAS DEL MES',
        child: Column(
          children: list.map((a) {
            return Container(
              decoration: BoxDecoration(
                color: const Color(0xFF1F1208),
                border: Border.all(color: const Color(0xFF854F0B), width: 0.5),
                borderRadius: BorderRadius.circular(10),
              ),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              margin: const EdgeInsets.only(bottom: 8),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        "${CategoryUtils.capitalizar(a.categoria)} · ${CategoryUtils.formatShortDate(a.fecha)}",
                        style: const TextStyle(
                          fontSize: 12,
                          color: NinaColors.textPrimary,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        "${a.multiplicador}× por encima de tu promedio habitual",
                        style: const TextStyle(fontSize: 10, color: NinaColors.warning),
                      ),
                    ],
                  ),
                  Text(
                    "S/ ${fmt.format(a.monto)}",
                    style: const TextStyle(
                      fontSize: 13,
                      color: NinaColors.warning,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            );
          }).toList(),
        ),
      ),
    ).animate().fadeIn(delay: 150.ms);
  }

  // 4. Patrones de comportamiento
  Widget _buildBehavioralReport(_AnalisisData data) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      child: _sectionCard(
        title: 'PATRONES DE COMPORTAMIENTO',
        child: Column(
          children: [
            _patternRow(
              'Día de mayor gasto',
              data.snapshot?.patrones.diaMayorGasto.isNotEmpty == true
                  ? data.snapshot!.patrones.diaMayorGasto
                  : '—',
            ),
            _patternRow(
              'Categoría con mayor crecimiento',
              data.snapshot?.patrones.categoriaMayorCrecimiento.nombre.isNotEmpty == true
                  ? '${CategoryUtils.capitalizar(data.snapshot!.patrones.categoriaMayorCrecimiento.nombre)} ↑${data.snapshot!.patrones.categoriaMayorCrecimiento.pctCambio.toInt()}%'
                  : '—',
            ),
            _patternRow(
              'Gasto hormiga detectado',
              data.snapshot?.patrones.gastoHormigas.total != null && data.snapshot!.patrones.gastoHormigas.total > 0
                  ? 'S/ ${NumberFormat('#,##0', 'es').format(data.snapshot!.patrones.gastoHormigas.total)}'
                  : '—',
            ),
          ],
        ),
      ),
    ).animate().fadeIn(delay: 200.ms);
  }

  Widget _patternRow(String label, String value) {
    return Container(
      decoration: BoxDecoration(
        color: NinaColors.surface,
        border: Border.all(color: NinaColors.border, width: 0.5),
        borderRadius: BorderRadius.circular(10),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 10),
      margin: const EdgeInsets.only(bottom: 7),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: const TextStyle(fontSize: 11, color: NinaColors.textTertiary),
          ),
          Text(
            value,
            style: const TextStyle(
              fontSize: 12,
              color: NinaColors.textPrimary,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }

  // 5. Salud financiera (Score radial chart)
  Widget _buildHealthScore(_AnalisisData data) {
    final scoreData = data.snapshot?.scoreFinanciero;
    final score = scoreData?.total ?? 0;
    final status = scoreData?.status ?? 'orange';
    final color = status == 'green'
        ? NinaColors.accent
        : status == 'orange'
            ? NinaColors.warning
            : NinaColors.error;

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      child: _sectionCard(
        title: 'SALUD FINANCIERA',
        child: Container(
          decoration: BoxDecoration(
            color: NinaColors.surface,
            border: Border.all(color: const Color(0xFF3D2F70), width: 0.5),
            borderRadius: BorderRadius.circular(16),
          ),
          padding: const EdgeInsets.all(16),
          margin: const EdgeInsets.only(bottom: 12),
          child: Row(
            children: [
              SizedBox(
                width: 72,
                height: 72,
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    SizedBox(
                      width: 72,
                      height: 72,
                      child: CircularProgressIndicator(
                        value: 1.0,
                        strokeWidth: 8,
                        valueColor: const AlwaysStoppedAnimation(NinaColors.border),
                        backgroundColor: Colors.transparent,
                      ),
                    ),
                    SizedBox(
                      width: 72,
                      height: 72,
                      child: CircularProgressIndicator(
                        value: score / 100,
                        strokeWidth: 8,
                        strokeCap: StrokeCap.round,
                        valueColor: AlwaysStoppedAnimation(color),
                        backgroundColor: Colors.transparent,
                      ),
                    ),
                    Text(
                      "$score",
                      style: const TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.w500,
                        color: NinaColors.textPrimary,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  children: (scoreData?.factores ?? []).map((f) {
                    final dotColor = f.puntos > 0
                        ? NinaColors.success
                        : f.microAccion != null
                            ? NinaColors.error
                            : NinaColors.textTertiary;
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 7),
                      child: Row(
                        children: [
                          Container(
                            width: 7,
                            height: 7,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: dotColor,
                            ),
                          ),
                          const SizedBox(width: 7),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  f.nombre,
                                  style: const TextStyle(
                                    fontSize: 11,
                                    color: NinaColors.textTertiary,
                                  ),
                                ),
                                if (f.microAccion != null)
                                  Text(
                                    f.microAccion!,
                                    style: const TextStyle(
                                      fontSize: 9,
                                      color: NinaColors.textTertiary,
                                    ),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                              ],
                            ),
                          ),
                          Text(
                            "+${f.puntos}",
                            style: const TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w500,
                              color: NinaColors.textPrimary,
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
        ),
      ),
    ).animate().fadeIn(delay: 250.ms);
  }

  // 6. Resumen Nina
  Widget _buildNinaSummary(_AnalisisData data) {
    final fmt = NumberFormat('#,##0', 'es');
    final snap = data.snapshot;
    String message = '';

    final topCat = snap?.topCategoriasMes.isNotEmpty == true ? snap!.topCategoriasMes.first : null;
    if (topCat != null) {
      message = 'Tu categoría de mayor gasto es ${CategoryUtils.capitalizar(topCat.categoria)} con S/ ${fmt.format(topCat.total)}. Registra más movimientos para recomendaciones precisas.';
    } else {
      message = 'Tu mayor oportunidad es estabilizar el gasto. Con más datos Nina puede darte recomendaciones en soles concretos.';
    }

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
      child: Container(
        decoration: BoxDecoration(
          color: NinaColors.surface,
          border: Border.all(color: NinaColors.border, width: 0.5),
          borderRadius: BorderRadius.circular(14),
        ),
        padding: const EdgeInsets.all(12).copyWith(right: 14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
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
                        "RESUMEN DEL MES",
                        style: TextStyle(
                          fontSize: 9,
                          color: NinaColors.accent,
                          fontWeight: FontWeight.w500,
                          letterSpacing: 0.45,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        message,
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
            const SizedBox(height: 12),
            GestureDetector(
              onTap: () => context.push('/chat'),
              child: Container(
                width: double.infinity,
                decoration: BoxDecoration(
                  color: NinaColors.primary,
                  borderRadius: BorderRadius.circular(10),
                ),
                padding: const EdgeInsets.symmetric(vertical: 11),
                child: const Center(
                  child: Text(
                    'Hablar con Nina',
                    style: TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w500,
                      fontSize: 13,
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    ).animate().fadeIn(delay: 300.ms);
  }

  Widget _sectionCard({required String title, required Widget child}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _SectionLabel(title),
        const SizedBox(height: 10),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: NinaColors.surface,
            borderRadius: BorderRadius.circular(NinaRadii.card),
            border: Border.all(color: NinaColors.border),
          ),
          child: child,
        ),
      ],
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
      style: const TextStyle(color: NinaColors.textTertiary, fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: 1.0),
    );
  }
}

class _AnalisisData {
  final double totalSpent;
  final Map<String, double> catTotals;
  final NinaSnapshot? snapshot;
  final List<MapEntry<String, int>> behavioralTags;

  const _AnalisisData({
    required this.totalSpent,
    required this.catTotals,
    required this.snapshot,
    required this.behavioralTags,
  });
}
