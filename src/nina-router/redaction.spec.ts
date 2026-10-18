import { redactPii, wrapUntrusted } from './redaction'

describe('redactPii', () => {
  it.each([
    ['email', 'escríbeme a ana.perez@example.com ya', 'ana.perez@example.com', 'EMAIL'],
    ['DNI', 'mi dni es 45678912', '45678912', 'DNI'],
    ['mobile', 'llámame al 987654321', '987654321', 'PHONE'],
    ['mobile with spaces', 'mi cel 987 654 321', '987 654 321', 'PHONE'],
    ['mobile with hyphens', 'mi cel 987-654-321', '987-654-321', 'PHONE'],
    ['+51 attached', 'mi cel +51987654321 gracias', '+51987654321', 'PHONE'],
    ['+51 spaced', 'mi cel +51 987 654 321 gracias', '+51 987 654 321', 'PHONE'],
    ['+51 with hyphen', 'mi cel +51-987654321', '+51-987654321', 'PHONE'],
    ['RUC 20', 'ruc 20123456789 de la empresa', '20123456789', 'RUC'],
    ['RUC 10', 'ruc 10456789123', '10456789123', 'RUC'],
    ['card plain', 'tarjeta 4111111111111111', '4111111111111111', 'CARD'],
    ['card grouped spaces', 'tarjeta 4111 1111 1111 1111', '4111 1111 1111 1111', 'CARD'],
    ['card grouped hyphens', 'tarjeta 4111-1111-1111-1111', '4111-1111-1111-1111', 'CARD'],
    ['amex grouped', 'amex 3782 822463 10005', '3782 822463 10005', 'CARD'],
    ['CCI plain', 'cci 00219300123456789012', '00219300123456789012', 'CCI'],
    ['CCI grouped', 'cci 002-193-001234567890-12', '002-193-001234567890-12', 'CCI'],
    ['account number', 'cuenta 19412345678901', '19412345678901', 'CARD'],
  ])('redacts %s', (_label, input, secret, kind) => {
    const { text, map } = redactPii(input)
    expect(text).not.toContain(secret)
    expect(text).toContain(`<${kind}_`)
    expect(Object.values(map)).toContain(secret)
  })

  it('keeps amounts, dates and ordinary words', () => {
    for (const input of ['gasté 25 en taxi', 'S/ 1,250.50 en comida', 'el 15 de octubre pagué 3 menús', 'compré 2026 clips']) {
      expect(redactPii(input).text).toBe(input)
    }
  })

  it('redacts several identifiers in one message', () => {
    const { text } = redactPii('ruc 20123456789, cel +51 987 654 321, mail a@b.pe')
    expect(text).not.toMatch(/\d{9}/)
    expect(text).not.toContain('a@b.pe')
  })

  it('wrapUntrusted fences redacted text', () => {
    expect(wrapUntrusted('mi cel 987654321')).toBe('<untrusted>mi cel <PHONE_1></untrusted>')
  })
})
