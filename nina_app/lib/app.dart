import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'core/theme/app_theme.dart';
import 'core/router/app_router.dart';
import 'features/auth/bloc/auth_bloc.dart';
import 'features/auth/bloc/auth_event.dart';

class NinaApp extends StatefulWidget {
  const NinaApp({super.key});

  @override
  State<NinaApp> createState() => _NinaAppState();
}

class _NinaAppState extends State<NinaApp> {
  late final AuthBloc _authBloc;
  late final GoRouter _router;

  @override
  void initState() {
    super.initState();
    _authBloc = AuthBloc()..add(const AuthCheckRequested());
    _router = buildRouter(_authBloc);
  }

  @override
  void dispose() {
    _authBloc.close();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return BlocProvider<AuthBloc>.value(
      value: _authBloc,
      child: MaterialApp.router(
        title: 'Nina',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.dark, // ← dark AI theme
        routerConfig: _router,
      ),
    );
  }
}
