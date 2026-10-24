import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nina_app/core/network/config_check.dart';
import 'package:nina_app/core/network/dio_client.dart';
import 'package:nina_app/features/auth/bloc/auth_bloc.dart';
import 'package:nina_app/features/auth/bloc/auth_event.dart';
import 'package:nina_app/features/auth/bloc/auth_state.dart';
import 'package:nina_app/shared/services/auth_service.dart';
import 'package:supabase_flutter/supabase_flutter.dart' as sb;

Dio _dioReturning(Object? data, {bool fail = false}) {
  final dio = Dio(BaseOptions(baseUrl: 'http://127.0.0.1:3000'));
  dio.interceptors.add(InterceptorsWrapper(onRequest: (options, handler) {
    if (fail) {
      handler.reject(DioException(
          requestOptions: options, type: DioExceptionType.connectionError));
    } else {
      handler.resolve(
          Response(requestOptions: options, statusCode: 200, data: data));
    }
  }));
  return dio;
}

class _FakeAuth implements AuthService {
  bool session = true;
  final changes = StreamController<sb.AuthState>.broadcast();
  @override
  bool hasValidSession() => session;
  @override
  String get userEmail => 'ana@example.com';
  @override
  Stream<sb.AuthState> get authStateChanges => changes.stream;
  @override
  Future<void> signOut() async => session = false;
  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

void main() {
  group('configMismatchMessage', () {
    test('hosts differ → explains it and names both hosts', () async {
      final msg = await configMismatchMessage(
        dio: _dioReturning({'status': 'ok', 'supabaseHost': '127.0.0.1'}),
        appSupabaseUrl: 'https://abc.supabase.co',
      );
      expect(msg, isNotNull);
      expect(msg, contains('abc.supabase.co'));
      expect(msg, contains('127.0.0.1'));
      expect(msg, contains('env/local.json'));
    });

    test('same host → no message', () async {
      expect(
        await configMismatchMessage(
          dio: _dioReturning({'status': 'ok', 'supabaseHost': '127.0.0.1'}),
          appSupabaseUrl: 'http://127.0.0.1:54321',
        ),
        isNull,
      );
    });

    test('server unreachable or host unknown → never blocks', () async {
      expect(
          await configMismatchMessage(
              dio: _dioReturning(null, fail: true),
              appSupabaseUrl: 'http://127.0.0.1:54321'),
          isNull);
      expect(
          await configMismatchMessage(
              dio: _dioReturning({'status': 'ok', 'supabaseHost': null}),
              appSupabaseUrl: 'http://127.0.0.1:54321'),
          isNull);
    });
  });

  group('AuthBloc on API 401', () {
    test('project mismatch → signs out and says why', () async {
      final bloc = AuthBloc(
          auth: _FakeAuth(), configCheck: () async => 'mismatch message');
      bloc.add(const AuthCheckRequested());
      await bloc.stream.firstWhere((s) => s is AuthAuthenticated);

      final seen = <AuthState>[];
      final sub = bloc.stream.listen(seen.add);
      AuthInterceptor.onUnauthorized?.call();
      await bloc.stream.firstWhere((s) => s is AuthError);
      await sub.cancel();

      expect(seen.whereType<AuthUnauthenticated>(), isNotEmpty);
      expect((seen.last as AuthError).message, 'mismatch message');
      await bloc.close();
    });

    test('a real expired session → plain sign-out, no error banner', () async {
      final bloc = AuthBloc(auth: _FakeAuth(), configCheck: () async => null);
      bloc.add(const AuthCheckRequested());
      await bloc.stream.firstWhere((s) => s is AuthAuthenticated);

      final seen = <AuthState>[];
      final sub = bloc.stream.listen(seen.add);
      AuthInterceptor.onUnauthorized?.call();
      await bloc.stream.firstWhere((s) => s is AuthUnauthenticated);
      await Future<void>.delayed(const Duration(milliseconds: 50));
      await sub.cancel();

      expect(seen.whereType<AuthError>(), isEmpty);
      await bloc.close();
    });
  });
}
