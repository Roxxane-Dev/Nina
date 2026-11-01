import 'package:flutter/material.dart';
import '../../../core/theme/design_system.dart';
import '../../../data/services/nudges_api_service.dart';
import '../../../shared/widgets/nina_ui.dart';

/// "Avisos de Nina" (NOTIF-01). `onAction` runs the nudge's action; closing a
/// nudge remembers it until the next period.
Future<void> showNudgesSheet(BuildContext context,
    {required List<Nudge> nudges,
    required NudgesApiService api,
    required ValueChanged<Nudge> onAction,
    required ValueChanged<Nudge> onDismissed}) {
  return showModalBottomSheet<void>(
    useRootNavigator: true,
    context: context,
    isScrollControlled: true,
    builder: (_) => NudgesSheet(
        nudges: nudges, api: api, onAction: onAction, onDismissed: onDismissed),
  );
}

class NudgesSheet extends StatefulWidget {
  const NudgesSheet(
      {super.key,
      required this.nudges,
      required this.api,
      required this.onAction,
      required this.onDismissed});
  final List<Nudge> nudges;
  final NudgesApiService api;
  final ValueChanged<Nudge> onAction;
  final ValueChanged<Nudge> onDismissed;

  @override
  State<NudgesSheet> createState() => _NudgesSheetState();
}

class _NudgesSheetState extends State<NudgesSheet> {
  late final List<Nudge> _items = [...widget.nudges];

  Future<void> _dismiss(Nudge n) async {
    setState(() => _items.remove(n));
    widget.onDismissed(n);
    try {
      await widget.api.dismiss(n.key);
    } catch (_) {
      // It simply comes back next time; closing a nudge never blocks the user.
    }
  }

  String _actionLabel(Nudge n) => switch (n.actionType) {
        'add' => 'Registrarlo',
        'goals' => 'Ver mis metas',
        'transactions' => 'Ver movimientos',
        _ => 'Hablar con Nina',
      };

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: ConstrainedBox(
        constraints:
            BoxConstraints(maxHeight: MediaQuery.of(context).size.height * 0.8),
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(24, 8, 24, 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Avisos de Nina', style: NinaText.displayM()),
              const SizedBox(height: 14),
              if (_items.isEmpty)
                Text('Todo tranquilo por ahora. Si veo algo, te aviso.',
                    key: const Key('nudges-empty'), style: NinaText.bodyM()),
              for (final n in _items)
                Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: NinaCard(
                    key: Key('nudge-${n.key}'),
                    shadow: false,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Expanded(
                                  child: Text(n.title,
                                      style: NinaText.titleL(
                                          color: n.tone == 'positive'
                                              ? NinaColors.success
                                              : NinaColors.textPrimary))),
                              IconButton(
                                key: Key('nudge-close-${n.key}'),
                                tooltip: 'Cerrar',
                                visualDensity: VisualDensity.compact,
                                icon: const Icon(Icons.close,
                                    size: 18, color: NinaColors.textTertiary),
                                onPressed: () => _dismiss(n),
                              ),
                            ]),
                        const SizedBox(height: 4),
                        Text(n.body, style: NinaText.bodyM()),
                        const SizedBox(height: 12),
                        NinaSmallAction(
                          key: Key('nudge-action-${n.key}'),
                          label: _actionLabel(n),
                          onTap: () {
                            Navigator.of(context).pop();
                            widget.onAction(n);
                          },
                        ),
                      ],
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
