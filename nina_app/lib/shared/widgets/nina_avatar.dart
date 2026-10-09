import 'package:flutter/material.dart';
import '../../core/theme/design_system.dart';

class NinaAvatar extends StatelessWidget {
  const NinaAvatar({super.key, this.size = 36, this.showOnline = true});

  final double size;
  final bool showOnline;

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        Container(
          width: size,
          height: size,
          decoration: BoxDecoration(
            gradient: NinaColors.ninaAura,
            borderRadius: BorderRadius.circular(size / 2),
          ),
          child: Center(
            child: Text(
              'N',
              style: TextStyle(
                fontSize: size * 0.45,
                fontWeight: FontWeight.w800,
                color: Colors.white,
              ),
            ),
          ),
        ),
        if (showOnline)
          Positioned(
            right: 0,
            bottom: 0,
            child: Container(
              width: size * 0.28,
              height: size * 0.28,
              decoration: BoxDecoration(
                color: NinaColors.accent,
                borderRadius: BorderRadius.circular(size * 0.14),
                border: Border.all(
                  color: NinaColors.background,
                  width: 1.5,
                ),
              ),
            ),
          ),
      ],
    );
  }
}
