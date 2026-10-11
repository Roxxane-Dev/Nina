import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:nina_app/data/services/accounts_api_service.dart';
import 'package:nina_app/data/services/finance_api_service.dart';
import 'package:nina_app/domain/models/overview.dart';
import 'package:nina_app/features/accounts/accounts_page.dart';
import 'package:nina_app/features/transactions/pages/movimientos_screen.dart';
import 'package:nina_app/shared/widgets/add_transaction_sheet.dart';

const bcp = Account(
    id: 'acc-1',
    name: 'BCP sueldo',
    kind: 'bank',
    institution: 'BCP',
    archived: false);
const yape = Account(
    id: 'acc-2',
    name: 'Yape',
    kind: 'wallet',
    institution: null,
    archived: false);

class FakeAccountsApi extends AccountsApiService {
  FakeAccountsApi(this.accounts) : super(dio: null);
  List<Account> accounts;
  final created = <String>[];
  final archived = <String>[];

  @override
  Future<List<Account>> list() async => accounts;

  @override
  Future<Account> create(
      {required String name, required String kind, String? institution}) async {
    created.add('$name/$kind');
    final a = Account(
        id: 'new',
        name: name,
        kind: kind,
        institution: institution,
        archived: false);
    accounts = [...accounts, a];
    return a;
  }

  @override
  Future<Account> update(String id,
      {String? name, String? kind, String? institution, bool? archived}) async {
    if (archived == true) this.archived.add(id);
    accounts = [
      for (final a in accounts)
        a.id == id
            ? Account(
                id: a.id,
                name: name ?? a.name,
                kind: kind ?? a.kind,
                institution: a.institution,
                archived: archived ?? a.archived)
            : a,
    ];
    return accounts.firstWhere((a) => a.id == id);
  }
}

class RecordingFinanceApi extends FinanceApiService {
  RecordingFinanceApi() : super(dio: null);
  final created = <Map<String, Object?>>[];

  @override
  Future<void> createTransaction({
    required String type,
    required double amount,
    required String category,
    required String date,
    String? note,
    String? spaceId,
    String? accountId,
  }) async {
    created.add({'amount': amount, 'accountId': accountId});
  }

  @override
  Future<Overview> getOverview(
          {OverviewPeriod period = OverviewPeriod.current}) async =>
      Overview.fromJson({
        'period': {'label': 'octubre 2026'},
        'hasHistory': true,
        'previous': {'label': 'setiembre 2026'},
      });
}

void main() {
  setUpAll(() => initializeDateFormatting('es'));

  testWidgets('Más → Cuentas: add an account (US-41)', (tester) async {
    final api = FakeAccountsApi([]);
    await tester.pumpWidget(MaterialApp(home: AccountsPage(api: api)));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('accounts-empty')), findsOneWidget);

    await tester.tap(find.byKey(const Key('accounts-add')));
    await tester.pumpAndSettle();
    await tester.enterText(find.byKey(const Key('account-name')), 'BCP sueldo');
    await tester.tap(find.text('Guardar'));
    await tester.pumpAndSettle();
    expect(api.created, ['BCP sueldo/bank']);
    expect(find.text('BCP sueldo'), findsOneWidget);
  });

  testWidgets('archiving keeps the account but hides it by default',
      (tester) async {
    final api = FakeAccountsApi([bcp, yape]);
    await tester.pumpWidget(MaterialApp(home: AccountsPage(api: api)));
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('Archivar').first);
    await tester.pumpAndSettle();
    expect(api.archived, ['acc-1']);
    expect(find.text('BCP sueldo'), findsNothing);
    await tester.tap(find.text('Ver archivadas'));
    await tester.pumpAndSettle();
    expect(find.text('BCP sueldo'), findsOneWidget);
  });

  testWidgets('the form can attach a movement to an account', (tester) async {
    final finance = RecordingFinanceApi();
    await tester.pumpWidget(MaterialApp(
      home: Scaffold(
          body: AddTransactionSheet(
              api: finance, loadAccounts: () async => [bcp, yape])),
    ));
    await tester.pumpAndSettle();
    await tester.enterText(find.byKey(const Key('amount')), '30');
    await tester.tap(find.byKey(const Key('account')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Yape').last);
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('save')));
    await tester.pumpAndSettle();
    expect(finance.created.single, {'amount': 30.0, 'accountId': 'acc-2'});
  });

  testWidgets('Movimientos filters by account', (tester) async {
    final today = DateTime.now();
    final day =
        '${today.year}-${today.month.toString().padLeft(2, '0')}-${today.day.toString().padLeft(2, '0')}';
    await tester.pumpWidget(MaterialApp(
      home: MovimientosScreen(
        api: RecordingFinanceApi(),
        loadTransactions: () async => [
          {
            'id': 't1',
            'type': 'expense',
            'amount': 20,
            'category': 'food',
            'description': 'menú',
            'date': day,
            'account_id': 'acc-1'
          },
          {
            'id': 't2',
            'type': 'expense',
            'amount': 8,
            'category': 'transport',
            'description': 'combi',
            'date': day,
            'account_id': 'acc-2'
          },
        ],
        watchChanges: () => const Stream.empty(),
        loadAccounts: () async => [bcp, yape],
      ),
    ));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Yape'));
    await tester.pumpAndSettle();
    expect(find.text('combi'), findsOneWidget);
    expect(find.text('menú'), findsNothing);
  });
}
