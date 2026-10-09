// Chat BLoC — states
import 'package:equatable/equatable.dart';
import 'chat_message.dart';

abstract class ChatState extends Equatable {
  const ChatState({required this.messages});
  final List<ChatMessage> messages;

  @override
  List<Object?> get props => [messages];
}

class ChatInitial extends ChatState {
  const ChatInitial() : super(messages: const []);
}

class ChatReady extends ChatState {
  const ChatReady({required super.messages});
}

class ChatSending extends ChatState {
  const ChatSending({required super.messages});
}

class ChatError extends ChatState {
  const ChatError({required super.messages, required this.error});
  final String error;

  @override
  List<Object?> get props => [messages, error];
}
