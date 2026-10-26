import 'package:flutter/material.dart';
import '../../core/theme/design_system.dart';
import '../../shared/widgets/nina_ui.dart';

/// 2.5 Planes — preview only, behind AppConstants.pricingPreview.
/// Prices and limits are examples; nothing here charges or moves money.
class PricingPage extends StatefulWidget {
  const PricingPage({super.key});

  @override
  State<PricingPage> createState() => _PricingPageState();
}

class _PricingPageState extends State<PricingPage> {
  bool _yearly = true;

  void _close() => Navigator.of(context).maybePop();

  @override
  Widget build(BuildContext context) {
    return NinaStepScaffold(
      header: Row(children: [
        NinaCircleButton(icon: Icons.close, tooltip: 'Cerrar', onTap: _close),
        const Spacer(),
        const NinaPill(label: 'Precios de ejemplo', tone: NinaTone.warning),
      ]),
      content: [
        const NinaHeading(
          title: 'Elige cómo usar Nina',
          subtitle:
              'Empieza gratis. Pásate a Plus cuando Nina ya te haya ahorrado más de lo que cuesta.',
        ),
        const SizedBox(height: 20),
        Container(
          padding: const EdgeInsets.all(4),
          decoration: BoxDecoration(
              color: NinaColors.surfaceAlt,
              borderRadius: BorderRadius.circular(NinaRadii.pill)),
          child: Row(children: [
            for (final (yearly, label) in const [
              (false, 'Mensual'),
              (true, 'Anual · ahorra 33%')
            ])
              Expanded(
                child: GestureDetector(
                  onTap: () => setState(() => _yearly = yearly),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 180),
                    padding: const EdgeInsets.symmetric(vertical: 10),
                    decoration: BoxDecoration(
                      color: _yearly == yearly ? NinaColors.surface : null,
                      borderRadius: BorderRadius.circular(NinaRadii.pill),
                    ),
                    alignment: Alignment.center,
                    child: Text(label,
                        style: NinaText.bodySStrong(
                            color: _yearly == yearly
                                ? NinaColors.textPrimary
                                : NinaColors.textSecondary)),
                  ),
                ),
              ),
          ]),
        ),
        const SizedBox(height: 16),
        NinaCard(
          color: NinaColors.cocoa,
          border: false,
          child:
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              const NinaMark(size: 28),
              const SizedBox(width: 8),
              Expanded(
                  child: Text('Nina Plus',
                      style: NinaText.titleL(color: NinaColors.textInverse))),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                    color: NinaColors.accent,
                    borderRadius: BorderRadius.circular(NinaRadii.pill)),
                child: Text('Recomendado',
                    style: NinaText.bodySStrong(color: NinaColors.textInverse)
                        .copyWith(fontSize: 12)),
              ),
            ]),
            const SizedBox(height: 12),
            Text(_yearly ? 'S/ 119 al año' : 'S/ 14.90 al mes',
                style: NinaText.displayL(color: NinaColors.textInverse)),
            if (_yearly)
              Text('Equivale a S/ 9.90 al mes',
                  style: NinaText.bodyS(color: NinaColors.peach)),
            const SizedBox(height: 12),
            for (final f in const [
              'Preguntas ilimitadas a Nina',
              'Planes para tus metas, paso a paso',
              'Primero en probar pronóstico y simulador',
            ])
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: Row(children: [
                  const Icon(Icons.check_rounded,
                      size: 18, color: NinaColors.peach),
                  const SizedBox(width: 10),
                  Expanded(
                      child: Text(f,
                          style:
                              NinaText.bodyM(color: NinaColors.textInverse))),
                ]),
              ),
          ]),
        ),
        const SizedBox(height: 12),
        NinaCard(
          shadow: false,
          child:
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Expanded(child: Text('Nina Gratis', style: NinaText.titleL())),
              Text('S/ 0', style: NinaText.titleL()),
            ]),
            const SizedBox(height: 6),
            Text(
                'Tu número disponible, registro de gastos, espacios compartidos y preguntas a Nina.',
                style: NinaText.bodyS()),
          ]),
        ),
      ],
      actions: [
        NinaButton(
          key: const Key('pricing-trial'),
          label: 'Probar Plus 7 días gratis',
          // Preview: no store connection yet.
          onPressed: () => ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                  content:
                      Text('Plus todavía no está disponible. Te avisamos.'))),
        ),
        Text('Te aviso 2 días antes de cobrar. Cancelas en 2 toques.',
            textAlign: TextAlign.center,
            style: NinaText.bodyS(color: NinaColors.textTertiary)),
        NinaButton(
          key: const Key('pricing-free'),
          label: 'Seguir con Gratis',
          variant: NinaButtonVariant.ghost,
          onPressed: _close,
        ),
      ],
    );
  }
}
