import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import '../../core/theme/design_system.dart';
import '../../core/utils/transaction_display.dart';
import '../../data/services/accounts_api_service.dart';
import '../../data/services/finance_api_service.dart';
import '../../data/services/spaces_api_service.dart';
import 'nina_ui.dart';

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
    {FinanceApiService? api, String? spaceId, String? spaceName}) async {
  final saved = await showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    builder: (_) => AddTransactionSheet(
      api: api ?? FinanceApiService.instance,
      spaceId: spaceId,
      spaceName: spaceName,
    ),
  );
  return saved == true;
}

class AddTransactionSheet extends StatefulWidget {
  const AddTransactionSheet(
      {super.key,
      required this.api,
      this.spaceId,
      this.spaceName,
      this.loadAccounts,
      this.loadSpaces});

  final FinanceApiService api;

  /// When set, the movement goes to this shared space (US-35/36) and the
  /// Personal/space switch is hidden.
  final String? spaceId;
  final String? spaceName;

  /// US-41 account options; injectable for tests. Errors (e.g. accounts not
  /// enabled yet) simply hide the field.
  final Future<List<Account>> Function()? loadAccounts;

  /// Spaces the user belongs to, for "¿Dónde va?". Errors hide the switch.
  final Future<List<SpaceSummary>> Function()? loadSpaces;

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
  List<Account> _accounts = const [];
  String? _accountId;
  List<SpaceSummary> _spaces = const [];
  String? _targetSpaceId; // null = Personal

  @override
  void initState() {
    super.initState();
    final load = widget.loadAccounts ?? AccountsApiService.instance.list;
    load().then((list) {
      if (mounted) {
        setState(() => _accounts = list.where((a) => !a.archived).toList());
      }
    }).catchError((_) {});
    if (widget.spaceId == null) {
      final loadSpaces = widget.loadSpaces ?? SpacesApiService.instance.list;
      loadSpaces().then((list) {
        if (mounted) setState(() => _spaces = list);
      }).catchError((_) {});
    }
  }

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
        spaceId: widget.spaceId ?? _targetSpaceId,
        accountId: _accountId,
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

  String _dateLabel() {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final d = DateTime(_date.year, _date.month, _date.day);
    if (d == today) return 'Hoy';
    if (d == today.subtract(const Duration(days: 1))) return 'Ayer';
    return DateFormat("d 'de' MMMM yyyy", 'es').format(_date);
  }

