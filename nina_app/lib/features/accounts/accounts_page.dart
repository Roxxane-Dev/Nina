import 'package:flutter/material.dart';
import '../../core/theme/design_system.dart';
import '../../data/services/accounts_api_service.dart';

/// Más → Cuentas (US-41): add, edit and archive the user's accounts.
class AccountsPage extends StatefulWidget {
  const AccountsPage({super.key, this.api});

  final AccountsApiService? api;

  @override
  State<AccountsPage> createState() => _AccountsPageState();
}

class _AccountsPageState extends State<AccountsPage> {
  late final AccountsApiService _api =
      widget.api ?? AccountsApiService.instance;
  late Future<List<Account>> _future = _api.list();
  bool _showArchived = false;

  void _reload() {
    setState(() {
      _future = _api.list();
    });
  }

  void _snack(String text) =>
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text)));

  /// Create (account == null) or edit.
  Future<void> _edit([Account? account]) async {
    final name = TextEditingController(text: account?.name ?? '');
    final institution = TextEditingController(text: account?.institution ?? '');
    var kind = account?.kind ?? 'bank';
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setLocal) => AlertDialog(
          title: Text(account == null ? 'Nueva cuenta' : 'Editar cuenta'),
          content: Column(mainAxisSize: MainAxisSize.min, children: [
            TextField(
              key: const Key('account-name'),
              controller: name,
              autofocus: true,
              maxLength: 40,
              decoration: const InputDecoration(
                  labelText: 'Nombre', hintText: 'Ej. BCP sueldo'),
            ),
            DropdownButtonFormField<String>(
              initialValue: kind,
              decoration: const InputDecoration(labelText: 'Tipo'),
              items: [
                for (final e in accountKinds.entries)
                  DropdownMenuItem(value: e.key, child: Text(e.value))
              ],
              onChanged: (v) => setLocal(() => kind = v ?? kind),
            ),
            TextField(
              controller: institution,
              maxLength: 40,
              decoration: const InputDecoration(
                  labelText: 'Institución (opcional)',
                  hintText: 'BCP, Interbank, BBVA…'),
            ),
          ]),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(ctx, false),
                child: const Text('Cancelar')),
            FilledButton(
                onPressed: () => Navigator.pop(ctx, true),
                child: const Text('Guardar')),
          ],
        ),
      ),
    );
    if (ok != true || name.text.trim().isEmpty) return;
    try {
      if (account == null) {
        await _api.create(
            name: name.text.trim(), kind: kind, institution: institution.text);
      } else {
        await _api.update(account.id,
            name: name.text.trim(),
            kind: kind,
            institution: institution.text.trim());
      }
      _reload();
    } catch (e) {
      _snack(accountsErrorMessage(e));
    }
  }

  Future<void> _toggleArchive(Account a) async {
    try {
      await _api.update(a.id, archived: !a.archived);
      _reload();
      _snack(a.archived
          ? '«${a.name}» está activa otra vez.'
          : '«${a.name}» archivada. Sus movimientos se conservan.');
    } catch (e) {
      _snack(accountsErrorMessage(e));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: NinaColors.background,
      appBar: AppBar(
        title: const Text('Cuentas'),
        backgroundColor: NinaColors.background,
        actions: [
          TextButton(
            onPressed: () => setState(() => _showArchived = !_showArchived),
            child:
                Text(_showArchived ? 'Ocultar archivadas' : 'Ver archivadas'),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton(
        key: const Key('accounts-add'),
        heroTag: 'accounts-add',
        tooltip: 'Nueva cuenta',
        backgroundColor: NinaColors.accent,
        foregroundColor: NinaColors.background,
        onPressed: _edit,
        child: const Icon(Icons.add),
      ),
      body: FutureBuilder<List<Account>>(
        future: _future,
        builder: (context, snap) {
          if (snap.connectionState == ConnectionState.waiting)
            return const Center(child: CircularProgressIndicator());
          if (snap.hasError) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Text(accountsErrorMessage(snap.error!),
                    textAlign: TextAlign.center),
              ),
            );
          }
          final list =
              snap.data!.where((a) => _showArchived || !a.archived).toList();
          if (list.isEmpty) {
            return const Center(
              key: Key('accounts-empty'),
              child: Padding(
                padding: EdgeInsets.all(24),
                child: Text(
                  'Agrega tus cuentas (banco, efectivo, tarjeta, Yape) para saber de dónde sale cada movimiento.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: NinaColors.textTertiary),
                ),
              ),
            );
          }
          return ListView(
            padding: const EdgeInsets.only(bottom: 96),
            children: [
              for (final a in list)
                ListTile(
                  leading: Icon(_icon(a.kind),
                      color: a.archived
                          ? NinaColors.textTertiary
                          : NinaColors.accent),
                  title: Text(a.name,
                      style: TextStyle(
                          color: a.archived
                              ? NinaColors.textTertiary
                              : NinaColors.textPrimary)),
                  subtitle: Text([
                    accountKinds[a.kind] ?? a.kind,
                    if (a.institution != null) a.institution!,
                    if (a.archived) 'Archivada'
                  ].join(' · ')),
                  onTap: () => _edit(a),
                  trailing: IconButton(
                    tooltip: a.archived ? 'Reactivar' : 'Archivar',
                    icon: Icon(a.archived
                        ? Icons.unarchive_outlined
                        : Icons.archive_outlined),
                    onPressed: () => _toggleArchive(a),
                  ),
                ),
            ],
          );
        },
      ),
    );
  }

  IconData _icon(String kind) => switch (kind) {
        'cash' => Icons.payments_outlined,
        'card' => Icons.credit_card,
        'wallet' => Icons.phone_iphone,
        _ => Icons.account_balance_outlined,
      };
}
