import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/design_system.dart';
import '../../../data/services/spaces_api_service.dart';
import '../../../shared/widgets/nina_ui.dart';

/// Shared spaces list: create (US-33) and join with a code (US-34).
/// In the Espacio tab ([embedded]) it is the empty state.
class SpacesPage extends StatefulWidget {
  const SpacesPage(
      {super.key, this.api, this.embedded = false, this.onChanged});

  final SpacesApiService? api;
  final bool embedded;

  /// Embedded only: a space was created or joined.
  final VoidCallback? onChanged;

  @override
  State<SpacesPage> createState() => _SpacesPageState();
}

class _SpacesPageState extends State<SpacesPage> {
  late final SpacesApiService _api = widget.api ?? SpacesApiService.instance;
  late Future<List<SpaceSummary>> _future = _api.list();

  void _reload() => setState(() {
        _future = _api.list();
      });

  void _snack(String text) =>
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text)));

  Future<void> _create() async {
    final name = TextEditingController();
    var type = 'pareja';
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setLocal) => AlertDialog(
          title: const Text('Nuevo espacio compartido'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                key: const Key('space-name'),
                controller: name,
                maxLength: 40,
                autofocus: true,
                decoration: const InputDecoration(
                    labelText: 'Nombre', hintText: 'Ej. Casa'),
              ),
              DropdownButtonFormField<String>(
                initialValue: type,
                decoration: const InputDecoration(labelText: 'Tipo'),
                items: const [
                  DropdownMenuItem(value: 'pareja', child: Text('Pareja')),
                  DropdownMenuItem(value: 'familia', child: Text('Familia')),
                  DropdownMenuItem(value: 'otro', child: Text('Otro')),
                ],
                onChanged: (v) => setLocal(() => type = v ?? type),
              ),
            ],
          ),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(ctx, false),
                child: const Text('Cancelar')),
            FilledButton(
                onPressed: () => Navigator.pop(ctx, true),
                child: const Text('Crear')),
          ],
        ),
      ),
    );
    if (ok != true || name.text.trim().isEmpty) return;
    try {
      final s = await _api.create(name.text.trim(), type);
      if (widget.embedded) {
        widget.onChanged?.call();
        return;
      }
      _reload();
      if (mounted) context.push('/spaces/${s.id}');
    } catch (e) {
      _snack(spacesErrorMessage(e));
    }
  }

  Future<void> _join() async {
    final code = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Unirme a un espacio'),
        content: TextField(
          key: const Key('join-code'),
          controller: code,
          autofocus: true,
          textCapitalization: TextCapitalization.characters,
          decoration:
              const InputDecoration(labelText: 'Código de 8 caracteres'),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Cancelar')),
          FilledButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('Unirme')),
        ],
      ),
    );
    if (ok != true) return;
    try {
      final s = await _api.join(code.text);
      _snack('Te uniste a «${s.name}».');
      if (widget.embedded) {
        widget.onChanged?.call();
      } else {
        _reload();
      }
    } catch (e) {
      _snack(spacesErrorMessage(e));
    }
  }

  @override
  Widget build(BuildContext context) {
    final body = FutureBuilder<List<SpaceSummary>>(
      future: _future,
      builder: (context, snap) {
        if (snap.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator());
        }
        final children = <Widget>[
          Row(children: [
            if (!widget.embedded) ...[
              NinaBackButton(onTap: () => context.pop()),
              const SizedBox(width: 12),
            ],
            Expanded(
              child: Text(widget.embedded ? 'Espacio' : 'Espacios compartidos',
                  style: NinaText.displayL()),
            ),
          ]),
          const SizedBox(height: 20),
          Container(
            height: 120,
            decoration: BoxDecoration(
              gradient: NinaColors.stageGradient,
              borderRadius: BorderRadius.circular(NinaRadii.lg),
            ),
            alignment: Alignment.center,
            child: const Row(mainAxisSize: MainAxisSize.min, children: [
              NinaPersonAvatar(name: 'Tú', size: 60),
              SizedBox(width: 10),
              Icon(Icons.add, color: NinaColors.textTertiary),
              SizedBox(width: 10),
              NinaPersonAvatar(
                  name: '?', size: 60, color: NinaColors.accentSoft),
            ]),
          ),
          const SizedBox(height: 20),
          Text('Gastos en común, sin enredos', style: NinaText.titleL()),
          const SizedBox(height: 6),
          Text(
            'Gestiona los gastos comunes (alquiler, mercado, servicios) con tu pareja o familia. '
            'Tus movimientos personales nunca se comparten.',
            style: NinaText.bodyM(),
          ),
          const SizedBox(height: 20),
        ];
        if (snap.hasError) {
          children.add(Text(spacesErrorMessage(snap.error!),
              style: NinaText.bodyS(color: NinaColors.error)));
        } else if (snap.data!.isEmpty) {
          children.add(Padding(
            key: const Key('spaces-empty'),
            padding: const EdgeInsets.only(bottom: 8),
            child: Text(
                'Aún no tienes espacios. Crea uno o únete con el código que te compartieron.',
                style: NinaText.bodyS(color: NinaColors.textTertiary)),
          ));
        } else {
          for (final s in snap.data!) {
            children.add(Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: NinaCard(
                onTap: () async {
                  await context.push('/spaces/${s.id}');
                  _reload();
                },
                padding: const EdgeInsets.all(16),
                child: Row(children: [
                  const NinaIconBox(
                      icon: Icons.group_outlined,
                      background: NinaColors.peachSoft),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(s.name, style: NinaText.bodyMStrong()),
                          Text(
                              '${s.memberCount} miembro${s.memberCount == 1 ? '' : 's'}${s.isOwner ? ' · Creado por ti' : ''}',
                              style: NinaText.bodyS()),
                        ]),
                  ),
                  const Icon(Icons.chevron_right_rounded,
                      color: NinaColors.textTertiary),
                ]),
              ),
            ));
          }
        }
        children.addAll([
          const SizedBox(height: 8),
          NinaButton(
              label: 'Crear espacio', icon: Icons.add, onPressed: _create),
          const SizedBox(height: 8),
          NinaButton(
              label: 'Unirme con código',
              icon: Icons.group_add_outlined,
              variant: NinaButtonVariant.secondary,
              onPressed: _join),
        ]);
        return RefreshIndicator(
          onRefresh: () async => _reload(),
          child: ListView(
            padding: EdgeInsets.fromLTRB(NinaSpace.gutter, 16, NinaSpace.gutter,
                widget.embedded ? 140 : 32),
            children: children,
          ),
        );
      },
    );
    return Scaffold(body: SafeArea(bottom: false, child: body));
  }
}
