import 'package:flutter/material.dart';
import '../../../data/services/spaces_api_service.dart';
import '../../../shared/widgets/nina_ui.dart';
import '../../../core/theme/design_system.dart';
import 'space_detail_page.dart';
import 'spaces_page.dart';

/// Espacio tab: the user's first shared space, or how to create/join one.
/// Other spaces are reachable from the space menu ("Mis espacios").
class SpaceTabPage extends StatefulWidget {
  const SpaceTabPage({super.key, this.api});

  final SpacesApiService? api;

  @override
  State<SpaceTabPage> createState() => _SpaceTabPageState();
}

class _SpaceTabPageState extends State<SpaceTabPage> {
  late final SpacesApiService _api = widget.api ?? SpacesApiService.instance;
  late Future<List<SpaceSummary>> _future = _api.list();
  int _generation = 0;

  void _reload() => setState(() {
        _generation++;
        _future = _api.list();
      });

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<SpaceSummary>>(
      future: _future,
      builder: (context, snap) {
        if (snap.connectionState == ConnectionState.waiting) {
          return const Scaffold(
              body: Center(child: CircularProgressIndicator()));
        }
        if (snap.hasError) {
          return Scaffold(
            body: Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(mainAxisSize: MainAxisSize.min, children: [
                  Text(spacesErrorMessage(snap.error!),
                      textAlign: TextAlign.center, style: NinaText.bodyM()),
                  const SizedBox(height: 12),
                  NinaButton(
                      label: 'Reintentar',
                      variant: NinaButtonVariant.secondary,
                      expand: false,
                      onPressed: _reload),
                ]),
              ),
            ),
          );
        }
        final spaces = snap.data!;
        if (spaces.isEmpty) {
          return SpacesPage(
              key: ValueKey('spaces-$_generation'),
              api: widget.api,
              embedded: true,
              onChanged: _reload);
        }
        return SpaceDetailPage(
          key: ValueKey('space-${spaces.first.id}-$_generation'),
          spaceId: spaces.first.id,
          api: widget.api,
          embedded: true,
          onLeft: _reload,
        );
      },
    );
  }
}
