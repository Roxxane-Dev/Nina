/**
 * Explains why the server could not start listening. EADDRINUSE almost always means a previous
 * backend is still running (for example the one started by scripts/start-local.ps1).
 */
export function describeListenError(err: unknown, port: number | string): string | null {
  const code = (err as { code?: string } | null)?.code
  if (code === 'EADDRINUSE') {
    return `Port ${port} is already in use: a backend is probably already running, so you do not need to start another. ` +
      'To restart it: powershell -ExecutionPolicy Bypass -File scripts/stop-local.ps1, then start it again.'
  }
  if (code === 'EACCES') return `No permission to listen on port ${port}. Use another PORT in .env.`
  return null
}
