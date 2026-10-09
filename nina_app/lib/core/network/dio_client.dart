import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../constants/app_constants.dart';

class DioClient {
  DioClient._();

  static DioClient? _instance;
  static DioClient get instance => _instance ??= DioClient._();

  late final Dio _dio;

  /// Call once in main() before running the app
  void init() {
    _dio = Dio(
      BaseOptions(
        baseUrl: AppConstants.baseUrl,
        connectTimeout: const Duration(seconds: 15),
        receiveTimeout: const Duration(seconds: 30),
        headers: {'Content-Type': 'application/json'},
      ),
    );

    _dio.interceptors.addAll([
      AuthInterceptor(),
      if (kDebugMode) LogInterceptor(requestBody: true, responseBody: true),
    ]);
  }

  Dio get dio => _dio;
}

/// Adds the current Supabase access token to every API request.
class AuthInterceptor extends Interceptor {
  // Callback injected by AuthBloc to handle 401 globally
  static void Function()? onUnauthorized;

  @override
  Future<void> onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    // supabase_flutter refreshes this token before it expires.
    final token = Supabase.instance.client.auth.currentSession?.accessToken;
    if (token != null) {
      options.headers['Authorization'] = 'Bearer $token';
    }
    handler.next(options);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    if (err.response?.statusCode == 401) {
      onUnauthorized?.call();
    }
    handler.next(err);
  }
}
