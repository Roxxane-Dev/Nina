// Auth BLoC
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../shared/services/auth_service.dart';
import 'auth_event.dart';
import 'auth_state.dart';

class AuthBloc extends Bloc<AuthEvent, AuthState> {
  AuthBloc() : super(const AuthInitial()) {
    on<AuthCheckRequested>(_onCheckRequested);
    on<AuthSignInRequested>(_onSignIn);
    on<AuthSignUpRequested>(_onSignUp);
    on<AuthSignOutRequested>(_onSignOut);
  }

  final _auth = AuthService.instance;

  Future<void> _onCheckRequested(
    AuthCheckRequested event,
    Emitter<AuthState> emit,
  ) async {
    emit(const AuthLoading());
    final valid = await _auth.hasValidSession();
    if (valid) {
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
    } catch (e) {
      emit(AuthError(message: _parseError(e)));
    }
  }

  Future<void> _onSignOut(
    AuthSignOutRequested event,
    Emitter<AuthState> emit,
  ) async {
    await _auth.signOut();
    emit(const AuthUnauthenticated());
  }

  String _parseError(dynamic e) {
    final msg = e.toString().toLowerCase();
    if (msg.contains('invalid login')) return 'Email o contraseña incorrectos';
    if (msg.contains('network')) return 'Sin conexión. Revisa tu internet 📡';
    return 'Algo salió mal. Inténtalo de nuevo 🔁';
  }
}
