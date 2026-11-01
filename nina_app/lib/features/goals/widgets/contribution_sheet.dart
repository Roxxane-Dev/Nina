import 'package:flutter/material.dart';
import '../../../core/theme/design_system.dart';
import '../../../core/utils/money.dart';
import '../../../data/services/finance_api_service.dart';
import '../../../data/services/goals_api_service.dart';
import '../../../shared/widgets/nina_ui.dart';

/// HOME-02: "Registrar avance". Resolves to the goal with its progress
/// recomputed by the backend, or null when nothing was saved.
Future<Goal?> showContributionSheet(BuildContext context,
    {required Goal goal, required GoalsApiService api}) {
  return showModalBottomSheet<Goal>(
    useRootNavigator: true,
    context: context,
    isScrollControlled: true,
    builder: (_) => ContributionSheet(goal: goal, api: api),
  );
}

class ContributionSheet extends StatefulWidget {
  const ContributionSheet({super.key, required this.goal, required this.api});
  final Goal goal;
  final GoalsApiService api;

  @override
  State<ContributionSheet> createState() => _ContributionSheetState();
}

class _ContributionSheetState extends State<ContributionSheet> {
  final _amount = TextEditingController();
  String? _error;
  bool _saving = false;

  @override
  void dispose() {
    _amount.dispose();
    super.dispose();
  }

  /// Amount as typed: positive, at most two decimals. Validated again by the API.
  double? _parsed() {
    final raw = _amount.text.trim().replaceAll(',', '.');
    final v = double.tryParse(raw);
    if (v == null || v <= 0 || !RegExp(r'^\d+(\.\d{1,2})?$').hasMatch(raw)) {
      return null;
    }
    return v;
  }

  Future<void> _save() async {
    final v = _parsed();
    if (v == null) {
      setState(() => _error = 'Escribe un monto mayor a cero.');
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final updated = await widget.api.contribute(widget.goal.id, v);
      if (mounted) Navigator.of(context).pop(updated);
    } catch (e) {
      if (mounted) {
        setState(() {
          _saving = false;
          _error = financeErrorMessage(e);
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final g = widget.goal;
    return Padding(
      padding:
          EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(24, 8, 24, 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Registrar avance', style: NinaText.displayM()),
              const SizedBox(height: 6),
              Text(
                  '${g.name} · llevas ${formatSoles(g.currentAmount)} de ${formatSoles(g.targetAmount)}',
                  style: NinaText.bodyM()),
              const SizedBox(height: 18),
              NinaField(
                label: '¿Cuánto apartaste?',
                controller: _amount,
                fieldKey: const Key('contribution-amount'),
                prefixText: 'S/ ',
                hint: '200',
                autofocus: true,
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                textInputAction: TextInputAction.done,
                errorText: _error,
                onSubmitted: (_) => _save(),
              ),
              const SizedBox(height: 12),
              const NinaNote(
                icon: Icons.info_outline,
                text:
                    'Lo apartado no cuenta como gasto, pero sale de tu disponible del mes. Nina no mueve tu plata: solo lo anota.',
              ),
              const SizedBox(height: 18),
              NinaButton(
                key: const Key('contribution-save'),
                label: _saving ? 'Guardando…' : 'Guardar avance',
                onPressed: _saving ? null : _save,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
