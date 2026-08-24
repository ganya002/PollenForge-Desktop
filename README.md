# Nexum

**Matte black AI coding assistant — a Codex / Claude Code / Cursor clone with full computer access.**

Nexum is an Electron + React desktop app with a Python backend that gives LLMs **full local control**: read/write/edit files, run shell commands, control apps, manage git/GitHub, run tests/linters, and automate workflows.

Built on top of [Pollinations.ai](https://pollinations.ai) (free by default) with support for OpenAI, Anthropic, Google, Ollama, and OpenRouter.

![Matte black](https://img.shields.io/badge/theme-matte%20black-0a0a0a) ![Electron](https://img.shields.io/badge/Electron-33-47848F) ![React](https://img.shields.io/badge/React-18-61DAFB) ![Python](https://img.shields.io/badge/Python-3.14-3776AB) ![License: MIT](https://img.shields.io/badge/License-MIT-yellow)

<img width="800" alt="Nexum" src="https://via.placeholder.com/800x450/0a0a0a/f0f0f0?text=Nexum+%E2%80%94+matte+black">

## Download

Installers are on **[Releases](https://github.com/ganya002/PollenForge-Desktop/releases/latest)** (not the Tags page).

| | Download |
|---|---|
| **macOS (Apple Silicon)** | `Nexum-*-Mac-arm64.dmg` |
| **macOS (Intel)** | `Nexum-*-Mac-x64.dmg` |
| **Windows** | `Nexum-*-Windows-Setup.exe` |

### Setup after download

Full steps (including Windows Smart App Control): **[docs/INSTALL.md](docs/INSTALL.md)**.

1. First launch installs a private Python env into app data. Optional: [uv](https://docs.astral.sh/uv/) (`brew install uv`) — Nexum also downloads uv if needed. Do not `pip install` into Homebrew Python.
2. **Mac:** open the `.dmg`, drag Nexum to Applications, then right-click → **Open**.
3. **Windows:** run the Setup `.exe`. If Windows blocks it, see [docs/INSTALL.md](docs/INSTALL.md) (More info → Run anyway, or turn off Smart App Control, or Unblock the file).
4. Open the app → Settings → paste an API key.

Later versions install from **Update** inside the app. You do not clone again.

## Features

**Codex-parity core:**
- **Full computer access** — file I/O, shell (`run_command`), app control (`open_app`), 69 tools total
- **Agent loop** — 12 iterations, continues after failures, salvages truncated outputs, deduplicates repeating tools
- **Diff & patch** — `show_diff`, `file_diff`, `apply_patch`, `revert_file`
- **Worktrees** — `worktree_list/add/remove/prune` (isolated git worktrees)
- **Background tasks** — `start_background_task` + `get_task`/`get_task_logs`/`list_tasks` (Codex cloud-style)
- **Code analysis** — `find_files`, `search_code`, `analyze_dependencies`, `tree_view`, `get_file_info`
- **Git & GitHub** — 14 git tools + 9 GitHub tools (PRs, issues, clone, search)
- **Test & quality** — `run_tests` (jest/vitest/pytest/cargo/go), `run_linter`, `run_formatter`, `run_build`, `run_typecheck`, `run_security_scan`
- **Skills** — `save_skill`/`list_skills`/`teach_convention` + auto-loads `AGENTS.md` / `.opencode/AGENTS.md`
- **Sessions** — persistent chat history with rename, grouped Today/Yesterday/Earlier

**Providers (vibrant distinct colors, no purple):**
- Pollinations (free, default) — bright red
- OpenAI — emerald
- Anthropic — orange
- Google — blue
- Ollama — yellow
- **OpenRouter** — cyan (14 best coding models: Claude 3.5 Sonnet, GPT-4o, o3-mini, DeepSeek Coder/V3, Qwen 2.5 Coder, Llama 405B, Gemini 2.0 Flash, Codestral)

**UI — Cursor/Codex matte black:**
- Matte black theme (`#0a0a0a`/`#141414`/`#1e1e1e`), off-white accent, no purple
- Resizable sidebar (drag handle, 200–480px, persisted), vibrant provider dots
- Tool timeline (Codex-style collapsed cards with status/spinner/duration), diff viewer, terminal output
- File tree with vector icons + git badges, session list, worktree indicator, background task panel
- Input with ` @` file mentions, `/` commands, drag-and-drop attach, auto-approve (like `codex --yolo`), command palette (`Cmd+K`), keyboard help (`Cmd+/`)
- Readable typography: Geist Sans + Inter + JetBrains Mono, 14.5px/1.75 for long texts

## Quick start (from source)

```bash
# 1. Clone
git clone https://github.com/ganya002/PollenForge-Desktop.git
cd PollenForge-Desktop

# 2. Install JS deps
npm install

# 3. Python backend (uv creates .venv and installs fastapi/uvicorn/httpx/websockets)
uv sync --directory backend
cd ..

# 4. Dev (frontend :5173 + backend :8765 + Electron)
npm run dev

# 5. Build
npm run build   # vite + electron
```

Open the app → Settings (`Cmd+,`) → paste API key for your provider.

- **Pollinations** is free and works without a key (rate-limited). Get a key at https://enter.pollinations.ai/keys → `POLLINATIONS_API_KEY` goes in Settings or `~/.config/nexum/config.json`
- **OpenRouter**: https://openrouter.ai/keys
- **OpenAI**: https://platform.openai.com/api-keys
- **Anthropic**: https://console.anthropic.com/

No keys are committed — see `.env.example`. The app reads `~/.config/nexum/config.json` and `~/.local/share/nexum/.env` at runtime (gitignored). Previous PollenForge config paths are still read as a fallback.

## Configuration

All keys are stored **outside the repo** in `~/.config/nexum/config.json` (or via Settings UI). Example:

```json
{
  "providers": {
    "pollinations": { "api_key": "sk_..." },
    "openrouter": { "api_key": "sk-or-..." }
  }
}
```

Or use the Settings modal in-app. Never commit `.env`.

## Project structure

```
Nexum/
├── electron/           # Electron main + backend launcher
├── backend/            # FastAPI + WebSocket server
│   ├── server.py       # agent loop, tool parsing (handles truncated outputs)
│   ├── providers/      # pollinations, openai, anthropic, google, ollama, openrouter
│   └── tools/          # filesystem, shell, git, github, code_analysis, test_runner, diff, worktree, tasks, skills
├── src/
│   ├── components/     # Chat, Sidebar, Input, StatusBar, DiffViewer, TaskPanel
│   ├── hooks/          # useWebSocket (reconnect, ping), useChat (tool timeline)
│   └── store/          # Zustand (messages, sessions, worktrees, tasks)
└── src/styles/         # matte black theme, diff/terminal styles
```

## How it works (Codex clone)

1. `Tool` format: ````tool {"name":"write_file","args":{"path":"/tmp/x","content":"..."}}``` (also handles raw JSON and truncated salvaged outputs)
2. Provider streams tokens → `tool_start`/`tool_result` events → frontend `ToolResult` timeline
3. Backend loops up to 12 turns: execute tools (sync tools via `asyncio.to_thread` + 30s timeout), feed `[Tool result]` back to model, repeat until no more tools
4. Search is guarded: no full-home scan with large regex (>30 chars), `max_scanned 2000`, ignored `.git/node_modules`

## Security

- Dangerous commands (`rm -rf`, `curl | sh`, `sudo`, etc.) blocked via `danger.py` + approval prompts (auto-approve toggle = Codex `--yolo`)
- No secrets in git — `.gitignore` excludes `.env`, `sessions/`, `logs/`, `dist/`, `.venv/`, `node_modules/`
- Single clean initial commit, no history imported

## Related

- **PollenForge (terminal CLI)** — private: `ganya002/Pollenforge-CLI`
- **PollenForge (original)** — public: `ganya002/Pollenforge`

## License

MIT
