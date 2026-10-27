import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../auth/bloc/auth_bloc.dart';
import '../../auth/bloc/auth_event.dart';
import '../../../core/constants/app_constants.dart';
import '../../../core/theme/design_system.dart';
import '../../../data/services/profile_api_service.dart';
import '../../../shared/widgets/nina_ui.dart';

/// Perfil: profile (US-40), shared spaces, accounts (US-41), privacy (US-42)
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
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(
              NinaSpace.gutter, 16, NinaSpace.gutter, 32),
          children: [
            Row(children: [
              // Opened from a link there is nothing to pop: go to Inicio instead.
              NinaBackButton(
                  onTap: () => Navigator.of(context).canPop()
                      ? context.pop()
                      : context.go('/home')),
              const SizedBox(width: 12),
              Text('Perfil', style: NinaText.displayL()),
            ]),
            const SizedBox(height: 20),
            FutureBuilder<Profile>(
              future: _profile,
              builder: (context, snap) {
                final p = snap.data;
                final hasName = p?.fullName?.isNotEmpty == true;
                return NinaCard(
                  key: const Key('more-name'),
                  onTap: p == null ? null : () => _editName(p),
                  child: Row(children: [
                    NinaPersonAvatar(
                        name: hasName ? p!.fullName! : '?', size: 56),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(hasName ? p!.fullName! : 'Agrega tu nombre',
                                style: NinaText.titleL()),
                            Text(
                                p?.email ??
                                    (snap.hasError
                                        ? 'No pude cargar tu perfil'
                                        : ''),
                                style: NinaText.bodyS()),
                          ]),
                    ),
                    const Icon(Icons.edit_outlined,
                        size: 18, color: NinaColors.textTertiary),
                  ]),
                );
              },
            ),
            if (AppConstants.pricingPreview) ...[
              const SizedBox(height: 12),
              NinaCard(
                color: NinaColors.peachSoft,
                border: false,
                shadow: false,
                onTap: () => context.push('/pricing'),
                child: Row(children: [
                  const NinaMark(size: 36),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Nina Gratis', style: NinaText.bodyMStrong()),
                          Text('Conoce Nina Plus', style: NinaText.bodyS()),
                        ]),
                  ),
                  const Icon(Icons.chevron_right_rounded),
                ]),
              ),
            ],
            const SizedBox(height: 24),
            _header('TUS FINANZAS'),
            NinaCard(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: Column(children: [
                const _Row(
                  icon: Icons.payments_outlined,
                  title: 'Moneda',
                  subtitle: 'Soles (S/). Otras monedas llegarán pronto.',
                ),
                const Divider(height: 1, indent: 68),
                _Row(
                  key: const Key('more-spaces'),
                  icon: Icons.group_outlined,
                  title: 'Espacios compartidos',
                  subtitle: 'Gastos comunes con tu pareja o familia',
                  onTap: () => context.push('/spaces'),
                ),
                const Divider(height: 1, indent: 68),
                _Row(
                  key: const Key('more-accounts'),
                  icon: Icons.account_balance_wallet_outlined,
                  title: 'Cuentas',
                  subtitle: 'Banco, efectivo, tarjeta, billetera',
                  onTap: () => context.push('/accounts'),
                ),
              ]),
            ),
            const SizedBox(height: 24),
            _header('PRIVACIDAD'),
            NinaCard(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: _Row(
                key: const Key('more-privacy'),
                icon: Icons.verified_user_outlined,
                title: 'Privacidad y permisos',
                subtitle: 'Revisa o cambia lo que aceptaste',
                onTap: () => context.push('/privacy'),
              ),
            ),
            const SizedBox(height: 24),
            NinaButton(
              key: const Key('more-signout'),
              label: 'Cerrar sesión',
              icon: Icons.logout,
              variant: NinaButtonVariant.secondary,
              onPressed: () {
                context.read<AuthBloc>().add(const AuthSignOutRequested());
                context.go('/login');
              },
            ),
            const SizedBox(height: 24),
            Text(
              'Nina no es un banco ni una billetera, y nunca mueve tu dinero.',
              textAlign: TextAlign.center,
              style: NinaText.bodyS(color: NinaColors.textTertiary),
            ),
          ],
        ),
      ),
    );
  }

  Widget _header(String title) => Padding(
        padding: const EdgeInsets.fromLTRB(4, 0, 4, 8),
        child: Text(title, style: NinaText.caps()),
      );
}

class _Row extends StatelessWidget {
  const _Row(
      {super.key,
      required this.icon,
      required this.title,
      required this.subtitle,
      this.onTap});
  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => ListTile(
        onTap: onTap,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16),
        leading: NinaIconBox(icon: icon, size: 40),
        title: Text(title, style: NinaText.bodyMStrong()),
        subtitle: Text(subtitle, style: NinaText.bodyS()),
        trailing: onTap == null
            ? null
            : const Icon(Icons.chevron_right_rounded,
                color: NinaColors.textTertiary),
      );
}
