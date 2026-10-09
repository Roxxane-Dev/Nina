import 'package:equatable/equatable.dart';

enum TransactionCategory {
  food,
  transport,
  entertainment,
  subscriptions,
  shopping,
  health,
  utilities,
  other,
}

class Transaction extends Equatable {
  final String id;
  final String description;
  final double amount;
  final DateTime date;
  final TransactionCategory category;
  final bool isIncome;

  const Transaction({
    required this.id,
    required this.description,
    required this.amount,
    required this.date,
    required this.category,
    this.isIncome = false,
  });

  @override
  List<Object?> get props => [id, description, amount, date, category, isIncome];
}
