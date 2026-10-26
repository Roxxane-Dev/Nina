import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:nina_app/data/services/finance_api_service.dart';
import 'package:nina_app/data/services/spaces_api_service.dart';
import 'package:nina_app/shared/widgets/add_transaction_sheet.dart';

import '../support/test_view.dart';

class RecordingFinance extends FinanceApiService {
  RecordingFinance() : super(dio: null);
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
    created.add({
      'type': type,
      'amount': amount,
      'category': category,
      'spaceId': spaceId,
    });
  }
}

const casa = SpaceSummary(
    id: 's1', name: 'Casa', type: 'pareja', role: 'owner', memberCount: 2);

Future<RecordingFinance> pumpSheet(WidgetTester tester,
    {List<SpaceSummary> spaces = const [casa], String? spaceId}) async {
  useTallSurface(tester);
  final api = RecordingFinance();
  await tester.pumpWidget(MaterialApp(
    home: Scaffold(
      body: AddTransactionSheet(
        api: api,
        spaceId: spaceId,
        loadAccounts: () async => [],
        loadSpaces: () async => spaces,
      ),
    ),
  ));
  await tester.pumpAndSettle();
  return api;
}

Future<void> save(WidgetTester tester) async {
  await tester.tap(find.byKey(const Key('save')));
  await tester.pumpAndSettle();
}

void main() {
  setUpAll(() => initializeDateFormatting('es'));

  testWidgets('Personal (default) sends no spaceId', (tester) async {
    final api = await pumpSheet(tester);
    expect(find.byKey(const Key('target-personal')), findsOneWidget);
    expect(find.text('Solo lo ves tú.'), findsOneWidget);
    await tester.enterText(find.byKey(const Key('amount')), '40');
    await save(tester);
    expect(api.created.single, containsPair('spaceId', null));
  });

  testWidgets('selecting a space chip sends its spaceId', (tester) async {
    final api = await pumpSheet(tester);
    await tester.enterText(find.byKey(const Key('amount')), '1200');
    await tester.tap(find.byKey(const Key('category-home')));
    await tester.tap(find.byKey(const Key('target-s1')));
    await tester.pumpAndSettle();
    expect(find.text('Lo ven los miembros del espacio.'), findsOneWidget);
    await save(tester);
    expect(api.created.single, {
      'type': 'expense',
      'amount': 1200.0,
      'category': 'home',
      'spaceId': 's1',
    });
  });

  testWidgets('switching back to Personal clears the space', (tester) async {
    final api = await pumpSheet(tester);
    await tester.enterText(find.byKey(const Key('amount')), '15');
    await tester.tap(find.byKey(const Key('target-s1')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('target-personal')));
    await tester.pumpAndSettle();
    await save(tester);
    expect(api.created.single, containsPair('spaceId', null));
  });

  testWidgets('income type uses income categories', (tester) async {
    final api = await pumpSheet(tester, spaces: const []);
    expect(find.byKey(const Key('target-personal')), findsNothing);
    await tester.tap(find.byKey(const Key('type-income')));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('category-food')), findsNothing);
    await tester.tap(find.byKey(const Key('category-freelance')));
    await tester.enterText(find.byKey(const Key('amount')), '300');
    await save(tester);
    expect(api.created.single, {
      'type': 'income',
      'amount': 300.0,
      'category': 'freelance',
      'spaceId': null,
    });
  });

  testWidgets('opened from a space, it always goes to that space',
      (tester) async {
    final api = await pumpSheet(tester, spaceId: 's9');
    expect(find.byKey(const Key('target-personal')), findsNothing);
    await tester.enterText(find.byKey(const Key('amount')), '80');
    await save(tester);
    expect(api.created.single, containsPair('spaceId', 's9'));
  });
}
