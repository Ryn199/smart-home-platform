import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_app/main.dart';

void main() {
  testWidgets('App initialization test', (WidgetTester tester) async {
    await tester.pumpWidget(const SmartHomeUserApp());
    expect(find.byType(SmartHomeUserApp), findsOneWidget);
  });
}
