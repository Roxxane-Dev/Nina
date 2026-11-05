import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nina_app/data/services/finance_api_service.dart';
import 'package:nina_app/features/insights/score_page.dart';

import '../support/test_view.dart';

class _Api extends FinanceApiService {
  _Api(this.json);
  final Map<String, dynamic> json;
  @override
  Future<HealthScore> getScore() async => HealthScore.fromJson(json);
}

void main() {
  testWidgets('shows the score and, for each part, what was measured',
      (tester) async {
    useTallSurface(tester);
    await tester.pumpWidget(MaterialApp(
        home: ScorePage(
            api: _Api({
      'score': 82,
      'sufficient': true,
      'monthsUsed': 3,
      'label': 'Sólida',
      'components': [
        {
          'key': 'savings_rate',
          'label': 'Tasa de ahorro',
          'subScore': 100,
          'weight': 0.4,
          'measured': true,
          'explanation': 'Te queda el 40% de lo que entra.'
        },
        {
          'key': 'liquidity_buffer',
          'label': 'Colchón',
          'subScore': 0,
          'weight': 0,
          'measured': false,
          'explanation': 'Necesito los saldos de tus cuentas para medirlo.'
        },
      ],
    }))));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('score-value')), findsOneWidget);
    expect(find.text('82'), findsOneWidget);
    expect(find.text('de 100 · Sólida'), findsOneWidget);
    expect(find.text('Te queda el 40% de lo que entra.'), findsOneWidget);
    expect(find.text('Pesa el 40% de tu puntaje.'), findsOneWidget);
    expect(find.text('No medido'), findsOneWidget);
  });

  testWidgets('without enough history it says so, with no number',
      (tester) async {
    useTallSurface(tester);
    await tester.pumpWidget(MaterialApp(
        home: ScorePage(
            api: _Api({
      'score': 0,
      'sufficient': false,
      'monthsUsed': 1,
      'label': 'Sin datos suficientes',
      'components': []
    }))));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('score-insufficient')), findsOneWidget);
    expect(find.byKey(const Key('score-value')), findsNothing);
  });
}
