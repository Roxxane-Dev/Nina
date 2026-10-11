import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import '../../core/theme/design_system.dart';
import '../../data/services/finance_api_service.dart';

/// Canonical engine categories (packages/finance-engine/src/categories.ts).
const expenseCategories = <String, String>{
  'food': 'Comida',
  'transport': 'Transporte',
  'home': 'Hogar',
  'services': 'Servicios',
  'health': 'Salud',
  'education': 'Educación',
  'entertainment': 'Entretenimiento',
  'shopping': 'Compras',
  'subscriptions': 'Suscripciones',
  'debt': 'Deudas',
  'other': 'Otros',
};

const incomeCategories = <String, String>{
  'salary': 'Sueldo',
  'freelance': 'Ingresos extra',
  'other': 'Otros',
};

/// Opens the manual entry form (US-26). Resolves to true when a movement was saved.
Future<bool> showAddTransactionSheet(BuildContext context,
    {FinanceApiService? api}) async {
  final saved = await showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    backgroundColor: NinaColors.surface,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (_) => AddTransactionSheet(api: api ?? FinanceApiService.instance),
  );
  return saved == true;
}

class AddTransactionSheet extends StatefulWidget {
  const AddTransactionSheet({super.key, required this.api});

  final FinanceApiService api;

  @override
  State<AddTransactionSheet> createState() => _AddTransactionSheetState();
}

class _AddTransactionSheetState extends State<AddTransactionSheet> {
  final _amount = TextEditingController();
  final _note = TextEditingController();
  String _type = 'expense';
  String _category = 'food';
  DateTime _date = DateTime.now();
  bool _saving = false;
  String? _error;

  Map<String, String> get _categories =>
      _type == 'expense' ? expenseCategories : incomeCategories;

  @override
  void dispose() {
    _amount.dispose();
    _note.dispose();
    super.dispose();
  }

  double? _parsedAmount() {
    final raw = _amount.text.trim().replaceAll(',', '.');
    final v = double.tryParse(raw);
    return v != null && v > 0 ? v : null;
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
    final amount = _parsedAmount();
    if (amount == null) {
      setState(() => _error = 'Ingresa un monto mayor a 0');
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await widget.api.createTransaction(
        type: _type,
        amount: amount,
        category: _category,
        date: DateFormat('yyyy-MM-dd').format(_date),
        note: _note.text,
      );
      if (mounted) Navigator.of(context).pop(true);
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
    final inset = MediaQuery.of(context).viewInsets.bottom;
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 16, 20, 20 + inset),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text(
            'Nuevo movimiento',
            style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w700,
                color: NinaColors.textPrimary),
          ),
          const SizedBox(height: 16),
          SegmentedButton<String>(
            segments: const [
              ButtonSegment(value: 'expense', label: Text('Gasto')),
              ButtonSegment(value: 'income', label: Text('Ingreso')),
            ],
            selected: {_type},
            onSelectionChanged: (s) => setState(() {
              _type = s.first;
              _category = _type == 'expense' ? 'food' : 'salary';
            }),
          ),
          const SizedBox(height: 12),
          TextField(
            key: const Key('amount'),
            controller: _amount,
            autofocus: true,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            inputFormatters: [
              FilteringTextInputFormatter.allow(RegExp(r'[0-9.,]'))
            ],
            decoration:
                const InputDecoration(labelText: 'Monto', prefixText: 'S/ '),
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            key: ValueKey(_type),
            initialValue: _category,
            decoration: const InputDecoration(labelText: 'Categoría'),
            items: [
              for (final e in _categories.entries)
                DropdownMenuItem(value: e.key, child: Text(e.value)),
            ],
            onChanged: (v) => setState(() => _category = v ?? _category),
          ),
          const SizedBox(height: 12),
          InkWell(
            onTap: _pickDate,
            child: InputDecorator(
              decoration: const InputDecoration(labelText: 'Fecha'),
              child: Text(DateFormat("d 'de' MMMM yyyy", 'es').format(_date)),
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _note,
            maxLength: 140,
            decoration: const InputDecoration(labelText: 'Nota (opcional)'),
          ),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Text(_error!,
                  style: const TextStyle(
                      color: NinaColors.errorLight, fontSize: 12)),
            ),
          FilledButton(
            key: const Key('save'),
            onPressed: _saving ? null : _save,
            child: Text(_saving ? 'Guardando…' : 'Guardar'),
          ),
        ],
      ),
    );
  }
}
