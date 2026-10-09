import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../../core/theme/design_system.dart';

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
    await Future.delayed(const Duration(milliseconds: 1500));
    if (!mounted) return;

    final prefs = await SharedPreferences.getInstance();
    final hasSeenOnboarding = prefs.getBool('has_seen_onboarding') ?? false;

    if (!mounted) return; // guard after every await
    if (hasSeenOnboarding) {
      context.go('/login');
    } else {
      context.go('/onboarding');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: NinaColors.background,
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              'N',
              style: Theme.of(context).textTheme.displayLarge?.copyWith(
                color: NinaColors.primary,
                fontWeight: FontWeight.w800,
                fontSize: 64,
              ),
            ).animate().fade(duration: 400.ms).scale(begin: const Offset(0.8, 0.8)),
            const SizedBox(height: 16),
            Text(
              'Tu dinero. Con actitud.',
              style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                color: NinaColors.textSecondary,
                letterSpacing: 0.5,
              ),
            ).animate().fade(delay: 300.ms, duration: 400.ms).slideY(begin: 0.5, end: 0),
          ],
        ),
      ),
    );
  }
}
