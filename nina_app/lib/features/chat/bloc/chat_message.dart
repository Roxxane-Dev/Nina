// Chat BLoC — model
import 'package:equatable/equatable.dart';

/// Result card built by the backend from engine figures (never from LLM text).
class ChatCard extends Equatable {
  const ChatCard({
    required this.title,
    required this.subtitle,
    required this.rows,
    required this.howCalculated,
    required this.confidence,
    this.highlight,
  });

  final String title;
  final String subtitle;
  final ChatCardRow? highlight;
  final List<ChatCardRow> rows;
  final String howCalculated;
  final String confidence;

  static ChatCard? fromJson(Object? json) {
    if (json is! Map) return null;
    final rows = (json['rows'] as List? ?? const [])
        .whereType<Map>()
        .map(ChatCardRow.fromJson)
        .toList();
    return ChatCard(
      title: json['title'] as String? ?? '',
      subtitle: json['subtitle'] as String? ?? '',
      highlight: json['highlight'] is Map
          ? ChatCardRow.fromJson(json['highlight'] as Map)
          : null,
      rows: rows,
      howCalculated: json['howCalculated'] as String? ?? '',
      confidence: json['confidence'] as String? ?? 'high',
    );
  }

  @override
  List<Object?> get props =>
      [title, subtitle, highlight, rows, howCalculated, confidence];
}

class ChatCardRow extends Equatable {
  const ChatCardRow({required this.label, required this.amount, this.tone});

  final String label;
  final double amount;

  /// 'positive' | 'negative' | 'neutral' | null
  final String? tone;

  factory ChatCardRow.fromJson(Map json) => ChatCardRow(
        label: json['label'] as String? ?? '',
        amount: (json['amount'] as num?)?.toDouble() ?? 0,
        tone: json['tone'] as String?,
      );

  @override
  List<Object?> get props => [label, amount, tone];
}

class ChatMessage extends Equatable {
  const ChatMessage({
    required this.id,
    required this.text,
    required this.isUser,
    this.isConfirmation = false,
    this.isPending = false,
    this.card,
    this.followUps = const [],
  });

  final String id;
  final String text;
  final bool isUser;
  final bool isConfirmation; // Nina asks to confirm a registration
  final bool isPending; // loading placeholder
  final ChatCard? card;
  final List<String> followUps;

  @override
  List<Object?> get props =>
      [id, text, isUser, isConfirmation, isPending, card, followUps];

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
      card: card,
      followUps: followUps,
    );
  }
}
