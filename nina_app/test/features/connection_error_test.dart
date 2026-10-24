import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nina_app/core/network/connection_error.dart';
import 'package:nina_app/data/services/profile_api_service.dart';
import 'package:nina_app/features/privacy/consent_gate.dart';

class _DownApi extends ProfileApiService {
  _DownApi() : super(dio: null);
  @override
  Future<ConsentState> getConsents() async => throw DioException(
        requestOptions: RequestOptions(path: '/v1/consents'),
        type: DioExceptionType.connectionError,
      );
}

class _ServerErrorApi extends ProfileApiService {
  _ServerErrorApi() : super(dio: null);
  @override
  Future<ConsentState> getConsents() async => throw DioException(
        requestOptions: RequestOptions(path: '/v1/consents'),
        response: Response(
            requestOptions: RequestOptions(path: '/v1/consents'),
            statusCode: 503),
        type: DioExceptionType.badResponse,
      );
}

void main() {
  test('isConnectionError tells "server unreachable" from other failures', () {
    DioException e(DioExceptionType t, {int? status}) => DioException(
          requestOptions: RequestOptions(path: '/x'),
          type: t,
          response: status == null
              ? null
              : Response(
                  requestOptions: RequestOptions(path: '/x'),
                  statusCode: status),
        );
    expect(isConnectionError(e(DioExceptionType.connectionError)), isTrue);
    expect(isConnectionError(e(DioExceptionType.connectionTimeout)), isTrue);
    expect(isConnectionError(e(DioExceptionType.badResponse, status: 503)),
        isFalse);
    expect(isConnectionError(e(DioExceptionType.badResponse, status: 401)),
        isFalse);
    expect(isConnectionError(StateError('x')), isFalse);
    expect(isConnectionError(null), isFalse);
  });

  test('the message names the server address only for connection errors', () {
    final down = DioException(
        requestOptions: RequestOptions(path: '/x'),
        type: DioExceptionType.connectionError);
    expect(
        apiLoadFailedMessage(down,
            fallback: 'otro', baseUrl: 'http://127.0.0.1:3000'),
        allOf(contains('127.0.0.1:3000'), contains('backend')));
    expect(apiLoadFailedMessage(StateError('x'), fallback: 'otro'), 'otro');
  });

  testWidgets(
      'privacy gate says the server is unreachable instead of a vague privacy error',
      (tester) async {
    await tester.pumpWidget(MaterialApp(
        home: ConsentGate(api: _DownApi(), child: const Text('APP'))));
    await tester.pumpAndSettle();
    expect(find.textContaining('No puedo conectar con el servidor'),
        findsOneWidget);
    expect(find.textContaining('configuración de privacidad'), findsNothing);
    expect(find.text('Reintentar'), findsOneWidget);
  });

  testWidgets('other failures keep the privacy message', (tester) async {
    await tester.pumpWidget(MaterialApp(
        home: ConsentGate(api: _ServerErrorApi(), child: const Text('APP'))));
    await tester.pumpAndSettle();
    expect(find.textContaining('configuración de privacidad'), findsOneWidget);
  });
}
