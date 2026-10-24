import 'package:dio/dio.dart';
import '../constants/app_constants.dart';

/// True when the request never reached the server (server down, wrong address, no network).
bool isConnectionError(Object? error) {
  if (error is! DioException) return false;
  return error.type == DioExceptionType.connectionError ||
      error.type == DioExceptionType.connectionTimeout ||
      (error.response == null && error.type == DioExceptionType.unknown);
}

/// Message for a failed API call, saying what is actually wrong when the server is unreachable.
String apiLoadFailedMessage(Object? error,
    {required String fallback, String? baseUrl}) {
  if (isConnectionError(error)) {
    return 'No puedo conectar con el servidor (${baseUrl ?? AppConstants.baseUrl}). '
        'Revisa que el backend esté corriendo e inténtalo de nuevo.';
  }
  return fallback;
}
