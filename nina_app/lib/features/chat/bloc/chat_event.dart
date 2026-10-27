// Chat BLoC — events
import 'package:equatable/equatable.dart';

abstract class ChatEvent extends Equatable {
  const ChatEvent();

  @override
  List<Object?> get props => [];
}

class ChatMessageSent extends ChatEvent {
  const ChatMessageSent({required this.message, this.displayText});
  final String message;

  /// What the user's bubble shows when it differs from what is sent
  /// ("Sí, dale" is sent as "confirmar").
  final String? displayText;

  @override
  List<Object?> get props => [message, displayText];
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
