import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../bloc/auth_bloc.dart';
import '../bloc/auth_event.dart';
import '../bloc/auth_state.dart';
import '../../../core/network/config_check.dart';
import '../../../core/theme/design_system.dart';
import '../../../shared/widgets/nina_ui.dart';

/// 1.6 Iniciar sesión (email + password, Supabase Auth).
class LoginPage extends StatefulWidget {
  const LoginPage({super.key});

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final _emailCtrl = TextEditingController();
  final _passwordCtrl = TextEditingController();
  bool _obscure = true;

  /// Set when the app was started against a different Supabase project than the backend uses.
  String? _configProblem;

  @override
  void initState() {
    super.initState();
    configMismatchMessage().then((message) {
      if (mounted && message != null) setState(() => _configProblem = message);
    });
  }

  @override
  void dispose() {
    _emailCtrl.dispose();
    _passwordCtrl.dispose();
    super.dispose();
  }

  void _submit() {
    final email = _emailCtrl.text.trim();
    final password = _passwordCtrl.text;
    if (email.isEmpty || password.isEmpty) return;
    context
        .read<AuthBloc>()
        .add(AuthSignInRequested(email: email, password: password));
  }

  @override
  Widget build(BuildContext context) {
    return BlocListener<AuthBloc, AuthState>(
      listener: (context, state) {
        if (state is AuthAuthenticated) context.go('/home');
        if (state is AuthError) {
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Text(state.message),
            backgroundColor: NinaColors.error,
          ));
        }
      },
      child: Scaffold(
        body: SafeArea(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(
                NinaSpace.gutter, 40, NinaSpace.gutter, 24),
            children: [
              const Align(
                  alignment: Alignment.centerLeft, child: NinaWordmark()),
              const SizedBox(height: 24),
              const NinaHeading(
                title: 'Hola de nuevo',
                subtitle: 'Tus números te extrañaron. Bueno, más o menos.',
                large: true,
              ),
              if (_configProblem != null) ...[
                const SizedBox(height: 16),
                Container(
                  key: const Key('config-mismatch-banner'),
                  child: NinaNote(
                      icon: Icons.error_outline,
                      text: _configProblem!,
                      tone: NinaTone.negative),
                ),
              ],
              const SizedBox(height: 28),
              NinaField(
                label: 'Correo',
                controller: _emailCtrl,
                hint: 'tu@correo.com',
                keyboardType: TextInputType.emailAddress,
                textInputAction: TextInputAction.next,
                fieldKey: const Key('login-email'),
              ),
              const SizedBox(height: 16),
              NinaField(
                label: 'Contraseña',
                controller: _passwordCtrl,
                obscureText: _obscure,
                fieldKey: const Key('login-password'),
                onSubmitted: (_) => _submit(),
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
              Align(
                alignment: Alignment.centerRight,
                child: TextButton(
                  key: const Key('login-forgot'),
                  onPressed: () => context.push('/forgot'),
                  child: const Text('¿Olvidaste tu contraseña?'),
                ),
              ),
              const SizedBox(height: 8),
              BlocBuilder<AuthBloc, AuthState>(
                builder: (context, state) => NinaButton(
                  key: const Key('login-submit'),
                  label: 'Iniciar sesión',
                  loading: state is AuthLoading,
                  onPressed: _submit,
                ),
              ),
              const SizedBox(height: 20),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text('¿Nueva en Nina?', style: NinaText.bodyS()),
                  TextButton(
                    key: const Key('login-to-signup'),
                    onPressed: () => context.go('/signup'),
                    child: const Text('Crea tu cuenta'),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
