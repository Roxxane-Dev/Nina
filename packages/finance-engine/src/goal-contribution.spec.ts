import { matchGoal, parseContributionRequest } from './goal-contribution'

describe('parseContributionRequest (HOME-02)', () => {
  it.each([
    ['aparté 200 para Japón', 200, 'japón'],
    ['Aparte S/ 150 para mi meta viaje a Japón', 150, 'viaje a japón'],
    ['le puse 300 soles a la laptop', 300, 'laptop'],
    ['separé 1,500 para el carro', 1500, 'carro'],
    ['ahorré 200 este mes', 200, ''],
    ['guardé 50', 50, ''],
  ])('%s', (msg, amount, goalText) => {
    expect(parseContributionRequest(msg)).toEqual({ amount, currency: 'PEN', goalText })
  })

  it('reads dollars', () => {
    expect(parseContributionRequest('aparté 100 dólares para japón')).toEqual({ amount: 100, currency: 'USD', goalText: 'japón' })
  })

  it.each([
    '¿cuánto debería apartar para japón?',
    'quiero ahorrar 2000 para un viaje',
    'gasté 25 en taxi',
    'aparté plata para japón',
    '¿puedo apartar 200?',
  ])('not a contribution: %s', (msg) => {
    expect(parseContributionRequest(msg)).toBeNull()
  })
})

describe('matchGoal', () => {
  const japon = { id: 'g1', name: 'Viaje a Japón' }
  const laptop = { id: 'g2', name: 'Laptop nueva' }
  const japon2 = { id: 'g3', name: 'Japón 2028' }

  it('matches by name, ignoring accents and generic words', () => {
    expect(matchGoal('japon', [japon, laptop])).toEqual({ goal: japon })
    expect(matchGoal('viaje a japón', [japon, laptop])).toEqual({ goal: japon })
    expect(matchGoal('la laptop', [japon, laptop])).toEqual({ goal: laptop })
  })

  it('no name: the only goal, or ask which one', () => {
    expect(matchGoal('', [japon])).toEqual({ goal: japon })
    expect(matchGoal('', [japon, laptop])).toEqual({ ambiguous: [japon, laptop] })
  })

  it('two goals with the same word are ambiguous; an unknown name is none', () => {
    expect(matchGoal('japón', [japon, japon2, laptop])).toEqual({ ambiguous: [japon, japon2] })
    expect(matchGoal('carro', [japon, laptop])).toEqual({ none: true })
    expect(matchGoal('japón', [])).toEqual({ none: true })
  })
})
