import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../bloc/auth_bloc.dart';
import '../bloc/auth_event.dart';
import '../../../core/theme/design_system.dart';
import '../../../shared/services/auth_service.dart';
import '../../../shared/widgets/nina_ui.dart';

/// 1.5 Verifica tu correo: 6-digit code from the sign-up email.
class VerifyEmailPage extends StatefulWidget {
  const VerifyEmailPage({super.key, required this.email, this.auth});

  final String email;

  /// Injectable for tests.
  final AuthService? auth;

  @override
  State<VerifyEmailPage> createState() => _VerifyEmailPageState();
}

class _VerifyEmailPageState extends State<VerifyEmailPage> {
  late final AuthService _auth = widget.auth ?? AuthService.instance;
  final _codeCtrl = TextEditingController();
  Timer? _timer;
  int _wait = 45;
  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _codeCtrl.addListener(() => setState(() {}));
    _startTimer();
  }

  void _startTimer() {
    _timer?.cancel();
    setState(() => _wait = 45);
    _timer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (!mounted) return t.cancel();
      setState(() => _wait--);
      if (_wait <= 0) t.cancel();
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    _codeCtrl.dispose();
    super.dispose();
  }

  Future<void> _verify() async {
    final code = _codeCtrl.text.trim();
    if (code.length != 6) {
      setState(() => _error = 'El código tiene 6 dígitos.');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await _auth.verifySignupCode(email: widget.email, code: code);
      if (!mounted) return;
      context.read<AuthBloc>().add(const AuthCheckRequested());
      context.go('/setup');
    } catch (_) {
      if (mounted) {
        setState(() {
          _busy = false;
          _error = 'Ese código no funcionó o ya venció. Pide otro.';
        });
      }
    }
  }

  Future<void> _resend() async {
    try {
      await _auth.resendSignupCode(widget.email);
      _startTimer();
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('Código reenviado.')));
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
            content: Text('No pude reenviarlo. Inténtalo en un rato.')));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final digits = _codeCtrl.text;
    return NinaStepScaffold(
      header: Align(
        alignment: Alignment.centerLeft,
        child: NinaBackButton(onTap: () => context.go('/signup')),
      ),
      content: [
        const NinaIconBox(
            icon: Icons.mail_outline,
            size: 72,
            radius: 24,
            background: NinaColors.peachSoft),
        const SizedBox(height: 24),
        NinaHeading(
          title: 'Revisa tu correo',
          subtitle:
              'Te mandamos un código de 6 dígitos a ${widget.email}. Si no llega, revisa spam (pasa en las mejores familias).',
          large: true,
        ),
        const SizedBox(height: 28),
        // The six boxes are a view over one hidden-styled text field.
        Stack(children: [
          Row(children: [
            for (var i = 0; i < 6; i++)
              Expanded(
                child: Container(
                  height: 60,
                  margin: EdgeInsets.only(right: i == 5 ? 0 : 10),
                  decoration: BoxDecoration(
                    color: NinaColors.surface,
                    borderRadius: BorderRadius.circular(NinaRadii.md),
                    border: Border.all(
                      color: i == digits.length
                          ? NinaColors.accent
                          : NinaColors.border,
                      width: i == digits.length ? 2 : 1,
                    ),
                  ),
                  alignment: Alignment.center,
                  child: Text(i < digits.length ? digits[i] : '',
                      style: NinaText.titleL()),
                ),
              ),
          ]),
          Positioned.fill(
            child: Opacity(
              opacity: 0,
              child: TextField(
                key: const Key('verify-code'),
                controller: _codeCtrl,
                autofocus: true,
                keyboardType: TextInputType.number,
                maxLength: 6,
                inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                onSubmitted: (_) => _verify(),
              ),
            ),
          ),
        ]),
        if (_error != null) ...[
          const SizedBox(height: 12),
          Text(_error!, style: NinaText.bodyS(color: NinaColors.error)),
        ],
        const SizedBox(height: 16),
        Row(children: [
          Text('¿No llegó?', style: NinaText.bodyS()),
          TextButton(
            key: const Key('verify-resend'),
            onPressed: _wait > 0 ? null : _resend,
            child: Text(_wait > 0
                ? 'Reenviar en 0:${_wait.toString().padLeft(2, '0')}'
                : 'Reenviar código'),
          ),
        ]),
      ],
      actions: [
        NinaButton(
          key: const Key('verify-submit'),
          label: 'Verificar',
          loading: _busy,
          onPressed: _verify,
        ),
      ],
    );
  }
}
