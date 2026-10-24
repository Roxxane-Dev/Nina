// Writes nina_app/env/local.json (git-ignored) with the values of the LOCAL Supabase started by
// `npx supabase@latest start`, so the Flutter app logs in against the same database as the backend.
//   node scripts/make-local-app-env.js
// Then run the app with:  flutter run --dart-define-from-file=env/local.json   (from nina_app/)
// It never touches env/dev.json and prints no keys.
const { execSync } = require('child_process')
const fs = require('fs')

const out = execSync('npx --yes supabase@latest status -o env', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
const env = Object.fromEntries(
  out
    .split('\n')
    .filter((l) => l.includes('='))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, '')]
    }),
)
if (!env.API_URL || !env.ANON_KEY) throw new Error('Local Supabase is not running. Start it with: npx supabase@latest start')
const host = new URL(env.API_URL).hostname
if (host !== '127.0.0.1' && host !== 'localhost') throw new Error('Refusing to write a non-local Supabase URL: ' + host)

fs.mkdirSync('nina_app/env', { recursive: true })
fs.writeFileSync(
  'nina_app/env/local.json',
  JSON.stringify({ SUPABASE_URL: env.API_URL, SUPABASE_ANON_KEY: env.ANON_KEY, API_BASE_URL: 'http://127.0.0.1:3000' }, null, 2) + '\n',
)
console.log('wrote nina_app/env/local.json (Supabase host: ' + host + ', API: http://127.0.0.1:3000). Not committed (git-ignored).')
