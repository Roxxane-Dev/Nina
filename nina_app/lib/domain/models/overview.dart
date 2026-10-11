/// Period summary computed by the backend engine (GET /v1/overview).
/// The app renders these numbers as-is: it never sums transactions itself.
class Overview {
  const Overview({
    required this.periodLabel,
    required this.from,
    required this.to,
    required this.hasHistory,
    required this.txnCount,
    required this.income,
    required this.expenses,
    required this.available,
    required this.balance,
    required this.categories,
    required this.previousLabel,
    required this.previousExpenses,
    required this.expensesChange,
  });

  final String periodLabel;
  final String from;
  final String to;
  final bool hasHistory;
  final int txnCount;
  final double income;
  final double expenses;
  final double available;
  final double balance;
  final List<CategoryShare> categories;
  final String previousLabel;
  final double previousExpenses;
  final double expensesChange;

  factory Overview.fromJson(Map<String, dynamic> j) {
    final period = (j['period'] as Map?) ?? const {};
    final previous = (j['previous'] as Map?) ?? const {};
    return Overview(
      periodLabel: period['label'] as String? ?? '',
      from: period['from'] as String? ?? '',
      to: period['to'] as String? ?? '',
      hasHistory: j['hasHistory'] == true,
      txnCount: (j['txnCount'] as num?)?.toInt() ?? 0,
      income: _d(j['income']),
      expenses: _d(j['expenses']),
      available: _d(j['available']),
      balance: _d(j['balance']),
      categories: (j['categories'] as List? ?? const [])
          .whereType<Map>()
          .map((c) => CategoryShare(
                slug: c['slug'] as String? ?? 'other',
                label: c['label'] as String? ?? '',
                amount: _d(c['amount']),
                sharePct: (c['sharePct'] as num?)?.toInt() ?? 0,
              ))
          .toList(),
      previousLabel: previous['label'] as String? ?? '',
      previousExpenses: _d(previous['expenses']),
      expensesChange: _d(j['expensesChange']),
    );
  }
}

class CategoryShare {
  const CategoryShare(
      {required this.slug,
      required this.label,
      required this.amount,
      required this.sharePct});
  final String slug;
  final String label;
  final double amount;
  final int sharePct;
}

class TrendPoint {
  const TrendPoint(
      {required this.label, required this.income, required this.expenses});
  final String label;
  final double income;
  final double expenses;

  factory TrendPoint.fromJson(Map<String, dynamic> j) => TrendPoint(
        label: j['label'] as String? ?? '',
        income: _d(j['income']),
        expenses: _d(j['expenses']),
      );
}

/// Period options shown in Inicio / Análisis (US-20).
enum OverviewPeriod {
  current('current', 'Este mes'),
  previous('previous', 'Mes anterior');

  const OverviewPeriod(this.param, this.label);
  final String param;
  final String label;
}

double _d(Object? v) => (v as num?)?.toDouble() ?? 0;
