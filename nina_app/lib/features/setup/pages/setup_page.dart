import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../../core/constants/app_constants.dart';
import '../../../core/theme/design_system.dart';
import '../../../core/utils/money.dart';
import '../../../data/services/finance_api_service.dart';
import '../../../data/services/profile_api_service.dart';
import '../../../data/services/spaces_api_service.dart';
import '../../../domain/models/overview.dart';
import '../../../shared/widgets/nina_ui.dart';
import '../../home/widgets/audit_sheet.dart';

/// 2.0–2.6 "Primeros pasos": name, what the user wants, income, fixed
/// expenses, shared space, then the first number from the engine.
/// Income and fixed expenses are saved as real transactions of this month.
class SetupPage extends StatefulWidget {
  const SetupPage(
      {super.key, this.finance, this.profile, this.spaces, this.today});

  /// Injectable for tests.
  final FinanceApiService? finance;
  final ProfileApiService? profile;
  final SpacesApiService? spaces;
  final DateTime Function()? today;

  @override
  State<SetupPage> createState() => _SetupPageState();
}

enum _Goal { spend, monthEnd, save, shared }

enum _Share { couple, family, none }

class _FixedItem {
  _FixedItem(this.label, this.category, this.icon)
      : amount = TextEditingController();
  final String label;
  final String category;
  final IconData icon;
  final TextEditingController amount;
}

class _SetupPageState extends State<SetupPage> {
  late final FinanceApiService _finance =
      widget.finance ?? FinanceApiService.instance;
  late final ProfileApiService _profile =
      widget.profile ?? ProfileApiService.instance;
  late final SpacesApiService _spaces =
      widget.spaces ?? SpacesApiService.instance;

  static const _total = 5;
  int _step = 0;
  bool _busy = false;
  String? _error;

  final _name = TextEditingController();
  final _income = TextEditingController();
  final Set<_Goal> _goals = {_Goal.spend};
  String _frequency = 'Mensual';
  final List<_FixedItem> _fixed = [
    _FixedItem('Alquiler', 'home', Icons.home_outlined),
    _FixedItem('Luz y agua', 'services', Icons.bolt_outlined),
    _FixedItem('Internet y celular', 'services', Icons.wifi_outlined),
    _FixedItem('Transporte', 'transport', Icons.directions_car_outlined),
  ];
  _Share _share = _Share.none;
  Overview? _overview;

  @override
  void dispose() {
    _name.dispose();
    _income.dispose();
    for (final f in _fixed) {
      f.amount.dispose();
    }
    super.dispose();
  }

  String get _today =>
      DateFormat('yyyy-MM-dd').format((widget.today ?? DateTime.now)());

  double? _amount(TextEditingController c) {
    final v = double.tryParse(c.text.trim().replaceAll(',', ''));
    return v != null && v > 0 ? v : null;
  }

  void _back() {
    if (_step == 0) {
      context.go('/home');
    } else {
      setState(() {
        _step--;
        _error = null;
      });
    }
  }

