part of 'app_router.dart';

class _ScaffoldWithNav extends StatelessWidget {
  const _ScaffoldWithNav({required this.child});
  final Widget child;

  int _tabIndex(BuildContext context) {
    final loc = GoRouterState.of(context).matchedLocation;
    if (loc.startsWith('/transactions')) return 1;
    if (loc.startsWith('/insights')) return 2;
    if (loc.startsWith('/mas') || loc.startsWith('/profile')) return 3;
    return 0; // /home
  }

  @override
  Widget build(BuildContext context) {
    final idx = _tabIndex(context);

    return Scaffold(
      backgroundColor: NinaColors.background,
      body: child,
      floatingActionButton: Container(
        height: 52,
        width: 52,
        margin: const EdgeInsets.only(top: 28),
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: NinaColors.accent,
          boxShadow: [
            BoxShadow(
              color: NinaColors.accent.withAlpha(100),
              blurRadius: 16,
              spreadRadius: 2,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: FloatingActionButton(
          onPressed: () => context.push('/chat'),
          backgroundColor: Colors.transparent,
          elevation: 0,
          highlightElevation: 0,
          child: const Icon(
            Icons.auto_awesome_rounded,
            color: NinaColors.background,
            size: 22,
          ),
        ),
      ),
      floatingActionButtonLocation: FloatingActionButtonLocation.centerDocked,
      bottomNavigationBar: Container(
        height: 72,
        decoration: BoxDecoration(
          color: NinaColors.background,
          border: Border(top: BorderSide(color: NinaColors.border.withAlpha(128), width: 0.5)),
        ),
        child: SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8.0),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                _NavItem(
                  icon: Icons.home_rounded,
                  label: 'Inicio',
                  isSelected: idx == 0,
                  onTap: () => context.go('/home'),
                ),
                _NavItem(
                  icon: Icons.swap_vert_rounded,
                  label: 'Movimientos',
                  isSelected: idx == 1,
                  onTap: () => context.go('/transactions'),
                ),
                const SizedBox(width: 52),
                _NavItem(
                  icon: Icons.donut_large_rounded,
                  label: 'Análisis',
                  isSelected: idx == 2,
                  onTap: () => context.go('/insights'),
                ),
                _NavItem(
                  icon: Icons.apps_rounded,
                  label: 'Más',
                  isSelected: idx == 3,
                  onTap: () => context.go('/mas'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _NavItem extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool isSelected;
  final VoidCallback onTap;

  const _NavItem({
    required this.icon,
    required this.label,
    required this.isSelected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final color = isSelected ? NinaColors.accent : NinaColors.textTertiary;

    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: SizedBox(
        width: 72,
        height: 72,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            if (isSelected)
              Container(
                width: 24,
                height: 2,
                margin: const EdgeInsets.only(bottom: 6),
                decoration: BoxDecoration(
                  color: NinaColors.accent,
                  borderRadius: BorderRadius.circular(1),
                ),
              )
            else
              const SizedBox(height: 8),
            Icon(icon, color: color, size: 22),
            const SizedBox(height: 4),
            Text(
              label,
              style: TextStyle(
                fontSize: 10,
                fontWeight: isSelected ? FontWeight.w600 : FontWeight.w400,
                color: color,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }
}
