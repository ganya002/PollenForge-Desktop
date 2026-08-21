# PollenForge ${VERSION}

Desktop AI coding assistant for **macOS** and **Windows**.

## Download

### macOS ${VERSION}

- **Apple Silicon (M1–M4):** [PollenForge-${VERSION}-Mac-arm64.dmg](${BASE}/PollenForge-${VERSION}-Mac-arm64.dmg)
- **Intel:** [PollenForge-${VERSION}-Mac-x64.dmg](${BASE}/PollenForge-${VERSION}-Mac-x64.dmg)

On a Mac, Apple menu → About This Mac. If the chip says Apple, use Apple Silicon.

### Windows ${VERSION}

- **Installer (recommended):** [PollenForge-${VERSION}-Windows-Setup.exe](${BASE}/PollenForge-${VERSION}-Windows-Setup.exe)
- **Portable zip:** [PollenForge-${VERSION}-Windows.zip](${BASE}/PollenForge-${VERSION}-Windows.zip)

## Setup

PollenForge needs **Python 3** on your PATH (the UI is packaged; the local tools backend is Python).

1. Install Python 3 from https://www.python.org/downloads/
   - Windows: enable **Add python.exe to PATH**
2. Install PollenForge with the file above.
3. Open the app → **Settings** → paste an API key (Pollinations works without a key).

### macOS install

1. Open the `.dmg`.
2. Drag **PollenForge** into **Applications**.
3. First launch: right-click the app → **Open** (builds are unsigned until notarized).

### Windows install

1. Run **Windows Setup**.
2. If SmartScreen appears: **More info** → **Run anyway**.
3. Open PollenForge from the Start menu.

Later versions install from inside the app (**Update** in the status bar, or Settings → Updates). You do not need to clone the repo again.
