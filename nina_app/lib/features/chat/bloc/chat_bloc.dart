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
    on<ChatRetryRequested>(_onRetry);
    on<ChatConfirmationAccepted>(_onConfirmAccepted);
    on<ChatConfirmationRejected>(_onConfirmRejected);
    on<_ChatGreet>(_onGreet);

    // Greet the user on first load
    add(const _ChatGreet());
  }

  final Dio _dio;

  /// Signed pending registration from the last reply; sent back with "sí"/"no".
  String? _pendingToken;

  /// Signed conversation context from the last reply (what Nina asked for,
  /// the last question). Opaque to the app; sent back with the next message.
  String? _context;

  /// Starters a beginner can tap without knowing what to ask.
  static const defaultFollowUps = [
    '¿Cuánto me queda este mes?',
    '¿A dónde se fue mi plata?',
    '¿Me alcanza para algo?',
    'Quiero ahorrar para algo',
  ];

  void _onGreet(_ChatGreet event, Emitter<ChatState> emit) {
    final greeting = ChatMessage(
      id: DateTime.now().microsecondsSinceEpoch.toString(),
      text: 'Hey 👋 Soy Nina. Pregúntame lo que quieras de tu plata: cuánto '
          'te queda, a dónde se fue o si te alcanza para algo. También puedes '
          'contarme un gasto, como «gasté 25 en taxi».',
      isUser: false,
      followUps: defaultFollowUps,
    );
    emit(ChatReady(messages: [greeting]));
  }

  Future<void> _onMessageSent(
    ChatMessageSent event,
    Emitter<ChatState> emit,
  ) async {
    final userMsg = ChatMessage(
      id: DateTime.now().microsecondsSinceEpoch.toString(),
      text: event.message,
      isUser: true,
    );
    await _send(event.message, [...state.messages, userMsg], emit);
  }

  /// Retry: drop the error bubble and send the same text again. The user's
  /// message stays where it was; nothing else in the conversation changes.
  Future<void> _onRetry(
    ChatRetryRequested event,
    Emitter<ChatState> emit,
  ) async {
    final failed =
        state.messages.where((m) => m.id == event.errorMessageId).firstOrNull;
    final text = failed?.retryText;
    if (text == null) return;
    final messages =
        state.messages.where((m) => m.id != event.errorMessageId).toList();
    await _send(text, messages, emit);
  }

  Future<void> _send(
    String text,
    List<ChatMessage> base,
    Emitter<ChatState> emit,
  ) async {
    const loadingMsg = ChatMessage(
      id: 'loading',
      text: '',
      isUser: false,
      isPending: true,
    );
    emit(ChatSending(messages: [...base, loadingMsg]));

    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '/chat',
        data: {
          'message': text,
          if (_pendingToken != null) 'pendingToken': _pendingToken,
          if (_context != null) 'context': _context,
        },
      );

      final data = response.data ?? const {};
      final reply = data['reply'] as String? ?? '';
      // The backend says explicitly when it is waiting for a Sí / No.
      final isConfirmation = data['needsConfirmation'] == true;
      _pendingToken = isConfirmation ? data['pendingToken'] as String? : null;
      _context = data['context'] as String? ?? _context;
      final followUps =
          (data['followUps'] as List? ?? const []).whereType<String>().toList();

      final ninaMsg = ChatMessage(
        id: DateTime.now().microsecondsSinceEpoch.toString(),
        text: reply,
        isUser: false,
        isConfirmation: isConfirmation,
        card: ChatCard.fromJson(data['card']),
        followUps: followUps,
      );

      emit(ChatReady(messages: [...base, ninaMsg]));
    } on Exception catch (e) {
      final errMsg = ChatMessage(
        id: DateTime.now().microsecondsSinceEpoch.toString(),
        text: _friendlyError(e),
        isUser: false,
        // A 401 is not fixed by retrying; everything else can be.
        retryText: _isRetryable(e) ? text : null,
      );
      emit(ChatError(messages: [...base, errMsg], error: errMsg.text));
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

  bool _isRetryable(Exception e) =>
      !(e is DioException && e.response?.statusCode == 401) &&
      !(e is DioException && e.response?.statusCode == 400);

  String _friendlyError(Exception e) {
    if (e is DioException) {
      final status = e.response?.statusCode;
      if (status == 401) return 'Tu sesión expiró. Ingresa de nuevo.';
      final body = e.response?.data;
      final serverMessage = body is Map ? body['message'] as String? : null;
      if (status == 503) {
        // Infrastructure (database) unavailable — the backend says what happened.
        return serverMessage ??
            'No pude consultar tus movimientos ahora. Inténtalo en unos minutos.';
      }
      if (status != null && status >= 500) {
        final requestId = body is Map ? body['requestId'] as String? : null;
        final ref = requestId != null && requestId.length >= 8
            ? ' (código ${requestId.substring(0, 8)})'
            : '';
        return 'Se me cruzaron los cables procesando tu mensaje. Inténtalo otra vez.$ref';
      }
      switch (e.type) {
        case DioExceptionType.connectionError:
        case DioExceptionType.connectionTimeout:
        case DioExceptionType.receiveTimeout:
        case DioExceptionType.sendTimeout:
          return 'No puedo conectarme ahora. Revisa tu conexión y vuelve a intentarlo.';
        default:
          break;
      }
    }
    return 'Algo salió mal en mi lado. Inténtalo otra vez.';
  }
}

/// Internal greet event — not exposed publicly
class _ChatGreet extends ChatEvent {
  const _ChatGreet();
}
