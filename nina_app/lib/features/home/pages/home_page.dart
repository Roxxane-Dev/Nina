import 'package:flutter/material.dart';
import '../../../domain/models/home_intelligence.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../../../core/theme/design_system.dart';
import '../../../core/theme/adaptive_theme_engine.dart';
import '../bloc/home_cubit.dart';
import '../bloc/home_state.dart';
import '../widgets/coaching_card.dart';
import '../widgets/financial_health_overview_card.dart';
import '../widgets/subscription_insights_card.dart';
import '../widgets/behavioral_signals_widget.dart';
import '../widgets/intelligence_timeline.dart';
import '../widgets/recovery_card.dart';
import '../widgets/streaks_widget.dart';
import '../widgets/prevention_card.dart';
import '../widgets/risk_timeline.dart';
import './evolution_dashboard.dart';

class HomePage extends StatefulWidget {
  const HomePage({super.key});

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  @override
  void initState() {
    super.initState();
    context.read<HomeCubit>().load();
  }

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<HomeCubit, HomeState>(
      builder: (context, state) {
        if (state is HomeLoading || state is HomeInitial) {
          return const Scaffold(
            backgroundColor: NinaColors.background,
            body: Center(child: CircularProgressIndicator(color: NinaColors.primary)),
          );
        }

        if (state is HomeError) {
          return Scaffold(body: _buildErrorState(state.message));
        }

        final loaded = state as HomeLoaded;
        final intel = loaded.intelligence;
        final theme = AdaptiveThemeEngine.getThemeForState(loaded.uiState);

        return Scaffold(
          backgroundColor: NinaColors.background,
          body: Container(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: theme.backgroundGradient,
              ),
            ),
            child: SafeArea(
              child: RefreshIndicator(
                color: theme.accentColor,
                onRefresh: () async => context.read<HomeCubit>().load(),
                child: CustomScrollView(
                  physics: const BouncingScrollPhysics(),
                  slivers: [
                    // 1. Adaptive Header
                    _buildAdaptiveHeader(loaded.uiState, theme),

                    // 2. Coaching (AI-First)
                    SliverToBoxAdapter(
                      child: Padding(
                        padding: EdgeInsets.symmetric(
                          horizontal: 24, 
                          vertical: 8 * theme.whitespaceMultiplier
                        ),
                        child: CoachingCard(coaching: intel.coaching),
                      ).animate().fadeIn(duration: (400 * theme.animationSpeedMultiplier).ms).slideY(begin: 0.1),
                    ),

                    // 3. Recovery Card (Behavioral)
                    if (intel.recovery != null && intel.recovery!.isRecovering)
                      SliverToBoxAdapter(
                        child: Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 8),
                          child: RecoveryCard(recovery: intel.recovery!),
                        ).animate().fadeIn(delay: 50.ms).slideX(begin: -0.1),
                      ),

                    // 4. Prevention Card (Predictive)
                    if (intel.prevention != null)
                      SliverToBoxAdapter(
                        child: Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 8),
                          child: PreventionCard(prevention: intel.prevention!),
                        ).animate().fadeIn(delay: 75.ms).slideY(begin: 0.1),
                      ),

                    // 5. Risk Timeline (Predictive)
                    if (intel.prevention != null && intel.prevention!.predictiveSignals.isNotEmpty)
                      SliverToBoxAdapter(
                        child: Padding(
                          padding: const EdgeInsets.symmetric(vertical: 16),
                          child: RiskTimeline(signals: intel.prevention!.predictiveSignals),
                        ).animate().fadeIn(delay: 100.ms).slideY(begin: 0.1),
                      ),

                    // 4. Health Overview (V2)
                    SliverToBoxAdapter(
                      child: Padding(
                        padding: EdgeInsets.fromLTRB(24, 16, 24, 16 * theme.whitespaceMultiplier),
                        child: FinancialHealthOverviewCard(health: intel.health),
                      ).animate().fadeIn(delay: 100.ms).scale(begin: const Offset(0.95, 0.95)),
                    ),

                    // 5. Streaks (Behavioral)
                    if (intel.streaks != null && intel.streaks!.isNotEmpty)
                      SliverToBoxAdapter(
                        child: Padding(
                          padding: const EdgeInsets.symmetric(vertical: 16),
                          child: StreaksWidget(streaks: intel.streaks!),
                        ).animate().fadeIn(delay: 150.ms),
                      ),

                    // 6. Behavioral Signals
                    SliverToBoxAdapter(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        child: BehavioralSignalsWidget(signals: intel.behaviorSignals),
                      ).animate().fadeIn(delay: 200.ms),
                    ),

                    // 7. Subscription Insights
                    if (intel.subscriptions != null)
                      SliverToBoxAdapter(
                        child: Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
                          child: SubscriptionInsightsCard(subscriptions: intel.subscriptions!),
                        ).animate().fadeIn(delay: 300.ms),
                      ),

