import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:share_plus/share_plus.dart';
import '../../core/theme/design_system.dart';
import '../../data/services/profile_api_service.dart';
import '../../shared/widgets/nina_ui.dart';
import '../auth/bloc/auth_bloc.dart';
import '../auth/bloc/auth_event.dart';
import 'consent_form.dart';

/// Más → Privacidad (US-42): current state of each consent; revoke any time.
class PrivacyPage extends StatefulWidget {
  const PrivacyPage({super.key, this.api, this.saveFile});

  final ProfileApiService? api;

  /// Hands the export to the user. Injectable for tests.
  final Future<void> Function(String name, String json)? saveFile;

  @override
  State<PrivacyPage> createState() => _PrivacyPageState();
}

class _PrivacyPageState extends State<PrivacyPage> {
  late final ProfileApiService _api = widget.api ?? ProfileApiService.instance;
  late Future<ConsentState> _future = _api.getConsents();
  bool _exporting = false;

  /// SEC-04. The file only leaves the app if the user chooses where to put it.
  static Future<void> _shareFile(String name, String json) async {
    await SharePlus.instance.share(ShareParams(
      files: [
        XFile.fromData(utf8.encode(json),
            mimeType: 'application/json', name: name)
      ],
      fileNameOverrides: [name],
    ));
  }

  Future<void> _export() async {
    setState(() => _exporting = true);
    try {
      final data = await _api.exportData();
      final day = DateTime.now().toIso8601String().substring(0, 10);
      final save = widget.saveFile ?? _shareFile;
      await save('nina-mis-datos-$day.json',
          const JsonEncoder.withIndent('  ').convert(data));
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
            content: Text('No pude exportar tus datos. Inténtalo de nuevo.')));
      }
    } finally {
      if (mounted) setState(() => _exporting = false);
    }
  }

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
              const SizedBox(height: 28),
              Text('Tus datos', style: NinaText.titleL()),
              const SizedBox(height: 6),
              Text(
                  'Descarga en un archivo lo que Nina guarda de ti: movimientos, metas, cuentas, conversaciones y permisos.',
                  style: NinaText.bodyM()),
              const SizedBox(height: 12),
              NinaButton(
                key: const Key('privacy-export'),
                label: _exporting ? 'Preparando…' : 'Exportar mis datos',
                variant: NinaButtonVariant.secondary,
                onPressed: _exporting ? null : _export,
              ),
            ],
          );
        },
      ),
    );
  }
}
