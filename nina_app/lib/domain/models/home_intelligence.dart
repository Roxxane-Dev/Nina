import 'package:flutter/foundation.dart';

@immutable
class HomeIntelligence {
  final FinancialHealth health;
  final List<IntelligenceAlert> alerts;
  final CoachingPayload coaching;
  final WeeklySummary weeklySummary;
  final List<String> behaviorSignals;
  final List<IntelligenceEvent> timeline;
  final SubscriptionBurden? subscriptions;
  final List<FinancialStreak>? streaks;
  final RecoveryInfo? recovery;
  final List<ReinforcementMoment>? reinforcements;
  final List<AdaptiveNudge>? nudges;
  final PreventionIntelligence? prevention;
  final HouseholdIntelligence? household;
  final CashFlowTrajectory? cashFlow;
  final String? lifeStage;
  final FinancialIdentity? identity;

  const HomeIntelligence({
    required this.health,
    required this.alerts,
    required this.coaching,
    required this.weeklySummary,
    required this.behaviorSignals,
    required this.timeline,
    this.subscriptions,
    this.streaks,
    this.recovery,
    this.reinforcements,
    this.nudges,
    this.prevention,
    this.household,
    this.cashFlow,
    this.lifeStage,
    this.identity,
  });

  factory HomeIntelligence.fromJson(Map<String, dynamic> json) {
    return HomeIntelligence(
      health: FinancialHealth.fromJson(json['financialHealth'] ?? {}),
      alerts: (json['alerts'] as List? ?? [])
          .map((e) => IntelligenceAlert.fromJson(e))
          .toList(),
      coaching: CoachingPayload.fromJson(json['coaching'] ?? {}),
      weeklySummary: WeeklySummary.fromJson(json['weeklySummary'] ?? {}),
      behaviorSignals: List<String>.from(json['behaviorSignals'] ?? []),
      timeline: (json['timeline'] as List? ?? [])
          .map((e) => IntelligenceEvent.fromJson(e))
          .toList(),
      subscriptions: json['subscriptionBurden'] != null 
          ? SubscriptionBurden.fromJson(json['subscriptionBurden']) 
          : null,
      streaks: (json['streaks'] as List? ?? [])
          .map((e) => FinancialStreak.fromJson(e))
          .toList(),
      recovery: json['recovery'] != null ? RecoveryInfo.fromJson(json['recovery']) : null,
      reinforcements: (json['reinforcements'] as List? ?? [])
          .map((e) => ReinforcementMoment.fromJson(e))
          .toList(),
      nudges: (json['nudges'] as List? ?? [])
          .map((e) => AdaptiveNudge.fromJson(e))
          .toList(),
      prevention: json['prevention'] != null ? PreventionIntelligence.fromJson(json['prevention']) : null,
      household: json['household'] != null ? HouseholdIntelligence.fromJson(json['household']) : null,
      cashFlow: json['cashFlow'] != null ? CashFlowTrajectory.fromJson(json['cashFlow']) : null,
      lifeStage: json['lifeStage'],
      identity: json['identity'] != null ? FinancialIdentity.fromJson(json['identity']) : null,
    );
  }
}

@immutable
class FinancialHealth {
  final int overallScore;
  final String riskLevel;
  final double runwayMonths;
  final String volatilityLevel;
  final FinancialForecast? forecasts;

  const FinancialHealth({
    required this.overallScore,
    required this.riskLevel,
    required this.runwayMonths,
    required this.volatilityLevel,
    this.forecasts,
  });

  factory FinancialHealth.fromJson(Map<String, dynamic> json) {
    return FinancialHealth(
      overallScore: json['overallScore'] ?? json['score'] ?? 0,
      riskLevel: json['riskLevel'] ?? 'low',
      runwayMonths: (json['emergencyRunway']?['months'] ?? 0).toDouble(),
      volatilityLevel: json['volatility']?['level'] ?? 'low',
      forecasts: json['forecasts'] != null ? FinancialForecast.fromJson(json['forecasts']) : null,
    );
  }
}

@immutable
class FinancialForecast {
  final double projectedBalance;
  final String overspendingRisk;

  const FinancialForecast({
    required this.projectedBalance,
    required this.overspendingRisk,
  });

  factory FinancialForecast.fromJson(Map<String, dynamic> json) {
    return FinancialForecast(
      projectedBalance: (json['projectedEndOfMonthBalance'] ?? 0).toDouble(),
      overspendingRisk: json['overspendingRisk'] ?? 'low',
    );
  }
}

@immutable
class SubscriptionBurden {
  final double percentageOfIncome;
  final int count;
  final List<String> opportunities;

  const SubscriptionBurden({
    required this.percentageOfIncome,
    required this.count,
    required this.opportunities,
  });

