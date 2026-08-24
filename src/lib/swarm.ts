const MAX_AGENTS = 3

export type SwarmTask = { role: string; task: string }

export type SwarmWorkerSeed = {
  id: string
  role: string
  task: string
}

export function parseSwarmTasks(tasks: unknown, goal = ''): SwarmTask[] {
  let raw: unknown = tasks
  if (typeof raw === 'string') {
    const text = raw.trim()
    if (!text) raw = []
    else {
      try {
        raw = JSON.parse(text)
      } catch {
        raw = [text]
      }
    }
  }
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) raw = [raw]
  if (!Array.isArray(raw)) raw = []
  const out: SwarmTask[] = []
  for (const item of raw) {
    if (typeof item === 'string' && item.trim()) {
      out.push({ role: 'worker', task: item.trim().slice(0, 2000) })
    } else if (item && typeof item === 'object') {
      const rec = item as Record<string, unknown>
      const task = String(rec.task || rec.goal || rec.prompt || '').trim()
      const role = String(rec.role || rec.name || 'worker').trim() || 'worker'
      if (task) out.push({ role: role.slice(0, 40), task: task.slice(0, 2000) })
    }
    if (out.length >= MAX_AGENTS) break
  }
  if (!out.length && String(goal || '').trim()) {
    out.push({ role: 'lead', task: String(goal).trim().slice(0, 2000) })
  }
  return out.slice(0, MAX_AGENTS)
}

export function swarmWorkersFromArgs(args: Record<string, unknown>): SwarmWorkerSeed[] {
  return parseSwarmTasks(args.tasks, String(args.goal || '')).map((item, i) => ({
    id: `s${i}`,
    role: item.role,
    task: item.task,
  }))
}
