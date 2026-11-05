import 'package:flutter/material.dart';
import '../../core/theme/design_system.dart';
import '../../data/services/finance_api_service.dart';
import '../../shared/widgets/nina_ui.dart';

/// INS-02: the health score and, for each part, what was measured. Every
/// number and every sentence comes from the engine (computeHealthScore).
class ScorePage extends StatefulWidget {
  const ScorePage({super.key, this.api});
  final FinanceApiService? api;

  @override
  State<ScorePage> createState() => _ScorePageState();
}

class _ScorePageState extends State<ScorePage> {
  late final FinanceApiService _api = widget.api ?? FinanceApiService.instance;
  late Future<HealthScore> _future = _api.getScore();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: NinaColors.background,
      appBar: AppBar(
          title: const Text('Tu salud financiera'),
          backgroundColor: NinaColors.background),
      body: FutureBuilder<HealthScore>(
        future: _future,
        builder: (context, snap) {
          if (snap.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snap.hasError) {
            return ListView(padding: const EdgeInsets.all(24), children: [
              Text(financeErrorMessage(snap.error!), style: NinaText.bodyM()),
              const SizedBox(height: 12),
              NinaButton(
                  label: 'Reintentar',
                  variant: NinaButtonVariant.secondary,
                  onPressed: () => setState(() => _future = _api.getScore())),
            ]);
          }
          final s = snap.data!;
          return ListView(padding: const EdgeInsets.all(24), children: [
            if (!s.sufficient) ...[
              Text('Todavía no hay puntaje', style: NinaText.displayM()),
              const SizedBox(height: 8),
              Text(
                  'Necesito al menos 2 meses con ingresos registrados para darte un puntaje honesto. Llevo ${s.monthsUsed}.',
                  key: const Key('score-insufficient'),
                  style: NinaText.bodyM()),
            ] else ...[
              Text('${s.score}',
                  key: const Key('score-value'),
                  style: NinaText.hero().copyWith(fontSize: 64)),
              Text('de 100 · ${s.label}', style: NinaText.titleL()),
              const SizedBox(height: 6),
              Text('Con tus últimos ${s.monthsUsed} meses registrados.',
                  style: NinaText.bodyS(color: NinaColors.textTertiary)),
              const SizedBox(height: 20),
              for (final c in s.components)
                Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: NinaCard(
                    key: Key('score-${c.key}'),
                    child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(children: [
                            Expanded(
                                child: Text(c.label, style: NinaText.titleL())),
                            Text(
                                c.measured
                                    ? '${c.subScore.round()}/100'
                                    : 'No medido',
                                style: NinaText.bodySStrong(
                                    color: c.measured
                                        ? NinaColors.textPrimary
                                        : NinaColors.textTertiary)),
                          ]),
                          if (c.measured) ...[
                            const SizedBox(height: 8),
                            NinaProgressBar(value: c.subScore / 100),
                          ],
                          const SizedBox(height: 8),
                          Text(c.explanation, style: NinaText.bodyM()),
                          if (c.measured)
                            Padding(
                              padding: const EdgeInsets.only(top: 6),
                              child: Text(
                                  'Pesa el ${(c.weight * 100).round()}% de tu puntaje.',
                                  style: NinaText.bodyS(
                                      color: NinaColors.textTertiary)),
                            ),
                        ]),
                  ),
                ),
              Text(
                  'Lo que no pude medir no te resta: su peso se reparte entre lo demás.',
                  style: NinaText.bodyS(color: NinaColors.textTertiary)),
            ],
          ]);
        },
      ),
    );
  }
}
