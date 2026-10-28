import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nina_app/core/utils/transaction_display.dart';
import 'package:nina_app/data/services/goals_api_service.dart';
import 'package:nina_app/domain/models/overview.dart';
import 'package:nina_app/features/goals/pages/goals_screen.dart';
import 'package:nina_app/features/home/widgets/audit_sheet.dart';

import '../support/test_view.dart';
import 'audit_test.dart' show overviewJson;

Goal _goal(double current) => Goal.fromJson({
      'id': 'g1',
      'name': 'Japón',
      'targetAmount': 3000,
      'currentAmount': current,
      'remaining': 3000 - current,
      'deadlineLabel': null,
      'deadlinePast': false,
      'plan': {'confidence': 'insufficient'},
    });

/// Records what the screen sends; the "backend" returns the recomputed goal.
class _Api extends GoalsApiService {
  _Api() : super(dio: null);
  double current = 0;
  final sent = <(String, double)>[];

  @override
  Future<List<Goal>> list() async => [_goal(current)];

  @override
  Future<Goal> contribute(String goalId, double amount) async {
    sent.add((goalId, amount));
    current += amount;
    return _goal(current);
  }
}

void main() {
  testWidgets(
      'HOME-02: Registrar avance sends the amount and shows the new progress',
      (tester) async {
    useTallSurface(tester);
    final api = _Api();
    await tester.pumpWidget(
        MaterialApp(home: GoalsScreen(api: api, onAskNina: (_) {})));
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('goal-contribute-g1')));
    await tester.pumpAndSettle();
    expect(find.text('Registrar avance'), findsWidgets);
    expect(
        find.textContaining('sale de tu disponible del mes'), findsOneWidget);

    // Invalid amounts never reach the API.
    for (final bad in ['0', '-5', 'abc', '12.345']) {
      await tester.enterText(find.byKey(const Key('contribution-amount')), bad);
      await tester.tap(find.byKey(const Key('contribution-save')));
      await tester.pumpAndSettle();
      expect(find.textContaining('mayor a cero'), findsOneWidget);
    }
    expect(api.sent, isEmpty);

    await tester.enterText(
        find.byKey(const Key('contribution-amount')), '200,50');
    await tester.tap(find.byKey(const Key('contribution-save')));
    await tester.pumpAndSettle();

    expect(api.sent, [('g1', 200.5)]);
    expect(find.byKey(const Key('contribution-save')), findsNothing);
    expect(tester.widget<Text>(find.byKey(const Key('goal-current-g1'))).data,
        'S/ 200.50');
    expect(find.text('Anotado. Llevas S/ 200.50 para Japón.'), findsOneWidget);
  });

  testWidgets('the audit sheet shows what was set aside, from the engine',
      (tester) async {
    final json = overviewJson();
    final audit = Map<String, dynamic>.from(json['audit'] as Map)
      ..['setAside'] = 200;
    final o = Overview.fromJson({...json, 'setAside': 200, 'audit': audit});
    expect(o.setAside, 200);
    await tester.pumpWidget(MaterialApp(
        home: Scaffold(
            body: AuditSheet(audit: o.audit!, onViewTransactions: () {}))));
    expect(find.byKey(const Key('audit-set-aside')), findsOneWidget);
    expect(find.text('− Apartado para metas'), findsOneWidget);
    expect(find.text('S/ 200.00'), findsOneWidget);
  });

  testWidgets('without contributions there is no set-aside line',
      (tester) async {
    final o = Overview.fromJson(overviewJson());
    expect(o.setAside, 0);
    await tester.pumpWidget(MaterialApp(
        home: Scaffold(
            body: AuditSheet(audit: o.audit!, onViewTransactions: () {}))));
    expect(find.byKey(const Key('audit-set-aside')), findsNothing);
  });

  test('a contribution row reads "Apartado", not "Otros"', () {
    expect(categoryLabel('savings'), 'Apartado');
    expect(categoryIcon('savings'), Icons.savings_outlined);
  });
}
