/** Strip tool-call JSON and close dangling fences so chat markdown stays readable. */

function stripJsonToolObjects(text: string): string {
  let i = 0
  let last = 0
  const out: string[] = []
  const needles = ['{"name"', '{\n"name"', '{ "name"', '{\n  "name"', '{  "name"']

  while (i < text.length) {
    let idx = -1
    for (const pat of needles) {
      const found = text.indexOf(pat, i)
      if (found !== -1 && (idx === -1 || found < idx)) idx = found
    }
    if (idx === -1) break

    let depth = 0
    let inString = false
    let escape = false
    let end = -1
    for (let j = idx; j < text.length; j++) {
      const c = text[j]
      if (escape) {
        escape = false
        continue
      }
      if (c === '\\' && inString) {
        escape = true
        continue
      }
      if (c === '"') {
        inString = !inString
        continue
      }
      if (inString) continue
      if (c === '{') depth++
      else if (c === '}') {
        depth--
        if (depth === 0) {
          end = j + 1
          break
        }
      }
    }

    const candidate = end === -1 ? text.slice(idx) : text.slice(idx, end)
    const isTool = /"name"\s*:/.test(candidate) && /"args"\s*:/.test(candidate)
    if (isTool) {
      out.push(text.slice(last, idx))
      last = end === -1 ? text.length : end
      i = last
    } else {
      i = idx + 1
    }
  }

  out.push(text.slice(last))
  return out.join('')
}

export function sanitizeAssistantContent(raw: string): string {
  if (!raw) return raw
  let s = raw.replace(/\r\n/g, '\n')

  s = s.replace(/```tool[^\n]*\n[\s\S]*?(?:```|$)/g, '')
  s = s.replace(/```json[^\n]*\n(\s*\{[\s\S]*?"name"\s*:[\s\S]*?)(?:```|$)/g, (full, body: string) => {
    return /"args"\s*:/.test(body) ? '' : full
  })
  s = s.replace(/<\/?(?:tool_call|tool_calls|function_calls?)>/gi, '')
  s = s.replace(/<function=?[^>]*>[\s\S]*?<\/function>/gi, '')

  s = stripJsonToolObjects(s)

  s = s.replace(/\n{3,}/g, '\n\n').replace(/^[ \t]*\n+/, '')

  const fences = s.match(/```/g)
  if (fences && fences.length % 2 === 1) s += '\n```'

  return s
}
