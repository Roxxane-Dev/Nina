import 'package:dio/dio.dart';
import '../../core/network/dio_client.dart';

/// One goal with its plan, as computed by the backend engine (GET /v1/goals).
/// The app shows these numbers as-is.
class GoalPlan {
  const GoalPlan({
    required this.requiredPerMonth,
    required this.monthsLeft,
    required this.avgMonthlySavings,
    required this.gapPerMonth,
    required this.confidence,
  });

  final double? requiredPerMonth;
  final int? monthsLeft;
  final double? avgMonthlySavings;

  /// Positive = per-month shortfall; negative = room to spare.
  final double? gapPerMonth;
  final String confidence;

  factory GoalPlan.fromJson(Map<String, dynamic> j) => GoalPlan(
        requiredPerMonth: (j['requiredPerMonth'] as num?)?.toDouble(),
        monthsLeft: (j['monthsLeft'] as num?)?.toInt(),
        avgMonthlySavings: (j['avgMonthlySavings'] as num?)?.toDouble(),
        gapPerMonth: (j['gapPerMonth'] as num?)?.toDouble(),
        confidence: j['confidence'] as String? ?? 'insufficient',
      );
}

class Goal {
  const Goal({
    required this.id,
    required this.name,
    required this.targetAmount,
    required this.currentAmount,
    required this.remaining,
    required this.deadlineLabel,
    required this.deadlinePast,
    required this.plan,
  });

  final String id;
  final String name;
  final double targetAmount;
  final double currentAmount;
  final double remaining;
  final String? deadlineLabel;
  final bool deadlinePast;
  final GoalPlan plan;

  /// Display only: how full the bar is (current / target from the row).
  double get progress =>
      targetAmount <= 0 ? 0 : (currentAmount / targetAmount).clamp(0, 1);

  factory Goal.fromJson(Map<String, dynamic> j) => Goal(
        id: j['id'].toString(),
        name: j['name'] as String? ?? '',
        targetAmount: (j['targetAmount'] as num?)?.toDouble() ?? 0,
        currentAmount: (j['currentAmount'] as num?)?.toDouble() ?? 0,
        remaining: (j['remaining'] as num?)?.toDouble() ?? 0,
        deadlineLabel: j['deadlineLabel'] as String?,
        deadlinePast: j['deadlinePast'] == true,
        plan: GoalPlan.fromJson(
            (j['plan'] as Map?)?.cast<String, dynamic>() ?? const {}),
      );
}

/// Metas API.
class GoalsApiService {
  GoalsApiService({Dio? dio}) : _injected = dio;

  static final GoalsApiService instance = GoalsApiService();

  final Dio? _injected;
  Dio get _dio => _injected ?? DioClient.instance.dio;

  Future<List<Goal>> list() async {
    final res = await _dio.get<Map<String, dynamic>>('/v1/goals');
    return ((res.data?['goals'] as List?) ?? const [])
        .whereType<Map>()
        .map((g) => Goal.fromJson(g.cast<String, dynamic>()))
        .toList();
  }

  /// HOME-02: records money the user set aside for the goal. Nina never moves
  /// money; the backend stores a movement linked to the goal and returns the
  /// goal with its progress recomputed by the engine.
  Future<Goal> withdraw(String goalId, double amount) async {
    final res = await _dio.post<Map<String, dynamic>>(
        '/v1/goals/$goalId/withdrawals',
        data: {'amount': amount});
    return Goal.fromJson(
        (res.data?['goal'] as Map?)?.cast<String, dynamic>() ?? const {});
  }

  Future<Goal> contribute(String goalId, double amount) async {
    final res = await _dio.post<Map<String, dynamic>>(
        '/v1/goals/$goalId/contributions',
        data: {'amount': amount});
    return Goal.fromJson(
        (res.data?['goal'] as Map?)?.cast<String, dynamic>() ?? const {});
  }
}
