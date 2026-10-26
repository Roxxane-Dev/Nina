import 'package:flutter/material.dart';
import '../../core/theme/design_system.dart';

/// Nina v2 building blocks. Screens compose these instead of styling
/// Material widgets one by one (Figma "Nina v2" component board).

// ── Brand ────────────────────────────────────────────────────────────────────

/// Four-point sparkle, the "intelligence" glyph of the brand.
class NinaSparkle extends StatelessWidget {
  const NinaSparkle({super.key, this.size = 20, this.color = NinaColors.peach});
  final double size;
  final Color color;

  @override
  Widget build(BuildContext context) =>
      CustomPaint(size: Size.square(size), painter: _SparklePainter(color));
}

class _SparklePainter extends CustomPainter {
  _SparklePainter(this.color);
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width, h = size.height, cx = w / 2, cy = h / 2;
    final k = 0.09 * w; // how far the curve bulges toward the center
    final p = Path()
      ..moveTo(cx, 0)
      ..cubicTo(cx + k, cy - k * 3, cx + k * 3, cy - k, w, cy)
      ..cubicTo(cx + k * 3, cy + k, cx + k, cy + k * 3, cx, h)
      ..cubicTo(cx - k, cy + k * 3, cx - k * 3, cy + k, 0, cy)
      ..cubicTo(cx - k * 3, cy - k, cx - k, cy - k * 3, cx, 0)
      ..close();
    canvas.drawPath(p, Paint()..color = color);
  }

  @override
  bool shouldRepaint(_SparklePainter old) => old.color != color;
}

/// Nina's isotype: cocoa tile with the peach sparkle.
class NinaMark extends StatelessWidget {
  const NinaMark({super.key, this.size = 36});
  final double size;

  @override
  Widget build(BuildContext context) => Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          gradient: NinaColors.markGradient,
          borderRadius: BorderRadius.circular(size * 0.3),
        ),
        alignment: Alignment.center,
        child: NinaSparkle(size: size * 0.55),
      );
}

class NinaWordmark extends StatelessWidget {
  const NinaWordmark({super.key, this.inverse = false});
  final bool inverse;

  @override
  Widget build(BuildContext context) => Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const NinaMark(size: 32),
          const SizedBox(width: 8),
          Text('nina',
              style: NinaText.titleL(
                  color: inverse
                      ? NinaColors.textInverse
                      : NinaColors.textPrimary)),
          const SizedBox(width: 4),
          Container(
            width: 6,
            height: 6,
            decoration: const BoxDecoration(
                color: NinaColors.accent, shape: BoxShape.circle),
          ),
        ],
      );
}

// ── Buttons ──────────────────────────────────────────────────────────────────

enum NinaButtonVariant { primary, secondary, ghost, accent, inverse }

/// Full-width pill button. One primary per screen.
class NinaButton extends StatelessWidget {
  const NinaButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.variant = NinaButtonVariant.primary,
    this.icon,
    this.loading = false,
    this.expand = true,
  });

  final String label;
  final VoidCallback? onPressed;
  final NinaButtonVariant variant;
  final IconData? icon;
  final bool loading;
  final bool expand;

  @override
  Widget build(BuildContext context) {
    final (bg, fg, border) = switch (variant) {
      NinaButtonVariant.primary => (
          NinaColors.cocoa,
          NinaColors.textInverse,
          null
        ),
      NinaButtonVariant.accent => (
          NinaColors.accent,
          NinaColors.textInverse,
          null
        ),
      NinaButtonVariant.secondary => (
          NinaColors.surface,
          NinaColors.textPrimary,
          NinaColors.border
        ),
      NinaButtonVariant.inverse => (
          NinaColors.surface,
          NinaColors.textPrimary,
          null
        ),
      NinaButtonVariant.ghost => (
          Colors.transparent,
          NinaColors.textPrimary,
          null
        ),
    };
    final disabled = onPressed == null || loading;
    final child = loading
        ? SizedBox(
            width: 22,
            height: 22,
            child: CircularProgressIndicator(strokeWidth: 2, color: fg))
        : Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (icon != null) ...[
                Icon(icon, size: 18, color: fg),
                const SizedBox(width: 8),
              ],
              Flexible(
                child: Text(label,
                    textAlign: TextAlign.center,
                    style: NinaText.button(color: fg),
                    overflow: TextOverflow.ellipsis),
              ),
            ],
          );
    final button = Opacity(
      opacity: disabled && !loading ? 0.45 : 1,
      child: Material(
        color: bg,
        shape: StadiumBorder(
            side: border == null ? BorderSide.none : BorderSide(color: border)),
        child: InkWell(
          customBorder: const StadiumBorder(),
          onTap: disabled ? null : onPressed,
          child: Container(
            height: 56,
            padding: const EdgeInsets.symmetric(horizontal: 24),
            alignment: Alignment.center,
            child: child,
          ),
        ),
      ),
    );
    final shadowed = variant == NinaButtonVariant.primary && !disabled
        ? DecoratedBox(
            decoration: const BoxDecoration(
                borderRadius: BorderRadius.all(Radius.circular(999)),
                boxShadow: NinaShadows.card),
            child: button)
        : button;
    return expand
        ? SizedBox(width: double.infinity, child: shadowed)
        : shadowed;
  }
}

