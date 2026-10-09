// Chat BLoC — events
import 'package:equatable/equatable.dart';

abstract class ChatEvent extends Equatable {
  const ChatEvent();

  @override
  List<Object?> get props => [];
}

class ChatMessageSent extends ChatEvent {
  const ChatMessageSent({required this.message, this.snapshotContext});
  final String message;
  final Map<String, dynamic>? snapshotContext;

  @override
  List<Object?> get props => [message, snapshotContext];
}

class ChatConfirmationAccepted extends ChatEvent {
  const ChatConfirmationAccepted();
}

class ChatConfirmationRejected extends ChatEvent {
  const ChatConfirmationRejected();
}
