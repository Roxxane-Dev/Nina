import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:intl/intl.dart';
import '../../../core/theme/design_system.dart';
import '../../../data/repositories/mock_finance_repository.dart';
import '../../../domain/models/subscription.dart';

class SubscriptionsPage extends StatefulWidget {
  const SubscriptionsPage({super.key});

  @override
  State<SubscriptionsPage> createState() => _SubscriptionsPageState();
}

class _SubscriptionsPageState extends State<SubscriptionsPage> {
  final _repo = MockFinanceRepository();
  List<Subscription>? _subs;

  @override
  void initState() {
    super.initState();
    _repo.getSubscriptions().then((s) {
      if (mounted) setState(() => _subs = s);
    });
  }

  double get _monthlyTotal =>
      (_subs ?? []).fold(0.0, (s, sub) => s + sub.monthlyAmount);

  @override
  Widget build(BuildContext context) {
    final fmt = NumberFormat.currency(symbol: '\$', decimalDigits: 0);

    return Scaffold(
      backgroundColor: NinaColors.background,
      body: SafeArea(
        child: _subs == null
            ? const Center(child: CircularProgressIndicator(color: NinaColors.primary))
            : CustomScrollView(
                physics: const BouncingScrollPhysics(),
                slivers: [
                  SliverToBoxAdapter(child: _buildHeader(context, fmt)),
                  SliverPadding(
                    padding: const EdgeInsets.fromLTRB(20, 0, 20, 32),
                    sliver: SliverList(
                      delegate: SliverChildBuilderDelegate(
                        (context, i) =>
                            _SubCard(sub: _subs![i]).animate().fadeIn(
                                delay: Duration(milliseconds: 80 * i)),
                        childCount: _subs!.length,
                      ),
                    ),
                  ),
                ],
              ),
      ),
    );
  }

  Widget _buildHeader(BuildContext context, NumberFormat fmt) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Suscripciones',
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    fontWeight: FontWeight.w800,
                    fontSize: 26,
                  )),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [NinaColors.primary, NinaColors.primaryLight],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(NinaRadii.card),
            ),
            child: Row(
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Total mensual',
                        style: Theme.of(context)
                            .textTheme
                            .bodyMedium
                            ?.copyWith(color: Colors.white70)),
                    const SizedBox(height: 4),
                    Text(fmt.format(_monthlyTotal),
                        style: const TextStyle(
                            color: Colors.white,
                            fontSize: 28,
                            fontWeight: FontWeight.w800,
                            height: 1)),
                  ],
                ),
                const Spacer(),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text('Al año',
                        style: Theme.of(context)
                            .textTheme
                            .labelMedium
                            ?.copyWith(color: Colors.white70)),
                    const SizedBox(height: 4),
                    Text(fmt.format(_monthlyTotal * 12),
                        style: const TextStyle(
                            color: Colors.white,
                            fontSize: 18,
                            fontWeight: FontWeight.w700)),
                  ],
                ),
              ],
            ),
          ).animate().fadeIn(delay: 100.ms),
        ],
      ),
    );
  }
}

class _SubCard extends StatelessWidget {
  final Subscription sub;
  const _SubCard({required this.sub});

  @override
  Widget build(BuildContext context) {
    final fmt = NumberFormat.currency(symbol: '\$', decimalDigits: 0);
    final daysLeft = sub.nextBillingDate.difference(DateTime.now()).inDays;
    final hasSuggestion = sub.suggestion != null;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: NinaColors.surface,
        borderRadius: BorderRadius.circular(NinaRadii.card),
        border: Border.all(
          color: hasSuggestion
              ? NinaColors.warning.withValues(alpha: 0.4)
              : NinaColors.border,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(sub.name,
                    style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                          fontWeight: FontWeight.w700,
                          color: NinaColors.textPrimary,
                        )),
              ),
              Text(
                '${fmt.format(sub.monthlyAmount)}/mes',
                style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                      fontWeight: FontWeight.w700,
                      color: NinaColors.data,
                    ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            'Próximo cobro en $daysLeft días',
            style: Theme.of(context)
                .textTheme
                .labelMedium
                ?.copyWith(color: NinaColors.textTertiary),
          ),
          if (hasSuggestion) ...[
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: NinaColors.warning.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                children: [
                  const Text('💡', style: TextStyle(fontSize: 14)),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      sub.suggestion!,
                      style: Theme.of(context).textTheme.labelMedium?.copyWith(
                            color: NinaColors.warning,
                            fontWeight: FontWeight.w500,
                          ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}
