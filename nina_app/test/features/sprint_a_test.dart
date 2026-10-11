import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:nina_app/core/utils/transaction_display.dart';
import 'package:nina_app/data/services/finance_api_service.dart';
import 'package:nina_app/domain/models/nina_user_profile.dart';
import 'package:nina_app/domain/models/overview.dart';
import 'package:nina_app/features/home/pages/home_screen.dart';
import 'package:nina_app/features/insights/pages/analisis_screen.dart';
import 'package:nina_app/features/transactions/pages/movimientos_screen.dart';
import 'package:nina_app/shared/widgets/add_transaction_sheet.dart';

Overview overview({bool hasHistory = true}) => Overview.fromJson({
      'period': {
        'from': '2026-10-01',
        'to': '2026-10-11',
        'label': 'octubre 2026',
        'granularity': 'month'
      },
      'hasHistory': hasHistory,
      'txnCount': hasHistory ? 2 : 0,
      'income': hasHistory ? 4500 : 0,
      'expenses': hasHistory ? 120.5 : 0,
      'available': hasHistory ? 4379.5 : 0,
      'balance': hasHistory ? 5749.5 : 0,
      'categories': hasHistory
          ? [
              {
                'slug': 'food',
                'label': 'Comida',
                'amount': 120.5,
                'sharePct': 100
              },
            ]
          : [],
      'previous': {'label': 'setiembre 2026', 'income': 0, 'expenses': 200.5},
      'expensesChange': -80,
    });

class FakeApi extends FinanceApiService {
  FakeApi({this.hasHistory = true}) : super(dio: null);
  final bool hasHistory;
  final created = <Map<String, Object?>>[];
  final deleted = <String>[];
  final periods = <OverviewPeriod>[];

  @override
  Future<Overview> getOverview(
      {OverviewPeriod period = OverviewPeriod.current}) async {
    periods.add(period);
    return overview(hasHistory: hasHistory);
  }

  @override
  Future<List<TrendPoint>> getTrends({int months = 6}) async => [
        const TrendPoint(label: 'setiembre 2026', income: 0, expenses: 200.5),
        const TrendPoint(label: 'octubre 2026', income: 4500, expenses: 120.5),
      ];

  @override
  Future<void> createTransaction({
    required String type,
    required double amount,
    required String category,
    required String date,
    String? note,
  }) async {
    created.add({
      'type': type,
      'amount': amount,
      'category': category,
      'date': date,
      'note': note
    });
  }

  @override
  Future<void> deleteTransaction(String id) async => deleted.add(id);
}

final rows = [
  {
    'id': 'a1',
    'type': 'income',
    'amount': 4500,
    'category': 'salary',
    'description': 'sueldo',
    'date': '${_today()}T00:00:00+00:00'
  },
  {
    'id': 'b2',
    'type': 'expense',
    'amount': 120.5,
    'category': 'comida',
    'description': 'mercado',
    'date': '${_today()}T00:00:00+00:00'
  },
];

String _today() {
  final n = DateTime.now();
  return '${n.year}-${n.month.toString().padLeft(2, '0')}-${n.day.toString().padLeft(2, '0')}';
}

Widget wrap(Widget child) => MaterialApp(home: child);

