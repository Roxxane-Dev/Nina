import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../bloc/chat_bloc.dart';
import '../bloc/chat_event.dart';
import '../bloc/chat_message.dart';
import '../../../core/theme/design_system.dart';
import '../../../shared/widgets/nina_ui.dart';
import 'answer_card.dart';

class MessageBubble extends StatelessWidget {
  const MessageBubble({super.key, required this.message});

  final ChatMessage message;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
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
                if (message.card != null) AnswerCardView(card: message.card!),
                if (message.isConfirmation)
                  const Padding(
                    padding: EdgeInsets.only(top: 8),
                    child: _ConfirmationButtons(),
                  ),
                if (message.canRetry)
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: NinaSmallAction(
                      key: const Key('chat-retry'),
                      label: 'Reintentar',
                      icon: Icons.refresh_rounded,
                      onTap: () => context
                          .read<ChatBloc>()
                          .add(ChatRetryRequested(errorMessageId: message.id)),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    )
        .animate()
        .fade(duration: 300.ms)
        .slideY(begin: 0.1, end: 0, curve: Curves.easeOut);
  }

  Widget _buildBubble(BuildContext context) {
    if (!message.isUser) {
      return Container(
        constraints: const BoxConstraints(maxWidth: 340),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: NinaColors.surface,
          border: Border.all(color: NinaColors.border),
          boxShadow: NinaShadows.card,
          borderRadius: const BorderRadius.only(
            topLeft: Radius.circular(NinaRadii.bubble),
            topRight: Radius.circular(NinaRadii.bubble),
            bottomLeft: Radius.circular(6),
            bottomRight: Radius.circular(NinaRadii.bubble),
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(mainAxisSize: MainAxisSize.min, children: [
              const NinaMark(size: 20),
              const SizedBox(width: 8),
              Text('Nina', style: NinaText.bodySStrong()),
            ]),
            const SizedBox(height: 8),
            Text(message.text,
                style: NinaText.bodyL(color: NinaColors.textPrimary)),
          ],
        ),
      );
    }

    return Container(
      constraints: const BoxConstraints(maxWidth: 300),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: const BoxDecoration(
        color: NinaColors.userBubble,
        borderRadius: BorderRadius.only(
          topLeft: Radius.circular(NinaRadii.bubble),
          topRight: Radius.circular(NinaRadii.bubble),
          bottomLeft: Radius.circular(NinaRadii.bubble),
          bottomRight: Radius.circular(6),
        ),
      ),
      child: Text(message.text,
          style: NinaText.bodyM(color: NinaColors.textInverse)),
    );
  }
}

class _ConfirmationButtons extends StatelessWidget {
  const _ConfirmationButtons();

  @override
  Widget build(BuildContext context) {
    return Wrap(spacing: 8, runSpacing: 8, children: [
      NinaSmallAction(
        key: const Key('chat-confirm'),
        label: 'Sí, dale',
        icon: Icons.check_rounded,
        filled: true,
        onTap: () =>
            context.read<ChatBloc>().add(const ChatConfirmationAccepted()),
      ),
      NinaSmallAction(
        key: const Key('chat-reject'),
        label: 'No, gracias',
        onTap: () =>
            context.read<ChatBloc>().add(const ChatConfirmationRejected()),
      ),
    ]);
  }
}
