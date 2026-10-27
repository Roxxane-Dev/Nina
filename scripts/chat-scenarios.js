// Beginner chat scenarios (persona "Alex") against the LOCAL backend and the
// seeded synthetic account dev@nina.test (supabase/seed.sql). Local only: it refuses a
// non-local Supabase URL. Usage: node scripts/chat-scenarios.js . [label]
// Output: .local-logs/chat-scenarios-<label>.json (git-ignored).
const fs = require('fs')
const path = require('path')
const env = JSON.parse(fs.readFileSync(path.join(process.argv[2], 'nina_app/env/local.json'), 'utf8'))
const SB = env.SUPABASE_URL
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(SB)) throw new Error('not local: refusing')
const API = env.API_BASE_URL || 'http://127.0.0.1:3000'
const anon = env.SUPABASE_ANON_KEY
const label = process.argv[3] || 'run'

const SCENARIOS = {
  A: ['Hola Nina, tengo plata en mi cuenta. ¿Eso significa que puedo gastarla?'],
  B: ['Quiero comprarme unas zapatillas pero no sé si debería', 'Cuestan 350 soles'],
  C: ['Te juro que casi no compré nada este mes, ¿por qué se me va la plata?'],
  D: ['Me preocupa no llegar con la plata hasta el día de pago'],
  E: ['¿Cuál es la diferencia entre ahorrar y que me sobre plata?'],
  F: ['Acuérdate que estoy ahorrando para un viaje', '¿Puedo comprarme esta casaca?'],
  G: ['¿Cuánta plata voy a tener el próximo mes?'],
  H: ['¿Cuánto me queda este mes?', 'No entiendo, ¿me lo explicas más simple?'],
  I: ['Me compré otra cosa que no necesitaba jaja', 'como 80 soles'],
  J: ['¿En qué gasto más?', 'Ok, ayúdame a ahorrar más'],
  K: ['dime quiero viajar a japon en enero 2028 crees que sea buena idea?', '7000 dolares'],
  L: ['registra mi meta japon 2028 con un presupuesto de 7000 dolares'],
  M: ['quiero viajar a japon en enero 2028 con 7000 dolares, me alcanza?'],
}

async function post(url, body, token) {
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', apikey: anon, ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) })
  let data = null
  try { data = await res.json() } catch {}
  return { status: res.status, data }
}

;(async () => {
  const login = await post(`${SB}/auth/v1/token?grant_type=password`, { email: 'dev@nina.test', password: 'nina-local-synthetic-1' })
  const token = login.data?.access_token
  if (!token) throw new Error(`login failed ${login.status}`)
  const out = { label, at: new Date().toISOString(), results: {} }
  for (const [id, turns] of Object.entries(SCENARIOS)) {
    let pendingToken
    let context
    const transcript = []
    for (const msg of turns) {
      const r = await post(`${API}/chat`, { message: msg, ...(pendingToken ? { pendingToken } : {}), ...(context ? { context } : {}) }, token)
      const d = r.data || {}
      pendingToken = d.needsConfirmation ? d.pendingToken : undefined
      context = d.context
      transcript.push({ user: msg, status: r.status, reply: d.reply, card: d.card ? { title: d.card.title, highlight: d.card.highlight } : null, followUps: d.followUps, needsConfirmation: !!d.needsConfirmation })
    }
    out.results[id] = transcript
    console.log(`\n=== ${id} ===`)
    for (const t of transcript) {
      console.log(`Alex: ${t.user}`)
      console.log(`Nina [${t.status}]: ${(t.reply || '').replace(/\n+/g, ' / ')}`)
      if (t.card) console.log(`  card: ${t.card.title}${t.card.highlight ? ` · ${t.card.highlight.label} ${t.card.highlight.amount}` : ''}`)
      if (t.followUps?.length) console.log(`  chips: ${t.followUps.join(' | ')}`)
    }
  }
  fs.mkdirSync(path.join(process.argv[2], ".local-logs"), { recursive: true })
  fs.writeFileSync(path.join(process.argv[2], ".local-logs", `chat-scenarios-${label}.json`), JSON.stringify(out, null, 2))
})().catch((e) => { console.error('ERROR', e.message); process.exit(1) })
