# Nexum — agent notes

**This file is for every coding agent**, not only Cursor: Claude Code, Gemini CLI, GitHub Copilot, Codex, Aider, and humans. `CLAUDE.md`, `GEMINI.md`, `CONTRIBUTING.md`, and `.github/copilot-instructions.md` all point here. Do not keep a Cursor-only copy of this process.

This is an Electron + React + Python desktop app. Users get Mac and Windows builds from **GitHub Releases** (the Releases tab). Tags without a Release look like source-only dumps and are not the product.

Blocked by Windows Smart App Control / SmartScreen or macOS Gatekeeper: send users to **[docs/INSTALL.md](docs/INSTALL.md)**. Do not tell them to `git clone` to run the app.

## Versioning

- **Source of truth:** `package.json` `"version"` (semver, no `v` prefix).
- Electron reads it via `app.getVersion()`. Settings → About and Settings → Updates must stay wired to that IPC — **never hardcode** a version string in the UI.
- Git tags are `v` + that version. Example: `package.json` `1.2.3` → tag `v1.2.3`.
- CI bumps the patch version automatically when you push to `main` if that tag already exists.

## How updates work

1. A push to `main` (or **Run workflow**) starts [`.github/workflows/release.yml`](.github/workflows/release.yml).
2. CI tags a new version, then **must** build both Mac and Windows.
3. A GitHub **Release** is created **only after both platforms succeed**, with:
   - Title `Nexum X.Y.Z`
   - Notes from [`.github/release-notes.md`](.github/release-notes.md) (separate Mac / Windows download + setup)
   - `Nexum-X.Y.Z-Mac-arm64.dmg`, `Nexum-X.Y.Z-Mac-x64.dmg`, `Nexum-X.Y.Z-Windows-Setup.exe`
4. Installed apps:
   - **Latest:** `electron-updater` reads `latest-mac.yml` / `latest.yml` from that release.
   - **Older versions:** Settings → Updates lists releases, downloads the installer for this OS, launches it, then quits.
5. `npm run dev` is unpackaged. The Updates UI still lists versions, but Check / Download / Install stay disabled.

User data (chats, settings, skills) lives in Electron `userData` (`sessions/` for chats) and survives restarts and updates. Installing an older version can delete or hide that data — Settings → Updates warns before a downgrade.

Packaged builds install Python packages into Electron `userData` (`backend-venv`) via **[uv](https://docs.astral.sh/uv/)** or `python3 -m venv`. Do not ship `.venv`. Never `pip install` into Homebrew/system Python (PEP 668).

## How to ship an update

Push to `main`. That is the release. Do not create tags by hand unless you are recovering a failed run. Do not send users to the Tags page.

```bash
git push origin main
```

CI then:

1. Bumps patch if `v{current version}` already exists (`1.0.0` → `1.0.1`).
2. Pushes the version commit and `vX.Y.Z` tag.
3. Builds Mac **and** Windows.
4. Publishes the GitHub Release with named Mac/Windows installers.

To skip a release (docs-only, etc.), put `[skip release]` in the commit message.

To force a minor/major instead of a patch, bump `"version"` in `package.json` yourself **before** pushing, and do not reuse an existing tag.

Confirm on https://github.com/ganya002/PollenForge-Desktop/releases (Releases, not Tags):

- Title `Nexum X.Y.Z`
- Mac dmg + Windows Setup exe
- `latest-mac.yml` and `latest.yml`

Local packaging (does **not** publish):

```bash
npm run dist:mac
npm run dist:win
```

Installers land in `release/`. Builds are **unsigned**. Windows Smart App Control / SmartScreen and macOS Gatekeeper will block them until code signing exists. User steps: [docs/INSTALL.md](docs/INSTALL.md). Do not treat that warning as a failed build.

## What not to do

- Do not tell users to `git clone` / `git pull` / open **Tags** as the install or update path.
- Do not tell users the Smart App Control / Gatekeeper block means the installer is malware or a bad download. Point to [docs/INSTALL.md](docs/INSTALL.md).
- Do not retag an existing version. Bump semver (or let CI patch-bump) and make a new tag.
- Do not put secrets, `.venv`, `dist/`, `dist-electron/`, or `release/` in git. Do commit `backend/uv.lock` when backend dependencies change.
- Do not change `build.publish` owner/repo unless the GitHub remote moved. Current feed: `ganya002/PollenForge-Desktop`.
- Do not enable prereleases in `electron-updater` unless you also mark the GitHub Release as prerelease **and** intend testers to get it.
- Do not rename installer files away from `Mac-arm64` / `Mac-x64` / `Windows-Setup` without updating this file, the workflow notes, and `electron/releases.ts`.

## Code map

| Area | Path |
|------|------|
| Latest auto-update | `electron/updater.ts` |
| Release list + rollback download | `electron/releases.ts` |
| IPC bridge | `electron/preload.ts` |
| Packaged Python backend paths | `electron/backend.ts` |
| Updates UI | `src/components/Settings/UpdatesPanel.tsx` |
| Builder / publish config | `package.json` `"build"` |
| CI | `.github/workflows/release.yml` |
| Release notes template | `.github/release-notes.md` |
| Install / unblock (Windows + Mac) | `docs/INSTALL.md` |
