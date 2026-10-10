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
    // Show the fix on screen instead of a blank page.
    runApp(const MissingConfigApp());
    return;
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

/// Shown when the app was started without env/dev.json.
class MissingConfigApp extends StatelessWidget {
  const MissingConfigApp({super.key});

  @override
  Widget build(BuildContext context) {
    return const MaterialApp(
      debugShowCheckedModeBanner: false,
      home: Scaffold(
        body: Center(
          child: Padding(
            padding: EdgeInsets.all(24),
            child: SelectableText(
              'Falta la configuración de Supabase.\n\n'
              'Ejecuta la app desde nina_app/ con:\n'
              'flutter run --dart-define-from-file=env/dev.json\n\n'
              'Si env/dev.json no existe, cópialo de env/dev.example.json '
              'y completa SUPABASE_URL y SUPABASE_ANON_KEY.',
              textAlign: TextAlign.center,
            ),
          ),
        ),
      ),
    );
  }
}