/// Small pill action (inside cards and chat answers).
class NinaSmallAction extends StatelessWidget {
  const NinaSmallAction(
      {super.key,
      required this.label,
      required this.onTap,
      this.icon,
      this.filled = false});
  final String label;
  final VoidCallback? onTap;
  final IconData? icon;
  final bool filled;

  @override
  Widget build(BuildContext context) {
    final fg = filled ? NinaColors.textInverse : NinaColors.textPrimary;
    return Material(
      color: filled ? NinaColors.cocoa : NinaColors.surface,
      shape: StadiumBorder(
          side: filled
              ? BorderSide.none
              : const BorderSide(color: NinaColors.border)),
      child: InkWell(
        customBorder: const StadiumBorder(),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          child: Row(mainAxisSize: MainAxisSize.min, children: [
            if (icon != null) ...[
              Icon(icon, size: 16, color: fg),
              const SizedBox(width: 6),
            ],
            Text(label, style: NinaText.bodySStrong(color: fg)),
          ]),
        ),
      ),
    );
  }
}

class NinaCircleButton extends StatelessWidget {
  const NinaCircleButton(
      {super.key,
      required this.icon,
      required this.onTap,
      this.tooltip,
      this.size = 44,
      this.filled = false});
  final IconData icon;
  final VoidCallback? onTap;
  final String? tooltip;
  final double size;
  final bool filled;

  @override
  Widget build(BuildContext context) {
    final btn = Material(
      color: filled ? NinaColors.cocoa : NinaColors.surface,
      shape: CircleBorder(
          side: filled
              ? BorderSide.none
              : const BorderSide(color: NinaColors.border)),
      child: InkWell(
        customBorder: const CircleBorder(),
        onTap: onTap,
        child: SizedBox(
          width: size,
          height: size,
          child: Icon(icon,
              size: size * 0.45,
              color: filled ? NinaColors.textInverse : NinaColors.textPrimary),
        ),
      ),
    );
    return tooltip == null ? btn : Tooltip(message: tooltip!, child: btn);
  }
}

class NinaBackButton extends StatelessWidget {
  const NinaBackButton({super.key, this.onTap});
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => NinaCircleButton(
        icon: Icons.arrow_back_rounded,
        tooltip: 'Volver',
        onTap: onTap ?? () => Navigator.of(context).maybePop(),
      );
}

// ── Surfaces ─────────────────────────────────────────────────────────────────

class NinaCard extends StatelessWidget {
  const NinaCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(20),
    this.color = NinaColors.surface,
    this.border = true,
    this.shadow = true,
    this.radius = NinaRadii.lg,
    this.gradient,
    this.onTap,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;
  final Color color;
  final bool border;
  final bool shadow;
  final double radius;
  final Gradient? gradient;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final content = Container(
      width: double.infinity,
      padding: padding,
      decoration: BoxDecoration(
        color: gradient == null ? color : null,
        gradient: gradient,
        borderRadius: BorderRadius.circular(radius),
        border: border ? Border.all(color: NinaColors.border) : null,
        boxShadow: shadow ? NinaShadows.card : null,
      ),
      child: child,
    );
    if (onTap == null) return content;
    return Material(
      color: Colors.transparent,
      child: InkWell(
          borderRadius: BorderRadius.circular(radius),
          onTap: onTap,
          child: content),
    );
  }
}

