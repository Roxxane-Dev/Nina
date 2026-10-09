import '../../domain/models/home_intelligence.dart';

abstract class HomeRepository {
  Future<HomeIntelligence> getHomeIntelligence();
}

class NinaHomeRepository implements HomeRepository {
  // Future: Inject Dio or SupabaseClient

  @override
  Future<HomeIntelligence> getHomeIntelligence() async {
    // Mocking the API response for now
    await Future.delayed(const Duration(milliseconds: 600));

    return HomeIntelligence.fromJson(const {
      'financialHealth': {
        'score': 82,
        'trend': 'improving',
        'riskLevel': 'medium',
      },
      'alerts': [
        {
          'type': 'warning',
          'message': 'Your restaurant spending increased 34% this week.',
        }
      ],
      'coaching': {
        'tone': 'supportive',
        'message':
            "You're improving compared to last month, but weekends are still your biggest spending trigger.",
      },
      'weeklySummary': {
        'spent': 540,
        'topCategory': 'food',
        'changeVsLastWeek': 18,
      },
      'behaviorSignals': ['weekend_overspending', 'food_delivery_dependency'],
      'timeline': [
        {
          'id': '1',
          'title': 'Ahorro detectado',
          'body':
              'Lograste mantenerte bajo el presupuesto en entretenimiento ayer. ¡Sigue así!',
          'type': 'insight',
          'severity': 'low',
          'created_at': '2026-05-15T10:00:00.000Z',
        },
        {
          'id': '2',
          'title': 'Alerta de Gasto',
          'body': "Detectamos un gasto inusual de S/ 250 en 'Ropa'. ¿Fue algo planeado?",
          'type': 'anomaly',
          'severity': 'medium',
          'created_at': '2026-05-14T10:00:00.000Z',
        }
      ],
    });
  }
}
