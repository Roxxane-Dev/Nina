// Auth BLoC
import 'dart:async';

import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:supabase_flutter/supabase_flutter.dart' as sb;
import '../../../core/network/dio_client.dart';
import '../../../shared/services/auth_service.dart';
import 'auth_event.dart';
import 'auth_state.dart';

class AuthBloc extends Bloc<AuthEvent, AuthState> {
  AuthBloc({AuthService? auth})
      : _auth = auth ?? AuthService.instance,
        super(const AuthInitial()) {
    on<AuthCheckRequested>(_onCheckRequested);
    on<AuthSignInRequested>(_onSignIn);
    on<AuthSignUpRequested>(_onSignUp);
    on<AuthSignOutRequested>(_onSignOut);
    on<_AuthSessionEnded>(_onSessionEnded);

    // Session ended elsewhere (refresh failed, signed out on another tab…).
    _sessionSub = _auth.authStateChanges.listen((data) {
      if (data.event == sb.AuthChangeEvent.signedOut) {
        add(const _AuthSessionEnded());
      }
    });

    // Any API 401 means the session is no longer valid.
    AuthInterceptor.onUnauthorized = () => add(const AuthSignOutRequested());
  }

  final AuthService _auth;
  late final StreamSubscription<sb.AuthState> _sessionSub;

  Future<void> _onCheckRequested(
    AuthCheckRequested event,
    Emitter<AuthState> emit,
  ) async {
    emit(const AuthLoading());
    if (_auth.hasValidSession()) {
      emit(AuthAuthenticated(email: _auth.userEmail));
    } else {
      emit(const AuthUnauthenticated());
    }
  }

  Future<void> _onSignIn(
    AuthSignInRequested event,
    Emitter<AuthState> emit,
  ) async {
    emit(const AuthLoading());
    try {
      await _auth.signIn(email: event.email, password: event.password);
      emit(AuthAuthenticated(email: event.email));
    } catch (e) {
      emit(AuthError(message: _parseError(e)));
    }
  }

  Future<void> _onSignUp(
    AuthSignUpRequested event,
    Emitter<AuthState> emit,
  ) async {
    emit(const AuthLoading());
    try {
      await _auth.signUp(email: event.email, password: event.password);
      emit(AuthAuthenticated(email: event.email));
    } on EmailConfirmationRequired {
      emit(const AuthError(
        message:
            'Te enviamos un correo para confirmar tu cuenta. Confírmalo y luego inicia sesión.',
      ));
    } catch (e) {
      emit(AuthError(message: _parseError(e)));
    }
  }

  Future<void> _onSignOut(
    AuthSignOutRequested event,
    Emitter<AuthState> emit,
  ) async {
    if (state is AuthUnauthenticated) return;
    await _auth.signOut();
    emit(const AuthUnauthenticated());
  }

  void _onSessionEnded(_AuthSessionEnded event, Emitter<AuthState> emit) {
    if (state is! AuthUnauthenticated) emit(const AuthUnauthenticated());
  }

  String _parseError(dynamic e) {
    final msg = e.toString().toLowerCase();
    if (msg.contains('invalid login')) return 'Email o contraseña incorrectos';
    if (msg.contains('email not confirmed')) {
      return 'Confirma tu correo antes de iniciar sesión';
    }
    if (msg.contains('already registered')) {
      return 'Ese correo ya tiene una cuenta. Inicia sesión.';
    }
    if (msg.contains('password')) {
      return 'La contraseña debe tener al menos 6 caracteres';
    }
    if (msg.contains('network') || msg.contains('socket')) {
      return 'Sin conexión. Revisa tu internet';
    }
    return 'Algo salió mal. Inténtalo de nuevo';
  }

  @override
  Future<void> close() {
    _sessionSub.cancel();
    AuthInterceptor.onUnauthorized = null;
    return super.close();
  }
}

/// Internal: the Supabase session ended outside the bloc.
class _AuthSessionEnded extends AuthEvent {
  const _AuthSessionEnded();
}
