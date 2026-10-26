import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../core/constants/app_constants.dart';

/// Thrown when sign-up succeeded but Supabase requires email confirmation
/// before a session exists.
class EmailConfirmationRequired implements Exception {
  const EmailConfirmationRequired();
}

/// Thin wrapper over Supabase Auth.
///
/// The session (and its access token) is owned by supabase_flutter, which
/// persists it and refreshes the token before it expires. We never store our
/// own copy of the JWT — a stored copy goes stale after ~1 hour.
class AuthService {
  AuthService._();

  static final AuthService instance = AuthService._();

  final _storage = const FlutterSecureStorage();
  GoTrueClient get _auth => Supabase.instance.client.auth;

  // ── Auth ──────────────────────────────────────────────────────────────────

  Future<AuthResponse> signIn({
    required String email,
    required String password,
  }) {
    return _auth.signInWithPassword(email: email, password: password);
  }

  Future<AuthResponse> signUp({
    required String email,
    required String password,
  }) async {
    final response = await _auth.signUp(email: email, password: password);
    if (response.session == null) {
      throw const EmailConfirmationRequired();
    }
    return response;
  }

  /// Confirms the sign-up with the 6-digit code from the email.
  Future<AuthResponse> verifySignupCode({
    required String email,
    required String code,
  }) {
    return _auth.verifyOTP(type: OtpType.signup, email: email, token: code);
  }

  Future<void> resendSignupCode(String email) =>
      _auth.resend(type: OtpType.signup, email: email);

  Future<void> sendPasswordReset(String email) =>
      _auth.resetPasswordForEmail(email);

  Future<void> signOut() async {
    await _auth.signOut();
    // Clean up tokens stored by older app versions.
    await _storage.delete(key: AppConstants.jwtTokenKey);
    await _storage.delete(key: AppConstants.userEmailKey);
  }

  // ── Session ───────────────────────────────────────────────────────────────

  /// Current access token, refreshed automatically by supabase_flutter.
  String? get accessToken => _auth.currentSession?.accessToken;

  bool hasValidSession() => _auth.currentSession != null;

  Stream<AuthState> get authStateChanges => _auth.onAuthStateChange;

  // ── User ─────────────────────────────────────────────────────────────────

  User? get currentUser => _auth.currentUser;
  String get userEmail => currentUser?.email ?? '';
}
