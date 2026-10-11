import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../auth/bloc/auth_bloc.dart';
import '../../auth/bloc/auth_event.dart';
import '../../../core/theme/design_system.dart';
import '../../../data/services/profile_api_service.dart';

/// Más: profile (US-40), shared spaces, accounts (US-41), privacy (US-42)
/// and sign out (US-05). Only options that actually work are listed.
class ProfilePage extends StatefulWidget {
  const ProfilePage({super.key, this.api});

  final ProfileApiService? api;

  @override
  State<ProfilePage> createState() => _ProfilePageState();
}

class _ProfilePageState extends State<ProfilePage> {
  late final ProfileApiService _api = widget.api ?? ProfileApiService.instance;
  late Future<Profile> _profile = _api.getProfile();

  Future<void> _editName(Profile current) async {
    final ctrl = TextEditingController(text: current.fullName ?? '');
    final name = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Tu nombre'),
        content: TextField(
          key: const Key('profile-name'),
          controller: ctrl,
          autofocus: true,
          maxLength: 60,
          decoration:
              const InputDecoration(hintText: 'Cómo quieres que te llame Nina'),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancelar')),
          FilledButton(
              onPressed: () => Navigator.pop(ctx, ctrl.text.trim()),
              child: const Text('Guardar')),
        ],
      ),
    );
    if (name == null || name.isEmpty) return;
    try {
      final updated = await _api.updateName(name);
      setState(() {
        _profile = Future.value(updated);
      });
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('No pude guardar tu nombre.')));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: NinaColors.background,
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
          children: [
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 8),
              child: Text('Más',
                  style: TextStyle(
                      fontSize: 28,
                      fontWeight: FontWeight.w800,
                      color: NinaColors.textPrimary)),
            ),
            const SizedBox(height: 16),
            _header('PERFIL'),
            FutureBuilder<Profile>(
              future: _profile,
              builder: (context, snap) {
                final p = snap.data;
                return Column(children: [
                  ListTile(
                    key: const Key('more-name'),
                    leading: const Icon(Icons.person_outline),
                    title: Text(p?.fullName?.isNotEmpty == true
                        ? p!.fullName!
                        : 'Agrega tu nombre'),
                    subtitle: Text(p?.email ??
                        (snap.hasError ? 'No pude cargar tu perfil' : '')),
                    trailing: const Icon(Icons.edit_outlined, size: 18),
                    onTap: p == null ? null : () => _editName(p),
                  ),
                  const ListTile(
                    leading: Icon(Icons.payments_outlined),
                    title: Text('Moneda'),
                    subtitle:
                        Text('Soles (S/). Otras monedas llegarán pronto.'),
                  ),
                ]);
              },
            ),
            _header('TUS FINANZAS'),
            ListTile(
              key: const Key('more-spaces'),
              leading: const Icon(Icons.home_work_outlined,
                  color: NinaColors.accent),
              title: const Text('Espacios compartidos'),
              subtitle: const Text('Gastos comunes con tu pareja o familia'),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => context.push('/spaces'),
            ),
            ListTile(
              key: const Key('more-accounts'),
              leading: const Icon(Icons.account_balance_wallet_outlined),
              title: const Text('Cuentas'),
              subtitle: const Text('Banco, efectivo, tarjeta, billetera'),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => context.push('/accounts'),
            ),
            _header('PRIVACIDAD'),
            ListTile(
              key: const Key('more-privacy'),
              leading: const Icon(Icons.shield_outlined),
              title: const Text('Privacidad y permisos'),
              subtitle: const Text('Revisa o cambia lo que aceptaste'),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => context.push('/privacy'),
            ),
            const SizedBox(height: 24),
            ListTile(
              key: const Key('more-signout'),
              leading: const Icon(Icons.logout, color: NinaColors.error),
              title: const Text('Cerrar sesión',
                  style: TextStyle(
                      color: NinaColors.error, fontWeight: FontWeight.w600)),
              onTap: () {
                context.read<AuthBloc>().add(const AuthSignOutRequested());
                context.go('/login');
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget _header(String title) => Padding(
        padding: const EdgeInsets.fromLTRB(8, 16, 8, 4),
        child: Text(title,
            style: const TextStyle(
                fontSize: 11,
                color: NinaColors.textTertiary,
                fontWeight: FontWeight.w700,
                letterSpacing: 1)),
      );
}
