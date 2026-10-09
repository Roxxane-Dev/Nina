import 'package:equatable/equatable.dart';

enum InsightType { anomaly, trend, savings, subscription, recommendation }

enum InsightSeverity { info, warning, positive }

class Insight extends Equatable {
  final String id;
  final String title;
  final String body;
  final InsightType type;
  final InsightSeverity severity;
  final DateTime generatedAt;

  const Insight({
    required this.id,
    required this.title,
    required this.body,
    required this.type,
    required this.severity,
    required this.generatedAt,
  });

  @override
  List<Object?> get props => [id, title, body, type, severity, generatedAt];
}
