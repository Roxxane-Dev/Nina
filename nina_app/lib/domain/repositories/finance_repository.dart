import '../models/transaction.dart';
import '../models/insight.dart';
import '../models/subscription.dart';
import '../models/financial_summary.dart';

abstract class FinanceRepository {
  Future<List<Transaction>> getTransactions({int? limit});
  Future<FinancialSummary> getFinancialSummary();
  Future<List<Insight>> getInsights();
  Future<List<Subscription>> getSubscriptions();
}