  factory SubscriptionBurden.fromJson(Map<String, dynamic> json) {
    return SubscriptionBurden(
      percentageOfIncome: (json['percentageOfIncome'] ?? 0).toDouble(),
      count: json['count'] ?? 0,
      opportunities: List<String>.from(json['optimizationOpportunities'] ?? []),
    );
  }
}

@immutable
class IntelligenceAlert {
  final String type;
  final String message;

  const IntelligenceAlert({
    required this.type,
    required this.message,
  });

  factory IntelligenceAlert.fromJson(Map<String, dynamic> json) {
    return IntelligenceAlert(
      type: json['type'] ?? 'info',
      message: json['message'] ?? '',
    );
  }
}

@immutable
class CoachingPayload {
  final String tone;
  final String message;

  const CoachingPayload({
    required this.tone,
    required this.message,
  });

  factory CoachingPayload.fromJson(Map<String, dynamic> json) {
    return CoachingPayload(
      tone: json['tone'] ?? 'supportive',
      message: json['message'] ?? '',
    );
  }
}

@immutable
class WeeklySummary {
  final double spent;
  final String topCategory;
  final double changeVsLastWeek;

  const WeeklySummary({
    required this.spent,
    required this.topCategory,
    required this.changeVsLastWeek,
  });

  factory WeeklySummary.fromJson(Map<String, dynamic> json) {
    return WeeklySummary(
      spent: (json['spent'] ?? 0).toDouble(),
      topCategory: json['topCategory'] ?? 'none',
      changeVsLastWeek: (json['changeVsLastWeek'] ?? 0).toDouble(),
    );
  }
}

@immutable
class IntelligenceEvent {
  final String id;
  final String title;
  final String body;
  final String type;
  final String severity;
  final DateTime createdAt;

  const IntelligenceEvent({
    required this.id,
    required this.title,
    required this.body,
    required this.type,
    required this.severity,
    required this.createdAt,
  });

  factory IntelligenceEvent.fromJson(Map<String, dynamic> json) {
    return IntelligenceEvent(
      id: json['id'] ?? '',
      title: json['title'] ?? '',
      body: json['body'] ?? '',
      type: json['type'] ?? 'insight',
      severity: json['severity'] ?? 'low',
      createdAt: DateTime.parse(json['created_at'] ?? json['generatedAt'] ?? DateTime.now().toIso8601String()),
    );
  }
}

@immutable
class FinancialStreak {
  final String type;
  final int length;
  final String status;

  const FinancialStreak({required this.type, required this.length, required this.status});

  factory FinancialStreak.fromJson(Map<String, dynamic> json) {
    return FinancialStreak(
      type: json['type'] ?? '',
      length: json['length'] ?? 0,
      status: json['status'] ?? 'active',
    );
  }
}

@immutable
class RecoveryInfo {
  final bool isRecovering;
  final String phase;
  final double improvementPercentage;
  final String supportiveMessage;

  const RecoveryInfo({
    required this.isRecovering,
    required this.phase,
    required this.improvementPercentage,
    required this.supportiveMessage,
  });

  factory RecoveryInfo.fromJson(Map<String, dynamic> json) {
    return RecoveryInfo(
      isRecovering: json['isRecovering'] ?? false,
      phase: json['recoveryPhase'] ?? 'none',
      improvementPercentage: (json['improvementPercentage'] ?? 0).toDouble(),
      supportiveMessage: json['supportiveMessage'] ?? '',
    );
  }
}

@immutable
class ReinforcementMoment {
  final String type;
  final String title;
  final String message;
  final String intensity;

  const ReinforcementMoment({
    required this.type,
    required this.title,
    required this.message,
    required this.intensity,
  });

  factory ReinforcementMoment.fromJson(Map<String, dynamic> json) {
    return ReinforcementMoment(
      type: json['type'] ?? '',
      title: json['title'] ?? '',
      message: json['message'] ?? '',
      intensity: json['intensity'] ?? 'low',
    );
  }
}

@immutable
class AdaptiveNudge {
  final String id;
  final String type;
  final String content;

  const AdaptiveNudge({required this.id, required this.type, required this.content});

  factory AdaptiveNudge.fromJson(Map<String, dynamic> json) {
    return AdaptiveNudge(
      id: json['id'] ?? '',
      type: json['type'] ?? 'info',
      content: json['content'] ?? '',
    );
  }
}

@immutable
class PreventionIntelligence {
  final RelapseRiskInfo relapseRisk;
  final String trajectory;
  final List<BehavioralRegressionInfo> regressions;
  final List<PredictiveSignalInfo> predictiveSignals;

  const PreventionIntelligence({
    required this.relapseRisk,
    required this.trajectory,
    required this.regressions,
    required this.predictiveSignals,
  });

