const SPECIAL: Record<string, { color: string; label: string }> = {
  'package.json': { color: 'text-emerald-400', label: 'NPM' },
  'package-lock.json': { color: 'text-emerald-400', label: 'NPM' },
  'pnpm-lock.yaml': { color: 'text-amber-400', label: 'PN' },
  'yarn.lock': { color: 'text-sky-400', label: 'YN' },
  'bun.lock': { color: 'text-zinc-300', label: 'BN' },
  'tsconfig.json': { color: 'text-sky-400', label: 'TS' },
  dockerfile: { color: 'text-sky-400', label: 'DK' },
  'docker-compose.yml': { color: 'text-sky-400', label: 'DK' },
  'docker-compose.yaml': { color: 'text-sky-400', label: 'DK' },
  'compose.yml': { color: 'text-sky-400', label: 'DK' },
  'compose.yaml': { color: 'text-sky-400', label: 'DK' },
  makefile: { color: 'text-zinc-300', label: 'MK' },
  'cmakelists.txt': { color: 'text-emerald-400', label: 'CM' },
  'cargo.toml': { color: 'text-orange-400', label: 'RS' },
  'go.mod': { color: 'text-cyan-400', label: 'GO' },
  'pyproject.toml': { color: 'text-emerald-400', label: 'PY' },
  'requirements.txt': { color: 'text-emerald-400', label: 'PY' },
  pipfile: { color: 'text-emerald-400', label: 'PY' },
  'readme.md': { color: 'text-zinc-300', label: 'MD' },
  'agents.md': { color: 'text-zinc-300', label: 'MD' },
  'claude.md': { color: 'text-zinc-300', label: 'MD' },
  license: { color: 'text-zinc-400', label: 'LIC' },
  'license.md': { color: 'text-zinc-400', label: 'LIC' },
  '.gitignore': { color: 'text-orange-400', label: 'GIT' },
  '.gitattributes': { color: 'text-orange-400', label: 'GIT' },
  '.env': { color: 'text-amber-300', label: 'ENV' },
  '.env.local': { color: 'text-amber-300', label: 'ENV' },
  '.editorconfig': { color: 'text-zinc-400', label: 'ED' },
  'vite.config.ts': { color: 'text-violet-400', label: 'VT' },
  'vite.config.js': { color: 'text-violet-400', label: 'VT' },
}

const EXT: Record<string, { color: string; label: string }> = {
  ts: { color: 'text-sky-400', label: 'TS' },
  tsx: { color: 'text-sky-400', label: 'TX' },
  js: { color: 'text-amber-400', label: 'JS' },
  jsx: { color: 'text-amber-400', label: 'JX' },
  mjs: { color: 'text-amber-400', label: 'JS' },
  cjs: { color: 'text-amber-400', label: 'JS' },
  py: { color: 'text-emerald-400', label: 'PY' },
  pyw: { color: 'text-emerald-400', label: 'PY' },
  pyi: { color: 'text-emerald-400', label: 'PY' },
  rs: { color: 'text-orange-400', label: 'RS' },
  go: { color: 'text-cyan-400', label: 'GO' },
  java: { color: 'text-orange-400', label: 'JV' },
  kt: { color: 'text-violet-400', label: 'KT' },
  kts: { color: 'text-violet-400', label: 'KT' },
  c: { color: 'text-sky-300', label: 'C' },
  h: { color: 'text-sky-300', label: 'H' },
  cpp: { color: 'text-sky-300', label: 'C+' },
  cc: { color: 'text-sky-300', label: 'C+' },
  cxx: { color: 'text-sky-300', label: 'C+' },
  hpp: { color: 'text-sky-300', label: 'H+' },
  cs: { color: 'text-violet-400', label: 'CS' },
  rb: { color: 'text-red-400', label: 'RB' },
  php: { color: 'text-indigo-400', label: 'PHP' },
  swift: { color: 'text-orange-400', label: 'SW' },
  css: { color: 'text-pink-400', label: 'CSS' },
  scss: { color: 'text-pink-400', label: 'SC' },
  less: { color: 'text-indigo-400', label: 'LS' },
  html: { color: 'text-orange-400', label: 'HT' },
  htm: { color: 'text-orange-400', label: 'HT' },
  json: { color: 'text-amber-300', label: '{ }' },
  jsonc: { color: 'text-amber-300', label: '{ }' },
  md: { color: 'text-zinc-400', label: 'MD' },
  mdx: { color: 'text-zinc-400', label: 'MD' },
  yml: { color: 'text-violet-400', label: 'YL' },
  yaml: { color: 'text-violet-400', label: 'YL' },
  toml: { color: 'text-zinc-300', label: 'TM' },
  xml: { color: 'text-orange-400', label: 'XM' },
  svg: { color: 'text-amber-300', label: 'VG' },
  sql: { color: 'text-sky-400', label: 'SQL' },
  sh: { color: 'text-emerald-400', label: 'SH' },
  bash: { color: 'text-emerald-400', label: 'SH' },
  zsh: { color: 'text-emerald-400', label: 'SH' },
  ps1: { color: 'text-sky-400', label: 'PS' },
  bat: { color: 'text-zinc-400', label: 'BAT' },
  cmd: { color: 'text-zinc-400', label: 'CMD' },
  env: { color: 'text-amber-300', label: 'ENV' },
  lock: { color: 'text-zinc-400', label: 'LK' },
  png: { color: 'text-violet-400', label: 'IMG' },
  jpg: { color: 'text-violet-400', label: 'IMG' },
  jpeg: { color: 'text-violet-400', label: 'IMG' },
  gif: { color: 'text-violet-400', label: 'IMG' },
  webp: { color: 'text-violet-400', label: 'IMG' },
  ico: { color: 'text-violet-400', label: 'IMG' },
  pdf: { color: 'text-red-400', label: 'PDF' },
  zip: { color: 'text-amber-400', label: 'ZIP' },
  tar: { color: 'text-amber-400', label: 'TAR' },
  gz: { color: 'text-amber-400', label: 'GZ' },
  '7z': { color: 'text-amber-400', label: '7Z' },
  vue: { color: 'text-emerald-400', label: 'VU' },
  svelte: { color: 'text-orange-400', label: 'SV' },
  astro: { color: 'text-orange-400', label: 'AS' },
  txt: { color: 'text-zinc-400', label: 'TXT' },
  log: { color: 'text-zinc-400', label: 'LOG' },
  csv: { color: 'text-emerald-400', label: 'CSV' },
  ipynb: { color: 'text-orange-400', label: 'NB' },
  wasm: { color: 'text-violet-400', label: 'WA' },
  dll: { color: 'text-zinc-400', label: 'BIN' },
  exe: { color: 'text-zinc-400', label: 'EXE' },
  dmg: { color: 'text-zinc-400', label: 'DMG' },
}

