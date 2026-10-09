import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../features/auth/bloc/auth_bloc.dart';
import '../../features/auth/bloc/auth_state.dart';
import '../../features/auth/pages/login_page.dart';
import '../../features/chat/pages/chat_page.dart';
import '../../features/chat/bloc/chat_bloc.dart';

// NEW SCREENS
import '../../features/home/pages/home_screen.dart';
import '../../features/transactions/pages/movimientos_screen.dart';
import '../../features/insights/pages/analisis_screen.dart';
import '../../features/subscriptions/pages/presupuesto_screen.dart';

import '../../features/onboarding/pages/splash_page.dart';
import '../../features/onboarding/pages/onboarding_page.dart';
import '../../features/profile/pages/profile_page.dart';

import '../../core/theme/design_system.dart';

part 'scaffold_with_nav.dart';

GoRouter buildRouter(AuthBloc authBloc) {
  final notifier = _AuthChangeNotifier(authBloc);

  return GoRouter(
    initialLocation: '/splash',
    refreshListenable: notifier,
    redirect: (context, state) {
      final authState = authBloc.state;
      final loc = state.matchedLocation;
      final isPublic = loc == '/login' || loc == '/splash' || loc == '/onboarding';

      if (authState is AuthUnauthenticated && !isPublic) return '/login';
      if (authState is AuthAuthenticated && loc == '/login') return '/home';
      if (authState is AuthAuthenticated && loc == '/onboarding') return '/home';
      return null;
    },
    routes: [
      GoRoute(path: '/splash', builder: (_, __) => const SplashPage()),
      GoRoute(path: '/onboarding', builder: (_, __) => const OnboardingPage()),
      GoRoute(path: '/login', builder: (_, __) => const LoginPage()),
      
      // Full-screen modal routes (outside shell)
      GoRoute(path: '/profile', builder: (_, __) => const ProfilePage()),
      
      // Shell with bottom nav
      ShellRoute(
        builder: (context, state, child) => _ScaffoldWithNav(child: child),
        routes: [
          GoRoute(path: '/home', builder: (_, __) => const HomeScreen()),
          GoRoute(path: '/transactions', builder: (_, __) => const MovimientosScreen()),
          GoRoute(
            path: '/chat',
            builder: (_, __) => BlocProvider(
              create: (_) => ChatBloc(),
              child: const ChatPage(),
            ),
          ),
          GoRoute(path: '/insights', builder: (_, __) => const AnalisisScreen()),
          GoRoute(path: '/presupuesto', builder: (_, __) => const PresupuestoScreen()),
          GoRoute(path: '/mas', builder: (_, __) => const ProfilePage()),
        ],
      ),
    ],
  );
}

/// Bridges AuthBloc state changes → GoRouter redirect evaluation
class _AuthChangeNotifier extends ChangeNotifier {
  _AuthChangeNotifier(AuthBloc bloc) {
    bloc.stream.listen((_) => notifyListeners());
  }
}
