import 'package:flutter/material.dart';
import 'design_system.dart';

enum FinancialUiState {
  stable,
  thriving,
  recovering,
  risky,
  overspending,
  stressed,
  disciplined,
}

@immutable
class AdaptiveThemeConfig {
  final Color primaryColor;
  final Color accentColor;
  final List<Color> backgroundGradient;
  final double animationSpeedMultiplier;
  final double whitespaceMultiplier;
  final String emotionEmoji;

  const AdaptiveThemeConfig({
    required this.primaryColor,
    required this.accentColor,
    required this.backgroundGradient,
    this.animationSpeedMultiplier = 1.0,
    this.whitespaceMultiplier = 1.0,
    this.emotionEmoji = '✨',
  });
}

class AdaptiveThemeEngine {
  static AdaptiveThemeConfig getThemeForState(FinancialUiState state) {
    switch (state) {
      case FinancialUiState.thriving:
        return const AdaptiveThemeConfig(
          primaryColor: NinaColors.accent,
          accentColor: Color(0xFF00E676),
          backgroundGradient: [NinaColors.background, Color(0xFF0A1A14)],
          animationSpeedMultiplier: 0.8,
          whitespaceMultiplier: 1.1,
          emotionEmoji: '🚀',
        );
      case FinancialUiState.risky:
      case FinancialUiState.overspending:
        return const AdaptiveThemeConfig(
          primaryColor: NinaColors.primary,
          accentColor: Color(0xFFFF5252),
          backgroundGradient: [NinaColors.background, Color(0xFF1A0A0A)],
          animationSpeedMultiplier: 1.2,
          whitespaceMultiplier: 0.9,
          emotionEmoji: '👀',
        );
      case FinancialUiState.stressed:
        return const AdaptiveThemeConfig(
          primaryColor: NinaColors.primaryLight,
          accentColor: Color(0xFFFFAB40),
          backgroundGradient: [NinaColors.background, Color(0xFF1A150A)],
          animationSpeedMultiplier: 1.1,
          whitespaceMultiplier: 0.95,
          emotionEmoji: '💛',
        );
      case FinancialUiState.recovering:
        return const AdaptiveThemeConfig(
          primaryColor: NinaColors.accent,
          accentColor: NinaColors.primaryLight,
          backgroundGradient: [NinaColors.background, Color(0xFF0D141A)],
          animationSpeedMultiplier: 0.9,
          whitespaceMultiplier: 1.05,
          emotionEmoji: '🌱',
        );
      case FinancialUiState.disciplined:
        return const AdaptiveThemeConfig(
          primaryColor: NinaColors.accent,
          accentColor: Colors.white,
          backgroundGradient: [NinaColors.background, Color(0xFF0D1A1A)],
          animationSpeedMultiplier: 0.85,
          whitespaceMultiplier: 1.1,
          emotionEmoji: '🏆',
        );
      case FinancialUiState.stable:
        return const AdaptiveThemeConfig(
          primaryColor: NinaColors.primary,
          accentColor: NinaColors.accent,
          backgroundGradient: [NinaColors.background, NinaColors.surface],
          animationSpeedMultiplier: 1.0,
          whitespaceMultiplier: 1.0,
          emotionEmoji: '✨',
        );
    }
  }

  static FinancialUiState mapHealthToState(int score, String riskLevel, List<String> signals) {
    if (signals.contains('stressed') || signals.contains('stress_spending')) return FinancialUiState.stressed;
    if (riskLevel == 'high') return FinancialUiState.risky;
    if (signals.contains('overspending')) return FinancialUiState.overspending;
    if (score > 85) return FinancialUiState.thriving;
    if (score > 70 && signals.contains('disciplined')) return FinancialUiState.disciplined;
    if (score > 60 && signals.contains('recovering')) return FinancialUiState.recovering;
    return FinancialUiState.stable;
  }
}
