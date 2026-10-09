import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:flutter/foundation.dart';
import '../../domain/models/nina_user_profile.dart';

/// Central repository for all Supabase finance queries.
/// Source of truth: [transactions] table with [type] = 'income' | 'expense'.
class SupabaseFinanceRepository {
  SupabaseFinanceRepository._();
  static final instance = SupabaseFinanceRepository._();

  SupabaseClient get _db => Supabase.instance.client;

  String? get currentUserId => _db.auth.currentUser?.id;

  // Helper to safely execute a query and return empty list if table/column missing
  Future<List<Map<String, dynamic>>> _safeQuery(Future<dynamic> queryFuture) async {
    try {
      final res = await queryFuture;
      if (res == null) return [];
      return List<Map<String, dynamic>>.from(res);
    } on PostgrestException catch (e) {
      if (e.code == 'PGRST205' || e.code == '42P01' || e.code == '42703') {
        debugPrint('SupabaseFinanceRepository: Ignored missing schema/table: ${e.message}');
        return [];
      }
      rethrow;
    } catch (e) {
      debugPrint('SupabaseFinanceRepository Error: $e');
      return [];
    }
  }

  // ─────────────────────────── EXPENSES ───────────────────────────────────

  /// All expenses for the current user from the unified [transactions] table.
  Future<List<Map<String, dynamic>>> getExpenses({String? month, String spaceId = 'personal'}) async {
    final uid = currentUserId;
    if (uid == null) return [];

    var q = _db.from('transactions').select().eq('user_id', uid).eq('type', 'expense');

    if (month != null) {
      final start = '$month-01';
      final parts = month.split('-');
      final y = int.parse(parts[0]);
      final m = int.parse(parts[1]);
      final lastDay =
          DateTime(m == 12 ? y + 1 : y, m == 12 ? 1 : m + 1, 1)
              .subtract(const Duration(days: 1))
              .day;
      q = q.gte('date', start).lte('date', '$month-$lastDay');
    }

    return _safeQuery(q.order('date', ascending: false));
  }

  /// Expenses-only view of [watchTransactions].
  Stream<List<Map<String, dynamic>>> watchExpenses() =>
      watchTransactions()
          .map((rows) => rows.where((r) => r['type'] == 'expense').toList());

  /// Budget limit from row (`limit_amount` or legacy `amount`).
  static double budgetLimit(Map<String, dynamic> row) {
    final v = row['limit_amount'] ?? row['amount'];
    return (v as num?)?.toDouble() ?? 0;
  }

  // ─────────────────────────── INCOMES ────────────────────────────────────

  /// All incomes for the current user from the unified [transactions] table.
  Future<List<Map<String, dynamic>>> getIncomes({String? month, String spaceId = 'personal'}) async {
    final uid = currentUserId;
    if (uid == null) return [];

    var q = _db.from('transactions').select().eq('user_id', uid).eq('type', 'income');

    if (month != null) {
      final parts = month.split('-');
      final y = int.parse(parts[0]);
      final m = int.parse(parts[1]);
      final lastDay =
          DateTime(m == 12 ? y + 1 : y, m == 12 ? 1 : m + 1, 1)
              .subtract(const Duration(days: 1))
              .day;
      q = q.gte('date', '$month-01').lte('date', '$month-$lastDay');
    }

    return _safeQuery(q.order('date', ascending: false));
  }

  // ─────────────────────────── TRANSACTIONS (unified) ─────────────────────

  /// All transactions (income + expense) for the current user.
  Future<List<Map<String, dynamic>>> getTransactions({String? month}) async {
    final uid = currentUserId;
    if (uid == null) return [];

    var q = _db.from('transactions').select().eq('user_id', uid);

    if (month != null) {
      final parts = month.split('-');
      final y = int.parse(parts[0]);
      final m = int.parse(parts[1]);
      final lastDay =
          DateTime(m == 12 ? y + 1 : y, m == 12 ? 1 : m + 1, 1)
              .subtract(const Duration(days: 1))
              .day;
      q = q.gte('date', '$month-01').lte('date', '$month-$lastDay');
    }

    return _safeQuery(q.order('date', ascending: false));
  }

  Future<bool> deleteTransaction(String id) async {
    try {
      await _db.from('transactions').delete().eq('id', id);
      return true;
    } catch (e) {
      debugPrint('deleteTransaction: $e');
      return false;
    }
  }

  Future<bool> updateTransaction(
    String id, {
    String? description,
    double? amount,
    String? category,
    String? date,
  }) async {
    final uid = currentUserId;
    if (uid == null) return false;
    try {
      final patch = <String, dynamic>{};
      if (description != null) patch['description'] = description;
      if (amount != null) patch['amount'] = amount;
      if (category != null) patch['category'] = category;
      if (date != null) patch['date'] = date;
      if (patch.isEmpty) return false;
      await _db
          .from('transactions')
          .update(patch)
          .eq('id', id)
          .eq('user_id', uid);
      return true;
    } catch (e) {
      debugPrint('updateTransaction: $e');
      return false;
    }
  }

  /// Real-time stream of ALL transactions (income + expense).
  Stream<List<Map<String, dynamic>>> watchTransactions() {
    final uid = currentUserId;
    if (uid == null) return const Stream.empty();

    return _db
        .from('transactions')
        .stream(primaryKey: ['id'])
        .eq('user_id', uid)
        .order('date', ascending: false);
  }