  @override
  Widget build(BuildContext context) {
    final inset = MediaQuery.of(context).viewInsets.bottom;
    return SafeArea(
      child: SingleChildScrollView(
        padding: EdgeInsets.fromLTRB(24, 0, 24, 20 + inset),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              widget.spaceName == null
                  ? 'Nuevo movimiento'
                  : 'Nuevo movimiento · ${widget.spaceName}',
              style: NinaText.displayM(),
            ),
            const SizedBox(height: 16),
            _TypeSwitch(
              value: _type,
              onChanged: (v) => setState(() {
                _type = v;
                _category = v == 'expense' ? 'food' : 'salary';
              }),
            ),
            const SizedBox(height: 16),
            // Big amount (Figma 3.4).
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
              decoration: BoxDecoration(
                color: NinaColors.surface,
                borderRadius: BorderRadius.circular(NinaRadii.lg),
                border: Border.all(color: NinaColors.border),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.baseline,
                textBaseline: TextBaseline.alphabetic,
                children: [
                  Text('S/ ',
                      style: NinaText.displayM(color: NinaColors.textTertiary)),
                  Expanded(
                    child: TextField(
                      key: const Key('amount'),
                      controller: _amount,
                      autofocus: true,
                      keyboardType:
                          const TextInputType.numberWithOptions(decimal: true),
                      inputFormatters: [
                        FilteringTextInputFormatter.allow(RegExp(r'[0-9.,]'))
                      ],
                      style: NinaText.hero().copyWith(fontSize: 44),
                      decoration: InputDecoration(
                        hintText: '0.00',
                        hintStyle: NinaText.hero(color: NinaColors.borderStrong)
                            .copyWith(fontSize: 44),
                        filled: false,
                        border: InputBorder.none,
                        enabledBorder: InputBorder.none,
                        focusedBorder: InputBorder.none,
                        contentPadding: EdgeInsets.zero,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            NinaField(
              label: 'Descripción (opcional)',
              controller: _note,
              hint: _type == 'expense' ? 'Ej. Tambo, almuerzo' : 'Ej. Sueldo',
              maxLength: 140,
            ),
            const SizedBox(height: 16),
            Text('Categoría',
                style: NinaText.bodySStrong(color: NinaColors.textSecondary)),
            const SizedBox(height: 8),
            Wrap(spacing: 8, runSpacing: 8, children: [
              for (final e in _categories.entries)
                NinaChip(
                  key: Key('category-${e.key}'),
                  label: e.value,
                  icon: categoryIcon(e.key),
                  selected: _category == e.key,
                  onTap: () => setState(() => _category = e.key),
                ),
            ]),
            if (widget.spaceId == null && _spaces.isNotEmpty) ...[
              const SizedBox(height: 16),
              Text('¿Dónde va?',
                  style: NinaText.bodySStrong(color: NinaColors.textSecondary)),
              const SizedBox(height: 8),
              Wrap(spacing: 8, runSpacing: 8, children: [
                NinaChip(
                  key: const Key('target-personal'),
                  label: 'Personal',
                  icon: Icons.lock_outline,
                  selected: _targetSpaceId == null,
                  onTap: () => setState(() => _targetSpaceId = null),
                ),
                for (final s in _spaces)
                  NinaChip(
                    key: Key('target-${s.id}'),
                    label: s.name,
                    icon: Icons.group_outlined,
                    selected: _targetSpaceId == s.id,
                    onTap: () => setState(() => _targetSpaceId = s.id),
                  ),
              ]),
              const SizedBox(height: 6),
              Text(
                _targetSpaceId == null
                    ? 'Solo lo ves tú.'
                    : 'Lo ven los miembros del espacio.',
                style: NinaText.bodyS(color: NinaColors.textTertiary),
              ),
            ],
            const SizedBox(height: 16),
            Material(
              color: NinaColors.surface,
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(NinaRadii.md),
                  side: const BorderSide(color: NinaColors.border)),
              child: ListTile(
                key: const Key('date'),
                onTap: _pickDate,
                leading: const Icon(Icons.calendar_today_outlined,
                    size: 20, color: NinaColors.textSecondary),
                title: Text('Fecha', style: NinaText.bodyS()),
                trailing: Text(_dateLabel(), style: NinaText.bodyMStrong()),
              ),
            ),
            if (_accounts.isNotEmpty) ...[
              const SizedBox(height: 12),
              DropdownButtonFormField<String?>(
                key: const Key('account'),
                initialValue: _accountId,
                decoration:
                    const InputDecoration(labelText: 'Cuenta (opcional)'),
                items: [
                  const DropdownMenuItem<String?>(
                      value: null, child: Text('Sin cuenta')),
                  for (final a in _accounts)
                    DropdownMenuItem<String?>(value: a.id, child: Text(a.name)),
                ],
                onChanged: (v) => setState(() => _accountId = v),
              ),
            ],
            if (_error != null)
              Padding(
                padding: const EdgeInsets.only(top: 12),
                child: Text(_error!,
                    style: NinaText.bodyS(color: NinaColors.error)),
              ),
            const SizedBox(height: 20),
            NinaButton(
              key: const Key('save'),
              label: 'Guardar',
              loading: _saving,
              onPressed: _save,
            ),
          ],
        ),
      ),
    );
  }
}

class _TypeSwitch extends StatelessWidget {
  const _TypeSwitch({required this.value, required this.onChanged});
  final String value;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(4),
        decoration: BoxDecoration(
            color: NinaColors.surfaceAlt,
            borderRadius: BorderRadius.circular(NinaRadii.pill)),
        child: Row(children: [
          for (final (v, label) in const [
            ('expense', 'Gasto'),
            ('income', 'Ingreso')
          ])
            Expanded(
              child: GestureDetector(
                key: Key('type-$v'),
                onTap: () => onChanged(v),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 160),
                  padding: const EdgeInsets.symmetric(vertical: 10),
                  decoration: BoxDecoration(
                    color: value == v ? NinaColors.surface : null,
                    borderRadius: BorderRadius.circular(NinaRadii.pill),
                    boxShadow: value == v ? NinaShadows.card : null,
                  ),
                  alignment: Alignment.center,
                  child: Text(label,
                      style: NinaText.bodySStrong(
                          color: value == v
                              ? NinaColors.textPrimary
                              : NinaColors.textSecondary)),
                ),
              ),
            ),
        ]),
      );
}
