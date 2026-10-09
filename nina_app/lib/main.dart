import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'app.dart';
import 'core/network/dio_client.dart';
import 'core/constants/app_constants.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Spanish locale for date formatting
  await initializeDateFormatting('es', null);

  if (AppConstants.supabaseUrl.isEmpty || AppConstants.supabaseAnonKey.isEmpty) {
    throw StateError(
      'Missing Supabase config. Run with --dart-define-from-file=env/dev.json '
      '(copy env/dev.example.json).',
    );
  }

  // Initialize Supabase
  await Supabase.initialize(
    url: AppConstants.supabaseUrl,
    anonKey: AppConstants.supabaseAnonKey,
  );

  // Initialize Dio HTTP client
  DioClient.instance.init();

  runApp(const NinaApp());
}
