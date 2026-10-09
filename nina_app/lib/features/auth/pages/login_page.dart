import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../bloc/auth_bloc.dart';
import '../bloc/auth_event.dart';
import '../bloc/auth_state.dart';
import '../../../core/theme/design_system.dart';

class LoginPage extends StatefulWidget {
  const LoginPage({super.key});

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final _emailCtrl = TextEditingController();
  final _passwordCtrl = TextEditingController();

  bool _obscure = true;
  bool _isSignUp = false;

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

    final bloc = context.read<AuthBloc>();

    if (_isSignUp) {
      bloc.add(AuthSignUpRequested(email: email, password: password));
    } else {
      bloc.add(AuthSignInRequested(email: email, password: password));
    }
  }

  @override
  Widget build(BuildContext context) {
    return BlocListener<AuthBloc, AuthState>(
      listener: (context, state) {
        if (state is AuthAuthenticated) {
          context.go('/chat');
        }

        if (state is AuthError) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(state.message),
              backgroundColor: NinaColors.error,
              behavior: SnackBarBehavior.floating,
            ),
          );
        }
      },
      child: Scaffold(
        backgroundColor: NinaColors.background,
        body: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 24),
              child: Column(
                children: [
                  _buildHeader(),
                  const SizedBox(height: 40),
                  _buildForm(),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  // =============================
  // 🧠 HEADER (AI FEELING)
  // =============================

  Widget _buildHeader() {
    return Column(
      children: [
        Container(
          width: 72,
          height: 72,
          decoration: const BoxDecoration(
            shape: BoxShape.circle,
            gradient: NinaColors.ninaAura,
          ),
        ),
        const SizedBox(height: 24),
        Text(
          _isSignUp ? "Empieza con Nina" : "Bienvenido de nuevo",
          style: Theme.of(context).textTheme.titleLarge,
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 8),
        Text(
          "Tu copiloto financiero inteligente",
          style: Theme.of(context).textTheme.bodyMedium,
          textAlign: TextAlign.center,
        ),
      ],
    );
  }

  // =============================
  // 🧾 FORM
  // =============================

  Widget _buildForm() {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: NinaColors.surface,
        borderRadius: BorderRadius.circular(NinaRadii.card),
        border: Border.all(color: NinaColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _buildTextField(
            controller: _emailCtrl,
            label: 'Correo electrónico',
            keyboardType: TextInputType.emailAddress,
          ),
          const SizedBox(height: 16),
          _buildTextField(
            controller: _passwordCtrl,
            label: 'Contraseña',
            obscureText: _obscure,
            suffixIcon: IconButton(
              icon: Icon(
                _obscure
                    ? Icons.visibility_outlined
                    : Icons.visibility_off_outlined,
                color: NinaColors.textTertiary,
              ),
              onPressed: () => setState(() => _obscure = !_obscure),
            ),
            onSubmitted: (_) => _submit(),
          ),
          const SizedBox(height: 32),

          // 🔘 BUTTON
          BlocBuilder<AuthBloc, AuthState>(
            builder: (context, state) {
              final isLoading = state is AuthLoading;

              return SizedBox(
                height: 56,
                child: ElevatedButton(
                  onPressed: isLoading ? null : _submit,
                  child: isLoading
                      ? const SizedBox(
                          width: 22,
                          height: 22,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : Text(_isSignUp ? "Crear cuenta" : "Ingresar"),
                ),
              );
            },
          ),

          const SizedBox(height: 16),

          // 🔁 SWITCH
          TextButton(
            onPressed: () => setState(() => _isSignUp = !_isSignUp),
            child: Text(
              _isSignUp
                  ? "Ya tengo cuenta →"
                  : "Crear cuenta →",
              style: const TextStyle(color: NinaColors.accent),
            ),
          ),
        ],
      ),
    );
  }

  // =============================
  // ✍️ INPUT
  // =============================

  Widget _buildTextField({
    required TextEditingController controller,
    required String label,
    bool obscureText = false,
    TextInputType? keyboardType,
    Widget? suffixIcon,
    Function(String)? onSubmitted,
  }) {
    return TextFormField(
      controller: controller,
      obscureText: obscureText,
      keyboardType: keyboardType,
      style: const TextStyle(color: NinaColors.textPrimary),
      decoration: InputDecoration(
        labelText: label,
        labelStyle: const TextStyle(color: NinaColors.textSecondary),
        filled: true,
        fillColor: NinaColors.surfaceAlt,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(NinaRadii.input),
          borderSide: const BorderSide(color: NinaColors.border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(NinaRadii.input),
          borderSide: const BorderSide(
            color: NinaColors.primary,
            width: 1.5,
          ),
        ),
        suffixIcon: suffixIcon,
      ),
      onFieldSubmitted: onSubmitted,
    );
  }
}