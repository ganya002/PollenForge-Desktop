export type ModelListMode = 'popular' | 'all' | 'free'

export interface FilterableModel {
  id: string
  name?: string
  cost_per_1k?: number
  cost_in_per_1k?: number
  cost_out_per_1k?: number
  cost_currency?: 'usd' | 'pollen' | string
  free?: boolean
  popular?: boolean
}

const POPULAR_PREFIXES = [
  'openai/gpt-4o',
  'openai/gpt-4.1',
  'openai/gpt-5',
  'openai/o1',
  'openai/o3',
  'openai/o4',
  'anthropic/claude-sonnet',
  'anthropic/claude-opus',
  'anthropic/claude-haiku',
  'anthropic/claude-fable',
  'anthropic/claude-3.5',
  'anthropic/claude-3.7',
  'google/gemini-3',
  'google/gemini-2.5',
  'google/gemini-2.0',
  'google/gemini-pro',
  'google/gemini-flash',
  'deepseek/deepseek-chat',
  'deepseek/deepseek-v3',
  'deepseek/deepseek-v4',
  'deepseek/deepseek-r1',
  'meta-llama/llama-3.3',
  'meta-llama/llama-4',
  'qwen/qwen2.5-coder',
  'qwen/qwen-2.5-coder',
  'qwen/qwen3',
  'mistralai/mistral-large',
  'mistralai/codestral',
  'x-ai/grok-3',
  'x-ai/grok-4',
  'x-ai/grok-5',
  'moonshotai/kimi-k2',
  'moonshotai/kimi-k3',
  'stealth/ox',
  'minimax/minimax-m',
  'perplexity/sonar',
]

export function isFreeModel(model: FilterableModel): boolean {
  if (model.free === true) return true
  if (model.free === false) return false
  if (typeof model.id === 'string' && /:free\b/i.test(model.id)) return true
  return Number(model.cost_per_1k || 0) === 0
}

export function isPopularModel(model: FilterableModel): boolean {
  if (model.popular === true) return true
  const id = (model.id || '').toLowerCase()
  if (!id) return false
  if (!id.includes('/')) return true
  return POPULAR_PREFIXES.some((prefix) => id === prefix || id.startsWith(`${prefix}-`) || id.startsWith(`${prefix}:`) || id.startsWith(prefix))
}

export function resolveModelList(config: { model_list?: string; free_models_only?: boolean }): ModelListMode {
  if (config.model_list === 'popular' || config.model_list === 'all' || config.model_list === 'free') {
    return config.model_list
  }
  if (config.free_models_only) return 'free'
  return 'popular'
}

export function visibleModels<T extends FilterableModel>(models: T[], mode: ModelListMode | boolean = 'all'): T[] {
  const resolved: ModelListMode = mode === true ? 'free' : mode === false ? 'all' : mode
  let out = models
  if (resolved === 'free') out = models.filter(isFreeModel)
  else if (resolved === 'popular') out = models.filter(isPopularModel)
  return [...out].sort((a, b) => {
    const pa = isPopularModel(a) ? 0 : 1
    const pb = isPopularModel(b) ? 0 : 1
    if (pa !== pb) return pa - pb
    return String(a.name || a.id).localeCompare(String(b.name || b.id))
  })
}

function compactNumber(n: number): string {
  if (!Number.isFinite(n) || n === 0) return '0'
  const abs = Math.abs(n)
  if (abs >= 10) return n.toFixed(1).replace(/\.0$/, '')
  if (abs >= 1) return n.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
  if (abs >= 0.01) return n.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
  return n.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
}

function formatUsdPer1k(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return ''
  if (n >= 0.01) return `$${n.toFixed(2)}/1k`
  if (n >= 0.001) return `$${n.toFixed(3)}/1k`
  return `$${n.toFixed(4)}/1k`
}

/** Pollen per 1k tokens is tiny; show in/out per million tokens. */
function formatPollen(model: FilterableModel): string {
  const inn = Number(model.cost_in_per_1k)
  const out = Number(model.cost_out_per_1k)
  if (Number.isFinite(inn) && Number.isFinite(out) && (inn > 0 || out > 0)) {
    return `${compactNumber(inn * 1000)}/${compactNumber(out * 1000)} P/M`
  }
  const n = Number(model.cost_per_1k || 0)
  if (n > 0) return `${compactNumber(n * 1000)} P/M`
  return ''
}

function formatUsdAmount(perMillion: number): string {
  if (!Number.isFinite(perMillion) || perMillion <= 0) return '$0'
  if (perMillion >= 1) return `$${perMillion.toFixed(2).replace(/\.00$/, '')}`
  if (perMillion >= 0.01) return `$${perMillion.toFixed(2)}`
  return `$${perMillion.toFixed(3)}`
}

function formatUsd(model: FilterableModel): string {
  const inn = Number(model.cost_in_per_1k)
  const out = Number(model.cost_out_per_1k)
  if (Number.isFinite(inn) && Number.isFinite(out) && (inn > 0 || out > 0)) {
    return `${formatUsdAmount(inn * 1000)}/${formatUsdAmount(out * 1000)} /M`
  }
  return formatUsdPer1k(Number(model.cost_per_1k || 0))
}

export function formatModelCost(model: FilterableModel): string {
  if (isFreeModel(model)) return 'Free'
  if (model.cost_currency === 'pollen') {
    return formatPollen(model) || 'Paid'
  }
  return formatUsd(model) || 'Paid'
}

