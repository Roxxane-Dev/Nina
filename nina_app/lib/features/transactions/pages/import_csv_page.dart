import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/design_system.dart';
import '../../../core/utils/money.dart';
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

class ImportFile {
  const ImportFile(this.name, this.bytes);
  final String name;
  final List<int> bytes;

  bool get isPdf => name.toLowerCase().endsWith('.pdf');
}

Future<ImportFile?> _pickFile() async {
  final picked = await FilePicker.pickFiles(
      type: FileType.custom,
      allowedExtensions: const ['pdf', 'csv', 'txt'],
      withData: true);
  final file = picked?.files.single;
  return file?.bytes == null ? null : ImportFile(file!.name, file.bytes!);
}

/// DATA-01 and DATA-02: choose a file, review what Nina read, import. The server
/// reads the file both times; this screen only shows the result and which rows
/// to leave out. A PDF's password stays in this screen's memory, never on disk.
class ImportCsvPage extends StatefulWidget {
  const ImportCsvPage({super.key, this.api, this.pickFile, this.askPassword});

  final FinanceApiService? api;

  /// Returns the chosen file, or null if nothing was chosen. Injectable for tests.
  final Future<ImportFile?> Function()? pickFile;

  /// Asks for a PDF's password. Injectable for tests.
  final Future<String?> Function(BuildContext context, bool wrong)? askPassword;

  @override
  State<ImportCsvPage> createState() => _ImportCsvPageState();
}

class _ImportCsvPageState extends State<ImportCsvPage> {
  late final FinanceApiService _api = widget.api ?? FinanceApiService.instance;
  ImportFile? _file;
  String? _password;
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
      final file = await (widget.pickFile ?? _pickFile)();
      if (file == null) {
        if (mounted) setState(() => _busy = false);
        return;
      }
      _password = null;
      final preview = await _readWithPassword(file);
      if (!mounted) return;
      if (preview == null) {
        setState(() => _busy = false);
        return;
      }
      setState(() {
        _file = file;
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

  /// Null when the user gave up on the password.
  Future<CsvPreview?> _readWithPassword(ImportFile file) async {
    if (!file.isPdf) return _api.previewCsv(decodeCsvBytes(file.bytes));
    while (true) {
      try {
        return await _api.previewPdf(file.bytes, file.name,
            password: _password);
      } on DioException catch (e) {
        final body = e.response?.data;
        final code = body is Map ? body['code'] : null;
        if (code != 'password_required' && code != 'wrong_password') rethrow;
        if (!mounted) return null;
        final ask = widget.askPassword ?? _askPassword;
        _password = await ask(context, code == 'wrong_password');
        if (_password == null) return null;
      }
    }
  }

  static Future<String?> _askPassword(BuildContext context, bool wrong) {
    final field = TextEditingController();
    return showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Este PDF tiene contraseña'),
        content: TextField(
          key: const Key('import-password'),
          controller: field,
          obscureText: true,
          autofocus: true,
          decoration: InputDecoration(
            labelText: 'Contraseña del estado de cuenta',
            errorText: wrong ? 'Esa no fue. Prueba otra vez.' : null,
            helperText: 'Solo la uso para abrir el archivo. No la guardo.',
          ),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancelar')),
          FilledButton(
              onPressed: () => Navigator.pop(ctx, field.text),
              child: const Text('Abrir')),
        ],
      ),
    );
  }

  Future<void> _import() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final file = _file!;
      final skip = _excluded.toList();
      final count = file.isPdf
          ? await _api.importPdf(file.bytes, file.name,
              password: _password, skipLines: skip)
          : await _api.importCsv(decodeCsvBytes(file.bytes), skipLines: skip);
      _password = null;
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
    final payments = p.skipped.where((s) => s.reason == 'card_payment').length;
    final refunded = p.skipped.where((s) => s.reason == 'refunded').length ~/ 2;
    final unread = p.skipped
        .where((s) =>
            s.reason != 'usd' &&
            s.reason != 'card_payment' &&
            s.reason != 'refunded')
        .toList();
    final other = unread.length;
    return [
      if (refunded > 0)
        '${refunded == 1 ? 'Un cobro que el banco te devolvió no cuenta' : '$refunded cobros que el banco te devolvió no cuentan'}: se cancelan entre sí.',
      if (payments > 0)
        '$payments ${payments == 1 ? 'pago a tu tarjeta no cuenta' : 'pagos a tu tarjeta no cuentan'} como gasto: es tu plata cambiando de lugar.',
      if (usd > 0)
        '$usd en dólares no ${usd == 1 ? 'entra' : 'entran'}: por ahora importo solo soles.',
      if (other > 0)
        '$other ${other == 1 ? 'fila' : 'filas'} sin leer (${other == 1 ? 'línea' : 'líneas'} ${unread.map((s) => s.line).take(8).join(', ')}).',
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
        Text('Sube tu estado de cuenta', style: NinaText.displayM()),
        const SizedBox(height: 8),
        Text(
            'PDF de tarjeta BCP o CSV de tu banco. Te muestro lo que leí antes de guardar nada.',
            style: NinaText.bodyM()),
        const SizedBox(height: 14),
        const NinaNote(
            icon: Icons.lock_outline,
            text:
                'El archivo no pasa por IA ni se guarda. Nina solo lee fecha, descripción y monto.'),
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
              if (p.balanceGap != null) ...[
                const SizedBox(height: 12),
                NinaNote(
                    key: const Key('import-balance-gap'),
                    icon: Icons.warning_amber_rounded,
                    tone: NinaTone.warning,
                    text:
                        'Esto no cuadra con tu estado de cuenta: faltan ${formatSoles(p.balanceGap!.abs())}. Puede que me haya saltado algo, así que revísalo antes de importar.'),
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
