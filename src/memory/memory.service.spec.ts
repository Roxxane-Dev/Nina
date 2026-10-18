import { MemoryService } from './memory.service'

const EMAIL = 'ana.perez@example.com'
const PHONE = '987654321'
const DNI = '45678912'
const TEXT = `Soy Ana, mi correo es ${EMAIL}, mi celular ${PHONE} y mi DNI ${DNI}. Gasté 25 en taxi`

function build() {
  const create = jest.fn().mockResolvedValue({ data: [{ embedding: new Array(1536).fill(0) }] })
  const insert = jest.fn().mockResolvedValue({ error: null })
  const rpc = jest.fn().mockResolvedValue({ data: [], error: null })
  const service = new MemoryService({ get: () => undefined } as never) as any
  service.openai = { embeddings: { create } }
  service.adminClient = { from: () => ({ insert }), rpc }
  return { service: service as MemoryService, create, insert }
}

function embeddedInput(create: jest.Mock): string {
  return create.mock.calls.map((c) => String(c[0].input)).join('\n')
}

describe('MemoryService PII redaction before embeddings', () => {
  beforeEach(() => jest.spyOn(console, 'log').mockImplementation(() => undefined))
  afterEach(() => jest.restoreAllMocks())

  it('never sends email, phone or document number to the embedding call (store)', async () => {
    const { service, create, insert } = build()
    await service.storeMessage('user-1', 'user', TEXT)

    const sent = embeddedInput(create)
    expect(sent).not.toContain(EMAIL)
    expect(sent).not.toContain(PHONE)
    expect(sent).not.toContain(DNI)
    expect(sent).toContain('<EMAIL_')
    expect(sent).toContain('Gasté 25 en taxi')
    // The user's own stored message is unchanged.
    expect(insert.mock.calls[0][0].content).toBe(TEXT)
  })

  it('never sends email, phone or document number to the embedding call (retrieval)', async () => {
    const { service, create } = build()
    await service.retrieveRelevantMemories('user-1', TEXT)

    const sent = embeddedInput(create)
    expect(sent).not.toContain(EMAIL)
    expect(sent).not.toContain(PHONE)
    expect(sent).not.toContain(DNI)
  })

  it('does not log the embedding model name', async () => {
    const { service } = build()
    await service.storeMessage('user-1', 'user', 'hola')
    const logged = (console.log as jest.Mock).mock.calls.flat().join(' ')
    expect(logged).not.toContain('USING EMBEDDING MODEL')
  })
})
