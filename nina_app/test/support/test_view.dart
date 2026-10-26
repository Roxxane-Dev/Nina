import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

/// The v2 screens are taller than the default 800x600 test view, so lazy lists
/// would not build the rows below the fold and buttons would be off-screen.
/// Use a tall surface so every section is laid out; reset after the test.
void useTallSurface(WidgetTester tester, {double height = 2400}) {
  tester.view.physicalSize = Size(800, height);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
}
