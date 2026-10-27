// Chat BLoC — events
import 'package:equatable/equatable.dart';

abstract class ChatEvent extends Equatable {
  const ChatEvent();

  @override
  List<Object?> get props => [];
}

class ChatMessageSent extends ChatEvent {
  const ChatMessageSent({required this.message});
  final String message;

  @override
  List<Object?> get props => [message];
}

/// Sends again a message whose request failed, keeping the conversation.
class ChatRetryRequested extends ChatEvent {
  const ChatRetryRequested({required this.errorMessageId});
  final String errorMessageId;

  @override
  List<Object?> get props => [errorMessageId];
}

class ChatConfirmationAccepted extends ChatEvent {
  const ChatConfirmationAccepted();
}

class ChatConfirmationRejected extends ChatEvent {
  const ChatConfirmationRejected();
}
