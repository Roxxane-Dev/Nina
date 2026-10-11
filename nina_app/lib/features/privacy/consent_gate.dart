import 'package:flutter/material.dart';
import '../../core/theme/design_system.dart';
import '../../data/services/profile_api_service.dart';
import 'consent_form.dart';

/// Shows the consent screen (US-03) until the user answers the current policy
/// and grants the required data consent; then shows [child].
class ConsentGate extends StatefulWidget {
  const ConsentGate({super.key, required this.child, this.api});

  final Widget child;
  final ProfileApiService? api;

  @override
  State<ConsentGate> createState() => _ConsentGateState();
}

class _ConsentGateState extends State<ConsentGate> {
  late final ProfileApiService _api = widget.api ?? ProfileApiService.instance;
  late Future<ConsentState> _future = _api.getConsents();
  ConsentState? _granted;

  @override
  Widget build(BuildContext context) {
    if (_granted?.canUseApp == true) return widget.child;
    return FutureBuilder<ConsentState>(
      future: _future,
      builder: (context, snap) {
        if (snap.connectionState == ConnectionState.waiting) {
          return const Scaffold(
            backgroundColor: NinaColors.background,
            body: Center(child: CircularProgressIndicator()),
          );
        }
        if (snap.hasError) {
          return Scaffold(
            backgroundColor: NinaColors.background,
            body: Center(
              child: Column(mainAxisSize: MainAxisSize.min, children: [
                const Text('No pude cargar tu configuración de privacidad.',
                    style: TextStyle(color: NinaColors.textSecondary)),
                const SizedBox(height: 12),
                OutlinedButton(
                  onPressed: () => setState(() {
                    _future = _api.getConsents();
                  }),
                  child: const Text('Reintentar'),
                ),
              ]),
            ),
          );
        }
        final state = snap.data!;
        if (state.canUseApp) return widget.child;
        return Scaffold(
          key: const Key('consent-screen'),
          backgroundColor: NinaColors.background,
          body: SafeArea(
            child: ListView(
              padding: const EdgeInsets.all(20),
              children: [
                const Text('Antes de empezar',
                    style: TextStyle(
                        fontSize: 26,
                        fontWeight: FontWeight.w800,
                        color: NinaColors.textPrimary)),
                const SizedBox(height: 8),
                const Text(
                  'Elige qué permites. Puedes cambiarlo cuando quieras en Más → Privacidad.',
                  style:
                      TextStyle(color: NinaColors.textSecondary, height: 1.4),
                ),
                const SizedBox(height: 20),
                ConsentForm(
                  // Optional consents never come pre-selected the first time.
                  initial: state.answered
                      ? state
                      : const ConsentState(
                          answered: false,
                          dataProcessing: false,
                          aiProcessing: false,
                          analytics: false),
                  submitLabel: 'Continuar',
                  onSubmit: (
                      {required dataProcessing,
                      required aiProcessing,
                      required analytics}) async {
                    final saved = await _api.saveConsents(
                      dataProcessing: dataProcessing,
                      aiProcessing: aiProcessing,
                      analytics: analytics,
                    );
                    if (mounted) setState(() => _granted = saved);
                  },
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}
