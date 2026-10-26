import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nina_app/core/utils/money.dart';
import 'package:nina_app/data/services/finance_api_service.dart';
import 'package:nina_app/data/services/profile_api_service.dart';
import 'package:nina_app/data/services/spaces_api_service.dart';
import 'package:nina_app/domain/models/overview.dart';
import 'package:nina_app/features/setup/pages/setup_page.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../support/test_view.dart';

final engineOverview = Overview.fromJson({
  'period': {
    'from': '2026-10-01',
    'to': '2026-10-15',
    'label': 'octubre 2026',
    'granularity': 'month'
  },
  'hasHistory': true,
  'txnCount': 2,
  'income': 4500,
  'expenses': 1200,
  // Deliberately not income - expenses: the screen must show the engine's figure.
  'available': 3187.25,
  'balance': 3300,
  'categories': [],
  'previous': {'label': 'setiembre 2026', 'income': 0, 'expenses': 0},
  'expensesChange': 0,
});

class FakeFinance extends FinanceApiService {
  FakeFinance() : super(dio: null);
  final created = <Map<String, Object?>>[];
  int overviews = 0;

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
      'date': date,
      'spaceId': spaceId,
    });
  }

  @override
  Future<Overview> getOverview(
      {OverviewPeriod period = OverviewPeriod.current}) async {
    overviews++;
    return engineOverview;
  }
}

class FakeProfile extends ProfileApiService {
  FakeProfile() : super(dio: null);
  final names = <String>[];

  @override
  Future<Profile> updateName(String fullName) async {
    names.add(fullName);
    return Profile(email: 'ana@example.com', fullName: fullName);
  }
}

class FakeSpaces extends SpacesApiService {
  FakeSpaces() : super(dio: null);
  final created = <String>[];

  @override
  Future<SpaceSummary> create(String name, String type) async {
    created.add('$name/$type');
    return SpaceSummary(
        id: 'new', name: name, type: type, role: 'owner', memberCount: 1);
  }
}

class Harness {
  final finance = FakeFinance();
  final profile = FakeProfile();
  final spaces = FakeSpaces();

  Future<void> pump(WidgetTester tester) async {
    useTallSurface(tester);
    await tester.pumpWidget(MaterialApp(
      home: SetupPage(
        finance: finance,
        profile: profile,
        spaces: spaces,
        today: () => DateTime(2026, 10, 15),
      ),
    ));
    await tester.pumpAndSettle();
  }
}

Future<void> next(WidgetTester tester) async {
  await tester.tap(find.byKey(const Key('setup-next')));
  await tester.pumpAndSettle();
}

Future<void> later(WidgetTester tester) async {
  await tester.tap(find.byKey(const Key('setup-later')));
  await tester.pumpAndSettle();
}

Future<void> passName(WidgetTester tester) async {
  await tester.enterText(find.byKey(const Key('setup-name')), 'Ana Torres');
  await next(tester);
}

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  testWidgets('name step saves the name through the API', (tester) async {
    final h = Harness();
    await h.pump(tester);
    await passName(tester);
    expect(h.profile.names, ['Ana Torres']);
    expect(find.text('¿En qué te ayudo, Ana?'), findsOneWidget);
  });

  testWidgets('an empty name shows an error and calls nothing', (tester) async {
    final h = Harness();
    await h.pump(tester);
    await next(tester);
    expect(find.byKey(const Key('setup-error')), findsOneWidget);
    expect(h.profile.names, isEmpty);
  });

  testWidgets('income step creates an income movement with category salary',
      (tester) async {
    final h = Harness();
    await h.pump(tester);
    await passName(tester);
    await next(tester); // goals
    await tester.enterText(find.byKey(const Key('setup-income')), '4500');
    await next(tester);
    expect(h.finance.created, [
      {
        'type': 'income',
        'amount': 4500.0,
        'category': 'salary',
        'date': '2026-10-15',
        'spaceId': null,
      }
    ]);
    expect(find.text('Lo fijo primero'), findsOneWidget);
  });

  testWidgets('"Lo hago después" skips income and fixed without the API',
      (tester) async {
    final h = Harness();
    await h.pump(tester);
    await passName(tester);
    await next(tester); // goals
    await tester.enterText(find.byKey(const Key('setup-income')), '4500');
    await later(tester);
    expect(find.text('Lo fijo primero'), findsOneWidget);
    await tester.enterText(find.byKey(const Key('setup-fixed-0')), '1200');
    await later(tester);
    expect(find.text('¿Compartes gastos con alguien?'), findsOneWidget);
    expect(h.finance.created, isEmpty);
  });

  testWidgets('fixed expenses are saved as expense movements', (tester) async {
    final h = Harness();
    await h.pump(tester);
    await passName(tester);
    await next(tester); // goals
    await later(tester); // no income
    await tester.enterText(find.byKey(const Key('setup-fixed-0')), '1200');
    await next(tester);
    expect(h.finance.created, [
      {
        'type': 'expense',
        'amount': 1200.0,
        'category': 'home',
        'date': '2026-10-15',
        'spaceId': null,
      }
    ]);
  });

  testWidgets('the reveal shows the available figure from the engine',
      (tester) async {
    final h = Harness();
    await h.pump(tester);
    await passName(tester);
    await next(tester); // goals
    await later(tester); // income
    await later(tester); // fixed
    await next(tester); // share: "Por ahora no" is the default
    expect(h.spaces.created, isEmpty);
    expect(h.finance.overviews, 1);
    expect(find.byKey(const Key('setup-reveal')), findsOneWidget);
    expect(tester.widget<Text>(find.byKey(const Key('setup-available'))).data,
        formatSoles(engineOverview.available));
    expect(find.text('S/ 3,187.25'), findsOneWidget);
  });

  testWidgets('sharing with a partner creates a couple space', (tester) async {
    final h = Harness();
    await h.pump(tester);
    await passName(tester);
    await next(tester); // goals
    await later(tester);
    await later(tester);
    await tester.tap(find.text('Sí, con mi pareja'));
    await tester.pumpAndSettle();
    await next(tester);
    expect(h.spaces.created, ['Casa/pareja']);
  });
}
