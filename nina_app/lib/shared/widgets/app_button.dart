import 'package:flutter/material.dart';
import '../../core/theme/design_system.dart';

class AppButton extends StatelessWidget {
  const AppButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.isLoading = false,
    this.variant = AppButtonVariant.primary,
    this.icon,
  });

  final String label;
  final VoidCallback? onPressed;
  final bool isLoading;
  final AppButtonVariant variant;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final isPrimary = variant == AppButtonVariant.primary;

    return SizedBox(
      width: double.infinity,
      height: 52,
      child: ElevatedButton(
        onPressed: isLoading ? null : onPressed,
        style: ElevatedButton.styleFrom(
          backgroundColor:
              isPrimary ? NinaColors.primary : NinaColors.surface,
          foregroundColor: NinaColors.textPrimary,
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(NinaRadii.button),
            side: isPrimary
                ? BorderSide.none
                : const BorderSide(color: NinaColors.border),
          ),
          disabledBackgroundColor: const Color(0x664C3AFF),
        ),
        child: isLoading
            ? const SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(
                  color: NinaColors.textPrimary,
                  strokeWidth: 2,
                ),
              )
            : Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  if (icon != null) ...[
                    Icon(icon, size: 18),
                    const SizedBox(width: 8),
                  ],
                  Text(
                    label,
                    style: const TextStyle(
                      fontWeight: FontWeight.w600,
                      fontSize: 15,
                    ),
                  ),
                ],
              ),
      ),
    );
  }
}

enum AppButtonVariant { primary, secondary }
