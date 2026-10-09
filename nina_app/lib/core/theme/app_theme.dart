import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'design_system.dart';

class AppTheme {
  AppTheme._();

  static final ThemeData dark = ThemeData(
    useMaterial3: true,
    brightness: Brightness.dark,
    scaffoldBackgroundColor: NinaColors.background,

    colorScheme: const ColorScheme.dark(
      primary: NinaColors.primary,
      secondary: NinaColors.accent,
      surface: NinaColors.surface,
      error: NinaColors.error,
      onPrimary: Colors.white,
      onSecondary: Colors.black,
      onSurface: NinaColors.textPrimary,
      onError: Colors.white,
    ),

    // 🧠 TYPOGRAPHY = CLARIDAD
    textTheme: GoogleFonts.interTextTheme().copyWith(
      displayLarge: GoogleFonts.inter(
        fontSize: 36,
        fontWeight: FontWeight.w700,
        color: NinaColors.textPrimary,
      ),
      titleLarge: GoogleFonts.inter(
        fontSize: 24,
        fontWeight: FontWeight.w600,
        color: NinaColors.textPrimary,
      ),
      bodyLarge: GoogleFonts.inter(
        fontSize: 16,
        fontWeight: FontWeight.w500,
        color: NinaColors.textPrimary,
      ),
      bodyMedium: GoogleFonts.inter(
        fontSize: 15,
        fontWeight: FontWeight.w400,
        color: NinaColors.textSecondary,
      ),
      labelMedium: GoogleFonts.inter(
        fontSize: 13,
        color: NinaColors.textTertiary,
      ),
    ),

    // 🧾 CARDS = DASHBOARD
    cardTheme: CardThemeData(
      color: NinaColors.surface,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(NinaRadii.card),
        side: const BorderSide(color: NinaColors.border),
      ),
    ),

    // 🔝 APP BAR
    appBarTheme: const AppBarTheme(
      backgroundColor: NinaColors.background,
      elevation: 0,
      iconTheme: IconThemeData(color: NinaColors.textPrimary),
      titleTextStyle: TextStyle(
        color: NinaColors.textPrimary,
        fontSize: 18,
        fontWeight: FontWeight.w600,
      ),
    ),

    // 🚀 PRIMARY BUTTON (ACCIÓN)
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: NinaColors.primary,
        foregroundColor: Colors.white,
        elevation: 0,
        minimumSize: const Size(double.infinity, 56),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(NinaRadii.button),
        ),
        textStyle: GoogleFonts.inter(
          fontSize: 16,
          fontWeight: FontWeight.w600,
        ),
      ),
    ),

    // ⚡ ACCENT BUTTON (DECISIONES IMPORTANTES)
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: NinaColors.accent,
        side: const BorderSide(color: NinaColors.accent),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(NinaRadii.button),
        ),
      ),
    ),

    // 🧠 INPUTS
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: NinaColors.surfaceAlt,
      hintStyle: const TextStyle(color: NinaColors.textTertiary),
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(NinaRadii.input),
        borderSide: const BorderSide(color: NinaColors.border),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(NinaRadii.input),
        borderSide: const BorderSide(color: NinaColors.primary, width: 2),
      ),
    ),

    dividerTheme: const DividerThemeData(
      color: NinaColors.divider,
      thickness: 1,
    ),
  );
}