import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../bloc/auth_bloc.dart';
import '../bloc/auth_event.dart';
import '../bloc/auth_state.dart';
import '../../../core/theme/design_system.dart';
import '../../../shared/widgets/nina_ui.dart';

/// 1.4 Registro. After sign-up: the code screen if Supabase asks for email
/// confirmation, otherwise straight to "Primeros pasos".
class SignupPage extends StatefulWidget {
  const SignupPage({super.key});

  @override
  State<SignupPage> createState() => _SignupPageState();
}

class _SignupPageState extends State<SignupPage> {
  final _emailCtrl = TextEditingController();
  final _passwordCtrl = TextEditingController();
  bool _obscure = true;
  bool _accepted = false;
  String? _error;

  static const minPasswordLength = 8;

  @override
  void initState() {
    super.initState();
    _passwordCtrl.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _emailCtrl.dispose();
    _passwordCtrl.dispose();
    super.dispose();
  }

  /// 0–4 bars; length and character variety only (no server call).
  int get _strength {
    final p = _passwordCtrl.text;
    if (p.isEmpty) return 0;
    var s = p.length >= minPasswordLength ? 1 : 0;
    if (RegExp(r'[A-Z]').hasMatch(p) && RegExp(r'[a-z]').hasMatch(p)) s++;
    if (RegExp(r'\d').hasMatch(p)) s++;
    if (RegExp(r'[^A-Za-z0-9]').hasMatch(p) || p.length >= 14) s++;
    return s;
  }

  void _submit() {
    final email = _emailCtrl.text.trim();
    final password = _passwordCtrl.text;
    String? error;
    if (!email.contains('@') || !email.contains('.')) {
      error = 'Revisa tu correo.';
    } else if (password.length < minPasswordLength) {
      error = 'La contraseña necesita al menos $minPasswordLength caracteres.';
    } else if (!_accepted) {
      error = 'Acepta los Términos y la Política de privacidad para seguir.';
    }
    setState(() => _error = error);
    if (error != null) return;
    context
        .read<AuthBloc>()
        .add(AuthSignUpRequested(email: email, password: password));
  }

  @override
  Widget build(BuildContext context) {
    final strength = _strength;
    final strengthLabel =
        const ['', 'Débil', 'Regular', 'Buena', 'Fuerte'][strength];
    final strengthColor =
        strength >= 3 ? NinaColors.success : NinaColors.warning;
    return BlocListener<AuthBloc, AuthState>(
      listener: (context, state) {
        if (state is AuthAuthenticated) context.go('/setup');
        if (state is AuthNeedsEmailConfirmation) {
          context.go('/verify?email=${Uri.encodeComponent(state.email)}');
        }
        if (state is AuthError) {
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(
              content: Text(state.message), backgroundColor: NinaColors.error));
        }
      },
      child: NinaStepScaffold(
        header: Align(
          alignment: Alignment.centerLeft,
          child: NinaBackButton(onTap: () => context.go('/welcome')),
        ),
        content: [
          const NinaHeading(
            title: 'Crea tu cuenta',
            subtitle: 'Un minuto. Sin tarjeta. Sin letra chiquita.',
            large: true,
          ),
          const SizedBox(height: 28),
          NinaField(
            label: 'Correo',
            controller: _emailCtrl,
            hint: 'tu@correo.com',
            keyboardType: TextInputType.emailAddress,
            textInputAction: TextInputAction.next,
            fieldKey: const Key('signup-email'),
          ),
          const SizedBox(height: 16),
          NinaField(
            label: 'Contraseña',
            controller: _passwordCtrl,
            hint: 'Mínimo $minPasswordLength caracteres',
            obscureText: _obscure,
            fieldKey: const Key('signup-password'),
            suffix: IconButton(
              tooltip: _obscure ? 'Mostrar' : 'Ocultar',
              icon: Icon(
                  _obscure
                      ? Icons.visibility_outlined
                      : Icons.visibility_off_outlined,
                  color: NinaColors.textTertiary),
              onPressed: () => setState(() => _obscure = !_obscure),
            ),
          ),
          if (strength > 0) ...[
            const SizedBox(height: 10),
            Row(children: [
              for (var i = 0; i < 4; i++)
                Expanded(
                  child: Container(
                    height: 4,
                    margin: const EdgeInsets.only(right: 6),
                    decoration: BoxDecoration(
                      color: i < strength ? strengthColor : NinaColors.border,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
              const SizedBox(width: 4),
              Text(strengthLabel,
                  style: NinaText.bodySStrong(color: strengthColor)),
            ]),
          ],
          const SizedBox(height: 20),
          InkWell(
            key: const Key('signup-terms'),
            onTap: () => setState(() => _accepted = !_accepted),
            borderRadius: BorderRadius.circular(8),
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              AnimatedContainer(
                duration: const Duration(milliseconds: 150),
                width: 22,
                height: 22,
                decoration: BoxDecoration(
                  color: _accepted ? NinaColors.cocoa : NinaColors.surface,
                  borderRadius: BorderRadius.circular(7),
                  border: _accepted
                      ? null
                      : Border.all(color: NinaColors.borderStrong, width: 1.5),
                ),
                child: _accepted
                    ? const Icon(Icons.check_rounded,
                        size: 15, color: NinaColors.textInverse)
                    : null,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text('Acepto los Términos y la Política de privacidad.',
                    style: NinaText.bodyS()),
              ),
            ]),
          ),
          if (_error != null) ...[
            const SizedBox(height: 16),
            Text(_error!,
                key: const Key('signup-error'),
                style: NinaText.bodyS(color: NinaColors.error)),
          ],
        ],
        actions: [
          BlocBuilder<AuthBloc, AuthState>(
            builder: (context, state) => NinaButton(
              key: const Key('signup-submit'),
              label: 'Crear cuenta',
              loading: state is AuthLoading,
              onPressed: _submit,
            ),
          ),
          Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            Text('¿Ya tienes cuenta?', style: NinaText.bodyS()),
            TextButton(
              onPressed: () => context.go('/login'),
              child: const Text('Inicia sesión'),
            ),
          ]),
        ],
      ),
    );
  }
}
