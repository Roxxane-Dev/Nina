import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'design_system.dart';

class AppTheme {
  AppTheme._();

  static final ThemeData light = ThemeData(
    useMaterial3: true,
    brightness: Brightness.light,
    scaffoldBackgroundColor: NinaColors.background,
    canvasColor: NinaColors.surface,
    splashFactory: InkSparkle.splashFactory,
    colorScheme: const ColorScheme.light(
      primary: NinaColors.primary,
      secondary: NinaColors.accent,
      surface: NinaColors.surface,
      error: NinaColors.error,
      onPrimary: NinaColors.textInverse,
      onSecondary: NinaColors.textInverse,
      onSurface: NinaColors.textPrimary,
      onError: NinaColors.textInverse,
      outline: NinaColors.border,
    ),
    textTheme: GoogleFonts.interTextTheme().copyWith(
      displayLarge: NinaText.displayL(),
      titleLarge: NinaText.displayM(),
      headlineSmall: NinaText.titleL(),
      titleMedium: GoogleFonts.inter(
          fontSize: 16,
          fontWeight: FontWeight.w500,
          color: NinaColors.textPrimary),
      titleSmall: GoogleFonts.inter(
          fontSize: 14,
          fontWeight: FontWeight.w500,
          color: NinaColors.textPrimary),
      bodyLarge: GoogleFonts.inter(fontSize: 16, color: NinaColors.textPrimary),
      bodyMedium: NinaText.bodyM(),
      bodySmall: NinaText.bodyS(),
      labelMedium: NinaText.bodyS(color: NinaColors.textTertiary),
    ),
    cardTheme: CardThemeData(
      color: NinaColors.surface,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(NinaRadii.card),
        side: const BorderSide(color: NinaColors.border),
      ),
    ),
    appBarTheme: AppBarTheme(
      backgroundColor: NinaColors.background,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      iconTheme: const IconThemeData(color: NinaColors.textPrimary),
      titleTextStyle: NinaText.titleM(),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: NinaColors.primary,
        foregroundColor: NinaColors.textInverse,
        elevation: 0,
        minimumSize: const Size(double.infinity, 56),
        shape: const StadiumBorder(),
        textStyle: NinaText.button(),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: NinaColors.primary,
        foregroundColor: NinaColors.textInverse,
        minimumSize: const Size(64, 52),
        shape: const StadiumBorder(),
        textStyle: NinaText.button(),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: NinaColors.textPrimary,
        backgroundColor: NinaColors.surface,
        minimumSize: const Size(64, 52),
        side: const BorderSide(color: NinaColors.border),
        shape: const StadiumBorder(),
        textStyle: NinaText.button(color: NinaColors.textPrimary),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        foregroundColor: NinaColors.accent,
        textStyle: NinaText.bodySStrong(color: NinaColors.accent),
      ),
    ),
    segmentedButtonTheme: SegmentedButtonThemeData(
      style: ButtonStyle(
        backgroundColor: WidgetStateProperty.resolveWith((s) =>
            s.contains(WidgetState.selected)
                ? NinaColors.surface
                : NinaColors.surfaceAlt),
        foregroundColor: WidgetStateProperty.all(NinaColors.textPrimary),
        side:
            WidgetStateProperty.all(const BorderSide(color: NinaColors.border)),
      ),
    ),
    chipTheme: ChipThemeData(
      backgroundColor: NinaColors.surface,
      selectedColor: NinaColors.cocoa,
      side: const BorderSide(color: NinaColors.border),
      shape: const StadiumBorder(),
      labelStyle: NinaText.bodySStrong(),
      secondaryLabelStyle: NinaText.bodySStrong(color: NinaColors.textInverse),
      checkmarkColor: NinaColors.textInverse,
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: NinaColors.surface,
      hintStyle: NinaText.bodyL(color: NinaColors.textTertiary),
      labelStyle: NinaText.bodyS(),
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(NinaRadii.input),
        borderSide: const BorderSide(color: NinaColors.border),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(NinaRadii.input),
        borderSide: const BorderSide(color: NinaColors.border),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(NinaRadii.input),
        borderSide: const BorderSide(color: NinaColors.accent, width: 2),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(NinaRadii.input),
        borderSide: const BorderSide(color: NinaColors.error, width: 2),
      ),
    ),
    bottomSheetTheme: const BottomSheetThemeData(
      backgroundColor: NinaColors.background,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(
          borderRadius:
              BorderRadius.vertical(top: Radius.circular(NinaRadii.xl))),
      showDragHandle: true,
      dragHandleColor: NinaColors.borderStrong,
    ),
    dialogTheme: DialogThemeData(
      backgroundColor: NinaColors.background,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(NinaRadii.lg)),
    ),
    snackBarTheme: SnackBarThemeData(
      backgroundColor: NinaColors.cocoa,
      contentTextStyle: NinaText.bodyS(color: NinaColors.textInverse),
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(NinaRadii.md)),
    ),
    progressIndicatorTheme:
        const ProgressIndicatorThemeData(color: NinaColors.cocoa),
    dividerTheme: const DividerThemeData(
      color: NinaColors.divider,
      thickness: 1,
    ),
  );
}
