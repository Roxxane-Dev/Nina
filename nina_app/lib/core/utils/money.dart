import 'package:intl/intl.dart';

final _money =
    NumberFormat.currency(locale: 'en_US', symbol: 'S/ ', decimalDigits: 2);

/// es-PE money format used everywhere in the app: "S/ 1,250.50".
String formatSoles(double amount) =>
    amount < 0 ? '-${_money.format(-amount)}' : _money.format(amount);
