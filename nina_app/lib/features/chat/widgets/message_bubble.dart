import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../bloc/chat_bloc.dart';
import '../bloc/chat_event.dart';
import '../bloc/chat_message.dart';
import '../../../core/theme/design_system.dart';

class MessageBubble extends StatelessWidget {
  const MessageBubble({super.key, required this.message});

  final ChatMessage message;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Row(
        mainAxisAlignment:
            message.isUser ? MainAxisAlignment.end : MainAxisAlignment.start,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Flexible(
            child: Column(
              crossAxisAlignment: message.isUser
                  ? CrossAxisAlignment.end
                  : CrossAxisAlignment.start,
              children: [
                _buildBubble(context),
                if (message.isConfirmation)
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: _ConfirmationButtons(),
                  ),
              ],
            ),
          ),
        ],
      ),
    ).animate().fade(duration: 300.ms).slideY(begin: 0.1, end: 0, curve: Curves.easeOut);
  }

  Widget _buildBubble(BuildContext context) {
    // Nina's messages: Asymmetric bubble (rounded except top-left)
    if (!message.isUser) {
      return Container(
        margin: const EdgeInsets.symmetric(vertical: 4),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: const Color(0xFF1E1535),
          borderRadius: const BorderRadius.only(
            topLeft: Radius.circular(4),
            topRight: Radius.circular(14),
            bottomLeft: Radius.circular(14),
            bottomRight: Radius.circular(14),
          ),
        ),
        child: Text(
          message.text,
          style: const TextStyle(
            fontSize: 12,
            color: NinaColors.textSecondary,
            height: 1.5,
          ),
        ),
      );
    }

    // User messages: Primary bubble, asymmetric (rounded except top-right)
    return Container(
      margin: const EdgeInsets.symmetric(vertical: 4),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: NinaColors.primary,
        borderRadius: const BorderRadius.only(
          topLeft: Radius.circular(14),
          topRight: Radius.circular(4),
          bottomLeft: Radius.circular(14),
          bottomRight: Radius.circular(14),
        ),
      ),
      child: Text(
        message.text,
        style: const TextStyle(
          fontSize: 12,
          color: Colors.white,
          height: 1.5,
        ),
      ),
    );
  }
}

class _ConfirmationButtons extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: NinaColors.surface,
        borderRadius: BorderRadius.circular(NinaRadii.card),
        border: Border.all(color: NinaColors.divider),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'He detectado estos gastos:',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 12),
          // We will mock the detected expenses here for now, or adapt from state
          Row(
            children: [
              Expanded(
                child: ElevatedButton(
                  onPressed: () => context
                      .read<ChatBloc>()
                      .add(const ChatConfirmationAccepted()),
                  child: const Text('Confirmar'),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: OutlinedButton(
                  onPressed: () => context
                      .read<ChatBloc>()
                      .add(const ChatConfirmationRejected()),
                  child: const Text('Cancelar'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
