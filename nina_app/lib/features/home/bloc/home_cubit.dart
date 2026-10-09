import 'dart:async';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'home_state.dart';
import '../../../domain/repositories/finance_repository.dart';
import '../../../data/repositories/home_repository.dart';
import '../../../data/services/realtime_intelligence_service.dart';
import '../../../domain/models/home_intelligence.dart';
import '../../../core/theme/adaptive_theme_engine.dart';

class HomeCubit extends Cubit<HomeState> {
  final FinanceRepository _financeRepo;
  final HomeRepository _homeRepo;
  final RealtimeIntelligenceService _realtimeService;
  StreamSubscription? _realtimeSubscription;

  HomeCubit(
    this._financeRepo, 
    this._homeRepo,
    this._realtimeService,
  ) : super(HomeInitial());

  Future<void> load() async {
    emit(HomeLoading());
    try {
      final summary = await _financeRepo.getFinancialSummary();
      final transactions = await _financeRepo.getTransactions(limit: 6);
      final insights = await _financeRepo.getInsights();
      final intelligence = await _homeRepo.getHomeIntelligence();

      final uiState = AdaptiveThemeEngine.mapHealthToState(
        intelligence.health.overallScore,
        intelligence.health.riskLevel,
        intelligence.behaviorSignals,
      );

      emit(HomeLoaded(
        summary: summary,
        recentTransactions: transactions,
        insights: insights,
        intelligence: intelligence,
        uiState: uiState,
      ));

      _subscribeToRealtime();
    } catch (e) {
      emit(HomeError(e.toString()));
    }
  }

  void _subscribeToRealtime() {
    _realtimeSubscription?.cancel();
    _realtimeSubscription = _realtimeService.stream.listen((update) {
      _handleRealtimeUpdate(update);
    });
  }

  void _handleRealtimeUpdate(Map<String, dynamic> update) {
    if (state is! HomeLoaded) return;
    
    final current = state as HomeLoaded;
    final type = update['type'] as String;
    final payload = update['payload'];

    // Incremental Intelligence Merge
    HomeIntelligence updatedIntel = current.intelligence;

    if (type == 'health.changed' || type == 'health_v2.updated') {
      updatedIntel = _mergeHealthUpdate(updatedIntel, payload);
    } else if (type == 'coaching.generated') {
      updatedIntel = _mergeCoachingUpdate(updatedIntel, payload);
    } else if (type == 'notification.created' || type == 'trigger.detected') {
      updatedIntel = _mergeTimelineEvent(updatedIntel, payload);
    }

    final uiState = AdaptiveThemeEngine.mapHealthToState(
      updatedIntel.health.overallScore,
      updatedIntel.health.riskLevel,
      updatedIntel.behaviorSignals,
    );

    emit(HomeLoaded(
      summary: current.summary,
      recentTransactions: current.recentTransactions,
      insights: current.insights,
      intelligence: updatedIntel,
      uiState: uiState,
    ));
  }

  HomeIntelligence _mergeHealthUpdate(HomeIntelligence current, dynamic payload) {
    final newHealth = FinancialHealth.fromJson(payload);
    return HomeIntelligence(
      health: newHealth,
      alerts: current.alerts,
      coaching: current.coaching,
      weeklySummary: current.weeklySummary,
      behaviorSignals: current.behaviorSignals,
      timeline: current.timeline,
      subscriptions: current.subscriptions,
    );
  }

  HomeIntelligence _mergeCoachingUpdate(HomeIntelligence current, dynamic payload) {
    final newCoaching = CoachingPayload.fromJson(payload);
    return HomeIntelligence(
      health: current.health,
      alerts: current.alerts,
      coaching: newCoaching,
      weeklySummary: current.weeklySummary,
      behaviorSignals: current.behaviorSignals,
      timeline: current.timeline,
      subscriptions: current.subscriptions,
    );
  }

  HomeIntelligence _mergeTimelineEvent(HomeIntelligence current, dynamic payload) {
    final newEvent = IntelligenceEvent.fromJson(payload);
    final newList = [newEvent, ...current.timeline];
    if (newList.length > 20) newList.removeLast();

    return HomeIntelligence(
      health: current.health,
      alerts: current.alerts,
      coaching: current.coaching,
      weeklySummary: current.weeklySummary,
      behaviorSignals: current.behaviorSignals,
      timeline: newList,
      subscriptions: current.subscriptions,
    );
  }

  @override
  Future<void> close() {
    _realtimeSubscription?.cancel();
    return super.close();
  }
}
