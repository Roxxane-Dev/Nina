import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nina_app/features/auth/bloc/auth_bloc.dart';
import 'package:nina_app/features/auth/pages/signup_page.dart';
import 'package:nina_app/shared/services/auth_service.dart';
import 'package:supabase_flutter/supabase_flutter.dart' as sb;

import '../support/test_view.dart';

/// Records sign-up calls; client validation must stop bad input before this.
class RecordingAuthService implements AuthService {
  final signUps = <String>[];
  final changes = StreamController<sb.AuthState>.broadcast();

  @override
  bool hasValidSession() => false;

  @override
  String get userEmail => '';

  @override
  Stream<sb.AuthState> get authStateChanges => changes.stream;

  @override
  Future<sb.AuthResponse> signUp(
      {required String email, required String password}) async {
    signUps.add(email);
    // The test only checks that the request was made; fail fast so the bloc
    // settles (an AuthError snackbar) and closes cleanly.
    throw Exception('offline');
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

Future<RecordingAuthService> pumpSignup(WidgetTester tester) async {
  useTallSurface(tester);
  final auth = RecordingAuthService();
  final bloc = AuthBloc(auth: auth);
  addTearDown(bloc.close);
  await tester.pumpWidget(BlocProvider.value(
    value: bloc,
    child: const MaterialApp(home: SignupPage()),
  ));
  await tester.pumpAndSettle();
  return auth;
}

Future<void> fill(WidgetTester tester,
    {required String email, required String password}) async {
  await tester.enterText(find.byKey(const Key('signup-email')), email);
  await tester.enterText(find.byKey(const Key('signup-password')), password);
}

Future<void> submit(WidgetTester tester) async {
  await tester.tap(find.byKey(const Key('signup-submit')));
  await tester.pump();
}

String errorText(WidgetTester tester) =>
    tester.widget<Text>(find.byKey(const Key('signup-error'))).data!;

void main() {
  testWidgets('a short password shows signup-error and sends nothing',
      (tester) async {
    final auth = await pumpSignup(tester);
    await fill(tester, email: 'ana@example.com', password: 'corta1');
    await tester.tap(find.byKey(const Key('signup-terms')));
    await submit(tester);
    expect(errorText(tester), contains('8 caracteres'));
    expect(auth.signUps, isEmpty);
  });

  testWidgets('without accepting the terms it shows signup-error',
      (tester) async {
    final auth = await pumpSignup(tester);
    await fill(tester, email: 'ana@example.com', password: 'unaClaveLarga1');
    await submit(tester);
    expect(errorText(tester), contains('Términos'));
    expect(auth.signUps, isEmpty);
  });

  testWidgets('an invalid email shows signup-error', (tester) async {
    final auth = await pumpSignup(tester);
    await fill(tester, email: 'ana', password: 'unaClaveLarga1');
    await tester.tap(find.byKey(const Key('signup-terms')));
    await submit(tester);
    expect(find.byKey(const Key('signup-error')), findsOneWidget);
    expect(auth.signUps, isEmpty);
  });

  testWidgets('valid input with terms accepted sends the sign-up',
      (tester) async {
    final auth = await pumpSignup(tester);
    await fill(tester, email: ' ana@example.com ', password: 'unaClaveLarga1');
    await tester.tap(find.byKey(const Key('signup-terms')));
    await submit(tester);
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('signup-error')), findsNothing);
    expect(auth.signUps, ['ana@example.com']);
  });
}
