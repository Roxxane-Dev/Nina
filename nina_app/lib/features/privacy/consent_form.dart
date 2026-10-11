import 'package:flutter/material.dart';
import '../../core/theme/design_system.dart';
import '../../data/services/profile_api_service.dart';

/// The three consents, shown separately (FDS §6.1). Only "datos" is required;
/// nothing optional comes pre-selected the first time (US-03).
class ConsentForm extends StatefulWidget {
  const ConsentForm({
    super.key,
    required this.initial,
    required this.submitLabel,
    required this.onSubmit,
    this.requireData = true,
  });

  /// Onboarding requires the data consent; Privacidad lets the user revoke it.
  final bool requireData;

  final ConsentState initial;
  final String submitLabel;
  final Future<void> Function(
      {required bool dataProcessing,
      required bool aiProcessing,
      required bool analytics}) onSubmit;

  @override
  State<ConsentForm> createState() => _ConsentFormState();
}

class _ConsentFormState extends State<ConsentForm> {
  late bool _data = widget.initial.dataProcessing;
  late bool _ai = widget.initial.aiProcessing;
  late bool _analytics = widget.initial.analytics;
  bool _saving = false;

  Future<void> _submit() async {
    setState(() => _saving = true);
    try {
      await widget.onSubmit(
          dataProcessing: _data, aiProcessing: _ai, analytics: _analytics);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Widget _tile({
    required Key key,
    required String title,
    required String body,
    required bool value,
    required ValueChanged<bool> onChanged,
    bool required = false,
  }) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: NinaColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: NinaColors.border, width: 0.5),
      ),
      child: SwitchListTile(
        key: key,
        value: value,
        onChanged: onChanged,
        title: Text(required ? '$title (obligatorio)' : title,
            style: const TextStyle(
                fontWeight: FontWeight.w600, color: NinaColors.textPrimary)),
        subtitle: Padding(
          padding: const EdgeInsets.only(top: 4),
          child: Text(body,
              style: const TextStyle(
                  fontSize: 12, color: NinaColors.textSecondary, height: 1.4)),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _tile(
          key: const Key('consent-data'),
          title: 'Procesar mis datos',
          body:
              'Guardamos tus movimientos para mostrarte tu información. Sin esto Nina no puede funcionar.',
          value: _data,
          onChanged: (v) => setState(() => _data = v),
          required: true,
        ),
        _tile(
          key: const Key('consent-ai'),
          title: 'Explicaciones con IA',
          body:
              'Enviamos cifras ya calculadas y anonimizadas a modelos de IA para explicarte tus resultados. '
              'No se guardan ni se usan para entrenar. Sin esto, Nina te responde igual con tus cifras, pero en formato simple.',
          value: _ai,
          onChanged: (v) => setState(() => _ai = v),
        ),
        _tile(
          key: const Key('consent-analytics'),
          title: 'Analítica de uso',
          body:
              'Nos ayudas a mejorar Nina con datos de uso (sin montos ni descripciones).',
          value: _analytics,
          onChanged: (v) => setState(() => _analytics = v),
        ),
        const SizedBox(height: 8),
        FilledButton(
          key: const Key('consent-submit'),
          onPressed:
              (_data || !widget.requireData) && !_saving ? _submit : null,
          child: Text(_saving ? 'Guardando…' : widget.submitLabel),
        ),
        if (!_data && widget.requireData)
          const Padding(
            padding: EdgeInsets.only(top: 8),
            child: Text(
                'Para usar Nina necesitas aceptar el procesamiento de tus datos.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 12, color: NinaColors.textTertiary)),
          ),
      ],
    );
  }
}
