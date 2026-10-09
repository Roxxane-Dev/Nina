import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../auth/bloc/auth_bloc.dart';
import '../../auth/bloc/auth_event.dart';
import '../../../core/theme/design_system.dart';

class ProfilePage extends StatelessWidget {
  const ProfilePage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: NinaColors.background,
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
          children: [
            Text(
              'Perfil',
              style: Theme.of(context).textTheme.displaySmall?.copyWith(
                fontWeight: FontWeight.w800,
                color: NinaColors.textPrimary,
              ),
            ),
            const SizedBox(height: 48),
            
            _buildSectionHeader(context, 'CUENTA'),
            _buildListTile(context, 'Tu plan', 'Gratis'),
            _buildListTile(context, 'Datos personales', ''),
            const SizedBox(height: 32),
            
            _buildSectionHeader(context, 'PREFERENCIAS'),
            _buildListTile(context, 'Notificaciones', 'Activadas'),
            _buildListTile(context, 'Voz de Nina', 'Directa'),
            const SizedBox(height: 48),
            
            ListTile(
              contentPadding: EdgeInsets.zero,
              title: Text(
                'Cerrar sesión',
                style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                  color: NinaColors.error,
                  fontWeight: FontWeight.w600,
                ),
              ),
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

  Widget _buildSectionHeader(BuildContext context, String title) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Text(
        title,
        style: Theme.of(context).textTheme.labelSmall?.copyWith(
          color: NinaColors.textTertiary,
          fontWeight: FontWeight.w700,
          letterSpacing: 1.0,
        ),
      ),
    );
  }

  Widget _buildListTile(BuildContext context, String title, String trailing) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 24),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            title,
            style: Theme.of(context).textTheme.bodyLarge?.copyWith(
              color: NinaColors.textPrimary,
              fontWeight: FontWeight.w500,
            ),
          ),
          if (trailing.isNotEmpty)
            Text(
              trailing,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: NinaColors.textSecondary,
              ),
            ),
        ],
      ),
    );
  }
}
