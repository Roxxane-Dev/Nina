import { detectSpaceReference } from './spaces'

const CASA = { id: 's1', name: 'Casa' }
const FAMILIA = { id: 's2', name: 'Familia Pérez' }

describe('detectSpaceReference (US-35)', () => {
  it.each([
    ['pagué 1200 de alquiler, es de la casa', [CASA], { spaceId: 's1', name: 'Casa' }],
    ['gasté 1200 en alquiler, es compartido', [CASA], { spaceId: 's1', name: 'Casa' }],
    ['gasté 300 en mercado para la familia perez', [CASA, FAMILIA], { spaceId: 's2', name: 'Familia Pérez' }],
    ['gasté 85 en luz, es de Casa', [CASA, FAMILIA], { spaceId: 's1', name: 'Casa' }],
    ['gasté 1200 en alquiler, es compartido', [CASA, FAMILIA], { ambiguous: true }],
    ['gasté 25 en taxi', [CASA], null],
    ['es de la casa', [], null],
  ])('%s', (message, spaces, expected) => {
    expect(detectSpaceReference(message, spaces)).toEqual(expected)
  })

  it('does not match a space name inside another word', () => {
    expect(detectSpaceReference('gasté 50 en casaca', [CASA])).toBeNull()
  })
})