class NinaIconBox extends StatelessWidget {
  const NinaIconBox(
      {super.key,
      required this.icon,
      this.size = 44,
      this.background = NinaColors.surfaceAlt,
      this.foreground = NinaColors.textPrimary,
      this.radius});
  final IconData icon;
  final double size;
  final Color background;
  final Color foreground;
  final double? radius;

  @override
  Widget build(BuildContext context) => Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
            color: background,
            borderRadius: BorderRadius.circular(radius ?? size * 0.32)),
        alignment: Alignment.center,
        child: Icon(icon, size: size * 0.48, color: foreground),
      );
}

class NinaPersonAvatar extends StatelessWidget {
  const NinaPersonAvatar(
      {super.key,
      required this.name,
      this.size = 44,
      this.color = NinaColors.peach});
  final String name;
  final double size;
  final Color color;

  @override
  Widget build(BuildContext context) => Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          color: color,
          shape: BoxShape.circle,
          border: Border.all(color: NinaColors.background, width: 2),
        ),
        alignment: Alignment.center,
        child: Text(name.trim().isEmpty ? '?' : name.trim()[0].toUpperCase(),
            style: NinaText.titleM().copyWith(fontSize: size * 0.4)),
      );
}

// ── Status & selection ───────────────────────────────────────────────────────

enum NinaTone { positive, warning, negative, accent, neutral }

class NinaPill extends StatelessWidget {
  const NinaPill(
      {super.key, required this.label, this.tone = NinaTone.neutral});
  final String label;
  final NinaTone tone;

  @override
  Widget build(BuildContext context) {
    final (bg, fg) = switch (tone) {
      NinaTone.positive => (NinaColors.successSoft, NinaColors.success),
      NinaTone.warning => (NinaColors.warningSoft, NinaColors.warning),
      NinaTone.negative => (NinaColors.errorSoft, NinaColors.error),
      NinaTone.accent => (NinaColors.accentSoft, NinaColors.accent),
      NinaTone.neutral => (NinaColors.surfaceAlt, NinaColors.textSecondary),
    };
    return Container(
      padding: const EdgeInsets.fromLTRB(10, 5, 12, 5),
      decoration: BoxDecoration(
          color: bg, borderRadius: BorderRadius.circular(NinaRadii.pill)),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Container(
            width: 6,
            height: 6,
            decoration: BoxDecoration(color: fg, shape: BoxShape.circle)),
        const SizedBox(width: 6),
        Text(label,
            style: NinaText.bodySStrong(color: fg).copyWith(fontSize: 12)),
      ]),
    );
  }
}

class NinaChip extends StatelessWidget {
  const NinaChip(
      {super.key,
      required this.label,
      required this.selected,
      required this.onTap,
      this.icon});
  final String label;
  final bool selected;
  final VoidCallback? onTap;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final fg = selected ? NinaColors.textInverse : NinaColors.textPrimary;
    return Material(
      color: selected ? NinaColors.cocoa : NinaColors.surface,
      shape: StadiumBorder(
          side: selected
              ? BorderSide.none
              : const BorderSide(color: NinaColors.border)),
      child: InkWell(
        customBorder: const StadiumBorder(),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          child: Row(mainAxisSize: MainAxisSize.min, children: [
            if (icon != null) ...[
              Icon(icon, size: 16, color: fg),
              const SizedBox(width: 6),
            ],
            Text(label, style: NinaText.bodySStrong(color: fg)),
          ]),
        ),
      ),
    );
  }
}

/// Horizontally scrolling row of chips.
class NinaChipRow<T> extends StatelessWidget {
  const NinaChipRow(
      {super.key,
      required this.options,
      required this.selected,
      required this.onSelect,
      this.padding = const EdgeInsets.symmetric(horizontal: NinaSpace.gutter)});
  final Map<T, String> options;
  final T selected;
  final ValueChanged<T> onSelect;
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) => SizedBox(
        height: 44,
        child: ListView(
          scrollDirection: Axis.horizontal,
          padding: padding,
          children: [
            for (final e in options.entries)
              Padding(
                padding: const EdgeInsets.only(right: 8),
                child: NinaChip(
                    label: e.value,
                    selected: e.key == selected,
                    onTap: () => onSelect(e.key)),
              ),
          ],
        ),
      );
}

