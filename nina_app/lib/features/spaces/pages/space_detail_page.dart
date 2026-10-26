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
import '../../../shared/widgets/nina_ui.dart';
import '../../transactions/widgets/transaction_row.dart';

/// One shared space: its own balance and totals (US-36), who registered what
/// (US-37), its movements, invite (US-34), add (US-35) and leave (US-38).
class SpaceDetailPage extends StatefulWidget {
  const SpaceDetailPage(
      {super.key,
      required this.spaceId,
      this.api,
      this.embedded = false,
      this.onLeft});

  final String spaceId;
  final SpacesApiService? api;

  /// Shown inside the Espacio tab (no back button, room for the tab bar).
  final bool embedded;

  /// Embedded only: the user left this space.
  final VoidCallback? onLeft;

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
                  'Compártelo por WhatsApp. Vence en 7 días. La otra persona lo ingresa en Espacio → Unirme con código.',
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
      if (!mounted) return;
      if (widget.embedded) {
        widget.onLeft?.call();
      } else {
        context.pop();
      }
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
          floatingActionButton: Padding(
            padding: EdgeInsets.only(bottom: widget.embedded ? 88 : 0),
            child: FloatingActionButton.extended(
              heroTag: 'space-add',
              tooltip: 'Agregar al espacio',
              backgroundColor: NinaColors.cocoa,
              foregroundColor: NinaColors.textInverse,
              onPressed: () async {
                if (await showAddTransactionSheet(context,
                    spaceId: widget.spaceId, spaceName: name)) {
                  _reload();
                }
              },
              icon: const Icon(Icons.add),
              label: Text('Añadir gasto',
                  style: NinaText.bodySStrong(color: NinaColors.textInverse)),
            ),
          ),
          body: SafeArea(bottom: false, child: _body(snap, name)),
        );
      },
    );
  }

  Widget _header(String name, List<MemberContribution> members) {
    return Row(children: [
      if (!widget.embedded) ...[
        NinaBackButton(onTap: () => context.pop()),
        const SizedBox(width: 12),
      ],
      Expanded(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(name, style: NinaText.displayL()),
          if (members.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Row(children: [
                for (var i = 0; i < members.length && i < 4; i++)
                  Align(
                    widthFactor: 0.75,
                    child: NinaPersonAvatar(
                      name: members[i].name,
                      size: 30,
                      color:
                          i.isEven ? NinaColors.peach : NinaColors.accentSoft,
                    ),
                  ),
                const SizedBox(width: 12),
                Text(
                    '${members.length} miembro${members.length == 1 ? '' : 's'}',
                    style: NinaText.bodyS()),
              ]),
            ),
        ]),
      ),
      NinaCircleButton(
          icon: Icons.person_add_alt_1_outlined,
          tooltip: 'Invitar',
          onTap: _invite),
      const SizedBox(width: 8),
      PopupMenuButton<String>(
        tooltip: 'Más opciones',
        icon: const Icon(Icons.more_horiz, color: NinaColors.textPrimary),
        onSelected: (v) {
          if (v == 'leave') _leave(name);
          if (v == 'all') context.push('/spaces');
        },
        itemBuilder: (_) => [
          if (widget.embedded)
            const PopupMenuItem(value: 'all', child: Text('Mis espacios')),
          const PopupMenuItem(value: 'leave', child: Text('Salir del espacio')),
        ],
      ),
    ]);
  }

  Widget _body(AsyncSnapshot<_Data> snap, String name) {
    if (snap.connectionState == ConnectionState.waiting) {
      return const Center(child: CircularProgressIndicator());
    }
    if (snap.hasError) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Text(spacesErrorMessage(snap.error!),
                textAlign: TextAlign.center, style: NinaText.bodyM()),
            const SizedBox(height: 12),
            NinaButton(
                label: 'Reintentar',
                variant: NinaButtonVariant.secondary,
                expand: false,
                onPressed: _reload),
          ]),
        ),
      );
    }
    final d = snap.data!;
    final o = d.overview.overview;
    return RefreshIndicator(
      onRefresh: () async => _reload(),
      child: ListView(
        padding: const EdgeInsets.fromLTRB(
            NinaSpace.gutter, 16, NinaSpace.gutter, 200),
        children: [
          _header(name, d.overview.members),
          const SizedBox(height: 16),
          Row(children: [
            for (final p in OverviewPeriod.values)
              Padding(
                padding: const EdgeInsets.only(right: 8),
                child: NinaChip(
                  label: p.label,
                  selected: _period == p,
                  onTap: () => setState(() {
                    _period = p;
                    _future = _load();
                  }),
                ),
              ),
          ]),
          const SizedBox(height: 16),
          NinaCard(
            child:
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('SALDO DEL ESPACIO', style: NinaText.caps()),
              const SizedBox(height: 8),
              Text(formatSoles(o.balance),
                  key: const Key('space-balance'),
                  style: NinaText.hero().copyWith(fontSize: 44)),
              const SizedBox(height: 8),
              Text(
                  '${o.periodLabel}: gastos ${formatSoles(o.expenses)} · aportes ${formatSoles(o.income)}',
                  style: NinaText.bodyS()),
            ]),
          ),
          const SizedBox(height: 12),
          const NinaNote(
            icon: Icons.verified_user_outlined,
            tone: NinaTone.positive,
            text:
                'Aquí solo aparece lo que cada uno mandó al espacio. Sus gastos personales siguen privados.',
          ),
          const SizedBox(height: 24),
          NinaSectionHeader(title: 'Quién registró qué · ${o.periodLabel}'),
          const SizedBox(height: 8),
          NinaCard(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
            child: Column(children: [
              for (var i = 0; i < d.overview.members.length; i++) ...[
                if (i > 0) const Divider(height: 1),
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  child: Row(children: [
                    NinaPersonAvatar(
                        name: d.overview.members[i].name,
                        size: 36,
                        color: i.isEven
                            ? NinaColors.peach
                            : NinaColors.accentSoft),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                                d.overview.members[i].isMe
                                    ? '${d.overview.members[i].name} (tú)'
                                    : d.overview.members[i].name,
                                style: NinaText.bodyMStrong()),
                            Text(
                                '${d.overview.members[i].count} movimiento${d.overview.members[i].count == 1 ? '' : 's'}',
                                style: NinaText.bodyS(
                                    color: NinaColors.textTertiary)),
                          ]),
                    ),
                    Text(
                        'Gastos ${formatSoles(d.overview.members[i].expenses)}',
                        style: NinaText.bodySStrong()),
                  ]),
                ),
              ],
            ]),
          ),
          const SizedBox(height: 24),
          const NinaSectionHeader(title: 'Movimientos del espacio'),
          const SizedBox(height: 8),
          NinaCard(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
            child: d.movements.isEmpty
                ? Padding(
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    child: Text(
                        'Aún no hay movimientos. Toca "Añadir gasto" o dile a Nina "pagué 1200 de alquiler, es de la casa".',
                        style: NinaText.bodyS()),
                  )
                : Column(children: [
                    for (var i = 0; i < d.movements.length; i++) ...[
                      if (i > 0) const Divider(height: 1),
                      TransactionRow(
                        title: (d.movements[i].description?.trim().isNotEmpty ??
                                false)
                            ? d.movements[i].description!
                            : categoryLabel(d.movements[i].category),
                        meta:
                            '${d.movements[i].isMine ? 'Tú' : d.movements[i].author} · ${_day(d.movements[i].date)} · ${categoryLabel(d.movements[i].category)}',
                        amount: d.movements[i].amount,
                        isIncome: d.movements[i].type == 'income',
                        category: d.movements[i].category,
                      ),
                    ],
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
}
