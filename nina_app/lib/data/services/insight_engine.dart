import '../../domain/models/transaction.dart';
import '../../domain/models/insight.dart';
import '../../domain/models/financial_summary.dart';

class InsightEngine {
  const InsightEngine();

  // ─── Summary ──────────────────────────────────────────────────────────────

  FinancialSummary computeSummary(
    List<Transaction> transactions, {
    double totalBalance = 12450.0,
    double previousPeriodBalance = 11120.0,
    double savingsAmount = 3200.0,
    double investmentAmount = 1800.0,
  }) {
    final now = DateTime.now();
    final firstOfMonth = DateTime(now.year, now.month, 1);

    final expenses = transactions
        .where((t) => !t.isIncome && t.date.isAfter(firstOfMonth))
        .toList();

    final income = transactions
        .where((t) => t.isIncome && t.date.isAfter(firstOfMonth))
        .fold(0.0, (sum, t) => sum + t.amount);

    final totalSpent = expenses.fold(0.0, (sum, t) => sum + t.amount);

    // Category breakdown
    final breakdown = <String, double>{};
    for (final t in expenses) {
      final key = categoryLabel(t.category);
      breakdown[key] = (breakdown[key] ?? 0) + t.amount;
    }

    final topCat = breakdown.isEmpty
        ? 'Sin datos'
        : (breakdown.entries.toList()
              ..sort((a, b) => b.value.compareTo(a.value)))
            .first
            .key;

    // Weekly trend – 4 weeks, oldest to newest
    final weeklyTrend = List.generate(4, (i) {
      final end = now.subtract(Duration(days: (3 - i) * 7));
      final start = end.subtract(const Duration(days: 7));
      return transactions
          .where((t) =>
              !t.isIncome && t.date.isAfter(start) && t.date.isBefore(end))
          .fold(0.0, (sum, t) => sum + t.amount);
    });

    // Health score (0–100)
    const avgMonthly = 4800.0;
    final ratio = (totalSpent / avgMonthly).clamp(0.5, 2.0);
    final savingsBonus = income > 0
        ? ((income - totalSpent) / income * 40).clamp(0.0, 40.0)
        : 0.0;
    final health =
        ((1 - (ratio - 0.5) / 1.5) * 60 + savingsBonus).clamp(0.0, 100.0);

    return FinancialSummary(
      totalBalance: totalBalance,
      previousPeriodBalance: previousPeriodBalance,
      totalSpentThisMonth: totalSpent,
      totalIncomeThisMonth: income,
      averageMonthlySpend: avgMonthly,
      healthScore: health,
      savingsAmount: savingsAmount,
      investmentAmount: investmentAmount,
      categoryBreakdown: breakdown,
      weeklyTrend: weeklyTrend,
      topSpendingCategory: topCat,
    );
  }

  // ─── Insights ─────────────────────────────────────────────────────────────

