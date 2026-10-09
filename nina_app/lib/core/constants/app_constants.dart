import 'package:flutter/foundation.dart';

class AppConstants {
  AppConstants._();

  // Values come from --dart-define-from-file=env/dev.json (git-ignored).
  // See env/dev.example.json for the expected keys.
  static const _apiBaseUrlOverride = String.fromEnvironment('API_BASE_URL');

  /// API base URL. Android emulators reach the host machine via 10.0.2.2.
  static String get baseUrl {
    if (_apiBaseUrlOverride.isNotEmpty) return _apiBaseUrlOverride;
    if (!kIsWeb && defaultTargetPlatform == TargetPlatform.android) {
      return 'http://10.0.2.2:3000';
    }
    return 'http://127.0.0.1:3000';
  }

  // Supabase (anon key is public by design; isolation is enforced by RLS)
  static const supabaseUrl = String.fromEnvironment('SUPABASE_URL');
  static const supabaseAnonKey = String.fromEnvironment('SUPABASE_ANON_KEY');

  // Secure storage keys
  static const jwtTokenKey = 'nina_jwt_token';
  static const userEmailKey = 'nina_user_email';

  // Pagination
  static const pageSize = 20;
}

class AppStrings {
  AppStrings._();

  static const appName = 'Nina';
  static const chatHint = 'Cuéntale a Nina...';
  static const ninaThinking = 'Nina está pensando...';
  static const confirm = 'Confirmar';
  static const cancel = 'Cancelar';
  static const online = 'En línea';

  // Nav
  static const navChat = 'Chat';
  static const navDashboard = 'Dashboard';
  static const navProfile = 'Perfil';

  // Errors
  static const errorGeneric = 'Algo salió mal, pero ya lo estoy revisando 🔍';
  static const errorNetwork = 'Sin conexión. Revisa tu internet 📡';
  static const errorAuth = 'Sesión expirada. Ingresa de nuevo 🔒';

  // Empty states
  static const emptyExpenses =
      'Aún no tienes gastos registrados. ¡Cuéntame en qué gastaste! 💬';
  static const emptyDashboard =
      'Aquí verás tus finanzas en cuanto registres tu primer gasto 📊';
}
