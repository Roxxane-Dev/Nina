import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../../core/theme/design_system.dart';

class InputBar extends StatefulWidget {
  const InputBar({
    super.key,
    required this.onSend,
    this.enabled = true,
    this.initialText,
  });

  final void Function(String) onSend;
  final bool enabled;
  final String? initialText;

  @override
  State<InputBar> createState() => _InputBarState();
}

class _InputBarState extends State<InputBar> {
  late final _ctrl = TextEditingController(text: widget.initialText ?? '');
  final _focusNode = FocusNode();

  @override
  void initState() {
    super.initState();
    _ctrl.addListener(() => setState(() {}));
    if ((widget.initialText ?? '').isNotEmpty) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _focusNode.requestFocus();
      });
    }
  }

  @override
  void dispose() {
    _ctrl.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  void _send() {
    if (!widget.enabled) return;
    final text = _ctrl.text.trim();
    if (text.isEmpty) return;
    _ctrl.clear();
    widget.onSend(text);
    _focusNode.requestFocus();
  }

  KeyEventResult _handleKey(FocusNode node, KeyEvent event) {
    if (event is! KeyDownEvent) return KeyEventResult.ignored;
    if (event.logicalKey == LogicalKeyboardKey.enter &&
        !HardwareKeyboard.instance.isShiftPressed) {
      _send();
      return KeyEventResult.handled;
    }
    return KeyEventResult.ignored;
  }

  @override
  Widget build(BuildContext context) {
    final canSend = widget.enabled && _ctrl.text.trim().isNotEmpty;
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 8),
      child: Container(
        padding: const EdgeInsets.fromLTRB(18, 6, 6, 6),
        decoration: BoxDecoration(
          color: NinaColors.surface,
          border: Border.all(color: NinaColors.border),
          borderRadius: BorderRadius.circular(NinaRadii.pill),
          boxShadow: NinaShadows.card,
        ),
        child: Row(children: [
          Expanded(
            child: Focus(
              onKeyEvent: _handleKey,
              child: TextField(
                key: const Key('chat-input'),
                controller: _ctrl,
                focusNode: _focusNode,
                enabled: widget.enabled,
                maxLines: 1,
                textCapitalization: TextCapitalization.sentences,
                textInputAction: TextInputAction.send,
                style: NinaText.bodyM(color: NinaColors.textPrimary),
                decoration: InputDecoration.collapsed(
                  hintText: 'Pregúntale lo que sea…',
                  hintStyle: NinaText.bodyM(color: NinaColors.textTertiary),
                ),
                onSubmitted: (_) => _send(),
              ),
            ),
          ),
          const SizedBox(width: 8),
          Material(
            color: canSend ? NinaColors.cocoa : NinaColors.surfaceAlt,
            shape: const CircleBorder(),
            child: InkWell(
              key: const Key('chat-send'),
              customBorder: const CircleBorder(),
              onTap: canSend ? _send : null,
              child: SizedBox(
                width: 40,
                height: 40,
                child: Icon(Icons.arrow_upward_rounded,
                    size: 20,
                    color: canSend
                        ? NinaColors.textInverse
                        : NinaColors.textTertiary),
              ),
            ),
          ),
        ]),
      ),
    );
  }
}
