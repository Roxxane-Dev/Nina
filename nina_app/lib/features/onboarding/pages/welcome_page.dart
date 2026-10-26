import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../../core/theme/design_system.dart';
import '../../../shared/widgets/nina_ui.dart';

/// 1.1–1.3 Welcome slides: what Nina does, ask anything, trust.
/// The figures in the illustrations are labelled as examples.
class WelcomePage extends StatefulWidget {
  const WelcomePage({super.key});

  @override
  State<WelcomePage> createState() => _WelcomePageState();
}

class _WelcomePageState extends State<WelcomePage> {
  final _pager = PageController();
  int _page = 0;

  static const _slides = [
    (
      'Un solo número. El que importa.',
      'Nina junta tus gastos y te dice cuánto te queda este mes sin tocar lo importante. Sin hojas de cálculo.'
    ),
    (
      'Pregúntale lo que sea. Te responde con tus números.',
      'Nina responde con tu plata real, no con consejos de Instagram.'
    ),
    (
      'Tu plata, tus reglas.',
      'Nina entiende tu dinero, pero nunca lo mueve. Tú decides siempre.'
    ),
  ];

  @override
  void dispose() {
    _pager.dispose();
    super.dispose();
  }

  Future<void> _markSeen() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('has_seen_onboarding', true);
  }

  Future<void> _goTo(String route) async {
    await _markSeen();
    if (mounted) context.go(route);
  }

  void _next() {
    if (_page < _slides.length - 1) {
      _pager.nextPage(
          duration: const Duration(milliseconds: 320), curve: Curves.easeOut);
    } else {
      _goTo('/signup');
    }
  }

  @override
  Widget build(BuildContext context) {
    final last = _page == _slides.length - 1;
    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            SizedBox(
              height: 48,
              child: Align(
                alignment: Alignment.centerRight,
                child: last
                    ? null
                    : TextButton(
                        key: const Key('welcome-skip'),
                        onPressed: () => _goTo('/signup'),
                        child: Text('Saltar',
                            style: NinaText.bodyMStrong(
                                color: NinaColors.textSecondary)),
                      ),
              ),
            ),
            Expanded(
              child: PageView.builder(
                controller: _pager,
                itemCount: _slides.length,
                onPageChanged: (i) => setState(() => _page = i),
                itemBuilder: (_, i) => ListView(
                  padding:
                      const EdgeInsets.symmetric(horizontal: NinaSpace.gutter),
                  children: [
                    _Stage(index: i),
                    const SizedBox(height: 28),
                    NinaDots(count: _slides.length, active: i),
                    const SizedBox(height: 14),
                    Text(_slides[i].$1, style: NinaText.displayM()),
                    const SizedBox(height: 10),
                    Text(_slides[i].$2, style: NinaText.bodyL()),
                  ],
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(
                  NinaSpace.gutter, 8, NinaSpace.gutter, 12),
              child: Column(children: [
                NinaButton(
                  key: const Key('welcome-next'),
                  label: last ? 'Crear mi cuenta' : 'Siguiente',
                  onPressed: _next,
                ),
                const SizedBox(height: 4),
                NinaButton(
                  key: const Key('welcome-login'),
                  label: 'Ya tengo cuenta',
                  variant: NinaButtonVariant.ghost,
                  onPressed: () => _goTo('/login'),
                ),
              ]),
            ),
          ],
        ),
      ),
    );
  }
}

/// Soft illustration card for each slide.
class _Stage extends StatelessWidget {
  const _Stage({required this.index});
  final int index;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 320,
      decoration: BoxDecoration(
        gradient: NinaColors.stageGradient,
        borderRadius: BorderRadius.circular(NinaRadii.xl),
      ),
      padding: const EdgeInsets.all(28),
      child: switch (index) {
        0 => const _NumberArt(),
        1 => const _ChatArt(),
        _ => const _TrustArt(),
      },
    );
  }
}

class _NumberArt extends StatelessWidget {
  const _NumberArt();