  Future<void> _run(Future<void> Function() action) async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await action();
      if (mounted) setState(() => _step++);
    } catch (e) {
      if (mounted) setState(() => _error = financeErrorMessage(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _next() async {
    switch (_step) {
      case 0:
        final name = _name.text.trim();
        if (name.isEmpty) {
          setState(() => _error = 'Dime cómo te llamo (aunque sea un apodo).');
          return;
        }
        await _run(() => _profile.updateName(name));
      case 1:
        await _run(() async {
          final prefs = await SharedPreferences.getInstance();
          await prefs.setStringList(
              'nina_goals', _goals.map((g) => g.name).toList());
        });
      case 2:
        final amount = _amount(_income);
        await _run(() async {
          if (amount == null) return; // "Lo hago después"
          await _finance.createTransaction(
            type: 'income',
            amount: amount,
            category: 'salary',
            date: _today,
            note: 'Sueldo ($_frequency)',
          );
        });
      case 3:
        await _run(() async {
          for (final f in _fixed) {
            final amount = _amount(f.amount);
            if (amount == null) continue;
            await _finance.createTransaction(
              type: 'expense',
              amount: amount,
              category: f.category,
              date: _today,
              note: f.label,
            );
          }
        });
      case 4:
        await _run(() async {
          if (_share != _Share.none) {
            await _spaces.create(
                'Casa', _share == _Share.couple ? 'pareja' : 'familia');
          }
          if (AppConstants.pricingPreview && mounted) {
            await context.push('/pricing');
          }
          _overview = await _finance.getOverview();
        });
    }
  }

  Future<void> _finish() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('setup_done', true);
    if (mounted) context.go('/home');
  }

  Future<void> _addFixed() async {
    final label = TextEditingController();
    final name = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Otro gasto fijo'),
        content: TextField(
          key: const Key('setup-fixed-name'),
          controller: label,
          autofocus: true,
          maxLength: 40,
          decoration: const InputDecoration(hintText: 'Ej. Gimnasio'),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancelar')),
          FilledButton(
              onPressed: () => Navigator.pop(ctx, label.text.trim()),
              child: const Text('Añadir')),
        ],
      ),
    );
    if (name == null || name.isEmpty) return;
    setState(() =>
        _fixed.add(_FixedItem(name, 'other', Icons.receipt_long_outlined)));
  }

  @override
  Widget build(BuildContext context) {
    if (_step >= _total) return _reveal();
    return NinaStepScaffold(
      header: NinaStepHeader(step: _step, total: _total, onBack: _back),
      content: [
        ...switch (_step) {
          0 => _nameStep(),
          1 => _goalsStep(),
          2 => _incomeStep(),
          3 => _fixedStep(),
          _ => _shareStep(),
        },
        if (_error != null) ...[
          const SizedBox(height: 16),
          Text(_error!,
              key: const Key('setup-error'),
              style: NinaText.bodyS(color: NinaColors.error)),
        ],
      ],
      actions: [
        NinaButton(
          key: const Key('setup-next'),
          label: 'Continuar',
          loading: _busy,
          onPressed: _next,
        ),
        if (_step == 2 || _step == 3)
          NinaButton(
            key: const Key('setup-later'),
            label: 'Lo hago después',
            variant: NinaButtonVariant.ghost,
            onPressed: _busy
                ? null
                : () => setState(() {
                      _error = null;
                      _step++;
                    }),
          ),
      ],
    );
  }

  List<Widget> _nameStep() => [
        const NinaHeading(
          title: 'Primero lo primero: ¿cómo te llamo?',
          subtitle: 'Así te hablo yo. Prometo no ponerme formal.',
        ),
        const SizedBox(height: 24),
        NinaField(
          label: 'Tu nombre',
          controller: _name,
          hint: 'Ana',
          autofocus: true,
          maxLength: 60,
          textCapitalization: TextCapitalization.words,
          fieldKey: const Key('setup-name'),
          onSubmitted: (_) => _next(),
        ),
      ];

  List<Widget> _goalsStep() {
    final first = _name.text.trim().split(' ').first;
    Widget tile(_Goal g, IconData icon, String title, String sub) => Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: NinaChoiceTile(
            icon: icon,
            title: title,
            subtitle: sub,
            selected: _goals.contains(g),
            onTap: () => setState(
                () => _goals.contains(g) ? _goals.remove(g) : _goals.add(g)),
          ),
        );
    return [
      NinaHeading(
        title:
            first.isEmpty ? '¿En qué te ayudo?' : '¿En qué te ayudo, $first?',
        subtitle: 'Elige todas las que quieras. Con esto ordeno tu inicio.',
      ),
      const SizedBox(height: 20),
      tile(_Goal.spend, Icons.account_balance_wallet_outlined,
          'Saber cuánto puedo gastar', 'Un número claro, todos los días'),
      tile(_Goal.monthEnd, Icons.calendar_today_outlined,
          'Dejar de llegar justo a fin de mes', 'Ver venir los gastos antes'),
      tile(_Goal.save, Icons.track_changes_outlined, 'Ahorrar para algo',
          'Un viaje, un fondo, lo que sea'),
      tile(_Goal.shared, Icons.group_outlined, 'Ordenar gastos compartidos',
          'Con tu pareja, familia o roomies'),
    ];
  }

  List<Widget> _incomeStep() => [
        const NinaHeading(
          title: '¿Cuánto te entra al mes?',
          subtitle:
              'Lo que de verdad llega a tu cuenta, después de descuentos.',
        ),
        const SizedBox(height: 24),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
          decoration: BoxDecoration(
            color: NinaColors.surface,
            borderRadius: BorderRadius.circular(NinaRadii.lg),
            border: Border.all(color: NinaColors.accent, width: 2),
          ),
          child: Column(children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.baseline,
              textBaseline: TextBaseline.alphabetic,
              children: [
                Text('S/ ',
                    style: NinaText.displayM(color: NinaColors.textTertiary)),
                Expanded(
                  child: TextField(
                    key: const Key('setup-income'),
                    controller: _income,
                    autofocus: true,
                    keyboardType:
                        const TextInputType.numberWithOptions(decimal: true),
                    inputFormatters: [
                      FilteringTextInputFormatter.allow(RegExp(r'[0-9.,]'))
                    ],
                    style: NinaText.hero().copyWith(fontSize: 48),
                    decoration: InputDecoration(
                      hintText: '0',
                      hintStyle: NinaText.hero(color: NinaColors.borderStrong)
                          .copyWith(fontSize: 48),
                      border: InputBorder.none,
                      enabledBorder: InputBorder.none,
                      focusedBorder: InputBorder.none,
                      filled: false,
                      contentPadding: EdgeInsets.zero,
                    ),
                  ),
                ),
              ],
            ),
            Text('Sueldo neto',
                style: NinaText.bodyS(color: NinaColors.textTertiary)),
          ]),
        ),
        const SizedBox(height: 16),
        Wrap(spacing: 8, children: [
          for (final f in const ['Mensual', 'Quincenal', 'Variable'])
            NinaChip(
                label: f,
                selected: _frequency == f,
                onTap: () => setState(() => _frequency = f)),
        ]),
        const SizedBox(height: 16),
        const NinaNote(
          icon: Icons.lock_outline,
          text:
              'Lo registro como tu ingreso de este mes y solo lo uso para tus cálculos. Lo cambias cuando quieras.',
        ),
      ];

  List<Widget> _fixedStep() => [
        const NinaHeading(
          title: 'Lo fijo primero',
          subtitle:
              'Lo que pagas sí o sí cada mes. Pon lo de este mes y ya puedo calcular.',
        ),
        const SizedBox(height: 20),
        NinaCard(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
          child: Column(children: [
            for (var i = 0; i < _fixed.length; i++) ...[
              if (i > 0) const Divider(height: 1),
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 10),
                child: Row(children: [
                  NinaIconBox(icon: _fixed[i].icon, size: 40),
                  const SizedBox(width: 12),
                  Expanded(
                      child:
                          Text(_fixed[i].label, style: NinaText.bodyMStrong())),
                  SizedBox(
                    width: 110,
                    child: TextField(
                      key: Key('setup-fixed-$i'),
                      controller: _fixed[i].amount,
                      textAlign: TextAlign.right,
                      keyboardType:
                          const TextInputType.numberWithOptions(decimal: true),
                      inputFormatters: [
                        FilteringTextInputFormatter.allow(RegExp(r'[0-9.,]'))
                      ],
                      style: NinaText.number(),
                      decoration: InputDecoration(
                        isDense: true,
                        prefixText: 'S/ ',
                        hintText: '0',
                        filled: true,
                        fillColor: NinaColors.surfaceSubtle,
                        contentPadding: const EdgeInsets.symmetric(
                            horizontal: 10, vertical: 10),
                        border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                            borderSide: BorderSide.none),
                        enabledBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                            borderSide: BorderSide.none),
                      ),
                    ),
                  ),
                ]),
              ),
            ],
          ]),
        ),
        const SizedBox(height: 12),
        OutlinedButton.icon(
          key: const Key('setup-add-fixed'),
          onPressed: _addFixed,
          icon: const Icon(Icons.add, size: 18),
          label: const Text('Añadir otro gasto fijo'),
        ),
        const SizedBox(height: 16),
        Row(children: [
          const Icon(Icons.upload_outlined,
              size: 18, color: NinaColors.textTertiary),
          const SizedBox(width: 10),
          Expanded(
              child: Text('Importar desde CSV',
                  style: NinaText.bodySStrong(color: NinaColors.textTertiary))),
          const NinaPill(label: 'Pronto'),
        ]),
      ];

  List<Widget> _shareStep() {
    Widget tile(_Share s, IconData icon, String title) => Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: NinaChoiceTile(
            icon: icon,
            title: title,
            selected: _share == s,
            onTap: () => setState(() => _share = s),
          ),
        );
    return [
      Container(
        height: 84,
        decoration: BoxDecoration(
          gradient: NinaColors.stageGradient,
          borderRadius: BorderRadius.circular(NinaRadii.lg),
        ),
        alignment: Alignment.center,
        child: const Row(mainAxisSize: MainAxisSize.min, children: [
          NinaPersonAvatar(name: 'A', size: 52),
          SizedBox(width: 8),
          Icon(Icons.add, color: NinaColors.textTertiary),
          SizedBox(width: 8),
          NinaPersonAvatar(name: '?', size: 52, color: NinaColors.accentSoft),
        ]),
      ),
      const SizedBox(height: 20),
      const NinaHeading(
        title: '¿Compartes gastos con alguien?',
        subtitle:
            'Alquiler, mercado, servicios… Crea un espacio común y cada quien registra lo suyo.',
      ),
      const SizedBox(height: 20),
      tile(_Share.couple, Icons.favorite_outline, 'Sí, con mi pareja'),
      tile(_Share.family, Icons.group_outlined, 'Sí, con familia o roomies'),
      tile(_Share.none, Icons.person_outline, 'Por ahora no'),
      const SizedBox(height: 4),
      const NinaNote(
        icon: Icons.verified_user_outlined,
        tone: NinaTone.positive,
        text:
            'Tus gastos personales siguen siendo 100% tuyos. Solo se comparte lo que tú mandes al espacio.',
      ),
    ];
  }

  Widget _reveal() {
    final o = _overview;
    final first = _name.text.trim().split(' ').first;
    return Scaffold(
      key: const Key('setup-reveal'),
      body: Container(
        decoration: const BoxDecoration(gradient: NinaColors.cocoaGradient),
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: NinaSpace.gutter),
            child: Column(children: [
              const Spacer(),
              const NinaMark(size: 56),
              const SizedBox(height: 16),
              Text(
                o == null || !o.hasHistory
                    ? 'Listo${first.isEmpty ? '' : ', $first'}. Ya estamos.'
                    : 'Listo${first.isEmpty ? '' : ', $first'}. Este es tu número.',
                textAlign: TextAlign.center,
                style: NinaText.titleL(color: NinaColors.peach),
              ),
              const SizedBox(height: 12),
              if (o != null && o.hasHistory) ...[
                Text(formatSoles(o.available),
                    key: const Key('setup-available'),
                    textAlign: TextAlign.center,
                    style: NinaText.hero(color: NinaColors.textInverse)
                        .copyWith(fontSize: 56)),
                const SizedBox(height: 6),
                Text('disponible para gastar en ${o.periodLabel}',
                    style: NinaText.bodyL(color: NinaColors.textInverse)),
                if (o.audit != null) ...[
                  const SizedBox(height: 18),
                  // Translucent pill on cocoa: readable, unlike a themed chip.
                  Material(
                    color: NinaColors.textInverse.withAlpha(26),
                    shape: const StadiumBorder(),
                    child: InkWell(
                      key: const Key('setup-audit'),
                      customBorder: const StadiumBorder(),
                      onTap: () => showAuditSheet(context,
                          audit: o.audit!,
                          onViewTransactions: () =>
                              context.go('/transactions')),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 16, vertical: 10),
                        child: Row(mainAxisSize: MainAxisSize.min, children: [
                          const Icon(Icons.calculate_outlined,
                              size: 16, color: NinaColors.peach),
                          const SizedBox(width: 8),
                          Text(
                              'Calculado con ${o.audit!.txnCount} ${o.audit!.txnCount == 1 ? 'movimiento' : 'movimientos'} · ver cómo',
                              style: NinaText.bodySStrong(
                                  color: NinaColors.peach)),
                        ]),
                      ),
                    ),
                  ),
                ],
              ] else
                Text(
                  'Cuando registres tu primer ingreso o gasto, aquí aparece cuánto te queda este mes.',
                  textAlign: TextAlign.center,
                  style: NinaText.bodyL(color: NinaColors.textInverse),
                ),
              const Spacer(),
              NinaButton(
                key: const Key('setup-finish'),
                label: 'Ir a mi inicio',
                variant: NinaButtonVariant.inverse,
                onPressed: _finish,
              ),
              const SizedBox(height: 16),
            ]),
          ),
        ),
      ),
    );
  }
}
