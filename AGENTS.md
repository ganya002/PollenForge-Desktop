# PollenForge Desktop — agent notes

This is an Electron + React + Python desktop app. Packaged Mac/Windows builds update from **GitHub Releases**. Agents working on this repo must follow the release process below instead of telling users to re-clone.

## Versioning

- **Source of truth:** `package.json` `"version"` (semver, no `v` prefix).
- Electron reads it via `app.getVersion()`. Settings → About and Settings → Updates must stay wired to that IPC — **never hardcode** a version string in the UI.
- Git tags are `v` + that version. Example: `package.json` `1.2.3` → tag `v1.2.3`.
- The tag **must** match `package.json` or `electron-builder` will refuse to publish.

## How updates work

1. A git tag `v*` is pushed.
2. [`.github/workflows/release.yml`](.github/workflows/release.yml) builds Mac (`dmg` + `zip`) and Windows (`NSIS` + `zip`) and uploads them to the GitHub Release.
3. Installed apps:
   - **Latest:** `electron-updater` reads `latest-mac.yml` / `latest.yml` from that release.
   - **Older versions:** Settings → Updates lists releases via the GitHub API, downloads the installer for this OS, launches it, then quits so the installer can replace files.
4. `npm run dev` is unpackaged. The Updates UI still lists versions, but Check / Download / Install stay disabled.

User data lives in Electron `userData` and survives updates/rollbacks.

Packaged builds still need **system Python** on PATH. Do not ship `.venv`.

## How to ship an update

Do this every time the app should go out to users. Do not skip the tag.

1. Make sure `main` is green enough to ship (build at least: `npm run build`).
2. Bump `"version"` in `package.json` (and let `package-lock.json` follow if npm rewrites it).
3. Commit the version bump **and** the code that belongs in that release.
4. Tag and push:

```bash
git tag vX.Y.Z
git push origin main
git push origin vX.Y.Z
```

5. Confirm the **Release** workflow on GitHub succeeded for both `macos-latest` and `windows-latest`.
6. Confirm the GitHub Release for `vX.Y.Z` has installers plus `latest-mac.yml` / `latest.yml`.

Local packaging (does **not** publish):

```bash
npm run dist:mac
npm run dist:win
```

CI publishes with `electron-builder --publish always` and `GH_TOKEN`. Unsigned builds are expected until notarization/code signing is added.

## What not to do

- Do not tell users to `git clone` / `git pull` as the update path for installed builds.
- Do not retag an existing version. Bump semver and make a new tag.
- Do not put secrets, `.venv`, `dist/`, or `dist-electron/` in git.
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
