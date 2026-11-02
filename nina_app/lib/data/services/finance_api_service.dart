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
    String? spaceId,
    String? accountId,
  }) async {
    await _dio.post<Map<String, dynamic>>('/v1/transactions', data: {
      'type': type,
      'amount': amount,
      'category': category,
      'date': date,
      if (note != null && note.trim().isNotEmpty) 'note': note.trim(),
      if (spaceId != null) 'spaceId': spaceId,
      if (accountId != null) 'accountId': accountId,
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

  /// HOME-03. True when a changed category will be remembered (US-24).
  Future<bool> updateTransaction(String id,
      {required double amount,
      required String date,
      required String note,
      String? category}) async {
    final res = await _dio.patch<Map<String, dynamic>>(
      '/v1/transactions/$id',
      data: {
        'amount': amount,
        'date': date,
        'note': note,
        if (category != null) 'category': category,
      },
    );
    return res.data?['remembered'] == true;
  }

  /// DATA-01: what the file holds; the server saves nothing here.
  Future<CsvPreview> previewCsv(String csv) async {
    final res = await _dio.post<Map<String, dynamic>>(
        '/v1/transactions/import/preview',
        data: {'csv': csv});
    return CsvPreview.fromJson(res.data ?? const {});
  }

  /// DATA-01. Returns how many movements were saved.
  Future<int> importCsv(String csv, {List<int> skipLines = const []}) async {
    final res = await _dio.post<Map<String, dynamic>>('/v1/transactions/import',
        data: {'csv': csv, 'skipLines': skipLines});
    return (res.data?['imported'] as num?)?.toInt() ?? 0;
  }

  /// US-25.
  Future<void> deleteTransaction(String id) async {
    await _dio.delete<void>('/v1/transactions/$id');
  }
}

class CsvPreviewRow {
  const CsvPreviewRow({
    required this.line,
    required this.date,
    required this.description,
    required this.amount,
    required this.isIncome,
    required this.category,
    required this.categoryLabel,
    required this.duplicate,
  });

  final int line;
  final String date;
  final String description;
  final double amount;
  final bool isIncome;
  final String category;
  final String categoryLabel;
  final bool duplicate;

  factory CsvPreviewRow.fromJson(Map<String, dynamic> j) => CsvPreviewRow(
        line: (j['line'] as num).toInt(),
        date: j['date'] as String? ?? '',
        description: j['description'] as String? ?? '',
        amount: (j['amount'] as num?)?.toDouble() ?? 0,
        isIncome: j['type'] == 'income',
        category: j['category'] as String? ?? 'other',
        categoryLabel: j['categoryLabel'] as String? ?? 'Otros',
        duplicate: j['duplicate'] == true,
      );
}

class CsvPreview {
  const CsvPreview(
      {required this.rows,
      required this.skipped,
      required this.assumedExpenses});

  final List<CsvPreviewRow> rows;
  final List<({int line, String reason})> skipped;

  /// The file has no sign: every row was read as an expense.
  final bool assumedExpenses;

  factory CsvPreview.fromJson(Map<String, dynamic> j) => CsvPreview(
        rows: ((j['rows'] as List?) ?? const [])
            .whereType<Map>()
            .map((r) => CsvPreviewRow.fromJson(r.cast<String, dynamic>()))
            .toList(),
        skipped: ((j['skipped'] as List?) ?? const [])
            .whereType<Map>()
            .map((s) => (
                  line: (s['line'] as num).toInt(),
                  reason: s['reason'] as String? ?? ''
                ))
            .toList(),
        assumedExpenses: j['assumedExpenses'] == true,
      );
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
