part of 'app_router.dart';

/// Floating tab bar: Inicio · Movimientos · Nina · Metas · Espacio.
/// Nina sits in the middle because asking is the main action.
class _ScaffoldWithNav extends StatelessWidget {
  const _ScaffoldWithNav({required this.child});
  final Widget child;

  static const _tabs = [
    _Tab('/home', 'Inicio', Icons.home_outlined, Icons.home_rounded),
    _Tab('/transactions', 'Movimientos', Icons.receipt_long_outlined,
        Icons.receipt_long_rounded),
    _Tab('/chat', 'Nina', Icons.auto_awesome_outlined, Icons.auto_awesome),
    _Tab('/goals', 'Metas', Icons.track_changes_outlined,
        Icons.track_changes_rounded),
    _Tab('/space', 'Espacio', Icons.group_outlined, Icons.group_rounded),
  ];

  int _tabIndex(BuildContext context) {
    final loc = GoRouterState.of(context).matchedLocation;
    final i = _tabs.indexWhere((t) => loc.startsWith(t.path));
    return i < 0 ? 0 : i;
  }

  @override
  Widget build(BuildContext context) {
    final idx = _tabIndex(context);
    return Scaffold(
      backgroundColor: NinaColors.background,
      extendBody: true,
      body: child,
      bottomNavigationBar: SafeArea(
        top: false,
        minimum: const EdgeInsets.only(bottom: 8),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 4),
          child: Container(
            height: 72,
            padding: const EdgeInsets.symmetric(horizontal: 6),
            decoration: BoxDecoration(
              color: NinaColors.surface.withAlpha(245),
              borderRadius: BorderRadius.circular(NinaRadii.pill),
              border: Border.all(color: NinaColors.border),
              boxShadow: NinaShadows.float,
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                for (var i = 0; i < _tabs.length; i++)
                  i == 2
                      ? _NinaTab(
                          selected: idx == 2,
                          onTap: () => context.go(_tabs[2].path))
                      // Each tab takes its share of the width, so labels never run under Nina.
                      : Expanded(
                          child: _NavItem(
                            tab: _tabs[i],
                            isSelected: idx == i,
                            onTap: () => context.go(_tabs[i].path),
                          ),
                        ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _Tab {
  const _Tab(this.path, this.label, this.icon, this.selectedIcon);
  final String path;
  final String label;
  final IconData icon;
  final IconData selectedIcon;
}

class _NinaTab extends StatelessWidget {
  const _NinaTab({required this.selected, required this.onTap});
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Semantics(
        button: true,
        label: 'Nina',
        selected: selected,
        child: GestureDetector(
          key: const Key('tab-nina'),
          onTap: onTap,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            width: 56,
            height: 56,
            decoration: BoxDecoration(
              color: selected ? NinaColors.accent : NinaColors.cocoa,
              shape: BoxShape.circle,
              boxShadow: const [
                BoxShadow(
                    color: Color(0x47270C0A),
                    blurRadius: 16,
                    offset: Offset(0, 6)),
              ],
            ),
            alignment: Alignment.center,
            child: const NinaSparkle(size: 24),
          ),
        ),
      );
}

class _NavItem extends StatelessWidget {
  const _NavItem(
      {required this.tab, required this.isSelected, required this.onTap});
  final _Tab tab;
  final bool isSelected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final color = isSelected ? NinaColors.textPrimary : NinaColors.textTertiary;
    return Semantics(
      button: true,
      selected: isSelected,
      child: GestureDetector(
        key: Key('tab-${tab.path.substring(1)}'),
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: SizedBox(
          width: double.infinity,
          height: 56,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(isSelected ? tab.selectedIcon : tab.icon,
                  color: color, size: 22),
              const SizedBox(height: 4),
              // "Movimientos" must fit whole on narrow phones.
              FittedBox(
                fit: BoxFit.scaleDown,
                child: Text(
                  tab.label,
                  style: NinaText.bodySStrong(color: color).copyWith(
                      fontSize: 10.5,
                      fontWeight:
                          isSelected ? FontWeight.w700 : FontWeight.w500),
                  maxLines: 1,
                  softWrap: false,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
