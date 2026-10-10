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
  moreTests();

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

/// Answers each request with the next queued body and records what was sent.
class QueueAdapter implements HttpClientAdapter {
  QueueAdapter(this.bodies);
  final List<Map<String, dynamic>> bodies;
  final sent = <dynamic>[];

  @override
  Future<ResponseBody> fetch(RequestOptions options, Stream<Uint8List>? _, Future<void>? __) async {
    sent.add(options.data);
    return ResponseBody.fromString(
      jsonEncode(bodies.removeAt(0)),
      200,
      headers: {Headers.contentTypeHeader: [Headers.jsonContentType]},
    );
  }

  @override
  void close({bool force = false}) {}
}

void moreTests() {
  test('sends the pending token back with "confirmar" (screenshot bug)', () async {
    final adapter = QueueAdapter([
      {'reply': 'Voy a registrar un sueldo de S/ 4500.00. ¿Confirmas?', 'needsConfirmation': true, 'pendingToken': 'tok-1'},
      {'reply': 'Ingreso registrado', 'needsConfirmation': false, 'followUps': ['¿Cuánto me queda?']},
      {'reply': 'ok', 'needsConfirmation': false},
    ]);
    final bloc = ChatBloc(dio: fakeDio2(adapter));
    await bloc.stream.firstWhere((s) => s is ChatReady);

    bloc.add(const ChatMessageSent(message: 'quiero registrar mis ingresos 4500 soles'));
    await bloc.stream.firstWhere((s) => s is ChatReady);
    bloc.add(const ChatConfirmationAccepted());
    final saved = await bloc.stream.firstWhere((s) => s is ChatReady && s.messages.last.text == 'Ingreso registrado');
    bloc.add(const ChatMessageSent(message: 'hola'));
    await bloc.stream.firstWhere((s) => s is ChatReady && s.messages.last.text == 'ok');

    expect(adapter.sent[1], {'message': 'confirmar', 'pendingToken': 'tok-1'});
    expect(adapter.sent[2], {'message': 'hola'}); // token cleared after use
    expect(saved.messages.last.followUps, ['¿Cuánto me queda?']);
    await bloc.close();
  });

  test('parses the result card', () async {
    final adapter = QueueAdapter([
      {
        'reply': 'En agosto gastaste S/ 1,870.30.',
        'needsConfirmation': false,
        'card': {
          'title': 'Tu resumen',
          'subtitle': 'Agosto 2026 · 5 movimientos',
          'highlight': {'label': 'Gastos', 'amount': 1870.3, 'tone': 'neutral'},
          'rows': [{'label': 'Hogar', 'amount': 1200}],
          'howCalculated': 'Sumé tus movimientos…',
          'confidence': 'medium',
        },
      },
    ]);
    final bloc = ChatBloc(dio: fakeDio2(adapter));
    await bloc.stream.firstWhere((s) => s is ChatReady);
    bloc.add(const ChatMessageSent(message: '¿cuánto gasté?'));
    final ready = await bloc.stream.firstWhere((s) => s is ChatReady && s.messages.last.card != null);
    final card = ready.messages.last.card!;
    expect(card.highlight?.amount, 1870.3);
    expect(card.rows.single.label, 'Hogar');
    await bloc.close();
  });
}

Dio fakeDio2(HttpClientAdapter adapter) =>
    Dio(BaseOptions(baseUrl: 'http://test'))..httpClientAdapter = adapter;
