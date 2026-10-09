import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../core/constants/app_constants.dart';
import '../../domain/models/nina_snapshot.dart';

/// HTTP client for GET /intelligence/snapshot on the NestJS backend.
/// Caches the last result in memory with a TTL of 5 minutes.
/// Call [invalidate] after any transaction write to force a fresh fetch.
class IntelligenceApiService {
  IntelligenceApiService._();
  static final instance = IntelligenceApiService._();

  final _dio = Dio(BaseOptions(
    baseUrl: AppConstants.baseUrl,
    connectTimeout: const Duration(seconds: 10),
    receiveTimeout: const Duration(seconds: 15),
    contentType: 'application/json',
  ));

  NinaSnapshot? _cached;
  DateTime? _cachedAt;
  static const _ttl = Duration(minutes: 5);

  /// Returns the snapshot. Uses memory cache unless stale or [forceRefresh].
  Future<NinaSnapshot?> fetchSnapshot({bool forceRefresh = false}) async {
    return getSnapshot(forceRefresh: forceRefresh);
  }

  Future<NinaSnapshot?> getSnapshot({bool forceRefresh = false}) async {
    if (!forceRefresh && _cached != null && _cachedAt != null) {
      if (DateTime.now().difference(_cachedAt!) < _ttl) {
        return _cached;
      }
    }

    try {
      final session = Supabase.instance.client.auth.currentSession;
      if (session == null) return _cached;

      final response = await _dio.get<Map<String, dynamic>>(
        '/intelligence/snapshot',
        options: Options(headers: {
          'Authorization': 'Bearer ${session.accessToken}',
        }),
      );

      if (response.statusCode == 200 && response.data != null) {
        _cached = NinaSnapshot.fromJson(response.data!);
        _cachedAt = DateTime.now();
        return _cached;
      }
      return _cached;
    } on DioException catch (e) {
      debugPrint('[IntelligenceApiService] DioException: ${e.message}');
      return _cached; // return stale cache on error
    } catch (e) {
      debugPrint('[IntelligenceApiService] Error: $e');
      return _cached;
    }
  }

  /// Invalidates the cache so the next call fetches fresh data.
  void invalidate() {
    _cached = null;
    _cachedAt = null;
  }

  /// Returns the last cached snapshot synchronously (may be null).
  NinaSnapshot? get lastSnapshot => _cached;
}
