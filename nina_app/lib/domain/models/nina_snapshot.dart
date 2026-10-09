/// Financial snapshot from GET /intelligence/snapshot (NinaFinanceEngine).
class NinaSnapshot {
  const NinaSnapshot({
    required this.saldoEstimado,
    required this.pulsoDelDia,
    required this.proyeccionCierreMes,
    required this.compromisosPendientes,
    required this.anomalias,
    required this.tendenciaCategorias,
    required this.gastosHormiga,
    required this.patrones,
    required this.flujoCajaLibre,
    required this.scoreFinanciero,
    required this.topCategoriasMes,
    required this.metasProgreso,
    this.rawJson,
  });

  final SaldoEstimado saldoEstimado;
  final PulsoDelDia pulsoDelDia;
  final ProyeccionCierreMes proyeccionCierreMes;
  final CompromisosPendientes compromisosPendientes;
  final List<Anomalia> anomalias;
  final Map<String, TendenciaCategoria> tendenciaCategorias;
  final GastosHormiga gastosHormiga;
  final PatronesComportamiento patrones;
  final FlujoCajaLibre flujoCajaLibre;
  final ScoreFinanciero scoreFinanciero;
  final List<TopCategoriaMes> topCategoriasMes;
  final List<MetaProgreso> metasProgreso;
  final Map<String, dynamic>? rawJson;

  Map<String, dynamic> toJson() => rawJson ?? {};

  factory NinaSnapshot.fromJson(Map<String, dynamic> json) {
    final tendenciaRaw =
        json['tendenciaCategorias'] as Map<String, dynamic>? ?? {};
    final tendencia = <String, TendenciaCategoria>{};
    tendenciaRaw.forEach((k, v) {
      if (v is Map<String, dynamic>) {
        tendencia[k] = TendenciaCategoria.fromJson(v);
      }
    });

    return NinaSnapshot(
      saldoEstimado: SaldoEstimado.fromJson(
        json['saldoEstimado'] as Map<String, dynamic>? ?? {},
      ),
      pulsoDelDia: PulsoDelDia.fromJson(
        json['pulsoDelDia'] as Map<String, dynamic>? ?? {},
      ),
      proyeccionCierreMes: ProyeccionCierreMes.fromJson(
        json['proyeccionCierreMes'] as Map<String, dynamic>? ?? {},
      ),
      compromisosPendientes: CompromisosPendientes.fromJson(
        json['compromisosPendientes'] as Map<String, dynamic>? ?? {},
      ),
      anomalias: (json['anomalias'] as List<dynamic>? ?? [])
          .map((e) => Anomalia.fromJson(e as Map<String, dynamic>))
          .toList(),
      tendenciaCategorias: tendencia,
      gastosHormiga: GastosHormiga.fromJson(
        json['gastosHormiga'] as Map<String, dynamic>? ?? {},
      ),
      patrones: PatronesComportamiento.fromJson(
        json['patrones'] as Map<String, dynamic>? ?? {},
      ),
      flujoCajaLibre: FlujoCajaLibre.fromJson(
        json['flujoCajaLibre'] as Map<String, dynamic>? ?? {},
      ),
      scoreFinanciero: ScoreFinanciero.fromJson(
        json['scoreFinanciero'] as Map<String, dynamic>? ?? {},
      ),
      topCategoriasMes: (json['topCategoriasMes'] as List<dynamic>? ?? [])
          .map((e) => TopCategoriaMes.fromJson(e as Map<String, dynamic>))
          .toList(),
      metasProgreso: (json['metasProgreso'] as List<dynamic>? ?? [])
          .map((e) => MetaProgreso.fromJson(e as Map<String, dynamic>))
          .toList(),
      rawJson: json,
    );
  }
}

class SaldoEstimado {
  const SaldoEstimado({
    required this.amount,
    required this.status,
    required this.tooltip,
  });
  final double amount;
  final String status;
  final String tooltip;

  factory SaldoEstimado.fromJson(Map<String, dynamic> j) => SaldoEstimado(
        amount: (j['amount'] as num?)?.toDouble() ?? 0,
        status: j['status'] as String? ?? 'green',
        tooltip: j['tooltip'] as String? ?? '',
      );
}

class PulsoDelDia {
  const PulsoDelDia({
    required this.gastoHoy,
    required this.promedioDiario7d,
    required this.deltaPct,
    required this.diasBajoPromedio,
  });
  final double gastoHoy;
  final double promedioDiario7d;
  final double deltaPct;
  final int diasBajoPromedio;

  factory PulsoDelDia.fromJson(Map<String, dynamic> j) => PulsoDelDia(
        gastoHoy: (j['gastoHoy'] as num?)?.toDouble() ?? 0,
        promedioDiario7d: (j['promedioDiario7d'] as num?)?.toDouble() ?? 0,
        deltaPct: (j['deltaPct'] as num?)?.toDouble() ?? 0,
        diasBajoPromedio: (j['diasBajoPromedio'] as num?)?.toInt() ?? 0,
      );
}

