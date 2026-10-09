import '../../domain/models/transaction.dart';
import '../../domain/models/insight.dart';
import '../../domain/models/subscription.dart';
import '../../domain/models/financial_summary.dart';
import '../../domain/repositories/finance_repository.dart';
import '../services/insight_engine.dart';

class MockFinanceRepository implements FinanceRepository {
  static const _engine = InsightEngine();

  static List<Transaction> _build() {
    final now = DateTime.now();
    return [
      Transaction(id: 't1', description: 'Starbucks', amount: 28, date: now.subtract(const Duration(hours: 2)), category: TransactionCategory.food),
      Transaction(id: 't2', description: 'Uber', amount: 45, date: now.subtract(const Duration(hours: 6)), category: TransactionCategory.transport),
      Transaction(id: 't3', description: 'Rappi', amount: 85, date: now.subtract(const Duration(days: 1)), category: TransactionCategory.food),
      Transaction(id: 't4', description: 'Netflix', amount: 140, date: now.subtract(const Duration(days: 2)), category: TransactionCategory.subscriptions),
      Transaction(id: 't5', description: 'Spotify', amount: 99, date: now.subtract(const Duration(days: 2)), category: TransactionCategory.subscriptions),
      Transaction(id: 't6', description: 'Walmart', amount: 320, date: now.subtract(const Duration(days: 3)), category: TransactionCategory.shopping),
      Transaction(id: 't7', description: 'Gasolina', amount: 750, date: now.subtract(const Duration(days: 4)), category: TransactionCategory.transport),
      Transaction(id: 't8', description: "McDonald's", amount: 95, date: now.subtract(const Duration(days: 5)), category: TransactionCategory.food),
      Transaction(id: 't9', description: 'Cinépolis', amount: 180, date: now.subtract(const Duration(days: 8)), category: TransactionCategory.entertainment),
      Transaction(id: 't10', description: 'Farmacia', amount: 230, date: now.subtract(const Duration(days: 9)), category: TransactionCategory.health),
      Transaction(id: 't11', description: 'Café', amount: 55, date: now.subtract(const Duration(days: 10)), category: TransactionCategory.food),
      Transaction(id: 't12', description: 'Amazon Prime', amount: 169, date: now.subtract(const Duration(days: 11)), category: TransactionCategory.subscriptions),
      Transaction(id: 't13', description: 'Luz CFE', amount: 480, date: now.subtract(const Duration(days: 12)), category: TransactionCategory.utilities),
      Transaction(id: 't14', description: 'Rappi', amount: 120, date: now.subtract(const Duration(days: 15)), category: TransactionCategory.food),
      Transaction(id: 't15', description: 'Gasolina', amount: 680, date: now.subtract(const Duration(days: 17)), category: TransactionCategory.transport),
      Transaction(id: 't16', description: 'Zara', amount: 890, date: now.subtract(const Duration(days: 18)), category: TransactionCategory.shopping),
      Transaction(id: 't17', description: 'Starbucks', amount: 35, date: now.subtract(const Duration(days: 19)), category: TransactionCategory.food),
      Transaction(id: 't18', description: 'Sushi Itto', amount: 340, date: now.subtract(const Duration(days: 20)), category: TransactionCategory.food),
      // Income
      Transaction(id: 'inc1', description: 'Salario', amount: 15000, date: now.subtract(const Duration(days: 7)), category: TransactionCategory.other, isIncome: true),
    ];
  }

  static final _txs = _build();

  @override
  Future<List<Transaction>> getTransactions({int? limit}) async {
    await Future.delayed(const Duration(milliseconds: 400));
    final sorted = [..._txs]..sort((a, b) => b.date.compareTo(a.date));
    return limit != null ? sorted.take(limit).toList() : sorted;
  }

  @override
  Future<FinancialSummary> getFinancialSummary() async {
    await Future.delayed(const Duration(milliseconds: 500));
    return _engine.computeSummary(_txs);
  }

  @override
  Future<List<Insight>> getInsights() async {
    await Future.delayed(const Duration(milliseconds: 600));
    return _engine.generateInsights(_txs);
  }

  @override
  Future<List<Subscription>> getSubscriptions() async {
    await Future.delayed(const Duration(milliseconds: 300));
    final now = DateTime.now();
    return [
      Subscription(id: 's1', name: 'Netflix', monthlyAmount: 140, nextBillingDate: now.add(const Duration(days: 12)), suggestion: 'Sin uso en 14 días. ¿La pausamos?'),
      Subscription(id: 's2', name: 'Spotify', monthlyAmount: 99, nextBillingDate: now.add(const Duration(days: 5))),
      Subscription(id: 's3', name: 'Amazon Prime', monthlyAmount: 169, nextBillingDate: now.add(const Duration(days: 20)), suggestion: '¿Cuándo fue la última vez que la usaste?'),
      Subscription(id: 's4', name: 'iCloud', monthlyAmount: 29, nextBillingDate: now.add(const Duration(days: 8))),
    ];
  }
}
