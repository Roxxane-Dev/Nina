// Chat BLoC
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../core/network/dio_client.dart';
import 'dart:convert';
import 'chat_event.dart';
import 'chat_state.dart';
import 'chat_message.dart';

class ChatBloc extends Bloc<ChatEvent, ChatState> {
  ChatBloc() : super(const ChatInitial()) {
    on<ChatMessageSent>(_onMessageSent);
    on<ChatConfirmationAccepted>(_onConfirmAccepted);
    on<ChatConfirmationRejected>(_onConfirmRejected);
    on<_ChatGreet>(_onGreet);

    // Greet the user on first load
    add(const _ChatGreet());
  }

  final _dio = DioClient.instance.dio;

  void _onGreet(_ChatGreet event, Emitter<ChatState> emit) {
    final greeting = ChatMessage(
      id: DateTime.now().microsecondsSinceEpoch.toString(),
      text:
          'Hola 👋 Soy Nina, tu asistente financiera. ¿En qué te ayudo hoy?',
      isUser: false,
    );
    emit(ChatReady(messages: [greeting]));
  }

  Future<void> _onMessageSent(
    ChatMessageSent event,
    Emitter<ChatState> emit,
  ) async {
    // Skip internal greet event forwarded as sent
    final userMsg = ChatMessage(
      id: DateTime.now().microsecondsSinceEpoch.toString(),
      text: event.message,
      isUser: true,
    );

    const loadingMsg = ChatMessage(
      id: 'loading',
      text: '',
      isUser: false,
      isPending: true,
    );

    emit(ChatSending(messages: [...state.messages, userMsg, loadingMsg]));

    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '/chat',
        data: {
          'message': event.message,
          if (event.snapshotContext != null) 'context': event.snapshotContext,
        },
      );

      var reply = response.data?['reply'] as String? ?? '';
      
      // If the LLM returned a JSON string that got doubly wrapped, parse it.
      if (reply.trim().startsWith('{') && reply.contains('"reply"')) {
        try {
          final parsed = jsonDecode(reply);
          if (parsed['reply'] != null) {
            reply = parsed['reply'] as String;
          }
        } catch (_) {}
      }

      final isConfirmation = _detectsConfirmation(reply);

      final messages =
          state.messages.where((m) => m.id != 'loading').toList();

      final ninaMsg = ChatMessage(
        id: DateTime.now().microsecondsSinceEpoch.toString(),
        text: reply,
        isUser: false,
        isConfirmation: isConfirmation,
      );

      emit(ChatReady(messages: [...messages, ninaMsg]));
    } on Exception catch (e) {
      final messages =
          state.messages.where((m) => m.id != 'loading').toList();
      final errMsg = ChatMessage(
        id: DateTime.now().microsecondsSinceEpoch.toString(),
        text: _friendlyError(e),
        isUser: false,
      );
      emit(ChatError(messages: [...messages, errMsg], error: errMsg.text));
    }
  }

  Future<void> _onConfirmAccepted(
    ChatConfirmationAccepted event,
    Emitter<ChatState> emit,
  ) async {
    final resolved = state.messages
        .map((m) => m.isConfirmation ? m.copyWith(isConfirmation: false) : m)
        .toList();
    emit(ChatSending(messages: resolved));
    add(const ChatMessageSent(message: 'confirmar'));
  }

  Future<void> _onConfirmRejected(
    ChatConfirmationRejected event,
    Emitter<ChatState> emit,
  ) async {
    final resolved = state.messages
        .map((m) => m.isConfirmation ? m.copyWith(isConfirmation: false) : m)
        .toList();
    emit(ChatSending(messages: resolved));
    add(const ChatMessageSent(message: 'cancelar'));
  }

  /// Heuristic: reply contains pending expenses to confirm
  bool _detectsConfirmation(String reply) {
    return reply.contains('¿Confirmas?') ||
        reply.contains('confirmas') ||
        reply.contains('registrar');
  }

  String _friendlyError(Exception e) {
    final msg = e.toString().toLowerCase();
    if (msg.contains('connection') || msg.contains('timeout')) {
      return 'No puedo conectarme ahora mismo 📡 Revisa tu internet';
    }
    if (msg.contains('401')) {
      return 'Sesión expirada. Ingresa de nuevo 🔒';
    }
    return 'Algo salió mal en mi lado 🔍 Inténtalo de nuevo';
  }
}

/// Internal greet event — not exposed publicly
class _ChatGreet extends ChatEvent {
  const _ChatGreet();
}
