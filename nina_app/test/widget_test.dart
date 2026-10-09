import 'package:flutter_test/flutter_test.dart';
import 'package:nina_app/app.dart';

void main() {
  testWidgets('NinaApp class exists', (WidgetTester tester) async {
    // Full widget test requires Supabase initialization.
    // This smoke test verifies the class is importable and exported correctly.
    expect(NinaApp, isNotNull);
  });
}
