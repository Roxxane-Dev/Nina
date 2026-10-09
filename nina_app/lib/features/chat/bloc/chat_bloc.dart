// Chat BLoC
import 'package:dio/dio.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../core/network/dio_client.dart';
import 'chat_event.dart';
import 'chat_state.dart';
import 'chat_message.dart';

class ChatBloc extends Bloc<ChatEvent, ChatState> {
  ChatBloc({Dio? dio})
      : _dio = dio ?? DioClient.instance.dio,
        super(const ChatInitial()) {
    on<ChatMessageSent>(_onMessageSent);
    on<ChatConfirmationAccepted>(_onConfirmAccepted);
    on<ChatConfirmationRejected>(_onConfirmRejected);
    on<_ChatGreet>(_onGreet);

    // Greet the user on first load
    add(const _ChatGreet());
  }

  final Dio _dio;

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
        data: {'message': event.message},
      );

      final data = response.data ?? const {};
      final reply = data['reply'] as String? ?? '';
      // The backend says explicitly when it is waiting for a Sí / No.
      final isConfirmation = data['needsConfirmation'] == true;

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

  String _friendlyError(Exception e) {
    if (e is DioException) {
      final status = e.response?.statusCode;
      if (status == 401) return 'Tu sesión expiró. Ingresa de nuevo.';
      if (status != null && status >= 500) {
        return 'Tuve un problema procesando tu mensaje. Inténtalo de nuevo.';
      }
      switch (e.type) {
        case DioExceptionType.connectionError:
        case DioExceptionType.connectionTimeout:
        case DioExceptionType.receiveTimeout:
        case DioExceptionType.sendTimeout:
          return 'No puedo conectarme con Nina ahora. Revisa tu conexión o que el servidor esté encendido.';
        default:
          break;
      }
    }
    return 'Algo salió mal en mi lado. Inténtalo de nuevo.';
  }
}

/// Internal greet event — not exposed publicly
class _ChatGreet extends ChatEvent {
  const _ChatGreet();
}
