import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/design_system.dart';
import '../../../data/services/spaces_api_service.dart';

/// Shared spaces list: create (US-33) and join with a code (US-34).
class SpacesPage extends StatefulWidget {
  const SpacesPage({super.key, this.api});

  final SpacesApiService? api;

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
      _reload();
      _snack('Te uniste a «${s.name}».');
    } catch (e) {
      _snack(spacesErrorMessage(e));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: NinaColors.background,
      appBar: AppBar(
          title: const Text('Espacios compartidos'),
          backgroundColor: NinaColors.background),
      body: FutureBuilder<List<SpaceSummary>>(
        future: _future,
        builder: (context, snap) {
          if (snap.connectionState == ConnectionState.waiting)
            return const Center(child: CircularProgressIndicator());
          final children = <Widget>[
            const Padding(
              padding: EdgeInsets.fromLTRB(16, 8, 16, 16),
              child: Text(
                'Gestiona los gastos comunes (alquiler, mercado, servicios) con tu pareja o familia. '
                'Tus movimientos personales nunca se comparten.',
                style: TextStyle(color: NinaColors.textSecondary, height: 1.4),
              ),
            ),
          ];
          if (snap.hasError) {
            children.add(Padding(
              padding: const EdgeInsets.all(16),
              child: Text(spacesErrorMessage(snap.error!),
                  style: const TextStyle(color: NinaColors.errorLight)),
            ));
          } else if (snap.data!.isEmpty) {
            children.add(const Padding(
              key: Key('spaces-empty'),
              padding: EdgeInsets.all(16),
              child: Text(
                  'Aún no tienes espacios. Crea uno o únete con el código que te compartieron.',
                  style: TextStyle(color: NinaColors.textTertiary)),
            ));
          } else {
            for (final s in snap.data!) {
              children.add(ListTile(
                leading: const Icon(Icons.home_work_outlined,
                    color: NinaColors.accent),
                title: Text(s.name,
                    style: const TextStyle(color: NinaColors.textPrimary)),
                subtitle: Text(
                    '${s.memberCount} miembro${s.memberCount == 1 ? '' : 's'}${s.isOwner ? ' · Creado por ti' : ''}'),
                trailing: const Icon(Icons.chevron_right),
                onTap: () async {
                  await context.push('/spaces/${s.id}');
                  _reload();
                },
              ));
            }
          }
          children.addAll([
            const SizedBox(height: 16),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: FilledButton.icon(
                  onPressed: _create,
                  icon: const Icon(Icons.add),
                  label: const Text('Crear espacio')),
            ),
            const SizedBox(height: 8),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: OutlinedButton.icon(
                  onPressed: _join,
                  icon: const Icon(Icons.group_add_outlined),
                  label: const Text('Unirme con código')),
            ),
          ]);
          return RefreshIndicator(
              onRefresh: () async => _reload(),
              child: ListView(children: children));
        },
      ),
    );
  }
}
