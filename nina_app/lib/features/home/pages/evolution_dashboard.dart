import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../../../core/theme/design_system.dart';
import '../../../domain/models/home_intelligence.dart';

class EvolutionDashboard extends StatelessWidget {
  final HomeIntelligence intelligence;

  const EvolutionDashboard({super.key, required this.intelligence});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: NinaColors.background,
      appBar: AppBar(
        title: const Text('Evolución Conductual', style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: Colors.transparent,
        elevation: 0,
        centerTitle: true,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildIdentityCard(),
            const SizedBox(height: 24),
            _buildTrajectorySection(),
            const SizedBox(height: 24),
            _buildStreaksSection(),
            const SizedBox(height: 24),
            if (intelligence.household != null) _buildHouseholdSection(),
          ],
        ),
      ),
    );
  }

  Widget _buildIdentityCard() {
    final id = intelligence.identity;
    if (id == null) return const SizedBox.shrink();

    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [NinaColors.primary, NinaColors.primary.withAlpha(200)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(32),
        boxShadow: [
          BoxShadow(color: NinaColors.primary.withAlpha(80), blurRadius: 20, offset: const Offset(0, 10))
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Identidad Financiera', style: TextStyle(color: Colors.white70, fontSize: 14)),
          const SizedBox(height: 8),
          Text(
            id.identity.replaceAll('_', ' ').toUpperCase(),
            style: const TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 20),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              _buildIdentityTag(Icons.bolt, id.disciplineLevel),
              _buildIdentityTag(Icons.psychology, id.moneyRelationship),
            ],
          ),
        ],
      ),
    ).animate().fadeIn().scale();
  }

  Widget _buildIdentityTag(IconData icon, String label) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.white.withAlpha(40),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        children: [
          Icon(icon, color: Colors.white, size: 16),
          const SizedBox(width: 8),
          Text(label, style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold)),
        ],
      ),
    );
  }

  Widget _buildTrajectorySection() {
    final cf = intelligence.cashFlow;
    if (cf == null) return const SizedBox.shrink();

    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: NinaColors.surface,
        borderRadius: BorderRadius.circular(28),
        border: Border.all(color: NinaColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('Trayectoria de Flujo', style: TextStyle(color: NinaColors.textPrimary, fontSize: 18, fontWeight: FontWeight.bold)),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: cf.state == 'thriving' ? Colors.green.withAlpha(30) : Colors.orange.withAlpha(30),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  cf.state.toUpperCase(),
                  style: TextStyle(
                    color: cf.state == 'thriving' ? Colors.green : Colors.orange,
                    fontSize: 10,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),
          Row(
            children: [
              _buildMetric('Reserva', '${cf.runwayMonths.toStringAsFixed(1)} m', Icons.calendar_today),
              const Spacer(),
              _buildMetric('Inercia', 'x${cf.accelerationFactor}', Icons.trending_up),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildMetric(String label, String value, IconData icon) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(icon, size: 14, color: NinaColors.textSecondary),
            const SizedBox(width: 8),
            Text(label, style: const TextStyle(color: NinaColors.textSecondary, fontSize: 12)),
          ],
        ),
        const SizedBox(height: 4),
        Text(value, style: const TextStyle(color: NinaColors.textPrimary, fontSize: 20, fontWeight: FontWeight.w900)),
      ],
    );
  }

  Widget _buildStreaksSection() {
    if (intelligence.streaks == null || intelligence.streaks!.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Rachas Activas', style: TextStyle(color: NinaColors.textPrimary, fontSize: 18, fontWeight: FontWeight.bold)),
        const SizedBox(height: 16),
        SizedBox(
          height: 100,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: intelligence.streaks!.length,
            separatorBuilder: (_, __) => const SizedBox(width: 12),
            itemBuilder: (context, index) {
              final streak = intelligence.streaks![index];
              return Container(
                width: 140,
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: NinaColors.surface,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: NinaColors.border),
                ),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text('${streak.length} Días', style: const TextStyle(color: NinaColors.primary, fontSize: 20, fontWeight: FontWeight.w900)),
                    const SizedBox(height: 4),
                    Text(streak.type, style: const TextStyle(color: NinaColors.textSecondary, fontSize: 10), textAlign: TextAlign.center),
                  ],
                ),
              );
            },
          ),
        ),
      ],
    );
  }

  Widget _buildHouseholdSection() {
    final hh = intelligence.household!;
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: NinaColors.surface,
        borderRadius: BorderRadius.circular(28),
        border: Border.all(color: NinaColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.group_rounded, color: NinaColors.primary),
              SizedBox(width: 12),
              Text('Hogar Inteligente', style: TextStyle(color: NinaColors.textPrimary, fontSize: 18, fontWeight: FontWeight.bold)),
            ],
          ),
          const SizedBox(height: 16),
          LinearProgressIndicator(
            value: hh.syncScore / 100,
            backgroundColor: NinaColors.background,
            color: NinaColors.primary,
            minHeight: 8,
            borderRadius: BorderRadius.circular(4),
          ),
          const SizedBox(height: 12),
          Text('Sincronización: ${hh.syncScore}%', style: const TextStyle(color: NinaColors.textSecondary, fontSize: 12, fontWeight: FontWeight.bold)),
          const SizedBox(height: 16),
          ...hh.insights.map((insight) => Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Row(
              children: [
                const Icon(Icons.auto_awesome, size: 14, color: Colors.amber),
                const SizedBox(width: 8),
                Expanded(child: Text(insight, style: const TextStyle(color: NinaColors.textPrimary, fontSize: 12))),
              ],
            ),
          )),
        ],
      ),
    );
  }
}
