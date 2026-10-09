import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nina_app/features/chat/bloc/chat_bloc.dart';
import 'package:nina_app/features/chat/bloc/chat_event.dart';
import 'package:nina_app/features/chat/bloc/chat_state.dart';

/// Returns a fixed JSON body (or status) for every request.
class FakeAdapter implements HttpClientAdapter {
  FakeAdapter(this.status, this.body);
  final int status;
  final Map<String, dynamic> body;
  RequestOptions? lastRequest;

  @override
  Future<ResponseBody> fetch(RequestOptions options, Stream<Uint8List>? _, Future<void>? __) async {
    lastRequest = options;
    return ResponseBody.fromString(
      jsonEncode(body),
      status,
      headers: {Headers.contentTypeHeader: [Headers.jsonContentType]},
    );
  }

  @override
  void close({bool force = false}) {}
}

Dio fakeDio(FakeAdapter adapter) =>
    Dio(BaseOptions(baseUrl: 'http://test'))..httpClientAdapter = adapter;

void main() {
  test('shows Sí / No only when the backend asks for confirmation', () async {
    final adapter = FakeAdapter(200, {
      'reply': '¿Confirmas S/ 20 en Comida?',
      'needsConfirmation': true,
      'followUps': [],
    });
    final bloc = ChatBloc(dio: fakeDio(adapter));
    await bloc.stream.firstWhere((s) => s is ChatReady); // greeting

    bloc.add(const ChatMessageSent(message: 'gasté 20 en comida'));
    final ready = await bloc.stream.firstWhere((s) => s is ChatReady);

    expect(ready.messages.last.text, '¿Confirmas S/ 20 en Comida?');
    expect(ready.messages.last.isConfirmation, isTrue);
    expect(adapter.lastRequest?.data, {'message': 'gasté 20 en comida'});
    await bloc.close();
  });

  test('a grounded answer that mentions "registrar" is not a confirmation', () async {
    final adapter = FakeAdapter(200, {
      'reply': 'Te recomiendo registrar tus gastos de transporte.',
      'needsConfirmation': false,
    });
    final bloc = ChatBloc(dio: fakeDio(adapter));
    await bloc.stream.firstWhere((s) => s is ChatReady);

    bloc.add(const ChatMessageSent(message: '¿cómo ahorro?'));
    final ready = await bloc.stream.firstWhere((s) => s is ChatReady);
    expect(ready.messages.last.isConfirmation, isFalse);
    await bloc.close();
  });

  test('401 shows a session message', () async {
    final bloc = ChatBloc(dio: fakeDio(FakeAdapter(401, {'message': 'Unauthorized'})));
    await bloc.stream.firstWhere((s) => s is ChatReady);

    bloc.add(const ChatMessageSent(message: 'hola'));
    final err = await bloc.stream.firstWhere((s) => s is ChatError) as ChatError;
    expect(err.error, contains('sesión'));
    await bloc.close();
  });
}
