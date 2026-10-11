import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nina_app/data/services/profile_api_service.dart';
import 'package:nina_app/features/privacy/consent_gate.dart';
import 'package:nina_app/features/profile/pages/profile_page.dart';

class FakeProfileApi extends ProfileApiService {
  FakeProfileApi(this.state) : super(dio: null);
  ConsentState state;
  final saved = <Map<String, bool>>[];
  String? name;

  @override
  Future<ConsentState> getConsents() async => state;

  @override
  Future<ConsentState> saveConsents(
      {required bool dataProcessing,
      required bool aiProcessing,
      required bool analytics}) async {
    saved.add(
        {'data': dataProcessing, 'ai': aiProcessing, 'analytics': analytics});
    state = ConsentState(
        answered: true,
        dataProcessing: dataProcessing,
        aiProcessing: aiProcessing,
        analytics: analytics);
    return state;
  }

  @override
  Future<Profile> getProfile() async =>
      Profile(email: 'ana@x.pe', fullName: name);

  @override
  Future<Profile> updateName(String fullName) async {
    name = fullName;
    return Profile(email: 'ana@x.pe', fullName: fullName);
  }
}

const unanswered = ConsentState(
    answered: false,
    dataProcessing: false,
    aiProcessing: false,
    analytics: false);

void main() {
  testWidgets(
      'US-03: first time, consents are separate and none is pre-selected',
      (tester) async {
    final api = FakeProfileApi(unanswered);
    await tester.pumpWidget(
        MaterialApp(home: ConsentGate(api: api, child: const Text('APP'))));
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('consent-screen')), findsOneWidget);
    for (final k in ['consent-data', 'consent-ai', 'consent-analytics']) {
      expect(tester.widget<SwitchListTile>(find.byKey(Key(k))).value, isFalse);
    }
    // The required consent gates the button.
    expect(
        tester
            .widget<FilledButton>(find.byKey(const Key('consent-submit')))
            .onPressed,
        isNull);

    await tester.tap(find.byKey(const Key('consent-data')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('consent-submit')));
    await tester.pumpAndSettle();

    expect(api.saved.single, {'data': true, 'ai': false, 'analytics': false});
    expect(find.text('APP'), findsOneWidget);
  });

  testWidgets('already consented users go straight to the app', (tester) async {
    final api = FakeProfileApi(const ConsentState(
        answered: true,
        dataProcessing: true,
        aiProcessing: true,
        analytics: false));
    await tester.pumpWidget(
        MaterialApp(home: ConsentGate(api: api, child: const Text('APP'))));
    await tester.pumpAndSettle();
    expect(find.text('APP'), findsOneWidget);
  });

  testWidgets('US-40: Más shows only working options and edits the name',
      (tester) async {
    final api = FakeProfileApi(unanswered);
    await tester.pumpWidget(MaterialApp(home: ProfilePage(api: api)));
    await tester.pumpAndSettle();

    expect(find.text('Tu plan'), findsNothing);
    expect(find.text('Voz de Nina'), findsNothing);
    expect(find.text('Soles (S/). Otras monedas llegarán pronto.'),
        findsOneWidget);

    await tester.tap(find.byKey(const Key('more-name')));
    await tester.pumpAndSettle();
    await tester.enterText(find.byKey(const Key('profile-name')), 'Ana Torres');
    await tester.tap(find.text('Guardar'));
    await tester.pumpAndSettle();
    expect(api.name, 'Ana Torres');
    expect(find.text('Ana Torres'), findsOneWidget);
  });
}
