import 'package:equatable/equatable.dart';

class Subscription extends Equatable {
  final String id;
  final String name;
  final double monthlyAmount;
  final DateTime nextBillingDate;
  final bool isActive;
  final String? suggestion;

  const Subscription({
    required this.id,
    required this.name,
    required this.monthlyAmount,
    required this.nextBillingDate,
    this.isActive = true,
    this.suggestion,
  });

  @override
  List<Object?> get props =>
      [id, name, monthlyAmount, nextBillingDate, isActive, suggestion];
}
