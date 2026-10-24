import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:nina_app/features/auth/bloc/auth_bloc.dart';
import 'package:nina_app/features/auth/bloc/auth_event.dart';
import 'package:nina_app/features/auth/pages/login_page.dart';
import 'package:nina_app/shared/services/auth_service.dart';
import 'package:supabase_flutter/supabase_flutter.dart' as sb;

class _FakeAuth implements AuthService {
  bool session = false;
  final changes = StreamController<sb.AuthState>.broadcast();
  @override
  bool hasValidSession() => session;
  @override
  String get userEmail => 'dev@nina.test';
  @override
  Stream<sb.AuthState> get authStateChanges => changes.stream;
  @override
  Future<sb.AuthResponse> signIn(
      {required String email, required String password}) async {
    session = true;
    return sb.AuthResponse();
  }

  @override
  Future<void> signOut() async => session = false;
  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

void main() {
  testWidgets('after a successful login the user lands on Inicio, not the chat',
      (tester) async {
    final bloc = AuthBloc(auth: _FakeAuth());
    final router = GoRouter(initialLocation: '/login', routes: [
      GoRoute(path: '/login', builder: (_, __) => const LoginPage()),
      GoRoute(path: '/home', builder: (_, __) => const Text('PANTALLA-INICIO')),
      GoRoute(path: '/chat', builder: (_, __) => const Text('PANTALLA-CHAT')),
    ]);

    await tester.pumpWidget(BlocProvider<AuthBloc>.value(
      value: bloc,
      child: MaterialApp.router(routerConfig: router),
    ));

    bloc.add(const AuthSignInRequested(email: 'dev@nina.test', password: 'x'));
    // The login page has endless animations, so pump a few frames instead of settling.
    for (var i = 0; i < 6; i++) {
      await tester.pump(const Duration(milliseconds: 200));
    }

    expect(find.text('PANTALLA-INICIO'), findsOneWidget);
    expect(find.text('PANTALLA-CHAT'), findsNothing);
    await tester.runAsync(bloc.close);
  });
}