void main() {
  setUpAll(() => initializeDateFormatting('es'));

  group('transaction_display', () {
    test('storedDay follows the engine convention', () {
      expect(storedDay('2026-10-10T00:00:00+00:00'), DateTime(2026, 10, 10));
      expect(storedDay('2026-10-10'), DateTime(2026, 10, 10));
      expect(storedDay('2026-10-11T02:00:00Z'),
          DateTime(2026, 10, 10)); // 9 p.m. in Lima
      expect(storedDay('nope'), isNull);
    });

    test('categoryLabel merges aliases', () {
      expect(categoryLabel('comida'), 'Comida');
      expect(categoryLabel('food'), 'Comida');
      expect(categoryLabel(null), 'Otros');
    });
  });

  group('Inicio (US-18..21)', () {
    testWidgets('shows engine figures, never sums rows itself', (tester) async {
      await tester.pumpWidget(wrap(HomeScreen(
        api: FakeApi(),
        loadRecent: () async => rows,
        loadProfile: () async => const NinaUserProfile(),
        watchChanges: () => const Stream.empty(),
      )));
      await tester.pumpAndSettle();
      expect(find.text('S/ 5,749.50'), findsOneWidget); // balance
      expect(find.text('S/ 4,379.50'), findsOneWidget); // available
      expect(find.text('Comida'), findsWidgets);
      expect(find.textContaining('vs. setiembre 2026'), findsOneWidget);
    });

    testWidgets(
        'period selector asks the engine for the previous month (US-20)',
        (tester) async {
      final api = FakeApi();
      await tester.pumpWidget(wrap(HomeScreen(
        api: api,
        loadRecent: () async => rows,
        loadProfile: () async => const NinaUserProfile(),
        watchChanges: () => const Stream.empty(),
      )));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Mes anterior'));
      await tester.pumpAndSettle();
      expect(api.periods.last, OverviewPeriod.previous);
    });

    testWidgets('a new user sees an invitation, not zeros (US-21, US-04)',
        (tester) async {
      await tester.pumpWidget(wrap(HomeScreen(
        api: FakeApi(hasHistory: false),
        loadRecent: () async => [],
        loadProfile: () async => const NinaUserProfile(),
        watchChanges: () => const Stream.empty(),
      )));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('home-empty')), findsOneWidget);
      expect(find.text('Contárselo a Nina'), findsOneWidget);
      expect(find.byKey(const Key('home-balance')), findsNothing);
    });
  });

  group('Movimientos (US-22, 23, 25)', () {
    Future<FakeApi> pump(WidgetTester tester) async {
      final api = FakeApi();
      await tester.pumpWidget(wrap(MovimientosScreen(
        api: api,
        loadTransactions: () async => rows,
        watchChanges: () => const Stream.empty(),
      )));
      await tester.pumpAndSettle();
      return api;
    }

    testWidgets('header totals come from the engine', (tester) async {
      await pump(tester);
      expect(find.text('−S/ 120.50'), findsWidgets);
      expect(find.text('+S/ 4,500.00'), findsWidgets);
    });

    testWidgets('type filter shows only expenses', (tester) async {
      await pump(tester);
      await tester.tap(find.text('Gastos').first);
      await tester.pumpAndSettle();
      expect(find.text('mercado'), findsOneWidget);
      expect(find.text('sueldo'), findsNothing);
    });

    testWidgets('delete asks for confirmation and calls the API',
        (tester) async {
      final api = await pump(tester);
      await tester.tap(find.byTooltip('Eliminar').last);
      await tester.pumpAndSettle();
      expect(find.text('Eliminar movimiento'), findsOneWidget);
      await tester.tap(find.widgetWithText(FilledButton, 'Eliminar'));
      await tester.pumpAndSettle();
      expect(api.deleted, ['b2']);
    });
  });

  testWidgets('Análisis shows the category total and trend (US-27, 28)',
      (tester) async {
    await tester.pumpWidget(wrap(AnalisisScreen(
        api: FakeApi(), watchChanges: () => const Stream.empty())));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('analisis-total')), findsOneWidget);
    expect(find.text('Mes a mes'), findsOneWidget);
    expect(
        find.textContaining('octubre 2026: gastos S/ 120.50'), findsOneWidget);
  });

  testWidgets('add sheet sends a validated movement (US-26)', (tester) async {
    final api = FakeApi();
    await tester
        .pumpWidget(wrap(Scaffold(body: AddTransactionSheet(api: api))));
    await tester.tap(find.byKey(const Key('save')));
    await tester.pump();
    expect(find.text('Ingresa un monto mayor a 0'), findsOneWidget);
    expect(api.created, isEmpty);

    await tester.enterText(find.byKey(const Key('amount')), '25,50');
    await tester.tap(find.byKey(const Key('save')));
    await tester.pumpAndSettle();
    expect(api.created.single, containsPair('amount', 25.5));
    expect(api.created.single, containsPair('type', 'expense'));
    expect(api.created.single, containsPair('category', 'food'));
  });
}
