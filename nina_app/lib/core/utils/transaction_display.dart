/// Presentation helpers for transaction rows read from Supabase.
/// Display only: totals always come from the backend engine.
library;

/// Same aliases as packages/finance-engine/src/categories.ts → es-PE label.
const _aliases = <String, String>{
  'food': 'Comida',
  'comida': 'Comida',
  'almuerzo': 'Comida',
  'mercado': 'Comida',
  'delivery': 'Comida',
  'transport': 'Transporte',
  'transporte': 'Transporte',
  'taxi': 'Transporte',
  'uber': 'Transporte',
  'home': 'Hogar',
  'hogar': 'Hogar',
  'alquiler': 'Hogar',
  'renta': 'Hogar',
  'rent': 'Hogar',
  'services': 'Servicios',
  'servicios': 'Servicios',
  'utilities': 'Servicios',
  'luz': 'Servicios',
  'agua': 'Servicios',
  'internet': 'Servicios',
  'health': 'Salud',
  'salud': 'Salud',
  'farmacia': 'Salud',
  'education': 'Educación',
  'educacion': 'Educación',
  'educación': 'Educación',
  'entertainment': 'Entretenimiento',
  'entretenimiento': 'Entretenimiento',
  'shopping': 'Compras',
  'compras': 'Compras',
  'ropa': 'Compras',
  'subscriptions': 'Suscripciones',
  'suscripciones': 'Suscripciones',
  'debt': 'Deudas',
  'deuda': 'Deudas',
  'deudas': 'Deudas',
  'salary': 'Sueldo',
  'sueldo': 'Sueldo',
  'salario': 'Sueldo',
  'freelance': 'Ingresos extra',
  'extra': 'Ingresos extra',
  'other': 'Otros',
  'otros': 'Otros',
};

String categoryLabel(String? raw) =>
    _aliases[(raw ?? '').trim().toLowerCase()] ?? 'Otros';

final _midnightUtc =
    RegExp(r'^(\d{4}-\d{2}-\d{2})T00:00:00(?:\.0+)?(?:Z|[+-]00(?::?00)?)$');

/// Calendar day of a stored `date` value, following timezone.ts:
/// 'YYYY-MM-DD' and exactly-midnight-UTC values are a calendar day; any other
/// instant is converted to Lima (UTC−5, Peru has no daylight saving time).
DateTime? storedDay(String? value) {
  if (value == null || value.isEmpty) return null;
  final m = _midnightUtc.firstMatch(value);
  final dayOnly = m?.group(1) ?? (value.length == 10 ? value : null);
  if (dayOnly != null) {
    final d = DateTime.tryParse(dayOnly);
    return d == null ? null : DateTime(d.year, d.month, d.day);
  }
  final instant = DateTime.tryParse(value);
  if (instant == null) return null;
  final lima = instant.toUtc().subtract(const Duration(hours: 5));
  return DateTime(lima.year, lima.month, lima.day);
}
