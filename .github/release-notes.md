# Nexum ${VERSION}

Desktop AI coding assistant for **macOS** and **Windows**.

## Download

### macOS ${VERSION}

- **Apple Silicon (M1–M4):** [Nexum-${VERSION}-Mac-arm64.dmg](${BASE}/Nexum-${VERSION}-Mac-arm64.dmg)
- **Intel:** [Nexum-${VERSION}-Mac-x64.dmg](${BASE}/Nexum-${VERSION}-Mac-x64.dmg)

On a Mac, Apple menu → About This Mac. If the chip says Apple, use Apple Silicon.

### Windows ${VERSION}

- **Installer (recommended):** [Nexum-${VERSION}-Windows-Setup.exe](${BASE}/Nexum-${VERSION}-Windows-Setup.exe)
- **Portable zip:** [Nexum-${VERSION}-Windows.zip](${BASE}/Nexum-${VERSION}-Windows.zip)

## Setup

Nexum needs **Python 3** on your PATH (the UI is packaged; the local tools backend is Python).

1. Install Python 3 from https://www.python.org/downloads/
   - Windows: enable **Add python.exe to PATH**
2. Install Nexum with the file above.
3. Open the app → **Settings** → paste an API key (Pollinations works without a key).

### macOS install

1. Open the `.dmg`.
2. Drag **Nexum** into **Applications**.
3. First launch: right-click the app → **Open** (builds are unsigned until notarized).

### Windows install

1. Run **Windows Setup**.
2. If **Windows protected your PC** (SmartScreen): **More info** → **Run anyway**.
3. If **Smart App Control** blocks it with no Run anyway:
   - Windows Security → App & browser control → Smart App Control → **Off**
   - Or right-click the `.exe` → Properties → check **Unblock** → Apply
4. Open Nexum from the Start menu.

Full unblock steps: https://github.com/ganya002/PollenForge-Desktop/blob/main/docs/INSTALL.md

Later versions install from inside the app (**Update** in the status bar, or Settings → Updates). You do not need to clone the repo again.
