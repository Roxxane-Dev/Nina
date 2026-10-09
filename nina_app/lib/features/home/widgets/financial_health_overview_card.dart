import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../../../core/theme/design_system.dart';
import '../../../domain/models/home_intelligence.dart';

class FinancialHealthOverviewCard extends StatelessWidget {
  final FinancialHealth health;

  const FinancialHealthOverviewCard({super.key, required this.health});

  @override
  Widget build(BuildContext context) {
    final currency = NumberFormat.currency(symbol: 'S/', decimalDigits: 0);
    final isGood = health.overallScore > 75;
    final isRisky = health.riskLevel == 'high';
    
    final mainColor = isRisky 
        ? NinaColors.primary 
        : (isGood ? NinaColors.accent : NinaColors.primaryLight);

    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: NinaColors.surface,
        borderRadius: BorderRadius.circular(32),
        border: Border.all(color: NinaColors.border),
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            NinaColors.surface,
            NinaColors.surface.withAlpha(200),
          ],
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Salud Financiera',
                    style: TextStyle(
                      color: NinaColors.textSecondary,
                      fontSize: 14,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Text(
                        _getHealthLabel(),
                        style: const TextStyle(
                          color: NinaColors.textPrimary,
                          fontSize: 24,
                          fontWeight: FontWeight.bold,
                          letterSpacing: -0.5,
                        ),
                      ),
                      const SizedBox(width: 8),
                      _buildTrendIcon(mainColor),
                    ],
                  ),
                ],
              ),
              _buildScoreGauge(mainColor),
            ],
          ),
          const SizedBox(height: 24),
          const Divider(color: NinaColors.border),
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              _buildQuickMetric(
                'Reserva', 
                '${health.runwayMonths.toStringAsFixed(1)} meses',
                health.runwayMonths < 1 ? NinaColors.primary : NinaColors.textPrimary,
              ),
              _buildQuickMetric(
                'Volatilidad', 
                health.volatilityLevel.toUpperCase(),
                health.volatilityLevel == 'high' ? NinaColors.primary : NinaColors.accent,
              ),
              if (health.forecasts != null)
                _buildQuickMetric(
                  'Proyectado', 
                  currency.format(health.forecasts!.projectedBalance),
                  NinaColors.textPrimary,
                ),
            ],
          ),
        ],
      ),
    );
  }

  String _getHealthLabel() {
    if (health.overallScore > 85) return 'Excelente';
    if (health.overallScore > 70) return 'Saludable';
    if (health.overallScore > 50) return 'Estable';
    return 'En riesgo';
  }

  Widget _buildTrendIcon(Color color) {
    return Icon(
      health.overallScore > 70 ? Icons.trending_up_rounded : Icons.trending_flat_rounded,
      color: color,
      size: 24,
    ).animate(onPlay: (controller) => controller.repeat())
     .shimmer(duration: 2.seconds, color: Colors.white24);
  }

  Widget _buildScoreGauge(Color color) {
    return Stack(
      alignment: Alignment.center,
      children: [
        SizedBox(
          width: 80,
          height: 80,
          child: CircularProgressIndicator(
            value: health.overallScore / 100,
            strokeWidth: 10,
            backgroundColor: NinaColors.background,
            color: color,
            strokeCap: StrokeCap.round,
          ),
        ),
        Text(
          '${health.overallScore}',
          style: const TextStyle(
            color: NinaColors.textPrimary,
            fontSize: 26,
            fontWeight: FontWeight.w800,
          ),
        ),
      ],
    );
  }

  Widget _buildQuickMetric(String label, String value, Color valueColor) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(
            color: NinaColors.textSecondary,
            fontSize: 12,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          value,
          style: TextStyle(
            color: valueColor,
            fontSize: 16,
            fontWeight: FontWeight.bold,
          ),
        ),
      ],
    );
  }
}