  factory PreventionIntelligence.fromJson(Map<String, dynamic> json) {
    return PreventionIntelligence(
      relapseRisk: RelapseRiskInfo.fromJson(json['relapseRisk'] ?? {}),
      trajectory: json['trajectory'] ?? 'stabilizing',
      regressions: (json['regressions'] as List? ?? [])
          .map((e) => BehavioralRegressionInfo.fromJson(e))
          .toList(),
      predictiveSignals: (json['predictiveSignals'] as List? ?? [])
          .map((e) => PredictiveSignalInfo.fromJson(e))
          .toList(),
    );
  }
}

@immutable
class RelapseRiskInfo {
  final String riskLevel;
  final double confidence;
  final List<String> matchingPatterns;
  final String predictedOutcome;
  final String preventionRecommendation;

  const RelapseRiskInfo({
    required this.riskLevel,
    required this.confidence,
    required this.matchingPatterns,
    required this.predictedOutcome,
    required this.preventionRecommendation,
  });

  factory RelapseRiskInfo.fromJson(Map<String, dynamic> json) {
    return RelapseRiskInfo(
      riskLevel: json['riskLevel'] ?? 'low',
      confidence: (json['confidence'] ?? 0).toDouble(),
      matchingPatterns: List<String>.from(json['matchingPatterns'] ?? []),
      predictedOutcome: json['predictedOutcome'] ?? '',
      preventionRecommendation: json['preventionRecommendation'] ?? '',
    );
  }
}

@immutable
class PredictiveSignalInfo {
  final String type;
  final double probability;
  final String window;
  final String context;

  const PredictiveSignalInfo({
    required this.type,
    required this.probability,
    required this.window,
    required this.context,
  });

  factory PredictiveSignalInfo.fromJson(Map<String, dynamic> json) {
    return PredictiveSignalInfo(
      type: json['type'] ?? '',
      probability: (json['probability'] ?? 0).toDouble(),
      window: json['window'] ?? '',
      context: json['context'] ?? '',
    );
  }
}

@immutable
class BehavioralRegressionInfo {
  final String type;
  final String severity;
  final double recoveryProbability;
  final double historicalSimilarity;
  final String emotionalImpact;

  const BehavioralRegressionInfo({
    required this.type,
    required this.severity,
    required this.recoveryProbability,
    required this.historicalSimilarity,
    required this.emotionalImpact,
  });

  factory BehavioralRegressionInfo.fromJson(Map<String, dynamic> json) {
    return BehavioralRegressionInfo(
      type: json['type'] ?? '',
      severity: json['severity'] ?? 'low',
      recoveryProbability: (json['recoveryProbability'] ?? 0).toDouble(),
      historicalSimilarity: (json['historicalSimilarity'] ?? 0).toDouble(),
      emotionalImpact: json['emotionalImpact'] ?? 'low',
    );
  }
}


@immutable
class HouseholdIntelligence {
  final int syncScore;
  final String responsibilityBalance;
  final List<String> insights;

  const HouseholdIntelligence({
    required this.syncScore,
    required this.responsibilityBalance,
    required this.insights,
  });

  factory HouseholdIntelligence.fromJson(Map<String, dynamic> json) {
    return HouseholdIntelligence(
      syncScore: json['syncScore'] ?? 0,
      responsibilityBalance: json['responsibilityBalance'] ?? 'aligned',
      insights: List<String>.from(json['insights'] ?? []),
    );
  }
}

@immutable
class CashFlowTrajectory {
  final String state;
  final double runwayMonths;
  final DateTime? projectedBurnoutDate;
  final double accelerationFactor;

  const CashFlowTrajectory({
    required this.state,
    required this.runwayMonths,
    this.projectedBurnoutDate,
    required this.accelerationFactor,
  });

  factory CashFlowTrajectory.fromJson(Map<String, dynamic> json) {
    return CashFlowTrajectory(
      state: json['state'] ?? 'stable',
      runwayMonths: (json['runwayMonths'] ?? 0).toDouble(),
      projectedBurnoutDate: json['projectedBurnoutDate'] != null ? DateTime.parse(json['projectedBurnoutDate']) : null,
      accelerationFactor: (json['accelerationFactor'] ?? 1.0).toDouble(),
    );
  }
}

@immutable
class FinancialIdentity {
  final String identity;
  final String disciplineLevel;
  final String riskBehavior;
  final String motivationStyle;
  final String moneyRelationship;

  const FinancialIdentity({
    required this.identity,
    required this.disciplineLevel,
    required this.riskBehavior,
    required this.motivationStyle,
    required this.moneyRelationship,
  });

  factory FinancialIdentity.fromJson(Map<String, dynamic> json) {
    return FinancialIdentity(
      identity: json['financial_identity'] ?? '',
      disciplineLevel: json['discipline_level'] ?? 'medium',
      riskBehavior: json['risk_behavior'] ?? '',
      motivationStyle: json['motivation_style'] ?? '',
      moneyRelationship: json['money_relationship'] ?? '',
    );
  }
}
