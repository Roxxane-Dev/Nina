import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nina_app/data/services/nudges_api_service.dart';
import 'package:nina_app/features/home/widgets/nudges_sheet.dart';

Nudge _nudge(String key, {String type = 'chat', String? draft}) =>
    Nudge.fromJson({
      'key': key,
      'tone': 'neutral',
      'title': 'Título $key',
      'body': 'Cuerpo $key',
      'action': {'type': type, if (draft != null) 'draft': draft},
    });

class _Api extends NudgesApiService {
  _Api({this.fails = false}) : super(dio: null);
  final bool fails;
  final dismissed = <String>[];

  @override
  Future<void> dismiss(String key) async {
    if (fails) throw Exception('offline');
    dismissed.add(key);
  }
}

Future<void> _pump(WidgetTester tester, List<Nudge> nudges, _Api api,
    {ValueChanged<Nudge>? onAction, ValueChanged<Nudge>? onDismissed}) async {
  await tester.pumpWidget(MaterialApp(
      home: Scaffold(
          body: NudgesSheet(
              nudges: nudges,
              api: api,
              onAction: onAction ?? (_) {},
              onDismissed: onDismissed ?? (_) {}))));
}

void main() {
  test('reads the action of a nudge', () {
    final n = _nudge('a', draft: 'Hola');
    expect(n.actionType, 'chat');
    expect(n.draft, 'Hola');
  });

  testWidgets('closing a nudge remembers it and tells Home', (tester) async {
    final api = _Api();
    final closed = <String>[];
    await _pump(tester, [_nudge('a')], api,
        onDismissed: (n) => closed.add(n.key));
    expect(find.text('Título a'), findsOneWidget);

    await tester.tap(find.byKey(const Key('nudge-close-a')));
    await tester.pumpAndSettle();
    expect(api.dismissed, ['a']);
    expect(closed, ['a']);
    expect(find.byKey(const Key('nudges-empty')), findsOneWidget);
  });

  testWidgets('a failed dismiss never blocks the user', (tester) async {
    await _pump(tester, [_nudge('a')], _Api(fails: true));
    await tester.tap(find.byKey(const Key('nudge-close-a')));
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    expect(find.text('Título a'), findsNothing);
  });

  testWidgets('each action has its own label', (tester) async {
    await _pump(
        tester,
        [
          _nudge('a'),
          _nudge('b', type: 'add'),
          _nudge('c', type: 'goals'),
          _nudge('d', type: 'transactions')
        ],
        _Api());
    expect(find.text('Hablar con Nina'), findsOneWidget);
    expect(find.text('Registrarlo'), findsOneWidget);
    expect(find.text('Ver mis metas'), findsOneWidget);
    expect(find.text('Ver movimientos'), findsOneWidget);
  });
}
