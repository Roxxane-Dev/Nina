import 'package:equatable/equatable.dart';

class FinancialSummary extends Equatable {
  // Balance
  final double totalBalance;          // current account balance
  final double previousPeriodBalance; // balance 30 days ago

  // Monthly
  final double totalSpentThisMonth;
  final double totalIncomeThisMonth;
  final double averageMonthlySpend;

  // Health
  final double healthScore; // 0–100

  // Wealth
  final double savingsAmount;
  final double investmentAmount;

  // Breakdown
  final Map<String, double> categoryBreakdown;
  final List<double> weeklyTrend; // 4 values, oldest → newest
  final String topSpendingCategory;

  const FinancialSummary({
    required this.totalBalance,
    required this.previousPeriodBalance,
    required this.totalSpentThisMonth,
    required this.totalIncomeThisMonth,
    required this.averageMonthlySpend,
    required this.healthScore,
    required this.savingsAmount,
    required this.investmentAmount,
    required this.categoryBreakdown,
    required this.weeklyTrend,
    required this.topSpendingCategory,
  });

  // ─── Computed ───────────────────────────────────────────────────────────────

  /// % change in balance vs previous period (positive = grew)
  double get balanceChangePct => previousPeriodBalance > 0
      ? (totalBalance - previousPeriodBalance) / previousPeriodBalance * 100
      : 0;

  /// % of income saved this month
  double get savingsRate => totalIncomeThisMonth > 0
      ? ((totalIncomeThisMonth - totalSpentThisMonth) / totalIncomeThisMonth * 100)
          .clamp(0, 100)
      : 0;

  /// % above / below average spend
  double get spendVsAvgPercent => averageMonthlySpend > 0
      ? (totalSpentThisMonth - averageMonthlySpend) / averageMonthlySpend * 100
      : 0;

  @override
  List<Object?> get props => [
        totalBalance,
        previousPeriodBalance,
        totalSpentThisMonth,
        totalIncomeThisMonth,
        averageMonthlySpend,
        healthScore,
        savingsAmount,
        investmentAmount,
        categoryBreakdown,
        weeklyTrend,
        topSpendingCategory,
      ];
}
