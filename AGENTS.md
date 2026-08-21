# PollenForge Desktop — agent notes

This is an Electron + React + Python desktop app. Packaged Mac/Windows builds update from **GitHub Releases**. Agents working on this repo must follow the release process below instead of telling users to re-clone.

## Versioning

- **Source of truth:** `package.json` `"version"` (semver, no `v` prefix).
- Electron reads it via `app.getVersion()`. Settings → About and Settings → Updates must stay wired to that IPC — **never hardcode** a version string in the UI.
- Git tags are `v` + that version. Example: `package.json` `1.2.3` → tag `v1.2.3`.
- CI bumps the patch version automatically when you push to `main` if that tag already exists.

## How updates work

1. A push to `main` (or **Run workflow**) starts [`.github/workflows/release.yml`](.github/workflows/release.yml).
2. CI tags a new version, then **must** build both Mac (`dmg` + `zip` for Intel and Apple Silicon) and Windows (`NSIS` + `zip`).
3. A GitHub Release is created **only after both platforms succeed**. Partial Mac-only or Windows-only releases are not published.
4. Installed apps:
   - **Latest:** `electron-updater` reads `latest-mac.yml` / `latest.yml` from that release.
   - **Older versions:** Settings → Updates lists releases via the GitHub API, downloads the installer for this OS, launches it, then quits so the installer can replace files.
5. `npm run dev` is unpackaged. The Updates UI still lists versions, but Check / Download / Install stay disabled.

User data lives in Electron `userData` and survives updates/rollbacks.

Packaged builds still need **system Python** on PATH. Do not ship `.venv`.

## How to ship an update

Push to `main`. That is the release. Do not create tags by hand unless you are recovering a failed run.

```bash
git push origin main
```

CI then:

1. Bumps patch if `v{current version}` already exists (`1.0.0` → `1.0.1`).
2. Pushes the version commit and `vX.Y.Z` tag.
3. Builds Mac **and** Windows.
4. Creates the GitHub Release with both installers.

To skip a release (docs-only, etc.), put `[skip release]` in the commit message.

To force a minor/major instead of a patch, bump `"version"` in `package.json` yourself **before** pushing, and do not reuse an existing tag.

Confirm:

- Release workflow is green for **mac** and **win**, then **publish**
- GitHub Release has `.dmg` / mac `.zip`, Windows `Setup.exe` / `.zip`, plus `latest-mac.yml` and `latest.yml`

Local packaging (does **not** publish):

```bash
npm run dist:mac
npm run dist:win
```

Installers land in `release/`. Unsigned builds are expected until notarization/code signing is added.

## What not to do

- Do not tell users to `git clone` / `git pull` as the update path for installed builds.
- Do not retag an existing version. Bump semver (or let CI patch-bump) and make a new tag.
- Do not put secrets, `.venv`, `dist/`, `dist-electron/`, or `release/` in git.
- Do not change `build.publish` owner/repo unless the GitHub remote moved. Current feed: `ganya002/PollenForge-Desktop`.
- Do not enable prereleases in `electron-updater` unless you also mark the GitHub Release as prerelease **and** intend testers to get it.

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