/// Big selectable card used in "Primeros pasos".
class NinaChoiceTile extends StatelessWidget {
  const NinaChoiceTile({
    super.key,
    required this.icon,
    required this.title,
    required this.selected,
    required this.onTap,
    this.subtitle,
  });
  final IconData icon;
  final String title;
  final String? subtitle;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: selected ? NinaColors.peachSoft : NinaColors.surface,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(20),
        side: BorderSide(
            color: selected ? NinaColors.cocoa : NinaColors.border,
            width: selected ? 2 : 1),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(20),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(children: [
            NinaIconBox(
                icon: icon,
                background:
                    selected ? NinaColors.surface : NinaColors.surfaceAlt),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: NinaText.bodyMStrong()),
                    if (subtitle != null)
                      Text(subtitle!, style: NinaText.bodyS()),
                  ]),
            ),
            const SizedBox(width: 8),
            Container(
              width: 24,
              height: 24,
              decoration: BoxDecoration(
                color: selected ? NinaColors.cocoa : NinaColors.surface,
                shape: BoxShape.circle,
                border: selected
                    ? null
                    : Border.all(color: NinaColors.borderStrong, width: 1.5),
              ),
              child: selected
                  ? const Icon(Icons.check_rounded,
                      size: 15, color: NinaColors.textInverse)
                  : null,
            ),
          ]),
        ),
      ),
    );
  }
}

class NinaProgressBar extends StatelessWidget {
  const NinaProgressBar(
      {super.key,
      required this.value,
      this.color = NinaColors.cocoa,
      this.track = NinaColors.surfaceAlt,
      this.height = 8});
  final double value;
  final Color color;
  final Color track;
  final double height;

  @override
  Widget build(BuildContext context) => ClipRRect(
        borderRadius: BorderRadius.circular(height),
        child: LinearProgressIndicator(
          value: value.clamp(0, 1).toDouble(),
          minHeight: height,
          color: color,
          backgroundColor: track,
        ),
      );
}

/// Pager dots for the welcome slides.
class NinaDots extends StatelessWidget {
  const NinaDots({super.key, required this.count, required this.active});
  final int count;
  final int active;

  @override
  Widget build(BuildContext context) => Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          for (var i = 0; i < count; i++)
            AnimatedContainer(
              duration: const Duration(milliseconds: 220),
              margin: const EdgeInsets.only(right: 6),
              width: i == active ? 24 : 8,
              height: 8,
              decoration: BoxDecoration(
                color: i == active ? NinaColors.cocoa : NinaColors.borderStrong,
                borderRadius: BorderRadius.circular(4),
              ),
            ),
        ],
      );
}

/// Back button + segmented progress + "n/total" (Primeros pasos).
class NinaStepHeader extends StatelessWidget {
  const NinaStepHeader(
      {super.key, required this.step, required this.total, this.onBack});
  final int step; // 0-based
  final int total;
  final VoidCallback? onBack;

  @override
  Widget build(BuildContext context) => Row(children: [
        NinaBackButton(onTap: onBack),
        const SizedBox(width: 16),
        Expanded(
          child: Row(children: [
            for (var i = 0; i < total; i++)
              Expanded(
                child: Container(
                  height: 6,
                  margin: EdgeInsets.only(right: i == total - 1 ? 0 : 6),
                  decoration: BoxDecoration(
                    color: i <= step ? NinaColors.cocoa : NinaColors.border,
                    borderRadius: BorderRadius.circular(3),
                  ),
                ),
              ),
          ]),
        ),
        const SizedBox(width: 16),
        Text('${step + 1}/$total',
            style: NinaText.bodySStrong(color: NinaColors.textTertiary)),
      ]);
}

class NinaSectionHeader extends StatelessWidget {
  const NinaSectionHeader(
      {super.key, required this.title, this.action, this.onAction});
  final String title;
  final String? action;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) => Row(children: [
        Expanded(child: Text(title, style: NinaText.titleL())),
        if (action != null)
          TextButton(onPressed: onAction, child: Text(action!)),
      ]);
}

/// Title + optional subtitle block at the top of a step/screen.
class NinaHeading extends StatelessWidget {
  const NinaHeading(
      {super.key, required this.title, this.subtitle, this.large = false});
  final String title;
  final String? subtitle;
  final bool large;

  @override
  Widget build(BuildContext context) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: large ? NinaText.displayL() : NinaText.displayM()),
          if (subtitle != null) ...[
            const SizedBox(height: 8),
            Text(subtitle!, style: NinaText.bodyL()),
          ],
        ],
      );
}

