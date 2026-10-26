import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/design_system.dart';
import '../../../core/utils/money.dart';
import '../../../data/services/finance_api_service.dart';
import '../../../data/services/goals_api_service.dart';
import '../../../shared/widgets/nina_ui.dart';

/// Metas: saved goals with the engine's plan (required per month vs. the
/// user's real savings pace). Goals are created by asking Nina in the chat.
class GoalsScreen extends StatefulWidget {
  const GoalsScreen({super.key, this.api, this.onAskNina});

  /// Injectable for tests.
  final GoalsApiService? api;

  /// Opens the chat with a draft question. Default: router.
  final void Function(String draft)? onAskNina;

  @override
  State<GoalsScreen> createState() => _GoalsScreenState();
}

class _GoalsScreenState extends State<GoalsScreen> {
  late final GoalsApiService _api = widget.api ?? GoalsApiService.instance;
  late Future<List<Goal>> _future = _api.list();

  void _reload() => setState(() {
        _future = _api.list();
      });

  void _ask(String draft) {
    final open = widget.onAskNina;
    if (open != null) {
      open(draft);
    } else {
      context.go('/chat?draft=${Uri.encodeComponent(draft)}');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: RefreshIndicator(
          onRefresh: () async {
            _reload();
            await _future.catchError((_) => <Goal>[]);
          },
          child: FutureBuilder<List<Goal>>(
            future: _future,
            builder: (context, snap) {
              final children = <Widget>[
                Row(children: [
                  Expanded(child: Text('Metas', style: NinaText.displayL())),
                  NinaSmallAction(
                    key: const Key('goals-new'),
                    label: 'Nueva',
                    icon: Icons.add,
                    filled: true,
                    onTap: () => _ask('Quiero juntar '),
                  ),
                ]),
                const SizedBox(height: 20),
              ];
              if (snap.connectionState == ConnectionState.waiting) {
                children.add(const Padding(
                  padding: EdgeInsets.only(top: 80),
                  child: Center(child: CircularProgressIndicator()),
                ));
              } else if (snap.hasError) {
                children.addAll([
                  Text(financeErrorMessage(snap.error!),
                      style: NinaText.bodyM()),
                  const SizedBox(height: 12),
                  NinaButton(
                      label: 'Reintentar',
                      variant: NinaButtonVariant.secondary,
                      onPressed: _reload),
                ]);
              } else if (snap.data!.isEmpty) {
                children.add(_EmptyGoals(onAsk: _ask));
              } else {
                for (final g in snap.data!) {
                  children.add(Padding(
                    padding: const EdgeInsets.only(bottom: 16),
                    child: _GoalCard(goal: g, onAsk: _ask),
                  ));
                }
              }
              return ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.fromLTRB(
                    NinaSpace.gutter, 20, NinaSpace.gutter, 120),
                children: children,
              );
            },
          ),
        ),
      ),
    );
  }
}

class _GoalCard extends StatelessWidget {
  const _GoalCard({required this.goal, required this.onAsk});
  final Goal goal;
  final ValueChanged<String> onAsk;

