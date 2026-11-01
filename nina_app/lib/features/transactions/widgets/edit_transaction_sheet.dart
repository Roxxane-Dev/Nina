import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../core/theme/design_system.dart';
import '../../../core/utils/transaction_display.dart';
import '../../../data/services/finance_api_service.dart';
import '../../../shared/widgets/add_transaction_sheet.dart';
import '../../../shared/widgets/nina_ui.dart';

/// What happened after editing a movement.
class EditResult {
  const EditResult({required this.remembered, required this.note});

  /// The category changed and Nina will reuse it for this description (US-24).
  final bool remembered;
  final String note;
}

/// HOME-03: edits a movement. Resolves to null when nothing was saved.
Future<EditResult?> showEditTransactionSheet(BuildContext context,
    {required Map<String, dynamic> row, required FinanceApiService api}) {
  return showModalBottomSheet<EditResult>(
    useRootNavigator: true,
    context: context,
    isScrollControlled: true,
    builder: (_) => EditTransactionSheet(row: row, api: api),
  );
}

class EditTransactionSheet extends StatefulWidget {
  const EditTransactionSheet({super.key, required this.row, required this.api});
  final Map<String, dynamic> row;
  final FinanceApiService api;

  @override
  State<EditTransactionSheet> createState() => _EditTransactionSheetState();
}

class _EditTransactionSheetState extends State<EditTransactionSheet> {
  late final _amount = TextEditingController(
      text: ((widget.row['amount'] as num?) ?? 0).toStringAsFixed(2));
  late final _note = TextEditingController(
      text: (widget.row['description'] as String?)?.trim() ?? '');
  late DateTime _date =
      storedDay(widget.row['date'] as String?) ?? DateTime.now();
  late String? _category = _initialCategory;
  bool _saving = false;
  String? _error;

  /// A goal contribution keeps its category (D-015).
  bool get _isContribution => widget.row['goal_id'] != null;

  Map<String, String> get _options =>
      widget.row['type'] == 'income' ? incomeCategories : expenseCategories;

  /// The chip that matches the stored category, whatever alias it was saved with.
  String? get _initialCategory {
    final label = categoryLabel(widget.row['category'] as String?);
    for (final e in _options.entries) {
      if (e.value == label) return e.key;
    }
    return null;
  }

  @override
  void dispose() {
    _amount.dispose();
    _note.dispose();
    super.dispose();
  }

  Future<void> _pickDate() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: _date,
      firstDate: DateTime(now.year - 2),
      lastDate: now,
    );
    if (picked != null) setState(() => _date = picked);
  }

  Future<void> _save() async {
    final raw = _amount.text.trim().replaceAll(',', '.');
    final amount = double.tryParse(raw);
    if (amount == null ||
        amount <= 0 ||
        !RegExp(r'^\d+(\.\d{1,2})?$').hasMatch(raw)) {
      setState(() => _error = 'Escribe un monto mayor a cero.');
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    final changedCategory =
        !_isContribution && _category != null && _category != _initialCategory;
    final note = _note.text.trim();
    try {
      final remembered = await widget.api.updateTransaction(
        widget.row['id'].toString(),
        amount: amount,
        date: DateFormat('yyyy-MM-dd').format(_date),
        note: note,
        category: changedCategory ? _category : null,
      );
      if (mounted) {
        Navigator.of(context)
            .pop(EditResult(remembered: remembered, note: note));
      }
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
    return Padding(
      padding:
          EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(24, 8, 24, 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Editar movimiento', style: NinaText.displayM()),
              const SizedBox(height: 18),
              NinaField(
                label: 'Monto',
                controller: _amount,
                fieldKey: const Key('edit-amount'),
                prefixText: 'S/ ',
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                errorText: _error,
              ),
              const SizedBox(height: 14),
              NinaField(
                label: 'Descripción',
                controller: _note,
                fieldKey: const Key('edit-note'),
                maxLength: 140,
                textCapitalization: TextCapitalization.sentences,
              ),
              const SizedBox(height: 6),
              NinaChip(
                key: const Key('edit-date'),
                label: DateFormat("d 'de' MMM yyyy", 'es').format(_date),
                selected: false,
                icon: Icons.calendar_today_outlined,
                onTap: _pickDate,
              ),
              if (_isContribution) ...[
                const SizedBox(height: 14),
                Text('Es un avance de tu meta: no cambia de categoría.',
                    style: NinaText.bodyS()),
              ] else ...[
                const SizedBox(height: 16),
                Text('Categoría', style: NinaText.bodySStrong()),
                const SizedBox(height: 8),
                Wrap(spacing: 8, runSpacing: 8, children: [
                  for (final e in _options.entries)
                    NinaChip(
                      key: Key('edit-category-${e.key}'),
                      label: e.value,
                      selected: _category == e.key,
                      onTap: () => setState(() => _category = e.key),
                    ),
                ]),
              ],
              const SizedBox(height: 20),
              NinaButton(
                key: const Key('edit-save'),
                label: _saving ? 'Guardando…' : 'Guardar cambios',
                onPressed: _saving ? null : _save,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