class ProyeccionCierreMes {
  const ProyeccionCierreMes({
    required this.amount,
    required this.status,
    required this.diasRestantes,
  });
  final double amount;
  final String status;
  final int diasRestantes;

  factory ProyeccionCierreMes.fromJson(Map<String, dynamic> j) =>
      ProyeccionCierreMes(
        amount: (j['amount'] as num?)?.toDouble() ?? 0,
        status: j['status'] as String? ?? 'green',
        diasRestantes: (j['diasRestantes'] as num?)?.toInt() ?? 0,
      );
}

class CompromisoItem {
  const CompromisoItem({
    required this.nombre,
    required this.monto,
    required this.fechaVencimiento,
    required this.fuente,
  });
  final String nombre;
  final double monto;
  final String fechaVencimiento;
  final String fuente;

  factory CompromisoItem.fromJson(Map<String, dynamic> j) => CompromisoItem(
        nombre: j['nombre'] as String? ?? '',
        monto: (j['monto'] as num?)?.toDouble() ?? 0,
        fechaVencimiento: j['fechaVencimiento'] as String? ?? '',
        fuente: j['fuente'] as String? ?? 'subscription',
      );
}

class CompromisosPendientes {
  const CompromisosPendientes({required this.total, required this.items});
  final double total;
  final List<CompromisoItem> items;

  factory CompromisosPendientes.fromJson(Map<String, dynamic> j) =>
      CompromisosPendientes(
        total: (j['total'] as num?)?.toDouble() ?? 0,
        items: (j['items'] as List<dynamic>? ?? [])
            .map((e) => CompromisoItem.fromJson(e as Map<String, dynamic>))
            .toList(),
      );
}

class Anomalia {
  const Anomalia({
    required this.transactionId,
    required this.categoria,
    required this.monto,
    required this.zScore,
    required this.multiplicador,
    required this.mediaCategoria,
    required this.descripcion,
    required this.fecha,
  });
  final String transactionId;
  final String categoria;
  final double monto;
  final double zScore;
  final double multiplicador;
  final double mediaCategoria;
  final String descripcion;
  final String fecha;

  factory Anomalia.fromJson(Map<String, dynamic> j) => Anomalia(
        transactionId: j['transactionId'] as String? ?? '',
        categoria: j['categoria'] as String? ?? '',
        monto: (j['monto'] as num?)?.toDouble() ?? 0,
        zScore: (j['zScore'] as num?)?.toDouble() ?? 0,
        multiplicador: (j['multiplicador'] as num?)?.toDouble() ?? 0,
        mediaCategoria: (j['mediaCategoria'] as num?)?.toDouble() ?? 0,
        descripcion: j['descripcion'] as String? ?? '',
        fecha: j['fecha'] as String? ?? DateTime.now().toIso8601String(),
      );
}

class TendenciaCategoria {
  const TendenciaCategoria({
    required this.mesActual,
    required this.mesAnterior,
    required this.pctCambio,
    required this.direction,
  });
  final double mesActual;
  final double mesAnterior;
  final double pctCambio;
  final String direction;

  factory TendenciaCategoria.fromJson(Map<String, dynamic> j) =>
      TendenciaCategoria(
        mesActual: (j['mesActual'] as num?)?.toDouble() ?? 0,
        mesAnterior: (j['mesAnterior'] as num?)?.toDouble() ?? 0,
        pctCambio: (j['pctCambio'] as num?)?.toDouble() ?? 0,
        direction: j['direction'] as String? ?? 'stable',
      );
}

class GastosHormiga {
  const GastosHormiga({
    required this.count,
    required this.total,
    required this.semanaActual,
    required this.comparacionConcreta,
  });
  final int count;
  final double total;
  final double semanaActual;
  final String comparacionConcreta;

  factory GastosHormiga.fromJson(Map<String, dynamic> j) => GastosHormiga(
        count: (j['count'] as num?)?.toInt() ?? 0,
        total: (j['total'] as num?)?.toDouble() ?? 0,
        semanaActual: (j['semanaActual'] as num?)?.toDouble() ?? 0,
        comparacionConcreta: j['comparacionConcreta'] as String? ?? '',
      );
}

class PatronesComportamiento {
  const PatronesComportamiento({
    required this.diaMayorGasto,
    required this.categoriaMayorCrecimiento,
    required this.gastoHormigas,
  });
  final String diaMayorGasto;
  final CategoriaCrecimiento categoriaMayorCrecimiento;
  final GastosHormiga gastoHormigas;

