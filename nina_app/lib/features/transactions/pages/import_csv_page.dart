import 'dart:convert';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/design_system.dart';
import '../../../core/utils/transaction_display.dart';
import '../../../data/services/finance_api_service.dart';
import '../../../shared/widgets/nina_ui.dart';
import '../widgets/transaction_row.dart';

/// Bank exports from Peru are often Latin-1, not UTF-8.
String decodeCsvBytes(List<int> bytes) {
  try {
    return utf8.decode(bytes);
  } on FormatException {
    return latin1.decode(bytes);
  }
}

Future<String?> _pickCsv() async {
  final picked = await FilePicker.pickFiles(
      type: FileType.custom,
      allowedExtensions: const ['csv', 'txt'],
      withData: true);
  final bytes = picked?.files.single.bytes;
  return bytes == null ? null : decodeCsvBytes(bytes);
}

/// DATA-01: choose a file, review what Nina read, import. The server reads the
/// file both times; this screen only shows the result and which rows to leave out.
class ImportCsvPage extends StatefulWidget {
  const ImportCsvPage({super.key, this.api, this.pickFile});

  final FinanceApiService? api;

  /// Returns the file's text, or null if nothing was chosen. Injectable for tests.
  final Future<String?> Function()? pickFile;

  @override
  State<ImportCsvPage> createState() => _ImportCsvPageState();
}

class _ImportCsvPageState extends State<ImportCsvPage> {
  late final FinanceApiService _api = widget.api ?? FinanceApiService.instance;
  String? _csv;
  CsvPreview? _preview;
  final _excluded = <int>{};
  int? _imported;
  bool _busy = false;
  String? _error;

  List<CsvPreviewRow> get _fresh =>
      _preview!.rows.where((r) => !r.duplicate).toList();
  int get _selected => _fresh.where((r) => !_excluded.contains(r.line)).length;

