import 'package:flutter/material.dart';

/// NINA DESIGN SYSTEM — AI FINANCIAL INTELLIGENCE (UI Rebuild)
class NinaColors {
  NinaColors._();

  // 🌑 BASE — CONTROL / DEPTH
  static const Color background = Color(0xFF0D0A1A);  // kBg
  static const Color surface = Color(0xFF1A1030);     // kSurface

  // 🧱 STRUCTURE
  static const Color border = Color(0xFF2A1F4A);      // kBorder
  static const Color divider = Color(0xFF2A1F4A);
  static const Color surfaceAlt = Color(0xFF24193F);

  // 🟣 CORE INTELLIGENCE
  static const Color primary = Color(0xFF5C3DCC);     // kPrimary
  static const Color primarySoft = Color(0x1A5C3DCC);
  static const Color primaryLight = Color(0xFF7B61FF);

  // ⚡ ACTION / DECISION
  static const Color accent = Color(0xFFB8F53A);      // kAccent
  static const Color accentSoft = Color(0x1AB8F53A);

  // ✍️ TEXT
  static const Color textPrimary = Color(0xFFE2DDF5); // kTextPrim
  static const Color textSecondary = Color(0xFFC4B5FD); // kTextSec
  static const Color textTertiary = Color(0xFF6B6580); // kTextMuted

  // 🚨 SEMANTIC
  static const Color success = Color(0xFF5DCAA5);     // kGreen
  static const Color warning = Color(0xFFEF9F27);     // kAmber
  static const Color error = Color(0xFFE24B4A);       // kRed
  static const Color errorLight = Color(0xFFF09595);  // kRedLight

  // 💬 CHAT BUBBLES
  static const Color ninaBubble = Color(0xFF1E1B30);
  static const Color userBubble = Color(0xFF5C3DCC);

  // ✨ AI AURA
  static const Gradient actionGradient = LinearGradient(
    colors: [
      Color(0xFFBFFF00),
      Color(0xFF7B61FF),
    ],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  static const Gradient ninaAura = LinearGradient(
    colors: [
      Color(0xFF5C3DCC),
      Color(0xFFB8F53A),
      Color(0xFF7B61FF),
    ],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );
}

class NinaRadii {
  NinaRadii._();
  static const double card = 18;
  static const double button = 16;
  static const double input = 16;
  static const double bubble = 14;
}

class NinaShadows {
  NinaShadows._();
  static const BoxShadow soft = BoxShadow(
    color: Color(0x33000000),
    blurRadius: 16,
    offset: Offset(0, 6),
  );
}