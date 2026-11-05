import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../features/auth/bloc/auth_bloc.dart';
import '../../features/auth/bloc/auth_state.dart';
import '../../features/auth/pages/forgot_password_page.dart';
import '../../features/auth/pages/login_page.dart';
import '../../features/auth/pages/signup_page.dart';
import '../../features/auth/pages/verify_email_page.dart';
import '../../features/chat/pages/chat_page.dart';
import '../../features/chat/bloc/chat_bloc.dart';
import '../../features/goals/pages/goals_screen.dart';
import '../../features/spaces/pages/space_detail_page.dart';
import '../../features/spaces/pages/space_tab_page.dart';
import '../../features/spaces/pages/spaces_page.dart';
import '../../features/privacy/consent_gate.dart';
import '../../features/privacy/privacy_page.dart';
import '../../features/transactions/pages/import_csv_page.dart';
import '../../features/insights/score_page.dart';
import '../../features/accounts/accounts_page.dart';
import '../../features/home/pages/home_screen.dart';
import '../../features/transactions/pages/movimientos_screen.dart';
import '../../features/onboarding/pages/splash_page.dart';
import '../../features/onboarding/pages/welcome_page.dart';
import '../../features/pricing/pricing_page.dart';
import '../../features/profile/pages/profile_page.dart';
import '../../features/setup/pages/setup_page.dart';
import '../../shared/widgets/nina_ui.dart';
import '../../core/theme/design_system.dart';

part 'scaffold_with_nav.dart';

/// Routes anyone can open without a session.
const publicRoutes = {
  '/splash',
  '/welcome',
  '/login',
  '/signup',
  '/verify',
  '/forgot',
};

/// Redirect rules, kept pure so they can be tested without a router.
String? authRedirect(AuthState authState, String loc) {
  final isPublic = publicRoutes.contains(loc);
  if (authState is AuthUnauthenticated && !isPublic) return '/login';
  if (authState is AuthAuthenticated) {
    if (loc == '/login' || loc == '/welcome') return '/home';
    // A fresh account goes through "Primeros pasos".
    if (loc == '/signup' || loc == '/verify') return '/setup';
  }
  return null;
}

GoRouter buildRouter(AuthBloc authBloc) {
  final notifier = _AuthChangeNotifier(authBloc);

  return GoRouter(
    initialLocation: '/splash',
    refreshListenable: notifier,
    redirect: (context, state) =>
        authRedirect(authBloc.state, state.matchedLocation),
    routes: [
      GoRoute(path: '/splash', builder: (_, __) => const SplashPage()),
      GoRoute(path: '/welcome', builder: (_, __) => const WelcomePage()),
      GoRoute(path: '/login', builder: (_, __) => const LoginPage()),
      GoRoute(path: '/signup', builder: (_, __) => const SignupPage()),
      GoRoute(
        path: '/verify',
        builder: (_, state) =>
            VerifyEmailPage(email: state.uri.queryParameters['email'] ?? ''),
      ),
      GoRoute(path: '/forgot', builder: (_, __) => const ForgotPasswordPage()),

      // First steps also need the data consent (US-03) before saving anything.
      GoRoute(
          path: '/setup',
          builder: (_, __) => const ConsentGate(child: SetupPage())),
      GoRoute(path: '/pricing', builder: (_, __) => const PricingPage()),

      // Full-screen routes (outside the shell)
      GoRoute(path: '/profile', builder: (_, __) => const ProfilePage()),
      GoRoute(path: '/spaces', builder: (_, __) => const SpacesPage()),
      GoRoute(path: '/import', builder: (_, __) => const ImportCsvPage()),
      GoRoute(path: '/score', builder: (_, __) => const ScorePage()),
      GoRoute(path: '/privacy', builder: (_, __) => const PrivacyPage()),
      GoRoute(path: '/accounts', builder: (_, __) => const AccountsPage()),
      GoRoute(
        path: '/spaces/:id',
        builder: (_, state) =>
            SpaceDetailPage(spaceId: state.pathParameters['id']!),
      ),

      // Shell with the floating tab bar
      ShellRoute(
        // US-03: nothing behind the tab bar is reachable before consenting.
        builder: (context, state, child) =>
            ConsentGate(child: _ScaffoldWithNav(child: child)),
        routes: [
          GoRoute(path: '/home', builder: (_, __) => const HomeScreen()),
          GoRoute(
              path: '/transactions',
              builder: (_, state) => MovimientosScreen(
                  initialPeriod: state.uri.queryParameters['period'])),
          GoRoute(
            path: '/chat',
            builder: (_, state) => BlocProvider(
              create: (_) => ChatBloc(),
              child: ChatPage(draft: state.uri.queryParameters['draft']),
            ),
          ),
          GoRoute(path: '/goals', builder: (_, __) => const GoalsScreen()),
          GoRoute(path: '/space', builder: (_, __) => const SpaceTabPage()),
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
