import { outlookText } from './outlook-text'

const base = {
  monthLabel: 'noviembre 2026',
  availableNow: 1200,
  expectedIncome: 3000,
  incomeDay: 15,
  overdueIncome: 0,
  recurringUntilEnd: 900,
  dailySpend: 50,
  daysLeft: 20,
  discretionaryUntilEnd: 1000,
  projected: 2300,
  confidence: 'high' as const,
}

describe('outlookText (INS-03)', () => {
  it('states the projection and every assumption, with engine figures only', () => {
    expect(outlookText(base)).toBe(
      'Si sigues como vas, cerrarías noviembre 2026 con unos S/ 2,300.00.\n\nAsí lo calculo:\n' +
        '• Hoy tienes S/ 1,200.00 disponibles.\n' +
        '• + S/ 3,000.00 de ingreso, que suele llegar el día 15.\n' +
        '• − S/ 900.00 de pagos fijos que se vienen.\n' +
        '• − S/ 1,000.00 del día a día: unos S/ 50.00 diarios por 20 días.\n\n' +
        'Es una estimación con lo que registraste, no una promesa.',
    )
  })

  it('a negative close is said plainly, and an overdue income is not counted', () => {
    const t = outlookText({ ...base, expectedIncome: 0, overdueIncome: 3000, projected: -700 })
    expect(t).toContain('noviembre 2026 cerraría en -S/ 700.00')
    expect(t).toContain('no está registrado y ya pasó su día, así que no lo cuento')
    expect(t).not.toContain('de ingreso, que suele llegar')
  })

  it('leaves out terms that are zero', () => {
    expect(outlookText({ ...base, recurringUntilEnd: 0 })).not.toContain('pagos fijos')
  })
})