  List<Insight> generateInsights(List<Transaction> transactions) {
    final insights = <Insight>[];
    final now = DateTime.now();

    double weekSpend(List<Transaction> txs, int weeksAgo, TransactionCategory cat) {
      final end = now.subtract(Duration(days: weeksAgo * 7));
      final start = end.subtract(const Duration(days: 7));
      return txs
          .where((t) =>
              t.category == cat &&
              !t.isIncome &&
              t.date.isAfter(start) &&
              t.date.isBefore(end))
          .fold(0.0, (s, t) => s + t.amount);
    }

    // Food spike
    final foodThis = weekSpend(transactions, 0, TransactionCategory.food);
    final foodLast = weekSpend(transactions, 1, TransactionCategory.food);
    if (foodLast > 0) {
      final pct = ((foodThis - foodLast) / foodLast * 100).round();
      if (pct > 15) {
        insights.add(Insight(
          id: 'food_spike',
          title: 'Gasto en comida $pct% más alto',
          body:
              'Esta semana gastaste \$${foodThis.toStringAsFixed(0)} en comida — $pct% más que la semana pasada. ¿Ajustamos tu límite?',
          type: InsightType.anomaly,
          severity: InsightSeverity.warning,
          generatedAt: now,
        ));
      }
    }

    // Delivery / food apps
    final delivery = transactions
        .where((t) =>
            !t.isIncome &&
            (t.description.toLowerCase().contains('rappi') ||
                t.description.toLowerCase().contains('uber eat') ||
                t.description.toLowerCase().contains('delivery')) &&
            t.date.isAfter(now.subtract(const Duration(days: 30))))
        .fold(0.0, (s, t) => s + t.amount);
    if (delivery > 150) {
      insights.add(Insight(
        id: 'delivery',
        title: 'Delivery: \$${delivery.toStringAsFixed(0)} este mes',
        body:
            'Tu gasto en delivery subió 24% esta semana. Podrías ahorrar ~\$${(delivery * 0.4).toStringAsFixed(0)} cocinando dos veces por semana.',
        type: InsightType.savings,
        severity: InsightSeverity.warning,
        generatedAt: now,
      ));
    }

    // Subscription waste
    final subTotal = transactions
        .where((t) =>
            t.category == TransactionCategory.subscriptions && !t.isIncome)
        .fold(0.0, (s, t) => s + t.amount);
    if (subTotal > 250) {
      insights.add(Insight(
        id: 'sub_total',
        title: 'Podrías ahorrar \$${(subTotal * 0.4).toStringAsFixed(0)} en suscripciones',
        body:
            'Tengo identificadas ${_subCount(transactions)} suscripciones activas. Al menos 2 parecen estar sin uso. ¿Las cancelamos?',
        type: InsightType.subscription,
        severity: InsightSeverity.info,
        generatedAt: now,
      ));
    }

    // Coffee savings
    final coffeeSpend = transactions
        .where((t) =>
            !t.isIncome &&
            (t.description.toLowerCase().contains('starbucks') ||
                t.description.toLowerCase().contains('café') ||
                t.description.toLowerCase().contains('cafe')))
        .fold(0.0, (s, t) => s + t.amount);
    if (coffeeSpend > 40) {
      insights.add(Insight(
        id: 'coffee',
        title: 'Ahorrarías \$${(coffeeSpend * 12).toStringAsFixed(0)}/año en café ☕',
        body:
            'Gastas ~\$${coffeeSpend.toStringAsFixed(0)} al mes en cafeterías. No te juzgo — solo te lo digo 😏',
        type: InsightType.savings,
        severity: InsightSeverity.positive,
        generatedAt: now,
      ));
    }

    // Positive: savings rate
    final income = transactions
        .where((t) => t.isIncome)
        .fold(0.0, (s, t) => s + t.amount);
    final spent = transactions
        .where((t) => !t.isIncome)
        .fold(0.0, (s, t) => s + t.amount);
    if (income > 0) {
      final rate = ((income - spent) / income * 100).clamp(0, 100);
      if (rate > 20) {
        insights.add(Insight(
          id: 'savings_rate',
          title: 'Tasa de ahorro: ${rate.toStringAsFixed(0)}% 🎯',
          body:
              'Estás ahorrando el ${rate.toStringAsFixed(0)}% de tus ingresos este mes. Eso es mejor que el 80% de las personas. Sigue así.',
          type: InsightType.recommendation,
          severity: InsightSeverity.positive,
          generatedAt: now,
        ));
      }
    }

    return insights;
  }

  int _subCount(List<Transaction> transactions) {
    return transactions
        .where((t) => t.category == TransactionCategory.subscriptions && !t.isIncome)
        .length;
  }

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

  static String aiTag(Transaction tx) {
    if (tx.description.toLowerCase().contains('starbucks') ||
        tx.description.toLowerCase().contains('café')) {
      return 'Hábito recurrente';
    }
    if (tx.category == TransactionCategory.subscriptions) {
      return 'Suscripción mensual';
    }
    if (tx.amount > 500) return 'Más alto de lo usual';
    if (tx.category == TransactionCategory.food && tx.amount > 100) {
      return 'Por encima del promedio';
    }
    return '';
  }
}
