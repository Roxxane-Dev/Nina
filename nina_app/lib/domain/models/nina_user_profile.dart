/// Perfil del usuario desde [profiles] + auth.
class NinaUserProfile {
  const NinaUserProfile({
    this.id,
    this.fullName,
    this.email,
    this.currentCoupleId,
  });

  final String? id;
  final String? fullName;
  final String? email;
  final String? currentCoupleId;

  bool get hasCoupleSpace =>
      currentCoupleId != null && currentCoupleId!.isNotEmpty;

  String get displayName {
    if (fullName != null && fullName!.trim().isNotEmpty) {
      return _capitalize(fullName!.trim().split(RegExp(r'\s+')).first);
    }
    final e = email;
    if (e != null && e.contains('@')) {
      final local = e.split('@').first;
      final firstPart = local.split('.').first;
      return _capitalize(firstPart);
    }
    return 'Usuario';
  }

  String get initials {
    if (fullName != null && fullName!.trim().isNotEmpty) {
      final parts = fullName!.trim().split(RegExp(r'\s+'));
      if (parts.length >= 2) {
        return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
      }
      return parts[0][0].toUpperCase();
    }
    final e = email;
    if (e != null && e.isNotEmpty) {
      return e[0].toUpperCase();
    }
    return 'U';
  }

  static String _capitalize(String s) {
    if (s.isEmpty) return s;
    return s[0].toUpperCase() + s.substring(1).toLowerCase();
  }

  static NinaUserProfile fromAuthFallback({
    String? id,
    String? email,
    Map<String, dynamic>? metadata,
  }) {
    final full = metadata?['full_name'] ?? metadata?['name'];
    return NinaUserProfile(
      id: id,
      fullName: full is String ? full : null,
      email: email,
    );
  }
}
