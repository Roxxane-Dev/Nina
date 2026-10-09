// Chat BLoC — model
import 'package:equatable/equatable.dart';

class ChatMessage extends Equatable {
  const ChatMessage({
    required this.id,
    required this.text,
    required this.isUser,
    this.isConfirmation = false,
    this.isPending = false,
  });

  final String id;
  final String text;
  final bool isUser;
  final bool isConfirmation; // Nina reply with pending expenses
  final bool isPending; // loading placeholder

  @override
  List<Object?> get props => [id, text, isUser, isConfirmation, isPending];

  ChatMessage copyWith({
    String? text,
    bool? isConfirmation,
    bool? isPending,
  }) {
    return ChatMessage(
      id: id,
      text: text ?? this.text,
      isUser: isUser,
      isConfirmation: isConfirmation ?? this.isConfirmation,
      isPending: isPending ?? this.isPending,
    );
  }
}
