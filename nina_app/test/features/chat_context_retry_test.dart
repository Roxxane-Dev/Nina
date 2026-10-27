import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nina_app/features/chat/bloc/chat_bloc.dart';
import 'package:nina_app/features/chat/bloc/chat_event.dart';
import 'package:nina_app/features/chat/bloc/chat_message.dart';
import 'package:nina_app/features/chat/bloc/chat_state.dart';
import 'package:nina_app/features/chat/widgets/message_bubble.dart';

/// Answers each request with the next scripted (status, body) and records what was sent.
class ScriptAdapter implements HttpClientAdapter {
  ScriptAdapter(this.script);
  final List<(int, Map<String, dynamic>)> script;
  final sent = <dynamic>[];

  @override
  Future<ResponseBody> fetch(
      RequestOptions options, Stream<Uint8List>? _, Future<void>? __) async {
    sent.add(options.data);
    final (status, body) = script.removeAt(0);
    return ResponseBody.fromString(
      jsonEncode(body),
      status,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType]
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

ChatBloc blocWith(ScriptAdapter adapter) => ChatBloc(
    dio: Dio(BaseOptions(baseUrl: 'http://test'))..httpClientAdapter = adapter);

Map<String, dynamic> ok(String reply, {String? context}) => {
      'reply': reply,
      'needsConfirmation': false,
      'followUps': <String>[],
      if (context != null) 'context': context,
    };

void main() {
  test('greeting says Hey and offers the beginner starters', () async {
    final bloc = blocWith(ScriptAdapter([]));
    final ready =
        await bloc.stream.firstWhere((s) => s is ChatReady) as ChatReady;
    expect(ready.messages.single.text, startsWith('Hey'));
    expect(ready.messages.single.followUps, ChatBloc.defaultFollowUps);
    expect(ChatBloc.defaultFollowUps, contains('¿Me alcanza para algo?'));
    await bloc.close();
  });

  test('sends back the context from the previous reply and keeps it', () async {
    final adapter = ScriptAdapter([
      (200, ok('¿Cuánto cuestan?', context: 'ctx-1')),
      (200, ok('Te quedan S/ 4,500.00.', context: 'ctx-2')),
      (200, ok('Va.')), // no new context: the last one is kept
      (200, ok('ok')),
    ]);
    final bloc = blocWith(adapter);
    await bloc.stream.firstWhere((s) => s is ChatReady);

    Future<void> say(String text, String expectedReply) async {
      bloc.add(ChatMessageSent(message: text));
      await bloc.stream.firstWhere(
          (s) => s is ChatReady && s.messages.last.text == expectedReply);
    }

    await say('Quiero comprarme unas zapatillas', '¿Cuánto cuestan?');
    await say('Cuestan 350 soles', 'Te quedan S/ 4,500.00.');
    await say('no entiendo', 'Va.');
    await say('hola', 'ok');

    expect(adapter.sent[0], {'message': 'Quiero comprarme unas zapatillas'});
    expect(
        adapter.sent[1], {'message': 'Cuestan 350 soles', 'context': 'ctx-1'});
    expect(adapter.sent[2], {'message': 'no entiendo', 'context': 'ctx-2'});
    expect(adapter.sent[3], {'message': 'hola', 'context': 'ctx-2'});
    await bloc.close();
  });

  test(
      'a failed send leaves an error bubble with retry; retry resends the same text and keeps the conversation',
      () async {
    final adapter = ScriptAdapter([
      (200, ok('Te quedan S/ 4,500.00.', context: 'ctx-1')),
      (500, {'code': 'INTERNAL', 'message': 'x', 'requestId': 'abc12345-0000'}),
      (200, ok('En octubre gastaste S/ 120.50.')),
    ]);
    final bloc = blocWith(adapter);
    await bloc.stream.firstWhere((s) => s is ChatReady);

    bloc.add(const ChatMessageSent(message: '¿Cuánto me queda?'));
    await bloc.stream.firstWhere((s) => s is ChatReady);
    bloc.add(const ChatMessageSent(message: '¿Cuánto gasté?'));
    final err =
        await bloc.stream.firstWhere((s) => s is ChatError) as ChatError;

    final errorBubble = err.messages.last;
    expect(errorBubble.isUser, isFalse);
    expect(errorBubble.canRetry, isTrue);
    expect(errorBubble.retryText, '¿Cuánto gasté?');
    expect(err.messages.map((m) => m.text).toList().sublist(1, 4), [
      '¿Cuánto me queda?',
      'Te quedan S/ 4,500.00.',
      '¿Cuánto gasté?',
    ]);

    bloc.add(ChatRetryRequested(errorMessageId: errorBubble.id));
    final ready = await bloc.stream.firstWhere((s) =>
        s is ChatReady &&
        s.messages.last.text == 'En octubre gastaste S/ 120.50.') as ChatReady;

    // Same text resent, with the context of the last good reply.
    expect(adapter.sent[2], adapter.sent[1]);
    expect(adapter.sent[2], {'message': '¿Cuánto gasté?', 'context': 'ctx-1'});
    // Prior messages kept, the user message not duplicated, the error bubble gone.
    expect(ready.messages.map((m) => m.text).skip(1).toList(), [
      '¿Cuánto me queda?',
      'Te quedan S/ 4,500.00.',
      '¿Cuánto gasté?',
      'En octubre gastaste S/ 120.50.',
    ]);
    expect(ready.messages.any((m) => m.id == errorBubble.id), isFalse);
    expect(ready.messages.where((m) => m.isUser).length, 2);
    await bloc.close();
  });

  test('a connection error is retryable too', () async {
    final bloc = ChatBloc(
        dio: Dio(BaseOptions(baseUrl: 'http://test'))
          ..httpClientAdapter = _ThrowingAdapter());
    await bloc.stream.firstWhere((s) => s is ChatReady);
    bloc.add(const ChatMessageSent(message: 'hola'));
    final err =
        await bloc.stream.firstWhere((s) => s is ChatError) as ChatError;
    expect(err.messages.last.retryText, 'hola');
    expect(err.error, contains('conectarme'));
    await bloc.close();
  });

  test('a 401 has no retry', () async {
    final bloc = blocWith(ScriptAdapter([
      (401, {'message': 'Unauthorized'})
    ]));
    await bloc.stream.firstWhere((s) => s is ChatReady);
    bloc.add(const ChatMessageSent(message: 'hola'));
    final err =
        await bloc.stream.firstWhere((s) => s is ChatError) as ChatError;
    expect(err.error, contains('sesión'));
    expect(err.messages.last.canRetry, isFalse);
    expect(err.messages.last.retryText, isNull);
    await bloc.close();
  });

  test('a 400 has no retry', () async {
    final bloc = blocWith(ScriptAdapter([
      (400, {'message': 'Bad request'})
    ]));
    await bloc.stream.firstWhere((s) => s is ChatReady);
    bloc.add(const ChatMessageSent(message: 'hola'));
    final err =
        await bloc.stream.firstWhere((s) => s is ChatError) as ChatError;
    expect(err.messages.last.canRetry, isFalse);
    await bloc.close();
  });

  testWidgets('MessageBubble shows chat-retry only on retryable errors',
      (tester) async {
    final bloc = blocWith(ScriptAdapter([]));
    Future<void> show(ChatMessage m) async {
      await tester.pumpWidget(MaterialApp(
        home: Scaffold(
          body:
              BlocProvider.value(value: bloc, child: MessageBubble(message: m)),
        ),
      ));
      await tester.pump(const Duration(milliseconds: 500));
    }

    await show(const ChatMessage(
        id: 'e1', text: 'Algo salió mal', isUser: false, retryText: 'hola'));
    expect(find.byKey(const Key('chat-retry')), findsOneWidget);
    expect(find.text('Reintentar'), findsOneWidget);

    await show(const ChatMessage(
        id: 'e2', text: 'Tu sesión expiró. Ingresa de nuevo.', isUser: false));
    expect(find.byKey(const Key('chat-retry')), findsNothing);
    await tester.pumpWidget(const SizedBox());
    await tester.runAsync(bloc.close);
  });
}

class _ThrowingAdapter implements HttpClientAdapter {
  @override
  Future<ResponseBody> fetch(
      RequestOptions options, Stream<Uint8List>? _, Future<void>? __) async {
    throw DioException.connectionError(
        requestOptions: options, reason: 'offline');
  }

  @override
  void close({bool force = false}) {}
}