function styleFor(name: string) {
  const lower = name.toLowerCase()
  if (SPECIAL[lower]) return SPECIAL[lower]
  if (lower.startsWith('.env')) return SPECIAL['.env']
  if (lower.startsWith('tsconfig') && lower.endsWith('.json')) return SPECIAL['tsconfig.json']
  const ext = lower.includes('.') ? lower.slice(lower.lastIndexOf('.') + 1) : ''
  if (EXT[ext]) return EXT[ext]
  return { color: 'text-zinc-400', label: (ext || '·').slice(0, 3).toUpperCase() }
}

export function FileTypeIcon({
  name,
  isDirectory,
  isExpanded,
}: {
  name: string
  isDirectory: boolean
  isExpanded?: boolean
}) {
  if (isDirectory) {
    return (
      <span className="w-4 h-4 shrink-0 inline-flex items-center justify-center">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-sky-400">
          <path
            d="M1.5 3.5A1.5 1.5 0 013 2h4l2 2h5a1.5 1.5 0 011.5 1.5v7A1.5 1.5 0 0114 14H3a1.5 1.5 0 01-1.5-1.5v-9z"
            fill="currentColor"
            opacity={isExpanded ? 0.95 : 0.85}
          />
          {isExpanded && <path d="M2 6h12" stroke="white" strokeOpacity="0.25" strokeWidth="1" />}
        </svg>
      </span>
    )
  }

  const { color, label } = styleFor(name)
  return (
    <span className={`w-4 h-4 shrink-0 inline-flex items-center justify-center overflow-hidden ${color}`}>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path
          d="M3.2 1.8A1.2 1.2 0 014.4 0.6h4.7l3.5 3.5v9.7A1.2 1.2 0 0111.4 15H4.4A1.2 1.2 0 013.2 13.8V1.8z"
          fill="currentColor"
          opacity="0.16"
        />
        <path
          d="M3.2 1.8A1.2 1.2 0 014.4 0.6h4.7l3.5 3.5v9.7A1.2 1.2 0 0111.4 15H4.4A1.2 1.2 0 013.2 13.8V1.8z"
          stroke="currentColor"
          strokeWidth="1.05"
        />
        <path d="M9.1 0.6v3.4h3.5" stroke="currentColor" strokeWidth="1.05" strokeLinejoin="round" />
        <text
          x="8"
          y="11.2"
          textAnchor="middle"
          fontSize="4.4"
          fontWeight="700"
          fill="currentColor"
          fontFamily="ui-sans-serif, system-ui, sans-serif"
        >
          {label}
        </text>
      </svg>
    </span>
  )
}

export function ChatIcon({ className = 'text-text-muted' }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className={`shrink-0 ${className}`}>
      <path
        d="M3 3.5A1.5 1.5 0 014.5 2h7A1.5 1.5 0 0113 3.5v5A1.5 1.5 0 0111.5 10H8l-3 3v-3H4.5A1.5 1.5 0 013 8.5v-5z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  )
}
