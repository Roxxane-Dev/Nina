import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../bloc/chat_bloc.dart';
import '../bloc/chat_event.dart';
import '../bloc/chat_state.dart';
import '../widgets/message_bubble.dart';
import '../widgets/input_bar.dart';
import '../../../shared/widgets/loading_dots.dart';
import '../../../shared/widgets/nina_ui.dart';
import '../../../core/theme/design_system.dart';

/// 3.2 Pregúntale a Nina. Figures in answers come from the engine (cards);
/// calm mode is decided by the backend, never here.
class ChatPage extends StatefulWidget {
  const ChatPage({super.key, this.draft});

  /// Pre-filled question (e.g. from Metas); the user still sends it.
  final String? draft;

  @override
  State<ChatPage> createState() => _ChatPageState();
}

class _ChatPageState extends State<ChatPage> {
  final _scrollCtrl = ScrollController();

  @override
  void dispose() {
    _scrollCtrl.dispose();
    super.dispose();
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollCtrl.hasClients) {
        _scrollCtrl.animateTo(
          _scrollCtrl.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  /// Suggestions from Nina's latest answer (built by the backend from the
  /// engine intent); hidden while Nina waits for a Sí / No.
  List<String> _dynamicChips(ChatState state) {
    for (final m in state.messages.reversed) {
      if (m.isUser || m.isPending) continue;
      if (m.isConfirmation) return const [];
      if (m.followUps.isNotEmpty) return m.followUps;
      break;
    }
    return ChatBloc.defaultFollowUps;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            _buildHeader(),
            Expanded(
              child: BlocConsumer<ChatBloc, ChatState>(
                listener: (context, state) => _scrollToBottom(),
                builder: (context, state) {
                  if (state.messages.isEmpty) return const _EmptyChat();
                  return ListView.builder(
                    controller: _scrollCtrl,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    itemCount: state.messages.length,
                    itemBuilder: (context, index) {
                      final msg = state.messages[index];
                      if (msg.isPending) return const LoadingDots();
                      return MessageBubble(message: msg);
                    },
                  );
                },
              ),
            ),
            _buildChipsRow(context),
            _InputBarWrapper(draft: widget.draft),
            // Room for the floating tab bar.
            const SizedBox(height: 96),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return Padding(
      padding:
          const EdgeInsets.fromLTRB(NinaSpace.gutter, 12, NinaSpace.gutter, 8),
      child: Row(
        children: [
          const NinaMark(size: 36),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Nina', style: NinaText.titleM()),
                Text('Responde con tus números',
                    style: NinaText.bodyS(color: NinaColors.textTertiary)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildChipsRow(BuildContext context) {
    final chips = _dynamicChips(context.watch<ChatBloc>().state);
    if (chips.isEmpty) return const SizedBox(height: 8);
    return SizedBox(
      height: 44,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: chips.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (context, i) => NinaChip(
          label: chips[i],
          selected: false,
          onTap: () =>
              context.read<ChatBloc>().add(ChatMessageSent(message: chips[i])),
        ),
      ),
    );
  }
}

class _EmptyChat extends StatelessWidget {
  const _EmptyChat();

  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 40),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            const NinaMark(size: 56),
            const SizedBox(height: 16),
            Text('Pregúntame lo que sea',
                style: NinaText.titleL(), textAlign: TextAlign.center),
            const SizedBox(height: 6),
            Text(
              'Cuánto te queda, en qué se va tu plata o cómo llegar a una meta. También puedes contarme un gasto: "gasté 25 en taxi".',
              style: NinaText.bodyM(),
              textAlign: TextAlign.center,
            ),
          ]),
        ),
      );
}

class _InputBarWrapper extends StatelessWidget {
  const _InputBarWrapper({this.draft});
  final String? draft;

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<ChatBloc, ChatState>(
      builder: (context, state) {
        final isSending = state is ChatSending;
        return InputBar(
          enabled: !isSending,
          initialText: draft,
          onSend: (text) {
            context.read<ChatBloc>().add(ChatMessageSent(message: text));
          },
        );
      },
    );
  }
}