                    // 8. Intelligence Timeline (Live Feed)
                    SliverToBoxAdapter(
                      child: Padding(
                        padding: const EdgeInsets.only(top: 24),
                        child: IntelligenceTimeline(events: intel.timeline),
                      ).animate().fadeIn(delay: 400.ms),
                    ),

                    const SliverToBoxAdapter(child: SizedBox(height: 120)),
                  ],
                ),
              ),
            ),
          ),
          floatingActionButton: _buildContextualFAB(loaded.uiState, theme, intel.nudges),
        );
      },
    );
  }

  Widget _buildAdaptiveHeader(FinancialUiState state, AdaptiveThemeConfig theme) {
    String message = 'Everything looks stable today';
    if (state == FinancialUiState.risky || state == FinancialUiState.overspending) {
      message = 'Your spending accelerated this week';
    } else if (state == FinancialUiState.thriving) {
      message = 'You are performing above average';
    } else if (state == FinancialUiState.stressed) {
      message = 'Focus on essential spending today';
    }

    return SliverToBoxAdapter(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '$message ${theme.emotionEmoji}', 
                    style: TextStyle(
                      color: theme.accentColor.withAlpha(200), 
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                    )
                  ).animate().fadeIn().shimmer(duration: 3.seconds),
                  const SizedBox(height: 4),
                  const Text(
                    'Hola, Nina OS', 
                    style: TextStyle(
                      color: NinaColors.textPrimary, 
                      fontSize: 28, 
                      fontWeight: FontWeight.bold, 
                      letterSpacing: -1
                    )
                  ),
                ],
              ),
            ),
            Row(
              children: [
                IconButton(
                  icon: const Icon(Icons.auto_graph_rounded, color: NinaColors.textSecondary),
                  onPressed: () {
                    final loaded = context.read<HomeCubit>().state as HomeLoaded;
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => EvolutionDashboard(intelligence: loaded.intelligence),
                      ),
                    );
                  },
                ),
                _buildProfileAvatar(theme),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildProfileAvatar(AdaptiveThemeConfig theme) {
    return Container(
      width: 48,
      height: 48,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [theme.primaryColor, theme.primaryColor.withAlpha(160)],
        ),
        border: Border.all(color: theme.primaryColor.withAlpha(120), width: 2),
        boxShadow: [
          BoxShadow(
            color: theme.primaryColor.withAlpha(50),
            blurRadius: 10,
            spreadRadius: 2,
          ),
        ],
      ),
      child: const Center(
        child: Text(
          'N',
          style: TextStyle(
            color: Colors.white,
            fontSize: 20,
            fontWeight: FontWeight.bold,
            letterSpacing: 0,
          ),
        ),
      ),
    );
  }

  Widget _buildContextualFAB(FinancialUiState state, AdaptiveThemeConfig theme, List<AdaptiveNudge>? nudges) {
    String label = 'Preguntar a Nina';
    IconData icon = Icons.chat_bubble_outline_rounded;

    if (nudges != null && nudges.isNotEmpty) {
      // Use the first nudge as the FAB label if it's high priority
      label = nudges.first.content.length > 20 ? '${nudges.first.content.substring(0, 17)}...' : nudges.first.content;
      icon = Icons.auto_awesome_rounded;
    } else if (state == FinancialUiState.risky || state == FinancialUiState.overspending) {
      label = 'Revisar Gastos';
      icon = Icons.warning_amber_rounded;
    } else if (state == FinancialUiState.stressed) {
      label = 'Calma Financiera';
      icon = Icons.spa_rounded;
    }

    return FloatingActionButton.extended(
      onPressed: () => context.push('/chat'),
      backgroundColor: theme.primaryColor,
      elevation: 4,
      icon: Icon(icon, color: Colors.white),
      label: Text(
        label, 
        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)
      ),
    ).animate(key: ValueKey(state))
     .scale(duration: 300.ms, curve: Curves.easeOutBack)
     .shimmer(delay: 2.seconds, duration: 1.5.seconds);
  }

  Widget _buildErrorState(String message) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.error_outline_rounded, color: NinaColors.primary, size: 48),
          const SizedBox(height: 16),
          Text(message, style: const TextStyle(color: NinaColors.textSecondary)),
          const SizedBox(height: 24),
          ElevatedButton(
            onPressed: () => context.read<HomeCubit>().load(),
            child: const Text('Reintentar'),
          ),
        ],
      ),
    );
  }
}
