import 'dart:async';
import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../../core/theme/design_system.dart';
import '../../../core/utils/category_utils.dart';
import '../../../data/repositories/supabase_finance_repository.dart';
import '../../../data/services/intelligence_api_service.dart';
import '../../../domain/models/nina_snapshot.dart';
import '../../../domain/models/nina_user_profile.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> with WidgetsBindingObserver {
  final _repo = SupabaseFinanceRepository.instance;
  final _intelligence = IntelligenceApiService.instance;
  
  late Future<_HomeData> _dataFuture;
  StreamSubscription<List<Map<String, dynamic>>>? _txSubscription;
  NinaUserProfile? _profile;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _dataFuture = _loadData();
    _refreshProfile();
    _txSubscription = _repo.watchTransactions().listen((_) {
      _intelligence.invalidate();
      if (mounted) setState(() => _dataFuture = _loadData());
    });
  }

  Future<void> _refreshProfile() async {
    final p = await _repo.getCurrentUser();
    if (mounted) setState(() => _profile = p);
  }

  @override
  void dispose() {
    _txSubscription?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      setState(() => _dataFuture = _loadData());
    }
  }

  Future<_HomeData> _loadData() async {
    final goals = await _repo.getGoals();
    final snapshot = await _intelligence.getSnapshot(forceRefresh: true);
    final activity = await _repo.getActivityFeed(limit: 5);

    return _HomeData(
      snapshot: snapshot,
      goals: goals,
      activity: activity,
    );
  }

  String _greeting() {
    final hour = DateTime.now().hour;
    if (hour < 12) return 'Buenos días';
    if (hour < 18) return 'Buenas tardes';
    return 'Buenas noches';
  }

  String _userDisplayName() {
    if (_profile?.email != null && _profile!.email!.contains('@')) {
      final local = _profile!.email!.split('@').first;
      if (local.isNotEmpty) {
        return local.substring(0, 1).toUpperCase() + local.substring(1);
      }
    }
    if (_profile?.fullName != null && _profile!.fullName!.isNotEmpty) {
      return _profile!.fullName!.split(' ').first
          .substring(0, 1).toUpperCase() +
          _profile!.fullName!.split(' ').first.substring(1).toLowerCase();
    }
    return 'Usuario';
  }

  String _fmt(double v) => NumberFormat('#,##0.00', 'es').format(v);

  String _dynamicNinaMessage(_HomeData data) {
    final snap = data.snapshot;
    if (snap == null) {
      return 'Todo se ve estable hoy ✨';
    }
    final fmt = NumberFormat('#,##0', 'es');
    final ahorro = snap.saldoEstimado.amount;
    if (ahorro > 0) {
      return 'Llevas S/ ${fmt.format(ahorro)} ahorrados este mes. ¡Buen ritmo! 🚀';
    }

    final pulso = snap.pulsoDelDia;
    final flujo = snap.flujoCajaLibre;

    if (pulso.diasBajoPromedio >= 2) {
      final extra = (pulso.promedioDiario7d - pulso.gastoHoy) *
          snap.proyeccionCierreMes.diasRestantes;
      if (extra > 0) {
        return 'Llevas ${pulso.diasBajoPromedio} días bajo tu promedio. Si mantienes este ritmo, podrías tener S/${fmt.format(extra)} extra a fin de mes.';
      }
    }

    if (snap.anomalias.isNotEmpty) {
      final a = snap.anomalias.first;
      return 'Detecté un gasto inusual en ${CategoryUtils.capitalizar(a.categoria)}: S/${fmt.format(a.monto)}, ${a.multiplicador}x tu promedio habitual.';
    }

    if (flujo.isNegative) {
      return 'Ojo: tus compromisos superan tu flujo estimado este mes. Hablemos.';
    }

    if (flujo.mensajeNatural.isNotEmpty) {
      return flujo.mensajeNatural;
    }

    return 'Todo se ve estable hoy ✨';
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
            setState(() => _dataFuture = _loadData());
          },
          child: FutureBuilder<_HomeData>(
            future: _dataFuture,
            builder: (context, snap) {
              if (snap.connectionState == ConnectionState.waiting) {
                return _buildSkeleton();
              }
              if (snap.hasError) {
                return _buildError(snap.error.toString());
              }
              final data = snap.data!;
              return CustomScrollView(
                physics: const BouncingScrollPhysics(),
                slivers: [
                  SliverToBoxAdapter(child: _buildHeader(data)),
                  SliverToBoxAdapter(child: _buildHeroPanel(data)),
                  SliverToBoxAdapter(child: _buildNinaCard(data)),
                  SliverToBoxAdapter(child: _buildQuickActions(context)),
                  SliverToBoxAdapter(child: _buildMetasActivas(data.goals)),
                  SliverToBoxAdapter(child: _buildActividadInteligente(data)),
                  const SliverToBoxAdapter(child: SizedBox(height: 120)),
                ],
              );
            },
          ),
        ),
      ),
    );
  }

  // 1. HEADER

  Widget _buildHeader(_HomeData data) {
    final displayName = _userDisplayName();
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(
                      color: NinaColors.surface,
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: NinaColors.border, width: 0.5),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                          width: 6,
                          height: 6,
                          decoration: const BoxDecoration(
                            shape: BoxShape.circle,
                            color: NinaColors.accent,
                          ),
                        ),
                        const SizedBox(width: 6),
                        const Text(
                          'Personal',
                          style: TextStyle(
                            fontSize: 11,
                            color: NinaColors.textPrimary,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  Container(
                    width: 28,
                    height: 28,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: NinaColors.surface,
                      border: Border.all(color: NinaColors.border, width: 0.5),
                    ),
                    child: const Icon(Icons.add, size: 16, color: NinaColors.accent),
                  ),
                ],
              ),
              Stack(
                children: [
                  Container(
                    width: 36,
                    height: 36,
                    decoration: const BoxDecoration(
                      shape: BoxShape.circle,
                      color: NinaColors.primary,
                    ),
                    child: Center(
                      child: Text(
                        displayName.isNotEmpty ? displayName[0].toUpperCase() : 'U',
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                          color: Colors.white,
                        ),
                      ),
                    ),
                  ),
                  Positioned(
                    bottom: 0,
                    right: 0,
                    child: Container(
                      width: 8,
                      height: 8,
                      decoration: BoxDecoration(
                        color: NinaColors.accent,
                        shape: BoxShape.circle,
                        border: Border.all(color: NinaColors.background, width: 1.5),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 24),
          Text(
            '${_greeting()} 👋,',
            style: const TextStyle(
              fontSize: 32,
              fontWeight: FontWeight.w800,
              color: NinaColors.textPrimary,
              height: 1.1,
              letterSpacing: -0.5,
            ),
          ),
          Text(
            displayName,
            style: const TextStyle(
              fontSize: 32,
              fontWeight: FontWeight.w800,
              color: NinaColors.textPrimary,
              height: 1.1,
              letterSpacing: -0.5,
            ),
          ),
          const SizedBox(height: 20),
        ],
      ),
    ).animate().fadeIn(duration: 400.ms);
  }

  // 2. HERO CARD

  Widget _buildHeroPanel(_HomeData data) {
    final snap = data.snapshot;
    final patrimonio = snap?.saldoEstimado.amount ?? 0.0;
    final score = snap?.scoreFinanciero.total ?? 0;
    final ahorroMes = snap?.proyeccionCierreMes.amount ?? patrimonio;
    final deltaPct = snap?.pulsoDelDia.deltaPct ?? 0.0;
    final deltaLabel = '${deltaPct >= 0 ? '+' : ''}${deltaPct.toStringAsFixed(1).replaceAll('.', ',')}%';

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
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'PATRIMONIO TOTAL',
                  style: TextStyle(
                    fontSize: 10,
                    color: Color(0xB3E2DDF5),
                    letterSpacing: 0.8,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                Icon(
                  Icons.visibility_outlined,
                  size: 14,
                  color: const Color(0xFFE2DDF5).withAlpha(150),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Expanded(
                  child: Text(
                    'S/ ${_fmt(patrimonio)}',
                    style: const TextStyle(
                      fontSize: 32,
                      fontWeight: FontWeight.w700,
                      color: Colors.white,
                      height: 1,
                    ),
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: NinaColors.accent.withAlpha(40),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(
                        Icons.arrow_outward_rounded,
                        size: 11,
                        color: NinaColors.accent,
                      ),
                      const SizedBox(width: 2),
                      Text(
                        deltaLabel,
                        style: const TextStyle(
                          fontSize: 11,
                          color: NinaColors.accent,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            Container(
              height: 1,
              color: Colors.white.withAlpha(40),
            ),
            const SizedBox(height: 14),
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'SALUD FINANCIERA',
                        style: TextStyle(
                          fontSize: 9,
                          color: const Color(0xFFC4B5FD).withAlpha(200),
                          letterSpacing: 0.5,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '$score/100',
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                          color: Colors.white,
                        ),
                      ),
                    ],
                  ),
                ),
                Container(width: 1, height: 32, color: Colors.white.withAlpha(40)),
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.only(left: 16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'AHORRO DEL MES',
                          style: TextStyle(
                            fontSize: 9,
                            color: const Color(0xFFC4B5FD).withAlpha(200),
                            letterSpacing: 0.5,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'S/ ${_fmt(ahorroMes)}',
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w700,
                            color: Colors.white,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    ).animate().fadeIn(delay: 100.ms).slideY(begin: 0.05, end: 0);
  }

  // 3. CARD NINA

  Widget _buildNinaCard(_HomeData data) {
    final ninaMessage = _dynamicNinaMessage(data);
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Container(
        decoration: BoxDecoration(
          color: NinaColors.surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: NinaColors.border, width: 0.5),
        ),
        padding: const EdgeInsets.all(14),
        margin: const EdgeInsets.only(bottom: 14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.auto_awesome_rounded, size: 12, color: NinaColors.accent),
                const SizedBox(width: 4),
                const Text(
                  'NINA',
                  style: TextStyle(
                    fontSize: 10,
                    color: NinaColors.accent,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.8,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              ninaMessage,
              style: const TextStyle(
                fontSize: 13,
                color: NinaColors.textPrimary,
                height: 1.45,
              ),
            ),
          ],
        ),
      ),
    ).animate().fadeIn(delay: 200.ms).slideX(begin: -0.05, end: 0);
  }

  Widget _buildQuickActions(BuildContext context) {
    final actions = [
      (Icons.sync_rounded, 'ANÁLISIS', () => context.go('/insights')),
      (Icons.flag_rounded, 'METAS', () => context.push('/chat')),
      (Icons.people_alt_rounded, 'ESPACIOS', () => context.go('/mas')),
      (Icons.grid_view_rounded, 'MÁS', () => context.go('/mas')),
    ];

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 14),
      child: Row(
        children: actions.map((a) {
          return Expanded(
            child: Padding(
              padding: EdgeInsets.only(right: a == actions.last ? 0 : 8),
              child: GestureDetector(
                onTap: a.$3,
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  decoration: BoxDecoration(
                    color: NinaColors.surface,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: NinaColors.border, width: 0.5),
                  ),
                  child: Column(
                    children: [
                      Icon(a.$1, size: 20, color: NinaColors.textPrimary),
                      const SizedBox(height: 8),
                      Text(
                        a.$2,
                        style: const TextStyle(
                          fontSize: 9,
                          color: NinaColors.textSecondary,
                          fontWeight: FontWeight.w600,
                          letterSpacing: 0.4,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          );
        }).toList(),
      ),
    ).animate().fadeIn(delay: 250.ms);
  }

  Widget _buildActividadInteligente(_HomeData data) {
    final items = data.activity.take(4).toList();

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'ACTIVIDAD INTELIGENTE',
                style: TextStyle(
                  fontSize: 11,
                  color: NinaColors.textTertiary,
                  letterSpacing: 0.55,
                  fontWeight: FontWeight.w600,
                ),
              ),
              GestureDetector(
                onTap: () => context.go('/transactions'),
                child: const Text(
                  'Ver todo',
                  style: TextStyle(fontSize: 11, color: NinaColors.primaryLight),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          if (items.isEmpty)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: NinaColors.surface,
                borderRadius: BorderRadius.circular(14),
              ),
              child: const Text(
                'Aún no hay movimientos este mes',
                style: TextStyle(fontSize: 12, color: NinaColors.textSecondary),
                textAlign: TextAlign.center,
              ),
            )
          else
            ...items.map(_buildActivityItem),
        ],
      ),
    ).animate().fadeIn(delay: 400.ms);
  }

  Widget _buildActivityItem(Map<String, dynamic> tx) {
    final isIncome = tx['type'] == 'income';
    final amount = (tx['amount'] as num?)?.toDouble() ?? 0;
    final desc = tx['description'] as String? ??
        (isIncome ? 'Ingreso' : CategoryUtils.capitalizar(tx['category'] as String? ?? 'Gasto'));
    final cat = tx['category'] as String? ?? '';
    final dateStr = CategoryUtils.formatShortDate(tx['date'] ?? '');
    final emoji = CategoryUtils.categoryEmoji(cat);

    final subtitle = isIncome
        ? '🤖 Ingreso registrado ✓'
        : '🤖 Gasto en ${CategoryUtils.capitalizar(cat.isNotEmpty ? cat : 'general')} · $dateStr';

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: NinaColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: NinaColors.border, width: 0.5),
      ),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: isIncome ? const Color(0xFF2D1F5A) : NinaColors.background,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: NinaColors.border, width: 0.5),
            ),
            child: Center(
              child: Text(emoji, style: const TextStyle(fontSize: 18)),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  desc,
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: NinaColors.textPrimary,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 2),
                Text(
                  subtitle,
                  style: const TextStyle(
                    fontSize: 11,
                    color: NinaColors.textTertiary,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
          Text(
            '${isIncome ? '+' : '−'}S/ ${_fmt(amount)}',
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w700,
              color: isIncome ? NinaColors.accent : const Color(0xFFF09595),
            ),
          ),
        ],
      ),
    );
  }

  // 4. BANNER ANOMALIA

  Widget _buildAnomalyBanner(_HomeData data) {
    final a = data.snapshot!.anomalias.first;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 0),
      child: Container(
        decoration: BoxDecoration(
          color: const Color(0xFF2A1010),
          border: Border.all(color: NinaColors.error, width: 0.5),
          borderRadius: BorderRadius.circular(12),
        ),
        padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 11),
        margin: const EdgeInsets.only(bottom: 12),
        child: Row(
          children: [
            const Icon(Icons.warning_amber_rounded, color: NinaColors.error, size: 16),
            const SizedBox(width: 9),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  RichText(
                    text: TextSpan(
                      style: const TextStyle(fontSize: 11, color: NinaColors.errorLight),
                      children: [
                        const TextSpan(text: "Anomalía detectada en "),
                        TextSpan(
                          text: a.categoria,
                          style: const TextStyle(fontWeight: FontWeight.w600),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    "S/ ${_fmt(a.monto)} — ${a.multiplicador}× tu promedio habitual",
                    style: const TextStyle(
                      fontSize: 11,
                      color: NinaColors.error,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    ).animate().fadeIn(delay: 250.ms);
  }

  // 5. COMPROMISOS PENDIENTES

  Widget _buildCompromisos(_HomeData data) {
    final comp = data.snapshot!.compromisosPendientes;
    final dateFmt = DateFormat('d MMM', 'es');
    final visible = comp.items.take(3).toList();

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                "COMPROMISOS PENDIENTES",
                style: TextStyle(
                  fontSize: 11,
                  color: NinaColors.textTertiary,
                  letterSpacing: 0.55,
                  fontWeight: FontWeight.w500,
                ),
              ),
              GestureDetector(
                onTap: () => context.go('/transactions'),
                child: const Text(
                  "Ver todos",
                  style: TextStyle(fontSize: 11, color: NinaColors.accent),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          ...visible.map((item) {
            final due = DateTime.tryParse(item.fechaVencimiento);
            final dueLabel = due != null
                ? dateFmt.format(due)
                : item.fechaVencimiento;
            return Container(
              decoration: BoxDecoration(
                color: NinaColors.surface,
                border: Border.all(color: NinaColors.border, width: 0.5),
                borderRadius: BorderRadius.circular(10),
              ),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              margin: const EdgeInsets.only(bottom: 8),
              child: Row(
                children: [
                  Container(
                    width: 28,
                    height: 28,
                    decoration: BoxDecoration(
                      color: const Color(0xFF2D1F5A),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Icon(
                      CategoryUtils.commitmentIcon(item.nombre),
                      size: 14,
                      color: NinaColors.primaryLight,
                    ),
                  ),
                  const SizedBox(width: 9),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          item.nombre,
                          style: const TextStyle(
                            fontSize: 12,
                            color: NinaColors.textPrimary,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                        Text(
                          "Vence $dueLabel",
                          style: const TextStyle(
                            fontSize: 10,
                            color: NinaColors.textTertiary,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Text(
                    "−S/ ${_fmt(item.monto)}",
                    style: const TextStyle(
                      fontSize: 13,
                      color: NinaColors.errorLight,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            );
          }),
        ],
      ),
    ).animate().fadeIn(delay: 300.ms);
  }

  // 6. METAS ACTIVAS

  Widget _buildMetasActivas(List<Map<String, dynamic>> goals) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 10),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'METAS',
                style: TextStyle(
                  fontSize: 11,
                  color: NinaColors.textTertiary,
                  letterSpacing: 0.55,
                  fontWeight: FontWeight.w600,
                ),
              ),
              GestureDetector(
                onTap: () => context.push('/chat'),
                child: const Text(
                  'Ver todas',
                  style: TextStyle(fontSize: 11, color: NinaColors.accent),
                ),
              ),
            ],
          ),
        ),
        if (goals.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Container(
              height: 110,
              decoration: BoxDecoration(
                color: NinaColors.surface,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: NinaColors.border),
              ),
              child: const Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text('🎯', style: TextStyle(fontSize: 28)),
                    SizedBox(height: 8),
                    Text(
                      'Cuéntale a Nina qué quieres lograr',
                      style: TextStyle(
                        color: NinaColors.textSecondary,
                        fontSize: 13,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          )
        else
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Column(
              children: goals.asMap().entries.map((e) => Padding(
                padding: EdgeInsets.only(bottom: e.key < goals.length - 1 ? 10 : 0),
                child: _GoalCard(goal: e.value),
              )).toList(),
            ),
          ),
      ],
    ).animate().fadeIn(delay: 350.ms);
  }

  // SKELETON & ERROR

  Widget _buildSkeleton() {
    return CustomScrollView(
      physics: const NeverScrollableScrollPhysics(),
      slivers: [
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              children: List.generate(
                5,
                (i) => Padding(
                  padding: const EdgeInsets.only(bottom: 16),
                  child: Container(
                    height: i == 0 ? 60 : i == 1 ? 140 : 80,
                    decoration: BoxDecoration(
                      color: NinaColors.surface,
                      borderRadius: BorderRadius.circular(16),
                    ),
                  ).animate(onPlay: (c) => c.repeat())
                      .shimmer(duration: 1200.ms,
                          color: NinaColors.surfaceAlt.withAlpha(80)),
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildError(String msg) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.error_outline_rounded,
                color: NinaColors.error, size: 48),
            const SizedBox(height: 16),
            Text(msg,
                style: const TextStyle(color: NinaColors.textSecondary),
                textAlign: TextAlign.center),
            const SizedBox(height: 24),
            GestureDetector(
              onTap: () => setState(() => _dataFuture = _loadData()),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                decoration: BoxDecoration(
                  color: NinaColors.primary,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Text('Reintentar',
                    style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _HomeData {
  final NinaSnapshot? snapshot;
  final List<Map<String, dynamic>> goals;
  final List<Map<String, dynamic>> activity;

  const _HomeData({
    required this.snapshot,
    required this.goals,
    required this.activity,
  });
}

class _GlassCard extends StatelessWidget {
  final Widget child;
  final Color? accentColor;

  const _GlassCard({required this.child, this.accentColor});

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(20),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: NinaColors.surface.withAlpha(200),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(
              color: accentColor?.withAlpha(60) ??
                  Colors.white.withAlpha(20),
            ),
          ),
          child: child,
        ),
      ),
    );
  }
}

class _GoalCard extends StatelessWidget {
  final Map<String, dynamic> goal;

  const _GoalCard({required this.goal});

  @override
  Widget build(BuildContext context) {
    final target = (goal['target_amount'] as num?)?.toDouble() ?? 1;
    final current = (goal['current_amount'] as num?)?.toDouble() ?? 0;
    final progress = (current / target).clamp(0.0, 1.0);
    final name = goal['name'] as String? ?? '';
    final fmt = NumberFormat('#,##0', 'es');

    // Check if it already has emoji, otherwise prepend 🎯
    final displayTitle = name.startsWith(RegExp(r'[\u{1F300}-\u{1F9FF}]', unicode: true)) 
        ? name 
        : '🎯 $name';

    return Container(
      decoration: BoxDecoration(
        color: NinaColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: NinaColors.border, width: 0.5),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      margin: const EdgeInsets.only(bottom: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            displayTitle,
            style: const TextStyle(
              fontSize: 14,
              color: NinaColors.textPrimary,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 14),
          Container(
            height: 4,
            decoration: BoxDecoration(
              color: NinaColors.border,
              borderRadius: BorderRadius.circular(2),
            ),
            child: FractionallySizedBox(
              widthFactor: progress,
              alignment: Alignment.centerLeft,
              child: Container(
                decoration: BoxDecoration(
                  color: NinaColors.accent,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
          ),
          const SizedBox(height: 12),
          Text(
            'S/ ${fmt.format(current)} / S/ ${fmt.format(target)}',
            style: const TextStyle(
              fontSize: 11,
              color: NinaColors.textTertiary,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }
}
