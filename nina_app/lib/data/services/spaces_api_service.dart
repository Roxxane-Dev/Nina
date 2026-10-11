import 'package:dio/dio.dart';
import '../../core/network/dio_client.dart';
import '../../domain/models/overview.dart';

/// A shared space the user belongs to (US-33).
class SpaceSummary {
  const SpaceSummary(
      {required this.id,
      required this.name,
      required this.type,
      required this.role,
      required this.memberCount});
  final String id;
  final String name;
  final String type;
  final String role;
  final int memberCount;

  bool get isOwner => role == 'owner';

  factory SpaceSummary.fromJson(Map<String, dynamic> j) => SpaceSummary(
        id: j['id'] as String,
        name: j['name'] as String? ?? '',
        type: j['type'] as String? ?? 'pareja',
        role: j['role'] as String? ?? 'member',
        memberCount: (j['memberCount'] as num?)?.toInt() ?? 1,
      );
}

/// What each member registered in the space this period (US-37).
class MemberContribution {
  const MemberContribution(
      {required this.name,
      required this.expenses,
      required this.income,
      required this.count,
      required this.isMe});
  final String name;
  final double expenses;
  final double income;
  final int count;
  final bool isMe;
}

class SpaceOverview {
  const SpaceOverview({required this.overview, required this.members});
  final Overview overview;
  final List<MemberContribution> members;

  factory SpaceOverview.fromJson(Map<String, dynamic> j) => SpaceOverview(
        overview: Overview.fromJson(j),
        members: (j['members'] as List? ?? const [])
            .whereType<Map>()
            .map((m) => MemberContribution(
                  name: m['name'] as String? ?? '',
                  expenses: (m['expenses'] as num?)?.toDouble() ?? 0,
                  income: (m['income'] as num?)?.toDouble() ?? 0,
                  count: (m['count'] as num?)?.toInt() ?? 0,
                  isMe: m['isMe'] == true,
                ))
            .toList(),
      );
}

class SpaceMovement {
  const SpaceMovement({
    required this.id,
    required this.type,
    required this.amount,
    required this.category,
    required this.description,
    required this.date,
    required this.author,
    required this.isMine,
  });
  final String id;
  final String type;
  final double amount;
  final String? category;
  final String? description;
  final String? date;
  final String author;
  final bool isMine;

  factory SpaceMovement.fromJson(Map<String, dynamic> j) => SpaceMovement(
        id: j['id'].toString(),
        type: j['type'] as String? ?? 'expense',
        amount: (j['amount'] as num?)?.toDouble() ?? 0,
        category: j['category'] as String?,
        description: j['description'] as String?,
        date: j['date'] as String?,
        author: j['author'] as String? ?? '',
        isMine: j['isMine'] == true,
      );
}

/// Shared spaces API (US-33 to US-38).
class SpacesApiService {
  SpacesApiService({Dio? dio}) : _injected = dio;

  static final instance = SpacesApiService();

  final Dio? _injected;
  Dio get _dio => _injected ?? DioClient.instance.dio;

  Future<List<SpaceSummary>> list() async {
    final res = await _dio.get<Map<String, dynamic>>('/v1/spaces');
    return ((res.data?['spaces'] as List?) ?? const [])
        .whereType<Map<String, dynamic>>()
        .map(SpaceSummary.fromJson)
        .toList();
  }

  Future<SpaceSummary> create(String name, String type) async {
    final res = await _dio.post<Map<String, dynamic>>('/v1/spaces',
        data: {'name': name, 'type': type});
    return SpaceSummary.fromJson(res.data ?? const {});
  }

  Future<SpaceSummary> join(String code) async {
    final res = await _dio
        .post<Map<String, dynamic>>('/v1/spaces/join', data: {'code': code});
    return SpaceSummary.fromJson(res.data ?? const {});
  }

  /// Returns the 8-character code to share.
  Future<String> invite(String spaceId) async {
    final res =
        await _dio.post<Map<String, dynamic>>('/v1/spaces/$spaceId/invites');
    return res.data?['code'] as String? ?? '';
  }

  Future<void> leave(String spaceId) async {
    await _dio.delete<void>('/v1/spaces/$spaceId/membership');
  }

  Future<SpaceOverview> overview(String spaceId,
      {OverviewPeriod period = OverviewPeriod.current}) async {
    final res = await _dio.get<Map<String, dynamic>>(
        '/v1/spaces/$spaceId/overview',
        queryParameters: {'period': period.param});
    return SpaceOverview.fromJson(res.data ?? const {});
  }

  Future<List<SpaceMovement>> movements(String spaceId) async {
    final res = await _dio
        .get<Map<String, dynamic>>('/v1/spaces/$spaceId/transactions');
    return ((res.data?['transactions'] as List?) ?? const [])
        .whereType<Map<String, dynamic>>()
        .map(SpaceMovement.fromJson)
        .toList();
  }
}

/// User-facing message for spaces errors (codes from the backend).
String spacesErrorMessage(Object e) {
  if (e is DioException) {
    final body = e.response?.data;
    final code = body is Map ? body['code'] : null;
    final message = body is Map ? body['message'] : null;
    if (code == 'SPACES_NOT_READY')
      return 'Los espacios compartidos todavía no están activados. Inténtalo más tarde.';
    final status = e.response?.statusCode;
    if ((status == 400 || status == 404 || status == 410) && message is String)
      return message;
    if (status == 404) return 'No encontré ese espacio.';
  }
  return 'Algo salió mal. Inténtalo de nuevo.';
}
