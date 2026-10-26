import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// NINA DESIGN SYSTEM v2 — light, warm, calm. Tokens mirror the Figma page
/// "Nina v2" (variables "Nina / Color" and "Nina / Dimension").
class NinaColors {
  NinaColors._();

  // Surfaces
  static const Color background = Color(0xFFFFF8F2); // bg/canvas
  static const Color surface = Color(0xFFFFFFFF); // bg/surface
  static const Color surfaceSubtle = Color(0xFFF9F2EC); // bg/subtle
  static const Color surfaceAlt = Color(0xFFF4EDE6); // bg/sunken

  // Structure
  static const Color border = Color(0xFFE8E1DB);
  static const Color borderStrong = Color(0xFFD5C2C0);
  static const Color divider = Color(0xFFE8E1DB);

  // Brand
  static const Color cocoa = Color(0xFF270C0A);
  static const Color cocoaSoft = Color(0xFF40201D);
  static const Color caramel = Color(0xFF775747);
  static const Color peach = Color(0xFFFFD4BF);
  static const Color peachSoft = Color(0xFFFFE9DE);
  static const Color indigo = Color(0xFF130051);

  /// Primary action color (buttons, selected states).
  static const Color primary = cocoa;
  static const Color primarySoft = peachSoft;
  static const Color primaryLight = caramel;

  /// Nina's accent: links, "Cómo calculé esto", focus.
  static const Color accent = Color(0xFF6546F5);
  static const Color accentSoft = Color(0xFFE5DEFF);

  // Text
  static const Color textPrimary = Color(0xFF270C0A);
  static const Color textSecondary = Color(0xFF514442);
  static const Color textTertiary = Color(0xFF837472);
  static const Color textInverse = Color(0xFFFFFFFF);

  // Semantic
  static const Color success = Color(0xFF16A34A);
  static const Color successSoft = Color(0xFFE3F5E9);
  static const Color warning = Color(0xFFB45309);
  static const Color warningSoft = Color(0xFFFDEFD9);
  static const Color error = Color(0xFFBA1A1A);
  static const Color errorLight = Color(0xFFBA1A1A);
  static const Color errorSoft = Color(0xFFFFE4E0);

  // Chat
  static const Color ninaBubble = surface;
  static const Color userBubble = cocoa;

  /// Hero surfaces (splash, first number, Nina's daily note).
  static const Gradient cocoaGradient = LinearGradient(
    colors: [cocoaSoft, Color(0xFF1A0605)],
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
  );

  static const Gradient markGradient = LinearGradient(
    colors: [cocoaSoft, cocoa],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  /// Soft illustration stage (welcome slides).
  static const Gradient stageGradient = LinearGradient(
    colors: [Color(0xFFFFE8DE), Color(0xFFEDE6FF)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );
}

class NinaRadii {
  NinaRadii._();
  static const double sm = 12;
  static const double md = 16;
  static const double lg = 24;
  static const double xl = 32;
  static const double pill = 999;

  static const double card = lg;
  static const double button = pill;
  static const double input = md;
  static const double bubble = 22;
}

class NinaSpace {
  NinaSpace._();
  static const double xs = 4;
  static const double sm = 8;
  static const double md = 12;
  static const double lg = 16;
  static const double xl = 24;
  static const double xxl = 32;

  /// Side gutter of every screen.
  static const double gutter = 24;
}

class NinaShadows {
  NinaShadows._();
  static const List<BoxShadow> card = [
    BoxShadow(color: Color(0x0A270C0A), blurRadius: 2, offset: Offset(0, 1)),
    BoxShadow(color: Color(0x0F270C0A), blurRadius: 30, offset: Offset(0, 8)),
  ];
  static const List<BoxShadow> float = [
    BoxShadow(color: Color(0x29270C0A), blurRadius: 32, offset: Offset(0, 12)),
  ];

  /// Kept for older widgets.
  static const BoxShadow soft = BoxShadow(
    color: Color(0x14270C0A),
    blurRadius: 16,
    offset: Offset(0, 6),
  );
}

/// Type ramp: Epilogue for display, Inter for everything else.
class NinaText {
  NinaText._();

  static TextStyle hero({Color color = NinaColors.textPrimary}) =>
      GoogleFonts.epilogue(
          fontSize: 56,
          fontWeight: FontWeight.w700,
          height: 1,
          letterSpacing: -1.4,
          color: color);
  static TextStyle displayL({Color color = NinaColors.textPrimary}) =>
      GoogleFonts.epilogue(
          fontSize: 34,
          fontWeight: FontWeight.w700,
          height: 1.1,
          letterSpacing: -0.5,
          color: color);
  static TextStyle displayM({Color color = NinaColors.textPrimary}) =>
      GoogleFonts.epilogue(
          fontSize: 26,
          fontWeight: FontWeight.w700,
          height: 1.18,
          letterSpacing: -0.26,
          color: color);
  static TextStyle titleL({Color color = NinaColors.textPrimary}) =>
      GoogleFonts.epilogue(
          fontSize: 20,
          fontWeight: FontWeight.w600,
          height: 1.25,
          letterSpacing: -0.1,
          color: color);
  static TextStyle titleM({Color color = NinaColors.textPrimary}) =>
      GoogleFonts.inter(
          fontSize: 17,
          fontWeight: FontWeight.w600,
          height: 1.3,
          letterSpacing: -0.1,
          color: color);
  static TextStyle bodyL({Color color = NinaColors.textSecondary}) =>
      GoogleFonts.inter(
          fontSize: 16, fontWeight: FontWeight.w400, height: 1.5, color: color);
  static TextStyle bodyM({Color color = NinaColors.textSecondary}) =>
      GoogleFonts.inter(
          fontSize: 15,
          fontWeight: FontWeight.w400,
          height: 1.45,
          color: color);
  static TextStyle bodyMStrong({Color color = NinaColors.textPrimary}) =>
      GoogleFonts.inter(
          fontSize: 15,
          fontWeight: FontWeight.w600,
          height: 1.45,
          color: color);
  static TextStyle bodyS({Color color = NinaColors.textSecondary}) =>
      GoogleFonts.inter(
          fontSize: 13, fontWeight: FontWeight.w400, height: 1.4, color: color);
  static TextStyle bodySStrong({Color color = NinaColors.textPrimary}) =>
      GoogleFonts.inter(
          fontSize: 13, fontWeight: FontWeight.w600, height: 1.4, color: color);
  static TextStyle caps({Color color = NinaColors.textSecondary}) =>
      GoogleFonts.inter(
          fontSize: 11,
          fontWeight: FontWeight.w600,
          height: 1.3,
          letterSpacing: 0.9,
          color: color);
  static TextStyle button({Color color = NinaColors.textInverse}) =>
      GoogleFonts.inter(
          fontSize: 16,
          fontWeight: FontWeight.w600,
          height: 1.2,
          letterSpacing: -0.1,
          color: color);
  static TextStyle number({Color color = NinaColors.textPrimary}) =>
      GoogleFonts.inter(
          fontSize: 17,
          fontWeight: FontWeight.w700,
          height: 1.2,
          letterSpacing: -0.2,
          color: color);
}
