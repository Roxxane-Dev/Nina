import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../constants/app_constants.dart';

class DioClient {
  DioClient._();

  static DioClient? _instance;
  static DioClient get instance => _instance ??= DioClient._();

  late final Dio _dio;
  final _storage = const FlutterSecureStorage();

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
      _AuthInterceptor(_storage),
      if (kDebugMode) LogInterceptor(requestBody: true, responseBody: true),
    ]);
  }

  Dio get dio => _dio;
}

class _AuthInterceptor extends Interceptor {
  _AuthInterceptor(this._storage);
  final FlutterSecureStorage _storage;

  // Callback injected by AuthBloc to handle 401 globally
  static void Function()? onUnauthorized;

  @override
  Future<void> onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    final token = await _storage.read(key: AppConstants.jwtTokenKey);
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
