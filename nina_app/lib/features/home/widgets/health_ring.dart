import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../../../core/theme/design_system.dart';

/// Renders a 270-degree arc showing the financial health score 0–100.
class HealthRing extends StatelessWidget {
  final double score;
  final double size;

  const HealthRing({super.key, required this.score, this.size = 120});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size,
      child: Stack(
        alignment: Alignment.center,
        children: [
          CustomPaint(
            size: Size(size, size),
            painter: _RingPainter(score: score.clamp(0, 100)),
          ),
          Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                score.toInt().toString(),
                style: TextStyle(
                  color: NinaColors.textPrimary,
                  fontSize: size * 0.26,
                  fontWeight: FontWeight.w800,
                  height: 1,
                ),
              ),
              Text(
                'salud',
                style: TextStyle(
                  color: NinaColors.textSecondary,
                  fontSize: size * 0.11,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _RingPainter extends CustomPainter {
  final double score;
  const _RingPainter({required this.score});

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = size.width / 2 - 10;
    const startAngle = math.pi * 0.75; // start at ~7:30
    const sweepMax = math.pi * 1.5;   // 270°

    // Background track
    canvas.drawArc(
      Rect.fromCircle(center: center, radius: radius),
      startAngle,
      sweepMax,
      false,
      Paint()
        ..color = NinaColors.surfaceAlt
        ..style = PaintingStyle.stroke
        ..strokeWidth = 9
        ..strokeCap = StrokeCap.round,
    );

    if (score <= 0) return;

    // Gradient foreground arc
    final rect = Rect.fromCircle(center: center, radius: radius);
    final shader = const LinearGradient(
      colors: [Color(0xFF4C3AFF), Color(0xFF7B61FF), Color(0xFF00C2FF)],
    ).createShader(rect);

    canvas.drawArc(
      rect,
      startAngle,
      sweepMax * (score / 100),
      false,
      Paint()
        ..shader = shader
        ..style = PaintingStyle.stroke
        ..strokeWidth = 9
        ..strokeCap = StrokeCap.round,
    );
  }

  @override
  bool shouldRepaint(_RingPainter old) => old.score != score;
}
