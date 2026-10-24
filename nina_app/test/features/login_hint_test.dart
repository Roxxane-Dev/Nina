import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:nina_app/features/auth/bloc/auth_bloc.dart';
import 'package:nina_app/features/auth/bloc/auth_event.dart';
import 'package:nina_app/features/auth/bloc/auth_state.dart';
import 'package:nina_app/shared/services/auth_service.dart';
import 'package:supabase_flutter/supabase_flutter.dart' as sb;

class _RejectingAuth implements AuthService {
  final changes = StreamController<sb.AuthState>.broadcast();
  @override
  bool hasValidSession() => false;
  @override
  String get userEmail => 'dev@nina.test';
  @override
  Stream<sb.AuthState> get authStateChanges => changes.stream;
  @override
  Future<sb.AuthResponse> signIn(
      {required String email, required String password}) async {
    throw Exception('Invalid login credentials');
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

/// Regression: signing in with the local account while the app pointed at the hosted project said
/// "Email o contraseña incorrectos" and nothing about the real cause.
void main() {
  test(
      'wrong credentials + app/server on different projects → explains the mismatch',
      () async {
    final bloc = AuthBloc(
        auth: _RejectingAuth(),
        configCheck: () async => 'bases de datos distintas');
    bloc.add(const AuthSignInRequested(email: 'dev@nina.test', password: 'x'));
    final error =
        await bloc.stream.firstWhere((s) => s is AuthError) as AuthError;
    expect(error.message, 'bases de datos distintas');
    await bloc.close();
  });

  test('wrong credentials on a consistent setup → the usual message', () async {
    final bloc =
        AuthBloc(auth: _RejectingAuth(), configCheck: () async => null);
    bloc.add(const AuthSignInRequested(email: 'dev@nina.test', password: 'x'));
    final error =
        await bloc.stream.firstWhere((s) => s is AuthError) as AuthError;
    expect(error.message, 'Email o contraseña incorrectos');
    await bloc.close();
  });
}
