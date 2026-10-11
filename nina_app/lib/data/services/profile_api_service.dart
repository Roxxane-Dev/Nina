import 'package:dio/dio.dart';
import '../../core/network/dio_client.dart';

/// Current consent state (US-03 / US-42). Purposes: data, AI, analytics.
class ConsentState {
  const ConsentState(
      {required this.answered,
      this.available = true,
      required this.dataProcessing,
      required this.aiProcessing,
      required this.analytics});
  final bool answered;

  /// False while the backend cannot store consents yet (migration pending).
  final bool available;
  final bool dataProcessing;
  final bool aiProcessing;
  final bool analytics;

  /// The app can be used only after the required consent is granted.
  bool get canUseApp => answered && dataProcessing;

  factory ConsentState.fromJson(Map<String, dynamic> j) {
    final c = (j['consents'] as Map?) ?? const {};
    return ConsentState(
      answered: j['answered'] == true,
      available: j['available'] != false,
      dataProcessing: c['data_processing'] == true,
      aiProcessing: c['ai_processing'] == true,
      analytics: c['analytics'] == true,
    );
  }
}

class Profile {
  const Profile({required this.email, required this.fullName});
  final String? email;
  final String? fullName;
}

/// Consents and profile (NestJS /v1/consents, /v1/me).
class ProfileApiService {
  ProfileApiService({Dio? dio}) : _injected = dio;

  static final instance = ProfileApiService();

  final Dio? _injected;
  Dio get _dio => _injected ?? DioClient.instance.dio;

  Future<ConsentState> getConsents() async {
    final res = await _dio.get<Map<String, dynamic>>('/v1/consents');
    return ConsentState.fromJson(res.data ?? const {});
  }

  Future<ConsentState> saveConsents(
      {required bool dataProcessing,
      required bool aiProcessing,
      required bool analytics}) async {
    final res = await _dio.post<Map<String, dynamic>>('/v1/consents', data: {
      'data_processing': dataProcessing,
      'ai_processing': aiProcessing,
      'analytics': analytics,
    });
    return ConsentState.fromJson(res.data ?? const {});
  }

  Future<Profile> getProfile() async {
    final res = await _dio.get<Map<String, dynamic>>('/v1/me');
    return Profile(
        email: res.data?['email'] as String?,
        fullName: res.data?['fullName'] as String?);
  }

  Future<Profile> updateName(String fullName) async {
    final res = await _dio
        .patch<Map<String, dynamic>>('/v1/me', data: {'fullName': fullName});
    return Profile(
        email: res.data?['email'] as String?,
        fullName: res.data?['fullName'] as String?);
  }
}
