import 'package:flutter_test/flutter_test.dart';
import 'package:nina_app/core/router/app_router.dart';
import 'package:nina_app/features/auth/bloc/auth_state.dart';

void main() {
  const out = AuthUnauthenticated();
  const signedIn = AuthAuthenticated(email: 'ana@example.com');

  group('authRedirect', () {
    test('unauthenticated users are sent to /login from private routes', () {
      for (final loc in [
        '/home',
        '/transactions',
        '/chat',
        '/goals',
        '/space',
        '/setup',
        '/profile',
        '/pricing',
      ]) {
        expect(authRedirect(out, loc), '/login', reason: loc);
      }
    });

    test('unauthenticated users can open every public route', () {
      for (final loc in publicRoutes) {
        expect(authRedirect(out, loc), isNull, reason: loc);
      }
      expect(
          publicRoutes,
          containsAll([
            '/splash',
            '/welcome',
            '/login',
            '/signup',
            '/verify',
            '/forgot'
          ]));
    });

    test('authenticated users on /login or /welcome go to /home', () {
      expect(authRedirect(signedIn, '/login'), '/home');
      expect(authRedirect(signedIn, '/welcome'), '/home');
    });

    test('a fresh account on /signup or /verify goes to /setup', () {
      expect(authRedirect(signedIn, '/signup'), '/setup');
      expect(authRedirect(signedIn, '/verify'), '/setup');
    });

    test('authenticated users stay where they are elsewhere', () {
      for (final loc in ['/home', '/goals', '/setup', '/splash', '/forgot']) {
        expect(authRedirect(signedIn, loc), isNull, reason: loc);
      }
    });

    test('while auth is still resolving nothing is redirected', () {
      expect(authRedirect(const AuthInitial(), '/home'), isNull);
      expect(authRedirect(const AuthLoading(), '/home'), isNull);
    });

    test('waiting for the email code keeps the user on public routes', () {
      const pending = AuthNeedsEmailConfirmation(email: 'ana@example.com');
      expect(authRedirect(pending, '/verify'), isNull);
    });
  });
}
