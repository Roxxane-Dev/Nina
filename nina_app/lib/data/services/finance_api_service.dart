import 'package:dio/dio.dart';
import '../../core/network/dio_client.dart';
import '../../domain/models/overview.dart';

/// Engine-backed figures and manual transactions (NestJS /v1).
class FinanceApiService {
  FinanceApiService({Dio? dio}) : _injected = dio;

  static final instance = FinanceApiService();

  final Dio? _injected;

  /// Resolved lazily so the shared client is only touched when a call is made.
  Dio get _dio => _injected ?? DioClient.instance.dio;

  Future<Overview> getOverview(
      {OverviewPeriod period = OverviewPeriod.current}) async {
    final res = await _dio.get<Map<String, dynamic>>(
      '/v1/overview',
      queryParameters: {'period': period.param},
    );
    return Overview.fromJson(res.data ?? const {});
  }

  Future<List<TrendPoint>> getTrends({int months = 6}) async {
    final res = await _dio.get<Map<String, dynamic>>(
      '/v1/trends',
      queryParameters: {'months': months},
    );
    return ((res.data?['points'] as List?) ?? const [])
        .whereType<Map<String, dynamic>>()
        .map(TrendPoint.fromJson)
        .toList();
  }

  /// US-26. [date] is 'YYYY-MM-DD'; the backend validates everything again.
  Future<void> createTransaction({
    required String type,
    required double amount,
    required String category,
    required String date,
    String? note,
  }) async {
    await _dio.post<Map<String, dynamic>>('/v1/transactions', data: {
      'type': type,
      'amount': amount,
      'category': category,
      'date': date,
      if (note != null && note.trim().isNotEmpty) 'note': note.trim(),
    });
  }

  /// US-24. Returns true when Nina will remember it for similar descriptions.
  Future<bool> updateCategory(String id, String category) async {
    final res = await _dio.patch<Map<String, dynamic>>(
      '/v1/transactions/$id',
      data: {'category': category},
    );
    return res.data?['remembered'] == true;
  }

  /// US-25.
  Future<void> deleteTransaction(String id) async {
    await _dio.delete<void>('/v1/transactions/$id');
  }
}

/// User-facing message for a failed engine call (no technical jargon).
String financeErrorMessage(Object e) {
  if (e is DioException) {
    final status = e.response?.statusCode;
    final body = e.response?.data;
    if (status == 400 && body is Map && body['message'] is String) {
      return 'Revisa los datos: ${body['message']}';
    }
    if (status == 503) {
      return 'No pude consultar tus movimientos ahora. Inténtalo en unos minutos.';
    }
    if (status == 401) return 'Tu sesión expiró. Ingresa de nuevo.';
    if (e.type == DioExceptionType.connectionError ||
        e.type == DioExceptionType.connectionTimeout ||
        e.type == DioExceptionType.receiveTimeout) {
      return 'No puedo conectarme con Nina ahora. Revisa tu conexión o que el servidor esté encendido.';
    }
  }
  return 'Algo salió mal. Inténtalo de nuevo.';
}
