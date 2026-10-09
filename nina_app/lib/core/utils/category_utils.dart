import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

/// Shared category display helpers for Nina finance UI.
class CategoryUtils {
  CategoryUtils._();

  static String capitalizar(String s) =>
      s.isEmpty ? s : s[0].toUpperCase() + s.substring(1).toLowerCase();

  static String categoryEmoji(String cat) {
    switch (cat.toLowerCase()) {
      case 'food':
      case 'comida':
      case 'alimentacion':
      case 'alimentación':
        return '🍔';
      case 'transport':
      case 'transporte':
        return '🚕';
      case 'entertainment':
      case 'entretenimiento':
        return '🎬';
      case 'subscriptions':
      case 'suscripciones':
        return '📱';
      case 'shopping':
      case 'compras':
        return '🛍️';
      case 'health':
      case 'salud':
        return '💊';
      case 'utilities':
      case 'servicios':
        return '💡';
      case 'salary':
      case 'salario':
        return '💰';
      case 'rent':
      case 'alquiler':
        return '🏠';
      default:
        return '💳';
    }
  }

  static String formatShortDate(dynamic date) {
    final d = date is DateTime ? date : DateTime.tryParse(date.toString());
    if (d == null) return '';
    return DateFormat('d MMM', 'es').format(d);
  }

  static String getTxTag(Map<String, dynamic> tx) {
    final cat = (tx['category'] as String? ?? '').toLowerCase();
    final amount = (tx['amount'] as num?)?.toDouble() ?? 0;
    final type = tx['type'] as String? ?? '';
    if (type == 'income') return '#Fijo';
    if (['rent', 'utilities', 'subscriptions', 'alquiler', 'servicios'].contains(cat)) return '#Fijo';
    if (amount < 30 && type == 'expense') return '#Hormiga';
    return '#Variable';
  }

  static IconData commitmentIcon(String nombre) {
    final n = nombre.toLowerCase();
    if (n.contains('luz') || n.contains('electric')) return Icons.bolt_outlined;
    if (n.contains('agua') || n.contains('water')) return Icons.water_drop_outlined;
    if (n.contains('internet') || n.contains('claro') || n.contains('movistar')) return Icons.wifi_outlined;
    if (n.contains('netflix') || n.contains('spotify') || n.contains('stream')) return Icons.play_circle_outline_rounded;
    return Icons.receipt_long_outlined;
  }
}
