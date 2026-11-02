import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nina_app/data/services/finance_api_service.dart';
import 'package:nina_app/features/transactions/pages/import_csv_page.dart';
import 'package:nina_app/shared/widgets/nina_ui.dart';

import '../support/test_view.dart';

CsvPreview _preview({bool assumed = false, bool withSkips = false}) =>
    CsvPreview.fromJson({
      'assumedExpenses': assumed,
      'rows': [
        {
          'line': 2,
          'date': '2026-10-02',
          'description': 'TAMBO',
          'amount': 12.5,
          'type': 'expense',
          'category': 'food',
          'categoryLabel': 'Comida',
          'duplicate': false
        },
        {
          'line': 3,
          'date': '2026-10-03',
          'description': 'UBER',
          'amount': 18,
          'type': 'expense',
          'category': 'transport',
          'categoryLabel': 'Transporte',
          'duplicate': false
        },
        {
          'line': 4,
          'date': '2026-10-04',
          'description': 'WONG',
          'amount': 50,
          'type': 'expense',
          'category': 'other',
          'categoryLabel': 'Otros',
          'duplicate': true
        },
      ],
      'skipped': withSkips
          ? [
              {'line': 5, 'reason': 'usd'},
              {'line': 6, 'reason': 'bad_date'}
            ]
          : [],
    });

class _Api extends FinanceApiService {
  _Api(this.preview, {this.fail = false});
  final CsvPreview preview;
  final bool fail;
  String? sent;
  List<int>? skip;

  @override
  Future<CsvPreview> previewCsv(String csv) async {
    if (fail) throw Exception('bad');
    return preview;
  }

  @override
  Future<int> importCsv(String csv, {List<int> skipLines = const []}) async {
    sent = csv;
    skip = skipLines;
    return preview.rows.where((r) => !r.duplicate).length - skipLines.length;
  }
}

Future<void> _pump(WidgetTester tester, _Api api,
    {String? file = 'csv'}) async {
  useTallSurface(tester);
  await tester.pumpWidget(
      MaterialApp(home: ImportCsvPage(api: api, pickFile: () async => file)));
  await tester.tap(find.byKey(const Key('import-pick')));
  await tester.pumpAndSettle();
}

void main() {
  test('reads Latin-1 files, the usual bank export', () {
    expect(decodeCsvBytes([0x63, 0x61, 0x66, 0xe9]), 'café');
    expect(decodeCsvBytes(utf8.encode('café')), 'café');
  });

  testWidgets('shows new rows, hides duplicates and imports the selection',
      (tester) async {
    final api = _Api(_preview());
    await _pump(tester, api);

    expect(find.text('Encontré 2 movimientos nuevos'), findsOneWidget);
    expect(find.text('1 ya estaba registrado: esos no se repiten.'),
        findsOneWidget);
    expect(find.text('WONG'), findsNothing);

    await tester.tap(find.byKey(const Key('import-row-3')));
    await tester.pumpAndSettle();
    expect(find.text('Importar 1 movimiento'), findsOneWidget);

    await tester.tap(find.byKey(const Key('import-confirm')));
    await tester.pumpAndSettle();
    expect(api.sent, 'csv');
    expect(api.skip, [3]);
    expect(find.text('Listo, importé 1 movimiento'), findsOneWidget);
  });

  testWidgets('warns when it assumed expenses, and lists what it skipped',
      (tester) async {
    await _pump(tester, _Api(_preview(assumed: true, withSkips: true)));
    expect(find.textContaining('los leí todos como gastos'), findsOneWidget);
    expect(find.textContaining('1 en dólares no entra'), findsOneWidget);
    expect(find.textContaining('1 fila sin leer (línea 6)'), findsOneWidget);
  });

  testWidgets('choosing nothing changes nothing', (tester) async {
    await _pump(tester, _Api(_preview()), file: null);
    expect(find.byKey(const Key('import-pick')), findsOneWidget);
  });

  testWidgets('a file it cannot read shows the error', (tester) async {
    await _pump(tester, _Api(_preview(), fail: true));
    expect(find.byKey(const Key('import-error')), findsOneWidget);
  });

  testWidgets('nothing new cannot be imported', (tester) async {
    final preview = CsvPreview.fromJson({
      'assumedExpenses': false,
      'rows': [
        {
          'line': 2,
          'date': '2026-10-02',
          'description': 'X',
          'amount': 1,
          'type': 'expense',
          'category': 'other',
          'categoryLabel': 'Otros',
          'duplicate': true
        }
      ],
      'skipped': [],
    });
    await _pump(tester, _Api(preview));
    expect(find.text('No hay nada nuevo'), findsOneWidget);
    expect(
        tester
            .widget<NinaButton>(find.byKey(const Key('import-confirm')))
            .onPressed,
        isNull);
  });
}
