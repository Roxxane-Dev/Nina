import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nina_app/data/services/goals_api_service.dart';
import 'package:nina_app/features/goals/pages/goals_screen.dart';

import '../support/test_view.dart';

/// Goals as the backend engine returns them (GET /v1/goals); the screen must
/// show these figures as-is and never compute its own.
class FakeGoalsApi extends GoalsApiService {
  FakeGoalsApi(this.goals) : super(dio: null);
  final List<Goal> goals;
  int calls = 0;

  @override
  Future<List<Goal>> list() async {
    calls++;
    return goals;
  }
}

Goal viaje({
  double current = 450,
  double? gap = 75,
  double? avg = 100,
  String confidence = 'high',
  String? deadlineLabel = 'abril 2027',
}) =>
    Goal.fromJson({
      'id': 'g1',
      'name': 'Viaje a Cusco',
      'targetAmount': 1500,
      'currentAmount': current,
      'remaining': (1500 - current).clamp(0, 1500),
      'deadline': '2027-04-30',
      'deadlineLabel': deadlineLabel,
      'deadlinePast': false,
      'plan': {
        'requiredPerMonth': 175,
        'monthsLeft': 6,
        'avgMonthlySavings': avg,
        'gapPerMonth': gap,
        'confidence': confidence,
      },
    });

void main() {
  testWidgets('shows current/target and the engine plan facts', (tester) async {
    useTallSurface(tester);
    await tester.pumpWidget(MaterialApp(
        home: GoalsScreen(api: FakeGoalsApi([viaje()]), onAskNina: (_) {})));
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('goal-g1')), findsOneWidget);
    expect(find.text('Viaje a Cusco'), findsOneWidget);
    expect(find.text('Para abril 2027'), findsOneWidget);
    expect(tester.widget<Text>(find.byKey(const Key('goal-current-g1'))).data,
        'S/ 450.00');
    expect(find.text('de S/ 1,500.00'), findsOneWidget);
    expect(find.text('Necesitas al mes'), findsOneWidget);
    expect(find.text('S/ 175.00'), findsOneWidget); // requiredPerMonth
    expect(find.text('Tu ahorro real'), findsOneWidget);
    expect(find.text('S/ 100.00'), findsOneWidget); // avgMonthlySavings
    expect(find.text('Te faltan S/ 75.00 al mes'), findsOneWidget); // gap
    expect(find.textContaining('Pocos meses registrados'), findsNothing);
  });

  testWidgets('room to spare reads "En ritmo"; low confidence is flagged',
      (tester) async {
    useTallSurface(tester);
    await tester.pumpWidget(MaterialApp(
        home: GoalsScreen(
            api: FakeGoalsApi([viaje(gap: -325, avg: 500, confidence: 'low')]),
            onAskNina: (_) {})));
    await tester.pumpAndSettle();
    expect(find.text('En ritmo'), findsOneWidget);
    expect(find.text('S/ 500.00'), findsOneWidget);
    expect(find.textContaining('Pocos meses registrados'), findsOneWidget);
  });

  testWidgets('a reached goal says so and offers no plan', (tester) async {
    useTallSurface(tester);
    await tester.pumpWidget(MaterialApp(
        home: GoalsScreen(
            api: FakeGoalsApi([viaje(current: 1500)]), onAskNina: (_) {})));
    await tester.pumpAndSettle();
    expect(find.text('¡Lograda!'), findsOneWidget);
    expect(find.text('Necesitas al mes'), findsNothing);
    expect(find.text('Pregúntale a Nina cómo'), findsNothing);
  });

  testWidgets('no goals → empty state with a sample question', (tester) async {
    final asked = <String>[];
    await tester.pumpWidget(MaterialApp(
        home: GoalsScreen(api: FakeGoalsApi([]), onAskNina: asked.add)));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('goals-empty')), findsOneWidget);
    await tester.tap(find.text('¿Cómo alcanzo 6000 soles para enero 2028?'));
    expect(asked, ['¿Cómo alcanzo 6000 soles para enero 2028?']);
  });

  testWidgets('"Pregúntale a Nina cómo" asks about the remaining amount',
      (tester) async {
    useTallSurface(tester);
    final asked = <String>[];
    await tester.pumpWidget(MaterialApp(
        home: GoalsScreen(api: FakeGoalsApi([viaje()]), onAskNina: asked.add)));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Pregúntale a Nina cómo'));
    expect(asked, ['¿Cómo junto S/ 1,050.00 para abril 2027?']);
  });

  testWidgets('"Nueva" opens the chat with a draft', (tester) async {
    final asked = <String>[];
    await tester.pumpWidget(MaterialApp(
        home: GoalsScreen(api: FakeGoalsApi([]), onAskNina: asked.add)));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('goals-new')));
    expect(asked, ['Quiero juntar ']);
  });
}
