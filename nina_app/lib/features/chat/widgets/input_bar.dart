import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../../core/theme/design_system.dart';

class InputBar extends StatefulWidget {
  const InputBar({
    super.key,
    required this.onSend,
    this.enabled = true,
  });

  final void Function(String) onSend;
  final bool enabled;

  @override
  State<InputBar> createState() => _InputBarState();
}

class _InputBarState extends State<InputBar> {
  final _ctrl = TextEditingController();
  final _focusNode = FocusNode();

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
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 20),
      decoration: const BoxDecoration(
        color: NinaColors.background,
      ),
      child: SafeArea(
        top: false,
        child: Container(
          decoration: BoxDecoration(
            color: NinaColors.surface,
            border: Border.all(color: NinaColors.border, width: 0.5),
            borderRadius: BorderRadius.circular(24),
          ),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          child: Focus(
            onKeyEvent: _handleKey,
            child: TextField(
              controller: _ctrl,
              focusNode: _focusNode,
              enabled: widget.enabled,
              maxLines: 1,
              textCapitalization: TextCapitalization.sentences,
              textInputAction: TextInputAction.send,
              style:
                  const TextStyle(fontSize: 13, color: NinaColors.textPrimary),
              decoration: const InputDecoration.collapsed(
                hintText: 'Cuéntale a Nina...',
                hintStyle:
                    TextStyle(fontSize: 13, color: NinaColors.textTertiary),
              ),
              onSubmitted: (_) => _send(),
            ),
          ),
        ),
      ),
    );
  }
}