  @override
  Widget build(BuildContext context) {
    final p = goal.plan;
    final (String label, NinaTone tone) = goal.remaining <= 0
        ? ('¡Lograda!', NinaTone.positive)
        : goal.deadlinePast
            ? ('La fecha ya pasó', NinaTone.neutral)
            : p.gapPerMonth == null
                ? ('Sin ritmo todavía', NinaTone.neutral)
                : p.gapPerMonth! > 0
                    ? (
                        'Te faltan ${formatSoles(p.gapPerMonth!)} al mes',
                        NinaTone.warning
                      )
                    : ('En ritmo', NinaTone.positive);
    return NinaCard(
      key: Key('goal-${goal.id}'),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const NinaIconBox(
              icon: Icons.track_changes_outlined,
              background: NinaColors.peachSoft),
          const SizedBox(width: 12),
          Expanded(
            child:
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(goal.name, style: NinaText.titleL()),
              if (goal.deadlineLabel != null)
                Text('Para ${goal.deadlineLabel}', style: NinaText.bodyS()),
            ]),
          ),
          NinaPill(label: label, tone: tone),
        ]),
        const SizedBox(height: 18),
        Row(
          crossAxisAlignment: CrossAxisAlignment.baseline,
          textBaseline: TextBaseline.alphabetic,
          children: [
            Text(formatSoles(goal.currentAmount),
                key: Key('goal-current-${goal.id}'),
                style: NinaText.displayM()),
            const SizedBox(width: 6),
            Expanded(
              child: Text('de ${formatSoles(goal.targetAmount)}',
                  style: NinaText.bodyS()),
            ),
          ],
        ),
        const SizedBox(height: 10),
        NinaProgressBar(value: goal.progress),
        if (goal.remaining > 0 &&
            (p.requiredPerMonth != null || p.avgMonthlySavings != null)) ...[
          const SizedBox(height: 16),
          Container(
            decoration: BoxDecoration(
                color: NinaColors.surfaceSubtle,
                borderRadius: BorderRadius.circular(NinaRadii.md)),
            child: IntrinsicHeight(
              child: Row(children: [
                if (p.requiredPerMonth != null)
                  Expanded(
                      child: _Fact('Necesitas al mes',
                          formatSoles(p.requiredPerMonth!), null)),
                if (p.requiredPerMonth != null && p.avgMonthlySavings != null)
                  const VerticalDivider(width: 1, color: NinaColors.border),
                if (p.avgMonthlySavings != null)
                  Expanded(
                      child: _Fact(
                          'Tu ahorro real',
                          formatSoles(p.avgMonthlySavings!),
                          (p.gapPerMonth ?? 0) > 0
                              ? NinaColors.warning
                              : NinaColors.success)),
              ]),
            ),
          ),
          if (p.confidence == 'low' || p.confidence == 'insufficient')
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text(
                  'Pocos meses registrados: tu ritmo real puede cambiar.',
                  style: NinaText.bodyS(color: NinaColors.warning)),
            ),
        ],
        if (goal.remaining > 0) ...[
          const SizedBox(height: 14),
          NinaSmallAction(
            label: 'Pregúntale a Nina cómo',
            icon: Icons.auto_awesome_outlined,
            onTap: () => onAsk(goal.deadlineLabel == null
                ? '¿Cómo junto ${formatSoles(goal.remaining)} para ${goal.name}?'
                : '¿Cómo junto ${formatSoles(goal.remaining)} para ${goal.deadlineLabel}?'),
          ),
        ],
      ]),
    );
  }
}

class _Fact extends StatelessWidget {
  const _Fact(this.label, this.value, this.color);
  final String label;
  final String value;
  final Color? color;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.all(14),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(label, style: NinaText.bodyS()),
          const SizedBox(height: 4),
          Text(value,
              style: NinaText.titleL(color: color ?? NinaColors.textPrimary)),
        ]),
      );
}

class _EmptyGoals extends StatelessWidget {
  const _EmptyGoals({required this.onAsk});
  final ValueChanged<String> onAsk;

  @override
  Widget build(BuildContext context) => NinaCard(
        key: const Key('goals-empty'),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const NinaIconBox(
              icon: Icons.flag_outlined,
              size: 56,
              background: NinaColors.peachSoft),
          const SizedBox(height: 16),
          Text('¿Para qué estás juntando?', style: NinaText.titleL()),
          const SizedBox(height: 6),
          Text(
              'Pregúntale a Nina con monto y fecha. Te arma el plan con tu ahorro real y, si te gusta, lo guarda aquí.',
              style: NinaText.bodyM()),
          const SizedBox(height: 16),
          NinaChip(
            label: '¿Cómo alcanzo 6000 soles para enero 2028?',
            selected: false,
            icon: Icons.auto_awesome_outlined,
            onTap: () => onAsk('¿Cómo alcanzo 6000 soles para enero 2028?'),
          ),
        ]),
      );
}
