import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../../core/theme/design_system.dart';
import '../../../core/utils/money.dart';
import '../../../core/utils/transaction_display.dart';
import '../../../data/services/spaces_api_service.dart';
import '../../../domain/models/overview.dart';
import '../../../shared/widgets/add_transaction_sheet.dart';

/// One shared space: its own balance and totals (US-36), who registered what
/// (US-37), its movements, invite (US-34), add (US-35) and leave (US-38).
class SpaceDetailPage extends StatefulWidget {
  const SpaceDetailPage({super.key, required this.spaceId, this.api});

  final String spaceId;
  final SpacesApiService? api;

  @override
  State<SpaceDetailPage> createState() => _SpaceDetailPageState();
}

class _Data {
  const _Data(this.space, this.overview, this.movements);
  final SpaceSummary? space;
  final SpaceOverview overview;
  final List<SpaceMovement> movements;
}

class _SpaceDetailPageState extends State<SpaceDetailPage> {
  late final SpacesApiService _api = widget.api ?? SpacesApiService.instance;
  OverviewPeriod _period = OverviewPeriod.current;
  late Future<_Data> _future = _load();

  Future<_Data> _load() async {
    final results = await Future.wait([
      _api.list(),
      _api.overview(widget.spaceId, period: _period),
      _api.movements(widget.spaceId),
    ]);
    final spaces = results[0] as List<SpaceSummary>;
    final space = spaces.where((s) => s.id == widget.spaceId).firstOrNull;
    return _Data(
        space, results[1] as SpaceOverview, results[2] as List<SpaceMovement>);
  }

  void _reload() => setState(() {
        _future = _load();
      });

  void _snack(String text) =>
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text)));

  Future<void> _invite() async {
    try {
      final code = await _api.invite(widget.spaceId);
      if (!mounted) return;
      await showDialog<void>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('Invita con este código'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              SelectableText(code,
                  key: const Key('invite-code'),
                  style: const TextStyle(
                      fontSize: 28,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 4)),
              const SizedBox(height: 8),
              const Text(
                  'Compártelo por WhatsApp. Vence en 7 días. La otra persona lo ingresa en Más → Espacios compartidos → Unirme con código.',
                  textAlign: TextAlign.center),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () {
                Clipboard.setData(ClipboardData(text: code));
                Navigator.pop(ctx);
                _snack('Código copiado');
              },
              child: const Text('Copiar'),
            ),
          ],
        ),
      );
    } catch (e) {
      _snack(spacesErrorMessage(e));
    }
  }

  Future<void> _leave(String name) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Salir de «$name»'),
        content: const Text(
            'Dejarás de ver y registrar movimientos en este espacio. Los demás miembros lo conservan.'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Cancelar')),
          FilledButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('Salir')),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await _api.leave(widget.spaceId);
      if (mounted) context.pop();
    } catch (e) {
      _snack(spacesErrorMessage(e));
    }
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<_Data>(
      future: _future,
      builder: (context, snap) {
        final name = snap.data?.space?.name ?? 'Espacio';
        return Scaffold(
          backgroundColor: NinaColors.background,
          appBar: AppBar(
            title: Text(name),
            backgroundColor: NinaColors.background,
            actions: [
              IconButton(
                  tooltip: 'Invitar',
                  onPressed: _invite,
                  icon: const Icon(Icons.person_add_alt_1)),
              PopupMenuButton<String>(
                onSelected: (_) => _leave(name),
                itemBuilder: (_) => const [
                  PopupMenuItem(
                      value: 'leave', child: Text('Salir del espacio'))
                ],
              ),
            ],
          ),
          floatingActionButton: FloatingActionButton(
            heroTag: 'space-add',
            tooltip: 'Agregar al espacio',
            backgroundColor: NinaColors.accent,
            foregroundColor: NinaColors.background,
            onPressed: () async {
              if (await showAddTransactionSheet(context,
                  spaceId: widget.spaceId, spaceName: name)) _reload();
            },
            child: const Icon(Icons.add),
          ),
          body: _body(snap),
        );
      },
    );
  }

  Widget _body(AsyncSnapshot<_Data> snap) {
    if (snap.connectionState == ConnectionState.waiting)
      return const Center(child: CircularProgressIndicator());
    if (snap.hasError) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Text(spacesErrorMessage(snap.error!), textAlign: TextAlign.center),
            const SizedBox(height: 12),
            OutlinedButton(onPressed: _reload, child: const Text('Reintentar')),
          ]),
        ),
      );
    }
    final d = snap.data!;
    final o = d.overview.overview;
    return RefreshIndicator(
      onRefresh: () async => _reload(),
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 96),
        children: [
          SegmentedButton<OverviewPeriod>(
            segments: [
              for (final p in OverviewPeriod.values)
                ButtonSegment(value: p, label: Text(p.label))
            ],
            selected: {_period},
            onSelectionChanged: (s) => setState(() {
              _period = s.first;
              _future = _load();
            }),
          ),
          const SizedBox(height: 12),
          _card(
            'Saldo del espacio',
            Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(formatSoles(o.balance),
                  key: const Key('space-balance'),
                  style: const TextStyle(
                      fontSize: 28,
                      fontWeight: FontWeight.w700,
                      color: NinaColors.textPrimary)),
              const SizedBox(height: 8),
              Text(
                  '${o.periodLabel}: gastos ${formatSoles(o.expenses)} · aportes ${formatSoles(o.income)}',
                  style: const TextStyle(
                      color: NinaColors.textSecondary, fontSize: 12)),
            ]),
          ),
          _card(
            'Quién registró qué · ${o.periodLabel}',
            Column(children: [
              for (final m in d.overview.members)
                ListTile(
                  dense: true,
                  contentPadding: EdgeInsets.zero,
                  leading: CircleAvatar(
                      radius: 14,
                      child:
                          Text(m.name.isEmpty ? '?' : m.name[0].toUpperCase())),
                  title: Text(m.isMe ? '${m.name} (tú)' : m.name),
                  subtitle:
                      Text('${m.count} movimiento${m.count == 1 ? '' : 's'}'),
                  trailing: Text('Gastos ${formatSoles(m.expenses)}'),
                ),
            ]),
          ),
          _card(
            'Movimientos del espacio',
            d.movements.isEmpty
                ? const Text(
                    'Aún no hay movimientos. Toca + o dile a Nina "pagué 1200 de alquiler, es de la casa".',
                    style:
                        TextStyle(color: NinaColors.textTertiary, fontSize: 12))
                : Column(children: [
                    for (final t in d.movements)
                      ListTile(
                        dense: true,
                        contentPadding: EdgeInsets.zero,
                        title: Text((t.description?.trim().isNotEmpty ?? false)
                            ? t.description!
                            : categoryLabel(t.category)),
                        subtitle: Text(
                            '${t.isMine ? 'Tú' : t.author} · ${_day(t.date)} · ${categoryLabel(t.category)}'),
                        trailing: Text(
                            '${t.type == 'income' ? '+' : '−'}${formatSoles(t.amount)}'),
                      ),
                  ]),
          ),
        ],
      ),
    );
  }

  String _day(String? raw) {
    final d = storedDay(raw);
    return d == null ? '' : DateFormat("d 'de' MMM", 'es').format(d);
  }

  Widget _card(String title, Widget child) => Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: NinaColors.surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: NinaColors.border, width: 0.5),
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(title,
              style: const TextStyle(
                  fontWeight: FontWeight.w700, color: NinaColors.textPrimary)),
          const SizedBox(height: 10),
          child,
        ]),
      );
}
