import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../core/constants/app_constants.dart';

class AuthService {
  AuthService._();

  static final AuthService instance = AuthService._();

  final _storage = const FlutterSecureStorage();
  final _supabase = Supabase.instance.client;

  // ── Auth ──────────────────────────────────────────────────────────────────

  Future<AuthResponse> signIn({
    required String email,
    required String password,
  }) async {
    final response = await _supabase.auth.signInWithPassword(
      email: email,
      password: password,
    );
    await _persistToken(response.session?.accessToken);
    return response;
  }

  Future<AuthResponse> signUp({
    required String email,
    required String password,
  }) async {
    final response = await _supabase.auth.signUp(
      email: email,
      password: password,
    );
    await _persistToken(response.session?.accessToken);
    return response;
  }

  Future<void> signOut() async {
    await _supabase.auth.signOut();
    await _storage.delete(key: AppConstants.jwtTokenKey);
    await _storage.delete(key: AppConstants.userEmailKey);
  }

  // ── Token helpers ─────────────────────────────────────────────────────────

  Future<String?> getToken() =>
      _storage.read(key: AppConstants.jwtTokenKey);

  Future<bool> hasValidSession() async {
    final token = await getToken();
    return token != null && token.isNotEmpty;
  }

  Future<void> _persistToken(String? token) async {
    if (token != null) {
      await _storage.write(key: AppConstants.jwtTokenKey, value: token);
    }
  }

  // ── User ─────────────────────────────────────────────────────────────────

  User? get currentUser => _supabase.auth.currentUser;
  String get userEmail => currentUser?.email ?? '';
}
