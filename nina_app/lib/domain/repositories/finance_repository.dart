import '../models/transaction.dart';
import '../models/insight.dart';
import '../models/subscription.dart';

abstract class FinanceRepository {
  Future<List<Transaction>> getTransactions({int? limit});
  Future<List<Insight>> getInsights();
  Future<List<Subscription>> getSubscriptions();
}
