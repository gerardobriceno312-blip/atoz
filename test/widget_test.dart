// This is a basic Flutter widget test.
//
// To perform an interaction with a widget in your test, use the WidgetTester
// utility in the flutter_test package. For example, you can send tap and scroll
// gestures. You can also use WidgetTester to find child widgets in the widget
// tree, read text, and verify that the values of widget properties are correct.

import 'dart:io';
import 'dart:convert';
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:atoz_quiniela/features/quiniela/quiniela_page.dart';
import 'package:atoz_quiniela/main.dart';

class MockHttpOverrides extends HttpOverrides {
  @override
  HttpClient createHttpClient(SecurityContext? context) {
    return MockHttpClient();
  }
}

class MockHttpClient implements HttpClient {
  @override
  Future<HttpClientRequest> openUrl(String method, Uri url) async {
    return MockHttpClientRequest();
  }

  @override
  Future<HttpClientRequest> getUrl(Uri url) async {
    return openUrl('GET', url);
  }

  @override
  void close({bool force = false}) {}
  
  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class MockHttpHeaders implements HttpHeaders {
  @override
  void forEach(void Function(String name, List<String> values) action) {}

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class MockHttpClientRequest implements HttpClientRequest {
  @override
  bool followRedirects = true;

  @override
  int maxRedirects = 5;

  @override
  int contentLength = 0;

  @override
  bool persistentConnection = true;

  @override
  final HttpHeaders headers = MockHttpHeaders();

  @override
  void add(List<int> data) {}

  @override
  Future addStream(Stream<List<int>> stream) async {
    await stream.drain();
  }

  @override
  Future<HttpClientResponse> close() async {
    return MockHttpClientResponse();
  }
  
  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class MockHttpClientResponse implements HttpClientResponse {
  @override
  int get statusCode => 200;

  @override
  final HttpHeaders headers = MockHttpHeaders();

  @override
  int get contentLength => -1;

  @override
  bool get persistentConnection => false;

  @override
  bool get isRedirect => false;

  @override
  List<RedirectInfo> get redirects => const [];

  @override
  Future<HttpClientResponse> redirect([String? method, Uri? url, bool? followLoops]) async {
    return this;
  }

  @override
  String get reasonPhrase => 'OK';
  
  @override
  StreamSubscription<List<int>> listen(
    void Function(List<int> event)? onData, {
    Function? onError,
    void Function()? onDone,
    bool? cancelOnError,
  }) {
    final data = utf8.encode(
      '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">'
      '<circle cx="50" cy="50" r="50" />'
      '</svg>',
    );
    return Stream<List<int>>.fromIterable([data]).listen(
      onData,
      onError: onError,
      onDone: onDone,
      cancelOnError: cancelOnError,
    );
  }
  
  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

void main() {
  setUpAll(() async {
    HttpOverrides.global = MockHttpOverrides();

    // Mock SharedPreferences
    SharedPreferences.setMockInitialValues({});

    // Initialize Supabase mock/fake settings for test
    await Supabase.initialize(
      url: 'https://woqhzmetfbfubkcdqtmh.supabase.co',
      anonKey: 'sb_publishable_vAh5dgmwqIeE7xWYz2QtzQ__CBMD-c7',
      authOptions: const FlutterAuthClientOptions(
        autoRefreshToken: false,
      ),
    );
  });

  testWidgets('App smoke test', (WidgetTester tester) async {
    // Set larger physical size for the test view to avoid RenderFlex overflow
    tester.view.physicalSize = const Size(800, 1200);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    // Build our app and trigger a frame.
    await tester.pumpWidget(const ProviderScope(child: AtozQuinielaApp()));

    // Verify that the welcome screen title is displayed.
    expect(find.text('QUINIELA MUNDIAL 2026'), findsOneWidget);
  });

  testWidgets('Can edit prediction scores before saving', (WidgetTester tester) async {
    // Set larger physical size for the test view
    tester.view.physicalSize = const Size(800, 1200);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    // Build the QuinielaPage in demo mode
    await tester.pumpWidget(
      const ProviderScope(
        child: MaterialApp(
          home: QuinielaPage(isDemo: true),
        ),
      ),
    );
    await tester.pump();

    // Find all text fields on the page (predictions inputs)
    final textFields = find.byType(TextField);
    expect(textFields, findsAtLeast(2));

    // Get the first two text fields (representing Team A and Team B of the first match)
    final firstTextField = textFields.at(0);
    final secondTextField = textFields.at(1);

    // Enter a score in the first text field (Team A)
    await tester.enterText(firstTextField, '2');
    await tester.pump();

    // Enter a score in the second text field (Team B)
    await tester.enterText(secondTextField, '1');
    await tester.pump();

    // Verify both text fields are still enabled
    final TextField widgetA = tester.widget<TextField>(firstTextField);
    final TextField widgetB = tester.widget<TextField>(secondTextField);
    expect(widgetA.enabled, isTrue);
    expect(widgetB.enabled, isTrue);

    // Verify we can edit/change the score of Team A to '3'
    await tester.enterText(firstTextField, '3');
    await tester.pump();

    final TextField widgetAUpdated = tester.widget<TextField>(firstTextField);
    expect(widgetAUpdated.controller?.text, '3');
  });
}
