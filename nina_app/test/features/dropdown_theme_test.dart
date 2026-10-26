import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nina_app/core/theme/app_theme.dart';
import 'package:nina_app/core/theme/design_system.dart';

/// Regression: dropdown menus (category/account in the add sheet) rendered dark text on the dark
/// surface, so the options were invisible. Found by clicking through the running app.
void main() {
  testWidgets(
      'dropdown menu items use the primary text color on the light canvas',
      (tester) async {
    await tester.pumpWidget(MaterialApp(
      theme: AppTheme.light,
      home: Scaffold(
        body: Center(
          child: DropdownButtonFormField<String>(
            initialValue: 'a',
            decoration: const InputDecoration(labelText: 'Categoría'),
            items: const [
              DropdownMenuItem(value: 'a', child: Text('Comida')),
              DropdownMenuItem(value: 'b', child: Text('Transporte')),
            ],
            onChanged: (_) {},
          ),
        ),
      ),
    ));

    await tester.tap(find.byType(DropdownButtonFormField<String>));
    await tester.pumpAndSettle();

    final option = find.text('Transporte').last;
    final style = DefaultTextStyle.of(tester.element(option)).style;
    expect(tester.widget<Text>(option).style?.color ?? style.color,
        NinaColors.textPrimary);
    expect(Theme.of(tester.element(option)).canvasColor, NinaColors.surface);
  });

  testWidgets(
      'dialog titles use the primary text color (delete confirmation was unreadable)',
      (tester) async {
    await tester.pumpWidget(MaterialApp(
      theme: AppTheme.light,
      home: const Scaffold(
        body: AlertDialog(
          title: Text('Eliminar movimiento'),
          content: Text('Dejará de contar en tu saldo.'),
        ),
      ),
    ));
    final title = find.text('Eliminar movimiento');
    final style = DefaultTextStyle.of(tester.element(title)).style;
    expect(tester.widget<Text>(title).style?.color ?? style.color,
        NinaColors.textPrimary);
  });

  test('theme defines the colors dropdowns and list titles inherit', () {
    expect(AppTheme.light.canvasColor, NinaColors.surface);
    expect(AppTheme.light.textTheme.titleMedium?.color, NinaColors.textPrimary);
    expect(AppTheme.light.textTheme.titleSmall?.color, NinaColors.textPrimary);
    expect(
        AppTheme.light.textTheme.headlineSmall?.color, NinaColors.textPrimary);
  });
}