  factory PatronesComportamiento.fromJson(Map<String, dynamic> j) =>
      PatronesComportamiento(
        diaMayorGasto: j['diaMayorGasto'] as String? ?? '—',
        categoriaMayorCrecimiento: CategoriaCrecimiento.fromJson(
          j['categoriaMayorCrecimiento'] as Map<String, dynamic>? ?? {},
        ),
        gastoHormigas: GastosHormiga.fromJson(
          (j['gastoHormigas'] ?? j['gastosHormiga']) as Map<String, dynamic>? ??
              {},
        ),
      );
}

class CategoriaCrecimiento {
  const CategoriaCrecimiento({required this.nombre, required this.pctCambio});
  final String nombre;
  final double pctCambio;

  factory CategoriaCrecimiento.fromJson(Map<String, dynamic> j) =>
      CategoriaCrecimiento(
        nombre: j['nombre'] as String? ?? '—',
        pctCambio: (j['pctCambio'] as num?)?.toDouble() ?? 0,
      );
}

class FlujoCajaLibre {
  const FlujoCajaLibre({
    required this.amount,
    required this.isNegative,
    required this.ingresoPromedio3m,
    required this.gastosFijosRecurrentes,
    required this.promedioVariables3m,
    required this.ratioAhorro,
    required this.ratioAhorroPct,
    required this.mensajeNatural,
  });
  final double amount;
  final bool isNegative;
  final double ingresoPromedio3m;
  final double gastosFijosRecurrentes;
  final double promedioVariables3m;
  final double ratioAhorro;
  final double ratioAhorroPct;
  final String mensajeNatural;

  factory FlujoCajaLibre.fromJson(Map<String, dynamic> j) => FlujoCajaLibre(
        amount: (j['amount'] as num?)?.toDouble() ?? 0,
        isNegative: j['isNegative'] as bool? ?? false,
        ingresoPromedio3m: (j['ingresoPromedio3m'] as num?)?.toDouble() ?? 0,
        gastosFijosRecurrentes:
            (j['gastosFijosRecurrentes'] as num?)?.toDouble() ?? 0,
        promedioVariables3m: (j['promedioVariables3m'] as num?)?.toDouble() ?? 0,
        ratioAhorro: (j['ratioAhorro'] as num?)?.toDouble() ?? 0,
        ratioAhorroPct: (j['ratioAhorroPct'] as num?)?.toDouble() ?? 0,
        mensajeNatural: j['mensajeNatural'] as String? ?? '',
      );
}

class ScoreFactor {
  const ScoreFactor({
    required this.nombre,
    required this.puntos,
    required this.maxPuntos,
    required this.microAccion,
  });
  final String nombre;
  final int puntos;
  final int maxPuntos;
  final String? microAccion;

  factory ScoreFactor.fromJson(Map<String, dynamic> j) => ScoreFactor(
        nombre: j['nombre'] as String? ?? '',
        puntos: (j['puntos'] as num?)?.toInt() ?? 0,
        maxPuntos: (j['maxPuntos'] as num?)?.toInt() ?? 0,
        microAccion: j['microAccion'] as String?,
      );
}

class ScoreFinanciero {
  const ScoreFinanciero({
    required this.total,
    required this.status,
    required this.factores,
    required this.deltaMesAnterior,
  });
  final int total;
  final String status;
  final List<ScoreFactor> factores;
  final int deltaMesAnterior;

  factory ScoreFinanciero.fromJson(Map<String, dynamic> j) => ScoreFinanciero(
        total: (j['total'] as num?)?.toInt() ?? 0,
        status: j['status'] as String? ?? 'orange',
        factores: (j['factores'] as List<dynamic>? ?? [])
            .map((e) => ScoreFactor.fromJson(e as Map<String, dynamic>))
            .toList(),
        deltaMesAnterior: (j['deltaMesAnterior'] as num?)?.toInt() ?? 0,
      );
}

class TopCategoriaMes {
  const TopCategoriaMes({
    required this.categoria,
    required this.total,
    required this.pct,
  });
  final String categoria;
  final double total;
  final double pct;

  factory TopCategoriaMes.fromJson(Map<String, dynamic> j) => TopCategoriaMes(
        categoria: j['categoria'] as String? ?? '',
        total: (j['total'] as num?)?.toDouble() ?? 0,
        pct: (j['pct'] as num?)?.toDouble() ?? 0,
      );
}

class MetaProgreso {
  const MetaProgreso({
    required this.nombre,
    required this.current,
    required this.target,
    required this.pct,
  });
  final String nombre;
  final double current;
  final double target;
  final double pct;

  factory MetaProgreso.fromJson(Map<String, dynamic> j) => MetaProgreso(
        nombre: j['nombre'] as String? ?? '',
        current: (j['current'] as num?)?.toDouble() ?? 0,
        target: (j['target'] as num?)?.toDouble() ?? 0,
        pct: (j['pct'] as num?)?.toDouble() ?? 0,
      );
}
