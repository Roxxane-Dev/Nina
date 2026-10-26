import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../../core/theme/design_system.dart';
import '../../../shared/widgets/nina_ui.dart';

/// 1.0 Splash: brand moment, then welcome (first launch) or login.
class SplashPage extends StatefulWidget {
  const SplashPage({super.key});

  @override
  State<SplashPage> createState() => _SplashPageState();
}

class _SplashPageState extends State<SplashPage> {
  @override
  void initState() {
    super.initState();
    _checkRouting();
  }

  Future<void> _checkRouting() async {
    await Future.delayed(const Duration(milliseconds: 1400));
    if (!mounted) return;

    final prefs = await SharedPreferences.getInstance();
    final hasSeenOnboarding = prefs.getBool('has_seen_onboarding') ?? false;

    if (!mounted) return; // guard after every await
    context.go(hasSeenOnboarding ? '/login' : '/welcome');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(gradient: NinaColors.cocoaGradient),
        child: Stack(
          children: [
            Positioned(
              left: -40,
              right: -40,
              top: 140,
              child: Container(
                height: 380,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(colors: [
                    NinaColors.accent.withAlpha(90),
                    NinaColors.accent.withAlpha(0),
                  ]),
                ),
              ),
            ),
            Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const NinaMark(size: 88)
                      .animate()
                      .fade(duration: 400.ms)
                      .scale(begin: const Offset(0.85, 0.85)),
                  const SizedBox(height: 20),
                  Text('nina',
                          style:
                              NinaText.displayL(color: NinaColors.textInverse)
                                  .copyWith(fontSize: 44))
                      .animate()
                      .fade(delay: 150.ms, duration: 400.ms),
                  const SizedBox(height: 8),
                  Text('Tu plata, por fin clara.',
                          style: NinaText.bodyL(color: NinaColors.peach))
                      .animate()
                      .fade(delay: 300.ms, duration: 400.ms)
                      .slideY(begin: 0.4, end: 0),
                ],
              ),
            ),
            Positioned(
              left: 24,
              right: 24,
              bottom: 48,
              child: Text(
                'Nina no toca tu dinero. Solo lo entiende.',
                textAlign: TextAlign.center,
                style: NinaText.bodyS(
                    color: NinaColors.textInverse.withAlpha(150)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
