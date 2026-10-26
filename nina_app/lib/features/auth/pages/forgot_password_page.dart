import 'package:flutter/material.dart';
import '../../../core/theme/design_system.dart';
import '../../../shared/services/auth_service.dart';
import '../../../shared/widgets/nina_ui.dart';

/// 1.7 Recuperar contraseña: Supabase sends the reset link.
class ForgotPasswordPage extends StatefulWidget {
  const ForgotPasswordPage({super.key, this.auth});

  /// Injectable for tests.
  final AuthService? auth;

  @override
  State<ForgotPasswordPage> createState() => _ForgotPasswordPageState();
}

class _ForgotPasswordPageState extends State<ForgotPasswordPage> {
  late final AuthService _auth = widget.auth ?? AuthService.instance;
  final _emailCtrl = TextEditingController();
  bool _busy = false;
  bool _sent = false;
  String? _error;

  @override
  void dispose() {
    _emailCtrl.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final email = _emailCtrl.text.trim();
    if (!email.contains('@')) {
      setState(() => _error = 'Revisa tu correo.');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await _auth.sendPasswordReset(email);
      if (mounted) setState(() => _sent = true);
    } catch (_) {
      if (mounted) {
        setState(() => _error = 'No pude mandarlo. Inténtalo en un rato.');
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return NinaStepScaffold(
      header:
          const Align(alignment: Alignment.centerLeft, child: NinaBackButton()),
      content: [
        const NinaIconBox(
            icon: Icons.lock_outline,
            size: 72,
            radius: 24,
            background: NinaColors.accentSoft,
            foreground: NinaColors.accent),
        const SizedBox(height: 24),
        NinaHeading(
          title: _sent ? 'Listo, revisa tu correo' : '¿Se te olvidó? Tranqui.',
          subtitle: _sent
              ? 'Si hay una cuenta con ese correo, te llega un enlace para crear una contraseña nueva.'
              : 'Escribe tu correo y te mandamos un enlace para crear una nueva.',
          large: true,
        ),
        const SizedBox(height: 28),
        if (!_sent)
          NinaField(
            label: 'Correo',
            controller: _emailCtrl,
            hint: 'tu@correo.com',
            keyboardType: TextInputType.emailAddress,
            autofocus: true,
            errorText: _error,
            fieldKey: const Key('forgot-email'),
            onSubmitted: (_) => _send(),
          ),
      ],
      actions: [
        _sent
            ? NinaButton(
                label: 'Volver a iniciar sesión',
                onPressed: () => Navigator.of(context).maybePop())
            : NinaButton(
                key: const Key('forgot-submit'),
                label: 'Enviar enlace',
                loading: _busy,
                onPressed: _send),
      ],
    );
  }
}
