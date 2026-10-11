import 'package:dio/dio.dart';
import '../../core/network/dio_client.dart';

/// An account the user organizes movements by (US-41). No balance (Phase 2).
class Account {
  const Account(
      {required this.id,
      required this.name,
      required this.kind,
      required this.institution,
      required this.archived});
  final String id;
  final String name;
  final String kind;
  final String? institution;
  final bool archived;

  factory Account.fromJson(Map<String, dynamic> j) => Account(
        id: j['id'] as String,
        name: j['name'] as String? ?? '',
        kind: j['kind'] as String? ?? 'bank',
        institution: j['institution'] as String?,
        archived: j['archived'] == true,
      );
}

const accountKinds = <String, String>{
  'bank': 'Banco',
  'cash': 'Efectivo',
  'card': 'Tarjeta',
  'wallet': 'Billetera (Yape, Plin…)',
};

class AccountsApiService {
  AccountsApiService({Dio? dio}) : _injected = dio;

  static final instance = AccountsApiService();

  final Dio? _injected;
  Dio get _dio => _injected ?? DioClient.instance.dio;

  Future<List<Account>> list() async {
    final res = await _dio.get<Map<String, dynamic>>('/v1/accounts');
    return ((res.data?['accounts'] as List?) ?? const [])
        .whereType<Map<String, dynamic>>()
        .map(Account.fromJson)
        .toList();
  }

  Future<Account> create(
      {required String name, required String kind, String? institution}) async {
    final res = await _dio.post<Map<String, dynamic>>('/v1/accounts', data: {
      'name': name,
      'kind': kind,
      if (institution != null && institution.trim().isNotEmpty)
        'institution': institution.trim(),
    });
    return Account.fromJson(res.data ?? const {});
  }

  Future<Account> update(String id,
      {String? name, String? kind, String? institution, bool? archived}) async {
    final res =
        await _dio.patch<Map<String, dynamic>>('/v1/accounts/$id', data: {
      if (name != null) 'name': name,
      if (kind != null) 'kind': kind,
      if (institution != null) 'institution': institution,
      if (archived != null) 'archived': archived,
    });
    return Account.fromJson(res.data ?? const {});
  }
}

String accountsErrorMessage(Object e) {
  if (e is DioException) {
    final body = e.response?.data;
    if (body is Map && body['code'] == 'ACCOUNTS_NOT_READY') {
      return 'Las cuentas todavía no están activadas. Inténtalo más tarde.';
    }
    if (body is Map &&
        body['message'] is String &&
        (e.response?.statusCode ?? 0) < 500) return body['message'] as String;
  }
  return 'Algo salió mal. Inténtalo de nuevo.';
}
