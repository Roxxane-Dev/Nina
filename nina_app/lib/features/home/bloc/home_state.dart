import 'package:equatable/equatable.dart';
import '../../../domain/models/transaction.dart';
import '../../../domain/models/insight.dart';
import '../../../domain/models/financial_summary.dart';
import '../../../domain/models/home_intelligence.dart';
import '../../../core/theme/adaptive_theme_engine.dart';

abstract class HomeState extends Equatable {
  const HomeState();
  @override
  List<Object?> get props => [];
}

class HomeInitial extends HomeState {}

class HomeLoading extends HomeState {}

class HomeError extends HomeState {
  final String message;
  const HomeError(this.message);
  @override
  List<Object?> get props => [message];
}

class HomeLoaded extends HomeState {
  final FinancialSummary summary;
  final List<Transaction> recentTransactions;
  final List<Insight> insights;
  final HomeIntelligence intelligence;
  final FinancialUiState uiState;

  const HomeLoaded({
    required this.summary,
    required this.recentTransactions,
    required this.insights,
    required this.intelligence,
    required this.uiState,
  });

  @override
  List<Object?> get props => [summary, recentTransactions, insights, intelligence, uiState];
}
