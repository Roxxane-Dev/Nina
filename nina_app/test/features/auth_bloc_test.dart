import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:nina_app/features/auth/bloc/auth_bloc.dart';
import 'package:nina_app/features/auth/bloc/auth_event.dart';
import 'package:nina_app/features/auth/bloc/auth_state.dart';
import 'package:nina_app/shared/services/auth_service.dart';
import 'package:supabase_flutter/supabase_flutter.dart' as sb;

class FakeAuthService implements AuthService {
  FakeAuthService({this.session = false, this.signUpError});

  bool session;
  Object? signUpError;
  final changes = StreamController<sb.AuthState>.broadcast();

  @override
  bool hasValidSession() => session;

  @override
  String get userEmail => 'ana@example.com';

  @override
  Stream<sb.AuthState> get authStateChanges => changes.stream;

  @override
  Future<sb.AuthResponse> signIn(
      {required String email, required String password}) async {
    session = true;
    return sb.AuthResponse();
  }

  @override
  Future<sb.AuthResponse> signUp(
      {required String email, required String password}) async {
    if (signUpError != null) throw signUpError!;
    session = true;
    return sb.AuthResponse();
  }

  @override
  Future<void> signOut() async => session = false;

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

void main() {
  test('no session → unauthenticated', () async {
    final bloc = AuthBloc(auth: FakeAuthService());
    bloc.add(const AuthCheckRequested());
    await expectLater(
      bloc.stream,
      emitsInOrder([isA<AuthLoading>(), isA<AuthUnauthenticated>()]),
    );
    await bloc.close();
  });

  test('sign in → authenticated', () async {
    final bloc = AuthBloc(auth: FakeAuthService());
    bloc.add(const AuthSignInRequested(
        email: 'ana@example.com', password: 'secret1'));
    await expectLater(
      bloc.stream,
      emitsInOrder([isA<AuthLoading>(), isA<AuthAuthenticated>()]),
    );
    await bloc.close();
  });

  test('sign up that needs email confirmation explains it', () async {
    final bloc = AuthBloc(
      auth: FakeAuthService(signUpError: const EmailConfirmationRequired()),
    );
    bloc.add(const AuthSignUpRequested(
        email: 'ana@example.com', password: 'secret1'));
    await expectLater(
      bloc.stream,
      emitsInOrder([
        isA<AuthLoading>(),
        isA<AuthError>()
            .having((s) => s.message, 'message', contains('correo')),
      ]),
    );
    await bloc.close();
  });
}
