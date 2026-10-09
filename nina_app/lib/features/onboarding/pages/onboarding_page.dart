import 'dart:async';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../../core/theme/design_system.dart';

class OnboardingPage extends StatefulWidget {
  const OnboardingPage({super.key});

  @override
  State<OnboardingPage> createState() => _OnboardingPageState();
}

enum StepType { intro, options, finalStep }

class _OnboardingPageState extends State<OnboardingPage> {
  StepType currentStep = StepType.intro;

  List<_Message> messages = [];
  bool showTyping = false;
  bool showOptions = false;

  @override
  void initState() {
    super.initState();
    _startFlow();
  }

  // =============================
  // 🎬 FLOW
  // =============================

  void _startFlow() async {
    await _addBot("Hola, soy Nina 👀");
    await _addBot("Voy a ayudarte a entender tu dinero de verdad.");

    await Future.delayed(const Duration(milliseconds: 400));

    await _addBot("¿Qué gastaste hoy?");

    setState(() {
      currentStep = StepType.options;
      showOptions = true;
    });
  }

  void _selectOption(String option) async {
    setState(() {
      messages.add(_Message(option, false));
      showOptions = false;
    });

    await _thinking();

    // 🧠 AI feeling
    if (option.contains("Netflix")) {
      await _addBot("Detecto una suscripción 📺");
      await _addBot("Este tipo de gasto suele acumularse rápido...");
      await _addBot("Estás gastando 30% más en entretenimiento 👀");
    } else if (option.contains("café")) {
      await _addBot("Pequeños gastos diarios ☕");
      await _addBot("Pero se acumulan más de lo que parece...");
      await _addBot("Podrías ahorrar ~S/120 al mes aquí 👀");
    } else {
      await _addBot("Gasto de transporte 🚗");
      await _addBot("Este es uno de tus gastos más frecuentes...");
      await _addBot("Podemos optimizarlo juntos ⚡");
    }

    await Future.delayed(const Duration(milliseconds: 600));

    await _addBot("No soy una app de gastos.");
    await _addBot("Soy tu copiloto financiero 🚀");

    setState(() {
      currentStep = StepType.finalStep;
    });
  }

  Future<void> _thinking() async {
    setState(() => showTyping = true);
    await Future.delayed(const Duration(milliseconds: 900));
    setState(() => showTyping = false);
  }

  Future<void> _addBot(String text) async {
    setState(() => showTyping = true);

    await Future.delayed(const Duration(milliseconds: 600));

    setState(() {
      showTyping = false;
      messages.add(_Message(text, true));
    });
  }

  Future<void> _finish() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('has_seen_onboarding', true);

    if (mounted) {
      context.go('/login');
    }
  }

  // =============================
  // 🎨 UI
  // =============================

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            colors: [
              NinaColors.background,
              NinaColors.surface,
            ],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
        ),
        child: SafeArea(
          child: Column(
            children: [
              _buildHeader(),
              Expanded(child: _buildChat()),
              _buildOptions(),
              _buildBottom(),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Row(
        children: [
          const Text(
            "Nina",
            style: TextStyle(
              color: NinaColors.textPrimary,
              fontSize: 20,
              fontWeight: FontWeight.w700,
            ),
          ),
          const Spacer(),
          TextButton(
            onPressed: _finish,
            child: const Text(
              "Saltar",
              style: TextStyle(color: NinaColors.textSecondary),
            ),
          )
        ],
      ),
    );
  }

  Widget _buildChat() {
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: messages.length + (showTyping ? 1 : 0),
      itemBuilder: (context, index) {
        if (index == messages.length && showTyping) {
          return _typingBubble();
        }

        final msg = messages[index];
        return _chatBubble(msg);
      },
    );
  }

  Widget _chatBubble(_Message msg) {
    final isBot = msg.isBot;

    return Align(
      alignment: isBot ? Alignment.centerLeft : Alignment.centerRight,
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 6),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        constraints: const BoxConstraints(maxWidth: 260),
        decoration: BoxDecoration(
          color: isBot ? NinaColors.ninaBubble : NinaColors.userBubble,
          borderRadius: BorderRadius.circular(NinaRadii.bubble),
        ),
        child: Text(
          msg.text,
          style: TextStyle(
            color: isBot ? NinaColors.textPrimary : Colors.white,
            fontSize: 15,
          ),
        ),
      ),
    );
  }

  Widget _typingBubble() {
    return Align(
      alignment: Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 6),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: NinaColors.ninaBubble,
          borderRadius: BorderRadius.circular(NinaRadii.bubble),
        ),
        child: const Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            _Dot(),
            _Dot(),
            _Dot(),
          ],
        ),
      ),
    );
  }

  Widget _buildOptions() {
    if (!showOptions) return const SizedBox();

    final options = [
      "S/140 en Netflix",
      "S/25 en café",
      "S/60 en transporte",
    ];

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Wrap(
        spacing: 8,
        runSpacing: 8,
        children: options.map((e) {
          return GestureDetector(
            onTap: () => _selectOption(e),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: BoxDecoration(
                color: NinaColors.surfaceAlt,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: NinaColors.primary),
              ),
              child: Text(
                e,
                style: const TextStyle(color: NinaColors.textPrimary),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _buildBottom() {
    if (currentStep != StepType.finalStep) {
      return const SizedBox(height: 16);
    }

    return Padding(
      padding: const EdgeInsets.all(16),
      child: ElevatedButton(
        onPressed: _finish,
        child: const Text("Entrar a Nina"),
      ),
    );
  }
}

// =============================
// 💬 MODELO
// =============================

class _Message {
  final String text;
  final bool isBot;

  _Message(this.text, this.isBot);
}

// =============================
// ✨ TYPING DOTS
// =============================

class _Dot extends StatefulWidget {
  const _Dot();

  @override
  State<_Dot> createState() => _DotState();
}

class _DotState extends State<_Dot>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller =
        AnimationController(vsync: this, duration: const Duration(milliseconds: 800))
          ..repeat();
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: Tween(begin: 0.2, end: 1.0).animate(_controller),
      child: const Padding(
        padding: EdgeInsets.symmetric(horizontal: 2),
        child: CircleAvatar(
          radius: 3,
          backgroundColor: NinaColors.textSecondary,
        ),
      ),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }
}