  Future<void> _pick() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final csv = await (widget.pickFile ?? _pickCsv)();
      if (csv == null) {
        if (mounted) setState(() => _busy = false);
        return;
      }
      final preview = await _api.previewCsv(csv);
      if (!mounted) return;
      setState(() {
        _csv = csv;
        _preview = preview;
        _excluded.clear();
        _busy = false;
      });
    } catch (e) {
      if (mounted) {
        setState(() {
          _busy = false;
          _error = financeErrorMessage(e);
        });
      }
    }
  }

  Future<void> _import() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final count = await _api.importCsv(_csv!, skipLines: _excluded.toList());
      if (mounted) {
        setState(() {
          _imported = count;
          _busy = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _busy = false;
          _error = financeErrorMessage(e);
        });
      }
    }
  }

  String? _skippedText(CsvPreview p) {
    if (p.skipped.isEmpty) return null;
    final usd = p.skipped.where((s) => s.reason == 'usd').length;
    final other = p.skipped.length - usd;
    return [
      if (usd > 0)
        '$usd en dólares no ${usd == 1 ? 'entra' : 'entran'}: por ahora importo solo soles.',
      if (other > 0)
        '$other ${other == 1 ? 'fila' : 'filas'} sin leer (${other == 1 ? 'línea' : 'líneas'} ${p.skipped.where((s) => s.reason != 'usd').map((s) => s.line).take(8).join(', ')}).',
    ].join(' ');
  }

  @override
  Widget build(BuildContext context) {
    final imported = _imported;
    return Scaffold(
      backgroundColor: NinaColors.background,
      appBar: AppBar(
          title: const Text('Importar movimientos'),
          backgroundColor: NinaColors.background),
      body: SafeArea(
        child: imported != null
            ? _done(imported)
            : _preview == null
                ? _start()
                : _review(_preview!),
      ),
    );
  }

  Widget _errorText() => _error == null
      ? const SizedBox.shrink()
      : Padding(
          padding: const EdgeInsets.only(top: 12),
          child: Text(_error!,
              key: const Key('import-error'),
              style: NinaText.bodyS(color: NinaColors.error)),
        );

  Widget _start() => ListView(padding: const EdgeInsets.all(24), children: [
        Text('Sube el CSV de tu banco', style: NinaText.displayM()),
        const SizedBox(height: 8),
        Text(
            'Descárgalo desde tu banca por internet. Te muestro lo que leí antes de guardar nada.',
            style: NinaText.bodyM()),
        const SizedBox(height: 14),
        const NinaNote(
            icon: Icons.lock_outline,
            text:
                'El archivo no pasa por IA. Nina lee fecha, descripción y monto, y no guarda el archivo.'),
        const SizedBox(height: 20),
        NinaButton(
          key: const Key('import-pick'),
          label: _busy ? 'Leyendo…' : 'Elegir archivo',
          onPressed: _busy ? null : _pick,
        ),
        _errorText(),
      ]);

  Widget _review(CsvPreview p) {
    final duplicates = p.rows.length - _fresh.length;
    final skipped = _skippedText(p);
    return Column(children: [
      Expanded(
        child: ListView(
            padding: const EdgeInsets.fromLTRB(24, 16, 24, 16),
            children: [
              Text(
                  _fresh.isEmpty
                      ? 'No hay nada nuevo'
                      : 'Encontré ${_fresh.length} ${_fresh.length == 1 ? 'movimiento nuevo' : 'movimientos nuevos'}',
                  key: const Key('import-summary'),
                  style: NinaText.displayM()),
              if (duplicates > 0) ...[
                const SizedBox(height: 6),
                Text(
                    '$duplicates ya ${duplicates == 1 ? 'estaba registrado' : 'estaban registrados'}: esos no se repiten.',
                    style: NinaText.bodyM()),
              ],
              if (p.assumedExpenses) ...[
                const SizedBox(height: 12),
                const NinaNote(
                    icon: Icons.info_outline,
                    tone: NinaTone.warning,
                    text:
                        'El archivo no distingue entradas de salidas, así que los leí todos como gastos. Revísalo antes de importar.'),
              ],
              if (skipped != null) ...[
                const SizedBox(height: 12),
                NinaNote(
                    key: const Key('import-skipped'),
                    icon: Icons.info_outline,
                    text: skipped),
              ],
              const SizedBox(height: 12),
              for (final r in _fresh)
                Row(children: [
                  Checkbox(
                    key: Key('import-row-${r.line}'),
                    value: !_excluded.contains(r.line),
                    activeColor: NinaColors.cocoa,
                    onChanged: _busy
                        ? null
                        : (on) => setState(() => on == true
                            ? _excluded.remove(r.line)
                            : _excluded.add(r.line)),
                  ),
                  Expanded(
                    child: TransactionRow(
                      title: r.description.isEmpty
                          ? r.categoryLabel
                          : r.description,
                      meta: '${r.categoryLabel} · ${formatStoredDay(r.date)}',
                      amount: r.amount,
                      isIncome: r.isIncome,
                      category: r.category,
                    ),
                  ),
                ]),
              _errorText(),
            ]),
      ),
      Padding(
        padding: const EdgeInsets.fromLTRB(24, 8, 24, 16),
        child: NinaButton(
          key: const Key('import-confirm'),
          label: _busy
              ? 'Importando…'
              : 'Importar $_selected ${_selected == 1 ? 'movimiento' : 'movimientos'}',
          onPressed: _busy || _selected == 0 ? null : _import,
        ),
      ),
    ]);
  }

  Widget _done(int count) =>
      ListView(padding: const EdgeInsets.all(24), children: [
        Text(
            count == 1
                ? 'Listo, importé 1 movimiento'
                : 'Listo, importé $count movimientos',
            key: const Key('import-done'),
            style: NinaText.displayM()),
        const SizedBox(height: 8),
        Text(
            'Ya están en tus números. Si Nina se equivocó de categoría, tócalo en Movimientos y lo corriges.',
            style: NinaText.bodyM()),
        const SizedBox(height: 20),
        NinaButton(
          label: 'Ver movimientos',
          onPressed: () => context.go('/transactions'),
        ),
      ]);
}

String formatStoredDay(String date) {
  final d = storedDay(date);
  return d == null ? date : '${d.day}/${d.month}/${d.year}';
}
