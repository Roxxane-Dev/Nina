import 'dart:ui';
import 'package:flutter/material.dart';
import '../../core/theme/design_system.dart';

/// Glassmorphism card used across Nina screens.
class NinaGlassCard extends StatelessWidget {
  const NinaGlassCard({
    super.key,
    required this.child,
    this.accentColor,
  });

  final Widget child;
  final Color? accentColor;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(20),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: NinaColors.surface.withAlpha(200),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(
              color: accentColor?.withAlpha(60) ?? Colors.white.withAlpha(20),
            ),
          ),
          child: child,
        ),
      ),
    );
  }
}
