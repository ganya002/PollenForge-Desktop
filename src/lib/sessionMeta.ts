export function sessionTimestampMs(session: { modified?: string; updated_at?: number }): number {
  const updated = session.updated_at
  if (typeof updated === 'number' && updated > 0) {
    return updated > 1e12 ? updated : updated * 1000
  }
  if (session.modified) {
    const parsed = Date.parse(session.modified)
    if (!Number.isNaN(parsed)) return parsed
  }
  return 0
}

export function normalizeSession(raw: Record<string, unknown>) {
  const updated = typeof raw.updated_at === 'number' ? raw.updated_at : 0
  const ts = sessionTimestampMs({
    modified: typeof raw.modified === 'string' ? raw.modified : '',
    updated_at: updated,
  })
  return {
    id: String(raw.id || ''),
    name: typeof raw.name === 'string' && raw.name ? raw.name : 'Untitled',
    created: typeof raw.created === 'string' ? raw.created : '',
    modified: ts ? new Date(ts).toISOString() : '',
    message_count: typeof raw.message_count === 'number' ? raw.message_count : 0,
    updated_at: ts || undefined,
    directory: typeof raw.directory === 'string' ? raw.directory : '',
    preview: typeof raw.preview === 'string' ? raw.preview : '',
    pinned: !!raw.pinned,
  }
}