  @override
  Widget build(BuildContext context) => Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          NinaCard(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(children: [
                  Expanded(
                      child:
                          Text('DISPONIBLE ESTE MES', style: NinaText.caps())),
                  const NinaPill(label: 'En ritmo', tone: NinaTone.positive),
                ]),
                const SizedBox(height: 8),
                Row(
                    crossAxisAlignment: CrossAxisAlignment.baseline,
                    textBaseline: TextBaseline.alphabetic,
                    children: [
                      Text('S/ ',
                          style:
                              NinaText.titleL(color: NinaColors.textSecondary)),
                      Text('1,240',
                          style: NinaText.hero().copyWith(fontSize: 48)),
                    ]),
                const SizedBox(height: 10),
                const NinaProgressBar(value: 0.66),
                const SizedBox(height: 8),
                Text('Ejemplo',
                    style: NinaText.bodyS(color: NinaColors.textTertiary)),
              ],
            ),
          ),
          const SizedBox(height: 14),
          NinaCard(
            padding: const EdgeInsets.all(14),
            radius: 18,
            child: Row(children: [
              const NinaMark(size: 24),
              const SizedBox(width: 8),
              Expanded(
                child: Text('Delivery: 4 veces esta semana. Audaz.',
                    style: NinaText.bodySStrong()),
              ),
            ]),
          ),
        ],
      );
}

class _ChatArt extends StatelessWidget {
  const _ChatArt();

  @override
  Widget build(BuildContext context) => Column(
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Align(
            alignment: Alignment.centerRight,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: const BoxDecoration(
                color: NinaColors.cocoa,
                borderRadius: BorderRadius.only(
                    topLeft: Radius.circular(20),
                    topRight: Radius.circular(20),
                    bottomLeft: Radius.circular(20),
                    bottomRight: Radius.circular(6)),
              ),
              child: Text('¿Me alcanza para Cusco en abril?',
                  style: NinaText.bodyM(color: NinaColors.textInverse)),
            ),
          ),
          const SizedBox(height: 12),
          NinaCard(
            padding: const EdgeInsets.all(16),
            radius: 20,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(children: [
                  const NinaMark(size: 22),
                  const SizedBox(width: 8),
                  Text('Nina', style: NinaText.bodySStrong()),
                ]),
                const SizedBox(height: 8),
                Text(
                    'Sí, si guardas S/ 310 al mes. Hoy ahorras S/ 280: te faltan S/ 30. ¿Vemos de dónde salen?',
                    style: NinaText.bodyM(color: NinaColors.textPrimary)),
                const SizedBox(height: 8),
                Row(children: [
                  const Icon(Icons.calculate_outlined,
                      size: 16, color: NinaColors.accent),
                  const SizedBox(width: 6),
                  Text('Cómo lo calculé',
                      style: NinaText.bodySStrong(color: NinaColors.accent)),
                ]),
              ],
            ),
          ),
          const SizedBox(height: 10),
          Text('Conversación de ejemplo',
              style: NinaText.bodyS(color: NinaColors.textTertiary)),
        ],
      );
}

class _TrustArt extends StatelessWidget {
  const _TrustArt();

  @override
  Widget build(BuildContext context) => Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            width: 76,
            height: 76,
            decoration: BoxDecoration(
              color: NinaColors.surface,
              borderRadius: BorderRadius.circular(24),
              boxShadow: NinaShadows.card,
            ),
            child: const Icon(Icons.verified_user_outlined,
                size: 36, color: NinaColors.accent),
          ),
          const SizedBox(height: 18),
          for (final (icon, text) in const [
            (Icons.lock_outline, 'Nunca movemos tu dinero.'),
            (Icons.calculate_outlined, 'Cada número te dice cómo se calculó.'),
            (
              Icons.visibility_off_outlined,
              'Ocultamos tus datos personales antes de procesar tus mensajes.'
            ),
          ])
            Container(
              margin: const EdgeInsets.only(bottom: 8),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: NinaColors.surface.withAlpha(220),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Row(children: [
                Icon(icon, size: 20, color: NinaColors.textPrimary),
                const SizedBox(width: 12),
                Expanded(child: Text(text, style: NinaText.bodySStrong())),
              ]),
            ),
        ],
      );
}
