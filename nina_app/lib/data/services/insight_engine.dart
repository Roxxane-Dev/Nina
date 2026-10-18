import '../../domain/models/transaction.dart';

/// Display labels for transaction categories. Holds no financial computation:
/// every figure comes from the backend engine (packages/finance-engine).
class InsightEngine {
  const InsightEngine();

  // ─── Labels ───────────────────────────────────────────────────────────────

  static String categoryLabel(TransactionCategory cat) {
    switch (cat) {
      case TransactionCategory.food:
        return 'Comida';
      case TransactionCategory.transport:
        return 'Transporte';
      case TransactionCategory.entertainment:
        return 'Entretenimiento';
      case TransactionCategory.subscriptions:
        return 'Suscripciones';
      case TransactionCategory.shopping:
        return 'Compras';
      case TransactionCategory.health:
        return 'Salud';
      case TransactionCategory.utilities:
        return 'Servicios';
      case TransactionCategory.other:
        return 'Otros';
    }
  }

  static String categoryEmoji(TransactionCategory cat) {
    switch (cat) {
      case TransactionCategory.food:
        return '🍔';
      case TransactionCategory.transport:
        return '🚗';
      case TransactionCategory.entertainment:
        return '🎬';
      case TransactionCategory.subscriptions:
        return '📱';
      case TransactionCategory.shopping:
        return '🛍️';
      case TransactionCategory.health:
        return '💊';
      case TransactionCategory.utilities:
        return '⚡';
      case TransactionCategory.other:
        return '💰';
    }
  }
}
