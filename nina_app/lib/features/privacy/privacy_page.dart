import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme/design_system.dart';
import '../../data/services/profile_api_service.dart';
import '../auth/bloc/auth_bloc.dart';
import '../auth/bloc/auth_event.dart';
import 'consent_form.dart';

/// Más → Privacidad (US-42): current state of each consent; revoke any time.
class PrivacyPage extends StatefulWidget {
  const PrivacyPage({super.key, this.api});

  final ProfileApiService? api;

  @override
  State<PrivacyPage> createState() => _PrivacyPageState();
}

class _PrivacyPageState extends State<PrivacyPage> {
  late final ProfileApiService _api = widget.api ?? ProfileApiService.instance;
  late Future<ConsentState> _future = _api.getConsents();

  Future<void> _save(
      {required bool dataProcessing,
      required bool aiProcessing,
      required bool analytics}) async {
    if (!dataProcessing) {
      final ok = await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('Revocar el procesamiento de datos'),
          content: const Text(
              'Sin este permiso no puedes usar Nina. Se cerrará tu sesión y te lo volveremos a pedir al entrar.'),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(ctx, false),
                child: const Text('Cancelar')),
            FilledButton(
                onPressed: () => Navigator.pop(ctx, true),
                child: const Text('Revocar')),
          ],
        ),
      );
      if (ok != true) return;
    }
    try {
      final saved = await _api.saveConsents(
        dataProcessing: dataProcessing,
        aiProcessing: aiProcessing,
        analytics: analytics,
      );
      if (!mounted) return;
      if (!saved.dataProcessing) {
        context.read<AuthBloc>().add(const AuthSignOutRequested());
        context.go('/login');
        return;
      }
      setState(() {
        _future = Future.value(saved);
      });
      ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Preferencias guardadas.')));
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
            content: Text('No pude guardar. Inténtalo de nuevo.')));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: NinaColors.background,
      appBar: AppBar(
          title: const Text('Privacidad'),
          backgroundColor: NinaColors.background),
      body: FutureBuilder<ConsentState>(
        future: _future,
        builder: (context, snap) {
          if (snap.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snap.hasError) {
            return const Center(
              child: Text('No pude cargar tus preferencias.',
                  style: TextStyle(color: NinaColors.textSecondary)),
            );
          }
          if (!snap.data!.available) {
            return const Padding(
              padding: EdgeInsets.all(24),
              child: Text(
                'La configuración de permisos se está activando. Por ahora Nina no envía tus datos a modelos de IA.',
                style: TextStyle(color: NinaColors.textSecondary, height: 1.4),
              ),
            );
          }
          return ListView(
            padding: const EdgeInsets.all(20),
            children: [
              ConsentForm(
                key: ValueKey(snap.data),
                initial: snap.data!,
                submitLabel: 'Guardar cambios',
                requireData: false,
                onSubmit: _save,
              ),
            ],
          );
        },
      ),
    );
  }
}
