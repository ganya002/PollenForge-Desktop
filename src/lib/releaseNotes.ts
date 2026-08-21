/** Drop installer boilerplate so every version uses the same compact notes. */
export function notesForDisplay(body: string): string {
  let text = (body || '').replace(/\r\n/g, '\n').trim()
  text = text.replace(/^#\s+Nexum[^\n]*\n+/i, '')
  const cut = text.search(/^##\s+(Download|Setup)\s*$/im)
  if (cut >= 0) text = text.slice(0, cut)
  text = text.trim()
  return text || 'Desktop AI coding assistant for macOS and Windows.'
}
