import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nina_app/features/chat/bloc/chat_message.dart';
import 'package:nina_app/features/chat/widgets/answer_card.dart';

void main() {
  test('formats soles es-PE', () {
    expect(formatSoles(1870.3), 'S/ 1,870.30');
    expect(formatSoles(-25), '-S/ 25.00');
  });

  testWidgets('renders highlight, rows and the low-confidence note',
      (tester) async {
    const card = ChatCard(
      title: 'Tu resumen',
      subtitle: 'Agosto 2026 · 3 movimientos',
      highlight: ChatCardRow(label: 'Gastos', amount: 1870.3, tone: 'neutral'),
      rows: [ChatCardRow(label: 'Hogar', amount: 1200)],
      howCalculated: 'Sumé tus movimientos',
      confidence: 'low',
    );
    await tester.pumpWidget(
        const MaterialApp(home: Scaffold(body: AnswerCardView(card: card))));
    expect(find.text('S/ 1,870.30'), findsOneWidget);
    expect(find.text('Hogar'), findsOneWidget);
    expect(find.textContaining('Pocos movimientos'), findsOneWidget);
    expect(find.text('Cómo lo calculé'), findsOneWidget);
  });
}
