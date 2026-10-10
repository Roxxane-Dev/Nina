import 'package:flutter_test/flutter_test.dart';
import 'package:nina_app/main.dart';

void main() {
  testWidgets('missing config shows instructions instead of a blank page',
      (tester) async {
    await tester.pumpWidget(const MissingConfigApp());
    expect(find.textContaining('dart-define-from-file=env/dev.json'),
        findsOneWidget);
  });
}