/// Label above a filled field (Input component).
class NinaField extends StatelessWidget {
  const NinaField({
    super.key,
    required this.label,
    required this.controller,
    this.hint,
    this.obscureText = false,
    this.keyboardType,
    this.textInputAction,
    this.suffix,
    this.prefixText,
    this.errorText,
    this.autofocus = false,
    this.onSubmitted,
    this.onChanged,
    this.maxLength,
    this.textCapitalization = TextCapitalization.none,
    this.fieldKey,
  });

  final String label;
  final TextEditingController controller;
  final String? hint;
  final bool obscureText;
  final TextInputType? keyboardType;
  final TextInputAction? textInputAction;
  final Widget? suffix;
  final String? prefixText;
  final String? errorText;
  final bool autofocus;
  final ValueChanged<String>? onSubmitted;
  final ValueChanged<String>? onChanged;
  final int? maxLength;
  final TextCapitalization textCapitalization;
  final Key? fieldKey;

  @override
  Widget build(BuildContext context) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label,
              style: NinaText.bodySStrong(color: NinaColors.textSecondary)),
          const SizedBox(height: 8),
          TextField(
            key: fieldKey,
            controller: controller,
            obscureText: obscureText,
            keyboardType: keyboardType,
            textInputAction: textInputAction,
            autofocus: autofocus,
            maxLength: maxLength,
            textCapitalization: textCapitalization,
            style: NinaText.bodyL(color: NinaColors.textPrimary),
            onSubmitted: onSubmitted,
            onChanged: onChanged,
            decoration: InputDecoration(
              hintText: hint,
              suffixIcon: suffix,
              prefixText: prefixText,
              errorText: errorText,
              counterText: '',
            ),
          ),
        ],
      );
}

/// Soft note with an icon (reassurance, privacy, "pronto").
class NinaNote extends StatelessWidget {
  const NinaNote(
      {super.key,
      required this.icon,
      required this.text,
      this.tone = NinaTone.neutral});
  final IconData icon;
  final String text;
  final NinaTone tone;

  @override
  Widget build(BuildContext context) {
    final (bg, fg) = switch (tone) {
      NinaTone.positive => (NinaColors.successSoft, NinaColors.success),
      NinaTone.accent => (NinaColors.accentSoft, NinaColors.accent),
      NinaTone.warning => (NinaColors.warningSoft, NinaColors.warning),
      NinaTone.negative => (NinaColors.errorSoft, NinaColors.error),
      NinaTone.neutral => (NinaColors.surfaceAlt, NinaColors.textSecondary),
    };
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
          color: bg, borderRadius: BorderRadius.circular(NinaRadii.md)),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Icon(icon, size: 18, color: fg),
        const SizedBox(width: 10),
        Expanded(
            child: Text(text,
                style: NinaText.bodyS(
                    color: tone == NinaTone.neutral
                        ? NinaColors.textSecondary
                        : NinaColors.textPrimary))),
      ]),
    );
  }
}

/// Bottom area of a full-screen step: primary action pinned above the
/// home indicator, content scrolls above it.
class NinaStepScaffold extends StatelessWidget {
  const NinaStepScaffold(
      {super.key,
      required this.content,
      required this.actions,
      this.header,
      this.background = NinaColors.background});
  final Widget? header;
  final List<Widget> content;
  final List<Widget> actions;
  final Color background;

  @override
  Widget build(BuildContext context) => Scaffold(
        backgroundColor: background,
        body: SafeArea(
          child: Column(children: [
            if (header != null)
              Padding(
                padding: const EdgeInsets.fromLTRB(
                    NinaSpace.gutter, 12, NinaSpace.gutter, 0),
                child: header,
              ),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(
                    NinaSpace.gutter, 24, NinaSpace.gutter, 24),
                children: content,
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(
                  NinaSpace.gutter, 8, NinaSpace.gutter, 16),
              child: Column(mainAxisSize: MainAxisSize.min, children: [
                for (var i = 0; i < actions.length; i++) ...[
                  if (i > 0) const SizedBox(height: 8),
                  actions[i],
                ],
              ]),
            ),
          ]),
        ),
      );
}

/// Vertical gap helper to keep layouts readable.
class Gap extends StatelessWidget {
  const Gap(this.size, {super.key});
  final double size;
  @override
  Widget build(BuildContext context) => SizedBox(height: size, width: size);
}
