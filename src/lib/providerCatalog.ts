export interface CatalogModel {
  id: string
  name: string
  cost_per_1k: number
  context_length: number
}

export interface ProviderCatalogEntry {
  id: string
  label: string
  color: string
  placeholder: string
  keyUrl?: string
  needsKey: boolean
  base_url?: string
  models: CatalogModel[]
}

const m = (id: string, name: string, cost = 0, context = 128000): CatalogModel => ({
  id,
  name,
  cost_per_1k: cost,
  context_length: context,
})

export const PROVIDER_CATALOG: ProviderCatalogEntry[] = [
  {
    id: 'pollinations',
    label: 'Pollinations',
    color: '#c45c54',
    placeholder: 'sk_… (required)',
    keyUrl: 'https://enter.pollinations.ai/keys',
    needsKey: true,
    models: [
      m('gpt-5.6-sol', 'GPT-5.6 Sol'),
      m('gpt-5.6-luna', 'GPT-5.6 Luna'),
      m('gpt-5.4-mini', 'GPT-5.4 Mini'),
      m('openai-large', 'OpenAI Large'),
      m('kimi-k3', 'Kimi K3'),
      m('grok-large', 'Grok Large'),
      m('deepseek-pro', 'DeepSeek Pro'),
      m('glm', 'GLM'),
      m('gpt-4o', 'GPT-4o'),
      m('claude-hybridspace', 'Claude Hybridspace', 0, 200000),
      m('mistral', 'Mistral'),
      m('gemini', 'Gemini', 0, 1048576),
      m('llama', 'Llama'),
      m('qwen-coder', 'Qwen Coder'),
      m('deepseek', 'DeepSeek'),
      m('kimi-k2.6', 'Kimi K2.6'),
      m('grok', 'Grok'),
    ],
  },
  {
    id: 'openai',
    label: 'OpenAI',
    color: '#6fbf73',
    placeholder: 'sk-…',
    keyUrl: 'https://platform.openai.com/api-keys',
    needsKey: true,
    models: [
      m('gpt-4o', 'GPT-4o', 0.005),
      m('gpt-4o-mini', 'GPT-4o Mini', 0.00015),
      m('o3', 'o3', 0.01, 200000),
      m('o3-mini', 'o3-mini', 0.0011, 200000),
    ],
  },
  {
    id: 'anthropic',
    label: 'Anthropic',
    color: '#d08a4a',
    placeholder: 'sk-ant-…',
    keyUrl: 'https://console.anthropic.com/',
    needsKey: true,
    models: [
      m('claude-sonnet-4-20250514', 'Claude 4 Sonnet', 0.003, 200000),
      m('claude-3-5-sonnet-20241022', 'Claude 3.5 Sonnet', 0.003, 200000),
    ],
  },
  {
    id: 'google',
    label: 'Google',
    color: '#6ea0d4',
    placeholder: 'AIza…',
    keyUrl: 'https://aistudio.google.com/apikey',
    needsKey: true,
    models: [
      m('gemini-2.5-flash', 'Gemini 2.5 Flash', 0.0001, 1048576),
      m('gemini-2.5-pro', 'Gemini 2.5 Pro', 0.00125, 1048576),
    ],
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    color: '#6bbbb6',
    placeholder: 'sk-or-…',
    keyUrl: 'https://openrouter.ai/keys',
    needsKey: true,
    base_url: 'https://openrouter.ai/api/v1',
    models: [
      m('stealth/ox-alpha', 'Ox Alpha', 0, 1048576),
      m('anthropic/claude-sonnet-5', 'Claude Sonnet 5', 0.003, 1000000),
      m('anthropic/claude-opus-4.7', 'Claude Opus 4.7', 0.015, 1000000),
      m('anthropic/claude-haiku-4.5', 'Claude Haiku 4.5', 0.001, 200000),
      m('openai/gpt-5.6-sol', 'GPT-5.6 Sol', 0.005, 1050000),
      m('openai/gpt-5.6-luna', 'GPT-5.6 Luna', 0.005, 1050000),
      m('openai/gpt-5.4-mini', 'GPT-5.4 Mini', 0.001, 400000),
      m('google/gemini-3.5-flash', 'Gemini 3.5 Flash', 0.0001, 1048576),
      m('google/gemini-3.1-pro-preview', 'Gemini 3.1 Pro', 0.001, 1048576),
      m('deepseek/deepseek-v4-pro', 'DeepSeek V4 Pro', 0.0003, 1048576),
      m('qwen/qwen3-coder', 'Qwen3 Coder', 0.0003, 262144),
      m('moonshotai/kimi-k3', 'Kimi K3', 0.0006, 1048576),
      m('x-ai/grok-4.6', 'Grok 4.6', 0.003),
      m('meta-llama/llama-4-maverick', 'Llama 4 Maverick', 0.0003, 1048576),
      m('perplexity/sonar-pro', 'Sonar Pro', 0.001, 200000),
    ],
  },
  {
    id: 'ollama',
    label: 'Ollama',
    color: '#c4b06a',
    placeholder: 'http://localhost:11434',
    needsKey: false,
    base_url: 'http://localhost:11434',
    models: [m('llama3', 'Llama 3'), m('qwen2.5-coder', 'Qwen 2.5 Coder'), m('mistral', 'Mistral')],
  },
  {
    id: 'groq',
    label: 'Groq',
    color: '#c48a5a',
    placeholder: 'gsk_…',
    keyUrl: 'https://console.groq.com/keys',
    needsKey: true,
    base_url: 'https://api.groq.com/openai/v1',
    models: [
      m('llama-3.3-70b-versatile', 'Llama 3.3 70B'),
      m('llama-3.1-8b-instant', 'Llama 3.1 8B Instant'),
      m('qwen/qwen3-32b', 'Qwen 3 32B'),
      m('moonshotai/kimi-k2-instruct', 'Kimi K2'),
    ],
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    color: '#5a8fd4',
    placeholder: 'sk-…',
    keyUrl: 'https://platform.deepseek.com/api_keys',
    needsKey: true,
    base_url: 'https://api.deepseek.com',
    models: [
      m('deepseek-chat', 'DeepSeek Chat', 0.00027),
      m('deepseek-reasoner', 'DeepSeek Reasoner', 0.00055),
    ],
  },
  {
    id: 'xai',
    label: 'xAI',
    color: '#b0b0b0',
    placeholder: 'xai-…',
    keyUrl: 'https://console.x.ai/',
    needsKey: true,
    base_url: 'https://api.x.ai/v1',
    models: [
      m('grok-3', 'Grok 3', 0.003),
      m('grok-3-mini', 'Grok 3 Mini', 0.0003),
      m('grok-2', 'Grok 2', 0.002),
    ],
  },
  {
    id: 'mistral',
    label: 'Mistral',
    color: '#d4a05a',
    placeholder: '…',
    keyUrl: 'https://console.mistral.ai/api-keys/',
    needsKey: true,
    base_url: 'https://api.mistral.ai/v1',
    models: [
      m('mistral-large-latest', 'Mistral Large', 0.002),
      m('mistral-small-latest', 'Mistral Small', 0.0002),
      m('codestral-latest', 'Codestral', 0.0003),
    ],
  },
  {
    id: 'together',
    label: 'Together',
    color: '#7a8fd4',
    placeholder: '…',
    keyUrl: 'https://api.together.xyz/settings/api-keys',
    needsKey: true,
    base_url: 'https://api.together.xyz/v1',
    models: [
      m('meta-llama/Llama-3.3-70B-Instruct-Turbo', 'Llama 3.3 70B Turbo', 0.00088),
      m('Qwen/Qwen2.5-Coder-32B-Instruct', 'Qwen 2.5 Coder 32B', 0.0008),
      m('deepseek-ai/DeepSeek-V3', 'DeepSeek V3', 0.00125),
    ],
  },
  {
    id: 'fireworks',
    label: 'Fireworks',
    color: '#d46a5a',
    placeholder: '…',
    keyUrl: 'https://fireworks.ai/account/api-keys',
    needsKey: true,
    base_url: 'https://api.fireworks.ai/inference/v1',
    models: [
      m('accounts/fireworks/models/llama-v3p3-70b-instruct', 'Llama 3.3 70B', 0.0009),
      m('accounts/fireworks/models/deepseek-v3', 'DeepSeek V3', 0.0009),
      m('accounts/fireworks/models/qwen2p5-coder-32b-instruct', 'Qwen 2.5 Coder 32B', 0.0009),
    ],
  },
  {
    id: 'cerebras',
    label: 'Cerebras',
    color: '#8a7ad4',
    placeholder: 'csk-…',
    keyUrl: 'https://cloud.cerebras.ai/',
    needsKey: true,
    base_url: 'https://api.cerebras.ai/v1',
    models: [
      m('llama-3.3-70b', 'Llama 3.3 70B'),
      m('qwen-3-32b', 'Qwen 3 32B'),
    ],
  },
  {
    id: 'moonshot',
    label: 'Moonshot',
    color: '#8aa0c4',
    placeholder: 'sk-…',
    keyUrl: 'https://platform.moonshot.ai/console/api-keys',
    needsKey: true,
    base_url: 'https://api.moonshot.ai/v1',
    models: [
      m('kimi-k2-0905-preview', 'Kimi K2', 0.0006),
      m('moonshot-v1-128k', 'Moonshot v1 128k', 0.002, 128000),
    ],
  },
]

export const PROVIDER_CATALOG_MAP: Record<string, ProviderCatalogEntry> = Object.fromEntries(
  PROVIDER_CATALOG.map((p) => [p.id, p]),
)

export function catalogEntry(id: string): ProviderCatalogEntry | undefined {
  return PROVIDER_CATALOG_MAP[id]
}

export function emptyProviderConfig(id: string) {
  const entry = catalogEntry(id)
  if (!entry) return { api_key: '', models: [] as CatalogModel[] }
  return {
    api_key: '',
    base_url: entry.base_url,
    models: entry.models,
  }
}
