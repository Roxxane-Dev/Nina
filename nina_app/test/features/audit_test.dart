import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:nina_app/data/services/finance_api_service.dart';
import 'package:nina_app/domain/models/nina_user_profile.dart';
import 'package:nina_app/domain/models/overview.dart';
import 'package:nina_app/features/home/pages/home_screen.dart';
import 'package:nina_app/features/home/widgets/audit_sheet.dart';
import 'package:nina_app/features/transactions/pages/movimientos_screen.dart';

Map<String, dynamic> overviewJson({int count = 2, bool withAudit = true}) => {
      'period': {
        'from': '2026-10-01',
        'to': '2026-10-11',
        'label': 'octubre 2026',
        'granularity': 'month'
      },
      'hasHistory': true,
      'txnCount': count,
      'income': 4500,
      'expenses': 120.5,
      'available': 4379.5,
      'balance': 5749.5,
      'categories': [],
      'previous': {'label': 'setiembre 2026', 'income': 0, 'expenses': 200.5},
      'expensesChange': -80,
      if (withAudit)
        'audit': {
          'metric': 'available',
          'formula':
              'Disponible = ingresos de octubre 2026 − gastos de octubre 2026. Las transferencias entre tus cuentas no se cuentan.',
          'period': {
            'from': '2026-10-01',
            'to': '2026-10-11',
            'label': 'octubre 2026'
          },
          'income': 4500,
          'expenses': 120.5,
          'available': 4379.5,
          'txnCount': count,
          'evidenceTxnIds': ['a1', 'b2'].take(count).toList(),
        },
    };

class _Api extends FinanceApiService {
  _Api(this.json) : super(dio: null);
  final Map<String, dynamic> json;
  final periods = <OverviewPeriod>[];

  @override
  Future<Overview> getOverview(
      {OverviewPeriod period = OverviewPeriod.current}) async {
    periods.add(period);
    return Overview.fromJson(json);
  }

  @override
  Future<List<TrendPoint>> getTrends({int months = 6}) async => const [];
}

Widget _home(_Api api, {void Function(String)? onOpen}) => MaterialApp(
      home: HomeScreen(
        api: api,
        loadRecent: () async => const [],
        loadProfile: () async => const NinaUserProfile(),
        watchChanges: () => const Stream.empty(),
        onOpenTransactions: onOpen,
      ),
    );

void main() {
  setUpAll(() => initializeDateFormatting('es'));

  test('Overview parses the engine audit block', () {
    final o = Overview.fromJson(overviewJson());
    expect(o.audit, isNotNull);
    expect(o.audit!.txnCount, 2);
    expect(o.audit!.evidenceTxnIds, ['a1', 'b2']);
    expect(o.audit!.available, o.available);
    expect(Overview.fromJson(overviewJson(withAudit: false)).audit, isNull);
  });

  testWidgets('Inicio: "Cómo calculé esto" opens the engine explanation',
      (tester) async {
    await tester.pumpWidget(_home(_Api(overviewJson())));
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('home-audit')));
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('audit-title')), findsOneWidget);
    expect(find.textContaining('Disponible = ingresos de octubre 2026'),
        findsOneWidget);
    expect(find.text('Calculado con 2 movimientos de octubre 2026.'),
        findsOneWidget);
    expect(find.text('S/ 4,500.00'), findsWidgets);
    expect(find.text('S/ 120.50'), findsWidgets);
    expect(find.text('S/ 4,379.50'), findsWidgets);
  });

  testWidgets('the sheet links to the filtered Movimientos list',
      (tester) async {
    String? opened;
    await tester
        .pumpWidget(_home(_Api(overviewJson()), onOpen: (p) => opened = p));
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('home-audit')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('audit-view-transactions')));
    await tester.pumpAndSettle();

    expect(opened, 'current');
    expect(find.byKey(const Key('audit-title')), findsNothing); // sheet closed
  });

  testWidgets('singular count and no link when there is nothing to show',
      (tester) async {
    await tester.pumpWidget(MaterialApp(
      home: Scaffold(
        body: AuditSheet(
          audit: Overview.fromJson(overviewJson(count: 1)).audit!,
          onViewTransactions: () {},
        ),
      ),
    ));
    expect(find.text('Calculado con 1 movimiento de octubre 2026.'),
        findsOneWidget);

    await tester.pumpWidget(MaterialApp(
      home: Scaffold(
        body: AuditSheet(
          audit: Overview.fromJson(overviewJson(count: 0)).audit!,
          onViewTransactions: () {},
        ),
      ),
    ));
    expect(find.text('Todavía no hay movimientos en octubre 2026.'),
        findsOneWidget);
    expect(find.byKey(const Key('audit-view-transactions')), findsNothing);
  });

  testWidgets('an older backend without audit simply hides the link',
      (tester) async {
    await tester.pumpWidget(_home(_Api(overviewJson(withAudit: false))));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('home-audit')), findsNothing);
    expect(find.byKey(const Key('home-available')), findsOneWidget);
  });

  testWidgets('Movimientos opens on the requested period', (tester) async {
    final api = _Api(overviewJson());
    await tester.pumpWidget(MaterialApp(
      home: MovimientosScreen(
        api: api,
        loadTransactions: () async => const [],
        watchChanges: () => const Stream.empty(),
        loadAccounts: () async => const [],
        initialPeriod: 'previous',
      ),
    ));
    await tester.pumpAndSettle();
    expect(api.periods, contains(OverviewPeriod.previous));
  });
}
