/**
 * Log-safe helpers. Logs may carry codes and counts, never message text,
 * descriptions, amounts or raw provider error bodies.
 */

/** A short, content-free code for an error: HTTP status, error code or class name. */
export function safeErrorCode(err: unknown): string {
  const e = err as { status?: unknown; code?: unknown; name?: unknown } | null | undefined
  if (typeof e?.status === 'number') return `status_${e.status}`
  if (typeof e?.code === 'string' && /^[A-Za-z0-9_.-]{1,40}$/.test(e.code)) return e.code
  if (typeof e?.name === 'string' && /^[A-Za-z0-9_]{1,40}$/.test(e.name)) return e.name
  return 'error'
}

/** Gemini's SDK puts the status in the message ("[402 Payment Required]"); extract only the number. */
export function statusFromMessage(err: unknown): string | null {
  const m = /\[(\d{3})[ \]]/.exec(String((err as { message?: unknown })?.message ?? ''))
  return m ? `status_${m[1]}` : null
}

/** Validation reasons such as "ungrounded_number:1250.5" keep only the code before the colon. */
export function reasonCode(reason: string | undefined): string {
  return (reason ?? 'unknown').split(':')[0].slice(0, 40)
}
