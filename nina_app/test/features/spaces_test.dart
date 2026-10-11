import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:nina_app/data/services/spaces_api_service.dart';
import 'package:nina_app/domain/models/overview.dart';
import 'package:nina_app/features/spaces/pages/space_detail_page.dart';
import 'package:nina_app/features/spaces/pages/spaces_page.dart';

class FakeSpacesApi extends SpacesApiService {
  FakeSpacesApi({this.spaces = const []}) : super(dio: null);
  List<SpaceSummary> spaces;
  final joined = <String>[];
  final created = <String>[];

  @override
  Future<List<SpaceSummary>> list() async => spaces;

  @override
  Future<SpaceSummary> create(String name, String type) async {
    created.add('$name/$type');
    final s = SpaceSummary(
        id: 'new', name: name, type: type, role: 'owner', memberCount: 1);
    spaces = [...spaces, s];
    return s;
  }

  @override
  Future<SpaceSummary> join(String code) async {
    joined.add(code);
    return const SpaceSummary(
        id: 's1', name: 'Casa', type: 'pareja', role: 'member', memberCount: 2);
  }

  @override
  Future<String> invite(String spaceId) async => 'ABCD2345';

  @override
  Future<SpaceOverview> overview(String spaceId,
          {OverviewPeriod period = OverviewPeriod.current}) async =>
      SpaceOverview.fromJson({
        'period': {
          'from': '2026-10-01',
          'to': '2026-10-11',
          'label': 'octubre 2026',
          'granularity': 'month'
        },
        'hasHistory': true,
        'txnCount': 2,
        'income': 0,
        'expenses': 1500.5,
        'available': -1500.5,
        'balance': -1500.5,
        'categories': [],
        'previous': {'label': 'setiembre 2026', 'income': 0, 'expenses': 0},
        'expensesChange': 1500.5,
        'members': [
          {
            'userId': 'a',
            'name': 'Ana',
            'expenses': 1200,
            'income': 0,
            'count': 1,
            'isMe': true
          },
          {
            'userId': 'b',
            'name': 'Beto',
            'expenses': 300.5,
            'income': 0,
            'count': 1,
            'isMe': false
          },
        ],
      });

  @override
  Future<List<SpaceMovement>> movements(String spaceId) async => [
        SpaceMovement.fromJson({
          'id': 't1',
          'type': 'expense',
          'amount': 1200,
          'category': 'home',
          'description': 'alquiler',
          'date': '2026-10-01T00:00:00+00:00',
          'author': 'Ana',
          'isMine': true,
        }),
        SpaceMovement.fromJson({
          'id': 't2',
          'type': 'expense',
          'amount': 300.5,
          'category': 'food',
          'description': 'mercado',
          'date': '2026-10-03T00:00:00+00:00',
          'author': 'Beto',
          'isMine': false,
        }),
      ];
}

void main() {
  setUpAll(() => initializeDateFormatting('es'));

  testWidgets('no spaces → invitation to create or join (US-33/34)',
      (tester) async {
    await tester
        .pumpWidget(MaterialApp(home: SpacesPage(api: FakeSpacesApi())));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('spaces-empty')), findsOneWidget);
    expect(find.text('Crear espacio'), findsOneWidget);
    expect(find.text('Unirme con código'), findsOneWidget);
  });

  testWidgets('joining with a code calls the API (US-34)', (tester) async {
    final api = FakeSpacesApi();
    await tester.pumpWidget(MaterialApp(home: SpacesPage(api: api)));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Unirme con código'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byKey(const Key('join-code')), 'abcd2345');
    await tester.tap(find.widgetWithText(FilledButton, 'Unirme'));
    await tester.pumpAndSettle();
    expect(api.joined, ['abcd2345']);
    debugPrint('TEXTS: ' +
        tester
            .widgetList<Text>(find.byType(Text))
            .map((t) => t.data)
            .join(' | '));
    expect(find.text('Te uniste a «Casa».'), findsOneWidget);
  });

  testWidgets(
      'space detail: own balance, who registered what, movements with author (US-36/37)',
      (tester) async {
    final api = FakeSpacesApi(spaces: const [
      SpaceSummary(
          id: 's1', name: 'Casa', type: 'pareja', role: 'owner', memberCount: 2)
    ]);
    await tester.pumpWidget(
        MaterialApp(home: SpaceDetailPage(spaceId: 's1', api: api)));
    await tester.pumpAndSettle();
    expect(find.text('Casa'), findsOneWidget);
    expect(find.byKey(const Key('space-balance')), findsOneWidget);
    expect(find.text('Ana (tú)'), findsOneWidget);
    expect(find.text('Beto'), findsOneWidget);
    expect(find.textContaining('Beto · '), findsOneWidget); // movement author
  });

  testWidgets('invite shows the code to share (US-34)', (tester) async {
    final api = FakeSpacesApi(spaces: const [
      SpaceSummary(
          id: 's1', name: 'Casa', type: 'pareja', role: 'owner', memberCount: 2)
    ]);
    await tester.pumpWidget(
        MaterialApp(home: SpaceDetailPage(spaceId: 's1', api: api)));
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('Invitar'));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('invite-code')), findsOneWidget);
    expect(find.text('ABCD2345'), findsOneWidget);
  });
}