  // ─────────────────────────── BUDGETS ────────────────────────────────────

  /// Budgets for the current user. The new [budgets] table uses [period]
  /// (monthly/weekly/yearly) and [category], no [month] column.
  Future<List<Map<String, dynamic>>> getBudgets([String? month]) async {
    final uid = currentUserId;
    if (uid == null) return [];

    return _safeQuery(
      _db.from('budgets').select().eq('user_id', uid),
    );
  }

  // ─────────────────────────── GOALS ──────────────────────────────────────

  Future<List<Map<String, dynamic>>> getGoals() async {
    final uid = currentUserId;
    if (uid == null) return [];
    return _safeQuery(
      _db.from('goals').select().eq('user_id', uid).order('created_at', ascending: false),
    );
  }

  // ─────────────────────────── SUBSCRIPTIONS ──────────────────────────────

  Future<List<Map<String, dynamic>>> getSubscriptions(
      {bool activeOnly = true}) async {
    final uid = currentUserId;
    if (uid == null) return [];

    var q = _db.from('subscriptions').select().eq('user_id', uid);
    if (activeOnly) q = q.eq('is_active', true);

    return _safeQuery(q.order('next_billing_date', ascending: true));
  }

  // ─────────────────────────── AI INSIGHTS ────────────────────────────────

  Future<List<Map<String, dynamic>>> getAiInsights({bool undismissedOnly = true}) async {
    final uid = currentUserId;
    if (uid == null) return [];
    var q = _db.from('ai_insights').select().eq('user_id', uid);
    if (undismissedOnly) q = q.eq('is_dismissed', false);
    return _safeQuery(q.order('created_at', ascending: false).limit(5));
  }

  Future<void> dismissInsight(String id) async {
    try {
      await _db.from('ai_insights').update({'is_dismissed': true}).eq('id', id);
    } catch (_) {}
  }

  // ─────────────────────────── ACTIVITY FEED ──────────────────────────────

  /// Returns last [limit] transactions (income + expense) sorted by date.
  Future<List<Map<String, dynamic>>> getActivityFeed({int limit = 8, String spaceId = 'personal'}) async {
    final uid = currentUserId;
    if (uid == null) return [];

    return _safeQuery(
      _db
          .from('transactions')
          .select()
          .eq('user_id', uid)
          .order('date', ascending: false)
          .limit(limit),
    );
  }

  // ─────────────────────────── USER PROFILE ─────────────────────────────

  /// [full_name] y [current_couple_id] desde tabla [profiles], con fallback a auth.
  Future<NinaUserProfile> getCurrentUser() async {
    final user = _db.auth.currentUser;
    if (user == null) {
      return const NinaUserProfile();
    }

    try {
      final row = await _db
          .from('profiles')
          .select('id, full_name, email, current_couple_id')
          .eq('id', user.id)
          .maybeSingle();

      if (row != null) {
        return NinaUserProfile(
          id: row['id'] as String?,
          fullName: row['full_name'] as String?,
          email: (row['email'] as String?) ?? user.email,
          currentCoupleId: row['current_couple_id'] as String?,
        );
      }
    } on PostgrestException catch (e) {
      if (e.code != 'PGRST205' && e.code != '42P01' && e.code != '42703') {
        debugPrint('getCurrentUser profiles: ${e.message}');
      }
    } catch (e) {
      debugPrint('getCurrentUser: $e');
    }

    return NinaUserProfile.fromAuthFallback(
      id: user.id,
      email: user.email,
      metadata: user.userMetadata,
    );
  }

  /// Activa espacio en pareja: crea fila en [spaces] y vincula [current_couple_id].
  Future<bool> enableCoupleSpace({String name = 'En Pareja'}) async {
    final uid = currentUserId;
    if (uid == null) return false;

    try {
      final spaceRes = await _db
          .from('spaces')
          .insert({
            'owner_id': uid,
            'name': name,
            'type': 'pareja',
            'emoji': '👫',
          })
          .select('id')
          .single();

      final spaceId = spaceRes['id'] as String;

      await _db.from('profiles').upsert({
        'id': uid,
        'current_couple_id': spaceId,
        'updated_at': DateTime.now().toIso8601String(),
      });

      return true;
    } on PostgrestException catch (e) {
      debugPrint('enableCoupleSpace: ${e.message}');
      try {
        await _db.from('profiles').upsert({
          'id': uid,
          'current_couple_id': uid,
        });
        return true;
      } catch (_) {
        return false;
      }
    } catch (e) {
      debugPrint('enableCoupleSpace: $e');
      return false;
    }
  }

  /// Categorías del sistema y del usuario desde [categories].
  Future<List<Map<String, dynamic>>> getCategories() async {
    return _safeQuery(
      _db.from('categories').select('id, name, normalized_name, emoji'),
    );
  }

  // ─────────────────────────── HELPERS ────────────────────────────────────

  String currentMonth() {
    final now = DateTime.now();
    return '${now.year}-${now.month.toString().padLeft(2, '0')}';
  }

  String previousMonth() {
    final now = DateTime.now();
    final prev = DateTime(now.year, now.month - 1);
    return '${prev.year}-${prev.month.toString().padLeft(2, '0')}';
  }

  List<String> lastSixMonths() {
    final now = DateTime.now();
    return List.generate(6, (i) {
      final d = DateTime(now.year, now.month - i);
      return '${d.year}-${d.month.toString().padLeft(2, '0')}';
    });
  }
}
