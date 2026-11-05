import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nina_app/data/services/finance_api_service.dart';
import 'package:nina_app/features/home/widgets/outlook_card.dart';

MonthOutlook _o({double projected = 2300, double overdue = 0}) =>
    MonthOutlook.fromJson({
      'monthLabel': 'noviembre 2026',
      'availableNow': 1200,
      'expectedIncome': overdue > 0 ? 0 : 3000,
      'incomeDay': 15,
      'overdueIncome': overdue,
      'recurringUntilEnd': 900,
      'dailySpend': 50,
      'daysLeft': 20,
      'discretionaryUntilEnd': 1000,
      'projected': projected,
    });

Future<void> _pump(WidgetTester tester, Widget w) => tester.pumpWidget(
    MaterialApp(home: Scaffold(body: SingleChildScrollView(child: w))));

void main() {
  testWidgets('shows the projection, and its parts only when opened',
      (tester) async {
    await _pump(tester, OutlookCard(outlook: _o()));
    expect(find.text('Cerrarías noviembre 2026 con unos S/ 2,300.00'),
        findsOneWidget);
    expect(find.byKey(const Key('home-outlook-daily')), findsNothing);

    await tester.tap(find.byKey(const Key('home-outlook')));
    await tester.pumpAndSettle();
    expect(find.text('+ Ingreso que suele llegar el día 15'), findsOneWidget);
    expect(find.text('− Día a día (S/ 50.00 × 20 días)'), findsOneWidget);
    expect(find.text('S/ 1,000.00'), findsOneWidget);
  });

  testWidgets('a negative close and an unregistered income are said plainly',
      (tester) async {
    await _pump(
        tester, OutlookCard(outlook: _o(projected: -700, overdue: 3000)));
    expect(find.text('Noviembre 2026 cerraría en -S/ 700.00'), findsOneWidget);
    expect(find.byKey(const Key('home-outlook-overdue')), findsOneWidget);
  });

  testWidgets('lists the next fixed payments', (tester) async {
    await _pump(
        tester,
        const UpcomingCard(payments: [
          UpcomingPayment(name: 'Alquiler', amount: 1200, date: '2026-12-05'),
          UpcomingPayment(name: 'Netflix', amount: 44.9, date: '2026-12-09'),
        ]));
    expect(find.text('Próximos pagos'), findsOneWidget);
    expect(find.text('5/12'), findsOneWidget);
    expect(find.text('Alquiler'), findsOneWidget);
    expect(find.text('S/ 44.90'), findsOneWidget);
  });

  test('reads a short history as no projection', () {
    final o = Outlook.fromJson({'outlook': null, 'upcoming': []});
    expect(o.outlook, isNull);
    expect(o.upcoming, isEmpty);
  });
}
