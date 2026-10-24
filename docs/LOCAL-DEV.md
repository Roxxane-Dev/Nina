# Running Nina locally

Everything runs on your machine: the Flutter app, the NestJS backend and a **local** Supabase (Docker). The app and the backend must use the **same** Supabase project, otherwise every API call answers 401 and you bounce back to the login. This setup guarantees it. It never touches the hosted project (`env/dev.json`).

## One command
From the repository root, in PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/start-local.ps1
```

It starts Docker Desktop if needed, the local Supabase, the backend (using your `.env`: OpenAI etc.) and the app in Chrome with `nina_app/env/local.json`. Options: `-Device windows` (desktop app), `-SkipApp` (database + backend only).

Stop the backend with `scripts/stop-local.ps1` (add `-Supabase` to stop the containers too). The backend log is `.local-logs/api.log`.

## Sign in
| Account | Email | Password | What it has |
|---|---|---|---|
| Yours | `dev@nina.test` | `nina-local-synthetic-1` | ~100 movements over 4 months, 3 accounts, consents given |
| User A | `usuario.a@nina.test` | same | the same data, plus membership of the shared space "Casa (sintética)" |
| User B | `usuario.b@nina.test` | same | a small set; not in A's space |

These exist only in your local database (they come from `supabase/seed.sql`). `npx supabase@latest db reset` rebuilds the database from the migrations and the seed. You can also create more accounts with "Crear cuenta" in the app (local email confirmation is off).

## Manual commands
```bash
npx supabase@latest start                       # local Supabase
node scripts/make-local-app-env.js               # writes nina_app/env/local.json (git-ignored)
npm run start:dev                                # backend (reads .env)
cd nina_app && flutter run -d chrome --dart-define-from-file=env/local.json
```

## Checks
```bash
npm run lint && npm test
cd nina_app && flutter analyze && flutter test
# RLS (local database only)
docker exec -i supabase_db_Nina psql -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase/tests/spaces_rls.sql
```

## Common problems
- **"La app y el servidor usan bases de datos distintas"**: you ran the app with `env/dev.json` (hosted project) against the local backend. Use `env/local.json`.
- **Login rejected right after a `db reset`**: restart the backend once (its connections to the old database are stale).
- **CORS in the browser**: in development `localhost` and `127.0.0.1` on any port are allowed automatically. For a real deployment set `NODE_ENV=production` and `CORS_ALLOWED_ORIGINS`.
