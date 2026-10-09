import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:intl/intl.dart';
import '../bloc/chat_bloc.dart';
import '../bloc/chat_event.dart';
import '../bloc/chat_state.dart';
import '../widgets/message_bubble.dart';
import '../widgets/input_bar.dart';
import '../../../shared/widgets/loading_dots.dart';
import '../../../core/theme/design_system.dart';
import '../../../data/services/intelligence_api_service.dart';
import '../../../domain/models/nina_snapshot.dart';

class ChatPage extends StatefulWidget {
  const ChatPage({super.key});

  @override
  State<ChatPage> createState() => _ChatPageState();
}

class _ChatPageState extends State<ChatPage> {
  final _scrollCtrl = ScrollController();
  NinaSnapshot? _snapshot;

  @override
  void initState() {
    super.initState();
    _loadSnapshot();
  }

  Future<void> _loadSnapshot() async {
    final snap = await IntelligenceApiService.instance.fetchSnapshot();
    if (mounted) setState(() => _snapshot = snap);
  }

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

  List<String> _dynamicChips() {
    final snap = _snapshot;
    final chips = <String>[];

    if (snap != null) {
      if (snap.anomalias.isNotEmpty) {
        chips.add('¿Por qué me alertaste en ${snap.anomalias.first.categoria}?');
      }

      final metasBajas = snap.metasProgreso.where((m) => m.pct < 50).toList()
        ..sort((a, b) => a.pct.compareTo(b.pct));
      if (metasBajas.isNotEmpty) {
        chips.add('¿Cómo voy con mi meta de ${metasBajas.first.nombre}?');
      }

      if (snap.gastosHormiga.count >= 3) {
        chips.add('¿Cuánto gasté en hormiga esta semana?');
      }
    }

    if (chips.isEmpty) {
      return [
        '¿Puedo gastar S/200 este finde?',
        '¿En qué gasto más?',
      ];
    }
    return chips.take(2).toList();
  }

  Color _scorePillColor(String status) {
    switch (status) {
      case 'green':
        return const Color(0xFFADFF2F).withAlpha(51);
      case 'orange':
        return const Color(0xFFFFB347).withAlpha(51);
      default:
        return const Color(0xFFFF6B6B).withAlpha(51);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: NinaColors.background,
      body: SafeArea(
        child: Column(
          children: [
            _buildHeader(context),
            Expanded(
              child: BlocConsumer<ChatBloc, ChatState>(
                listener: (context, state) => _scrollToBottom(),
                builder: (context, state) {
                  if (state.messages.isEmpty) {
                    return Center(
                      child: Text(
                        'Cuéntame algo... como ese café que compraste 👀',
                        style: Theme.of(context).textTheme.bodyMedium,
                        textAlign: TextAlign.center,
                      ),
                    );
                  }
                  return ListView.builder(
                    controller: _scrollCtrl,
                    padding: const EdgeInsets.symmetric(vertical: 24),
                    itemCount: state.messages.length,
                    itemBuilder: (context, index) {
                      final msg = state.messages[index];
                      if (msg.isPending) {
                        return const LoadingDots();
                      }
                      return MessageBubble(message: msg);
                    },
                  );
                },
              ),
            ),
            _buildChipsRow(context),
            _InputBarWrapper(snapshot: _snapshot),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: const BoxDecoration(shape: BoxShape.circle, color: NinaColors.accent),
            child: const Icon(Icons.auto_awesome_rounded, size: 18, color: NinaColors.background),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  "Nina",
                  style: TextStyle(
                    fontSize: 14,
                    color: NinaColors.textPrimary,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const Text(
                  "En línea · contexto cargado",
                  style: TextStyle(fontSize: 10, color: NinaColors.accent),
                ),
              ],
            ),
          ),
          const Icon(Icons.more_horiz_rounded, size: 18, color: NinaColors.textTertiary),
        ],
      ),
    );
  }

  Widget _buildChipsRow(BuildContext context) {
    final chips = _dynamicChips();
    return SizedBox(
      height: 40,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: chips.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (context, i) {
          return GestureDetector(
            onTap: () {
              context.read<ChatBloc>().add(ChatMessageSent(
                    message: chips[i],
                    snapshotContext: _snapshot?.toJson(),
                  ));
            },
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: NinaColors.surface,
                border: Border.all(color: const Color(0xFF3D2F70), width: 0.5),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Text(
                chips[i],
                style: const TextStyle(
                  fontSize: 11,
                  color: NinaColors.textSecondary,
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

class _InputBarWrapper extends StatelessWidget {
  final NinaSnapshot? snapshot;
  const _InputBarWrapper({this.snapshot});

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<ChatBloc, ChatState>(
      builder: (context, state) {
        final isSending = state is ChatSending;
        return InputBar(
          enabled: !isSending,
          onSend: (text) {
            context.read<ChatBloc>().add(ChatMessageSent(
                  message: text,
                  snapshotContext: snapshot?.toJson(),
                ));
          },
        );
      },
    );
  }
}
