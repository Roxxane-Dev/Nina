// Auth BLoC — events
import 'package:equatable/equatable.dart';

abstract class AuthEvent extends Equatable {
  const AuthEvent();

  @override
  List<Object?> get props => [];
}

class AuthCheckRequested extends AuthEvent {
  const AuthCheckRequested();
}

class AuthSignInRequested extends AuthEvent {
  const AuthSignInRequested({required this.email, required this.password});
  final String email;
  final String password;

  @override
  List<Object?> get props => [email, password];
}

class AuthSignUpRequested extends AuthEvent {
  const AuthSignUpRequested({required this.email, required this.password});
  final String email;
  final String password;

  @override
  List<Object?> get props => [email, password];
}

class AuthSignOutRequested extends AuthEvent {
  const AuthSignOutRequested();
}
