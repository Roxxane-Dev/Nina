import 'package:dio/dio.dart';
import '../../core/network/dio_client.dart';

/// One "aviso" as the backend engine computes it (GET /v1/nudges).
class Nudge {
  const Nudge({
    required this.key,
    required this.tone,
    required this.title,
    required this.body,
    required this.actionType,
    this.draft,
  });

  final String key;

  /// calm | neutral | positive
  final String tone;
  final String title;
  final String body;

  /// chat | add | goals | transactions
  final String actionType;
  final String? draft;

  factory Nudge.fromJson(Map<String, dynamic> j) {
    final action = (j['action'] as Map?) ?? const {};
    return Nudge(
      key: j['key'].toString(),
      tone: j['tone'] as String? ?? 'neutral',
      title: j['title'] as String? ?? '',
      body: j['body'] as String? ?? '',
      actionType: action['type'] as String? ?? 'chat',
      draft: action['draft'] as String?,
    );
  }
}

class NudgesApiService {
  NudgesApiService({Dio? dio}) : _injected = dio;

  static final NudgesApiService instance = NudgesApiService();

  final Dio? _injected;
  Dio get _dio => _injected ?? DioClient.instance.dio;

  Future<List<Nudge>> list() async {
    final res = await _dio.get<Map<String, dynamic>>('/v1/nudges');
    return ((res.data?['nudges'] as List?) ?? const [])
        .whereType<Map>()
        .map((n) => Nudge.fromJson(n.cast<String, dynamic>()))
        .toList();
  }

  Future<void> dismiss(String key) async {
    await _dio.post<void>('/v1/nudges/dismiss', data: {'key': key});
  }
}
