import 'package:dio/dio.dart';
import '../constants/app_constants.dart';

/// Detects the classic dev mistake: the app signs in against one Supabase project while the
/// API validates tokens against another. The API then answers 401 to a perfectly valid login
/// and the user is thrown back to the login screen with no explanation.
///
/// Asks the public `GET /health` which Supabase host the server uses and compares it with the
/// host the app was built with. Returns a user-facing message on mismatch, or null when the
/// hosts agree or the check cannot be made (never blocks the app on its own).
Future<String?> configMismatchMessage(
    {Dio? dio, String? appSupabaseUrl}) async {
  try {
    final client = dio ??
        Dio(BaseOptions(
          baseUrl: AppConstants.baseUrl,
          connectTimeout: const Duration(seconds: 4),
          receiveTimeout: const Duration(seconds: 4),
        ));
    final res = await client.get<Map<String, dynamic>>('/health');
    final server = res.data?['supabaseHost'] as String?;
    final app = Uri.tryParse(appSupabaseUrl ?? AppConstants.supabaseUrl)?.host;
    if (server == null || server.isEmpty || app == null || app.isEmpty) {
      return null;
    }
    if (server == app) return null;
    return 'La app y el servidor usan bases de datos distintas '
        '(app: $app, servidor: $server). Ejecuta la app con el mismo proyecto '
        'que el servidor, por ejemplo con env/local.json.';
  } catch (_) {
    return null;
  }
}
