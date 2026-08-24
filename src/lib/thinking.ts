const OPEN_RE = /<think(?:ing)?\s*>|<reasoning\s*>/i
const CLOSE_RE = /<\/think(?:ing)?\s*>|<\/reasoning\s*>/i

export function splitThinkTags(raw: string): { content: string; reasoning: string } {
  if (!raw) return { content: '', reasoning: '' }
  const content: string[] = []
  const reasoning: string[] = []
  let rest = raw.replace(/\r\n/g, '\n')
  while (rest) {
    const open = rest.match(OPEN_RE)
    if (!open || open.index == null) {
      content.push(rest)
      break
    }
    content.push(rest.slice(0, open.index))
    rest = rest.slice(open.index + open[0].length)
    const close = rest.match(CLOSE_RE)
    if (!close || close.index == null) {
      reasoning.push(rest)
      break
    }
    reasoning.push(rest.slice(0, close.index))
    rest = rest.slice(close.index + close[0].length)
  }
  return {
    content: content.join(''),
    reasoning: reasoning.filter((part) => part.trim()).join('\n\n'),
  }
}

export function mergeReasoning(existing?: string, incoming?: string): string | undefined {
  const a = (existing || '').trim()
  const b = (incoming || '').trim()
  if (!a) return b || undefined
  if (!b) return a
  if (a.includes(b)) return a
  if (b.includes(a)) return b
  return `${a}\n\n${b}`
}
