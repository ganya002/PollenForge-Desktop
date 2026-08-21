# Install PollenForge (macOS and Windows)

Installers: [GitHub Releases](https://github.com/ganya002/PollenForge-Desktop/releases/latest) — use the **Releases** tab, not Tags.

You also need **Python 3** on your PATH. The desktop UI is packaged; the local tools backend is Python.

- Windows: https://www.python.org/downloads/ — enable **Add python.exe to PATH**
- macOS: Python 3 from python.org, or `brew install python`

Then install PollenForge and open **Settings** to paste an API key. Pollinations works without a key.

## Windows: Smart App Control / SmartScreen is blocking it

Builds are **unsigned** until a code-signing certificate is added. Windows will often block the Setup `.exe`. That is expected. It is not a broken download.

### SmartScreen (“Windows protected your PC”)

1. Click **More info**.
2. Click **Run anyway**.

### Smart App Control (Windows 11)

This can block the app with no Run anyway button.

1. Open **Windows Security** → **App & browser control**.
2. Open **Smart App Control settings**.
3. Set Smart App Control to **Off**.
4. Run `PollenForge-*-Windows-Setup.exe` again.

You can also unblock the downloaded file:

1. Right-click the `.exe` → **Properties**.
2. If you see **Unblock** at the bottom, check it → **Apply** → **OK**.
3. Or in PowerShell:

```powershell
Unblock-File .\PollenForge-*-Windows-Setup.exe
```

Then run the installer. Open PollenForge from the Start menu.

The lasting fix is an Authenticode certificate in CI. Until then, use the steps above. Do not tell users to clone the repo to “avoid” this.

## macOS: Gatekeeper is blocking it

1. Open the `.dmg` (`Mac-arm64` for Apple Silicon, `Mac-x64` for Intel).
2. Drag **PollenForge** into **Applications**.
3. Right-click the app → **Open** → **Open**.
4. If it still blocks: **System Settings** → **Privacy & Security** → **Open Anyway**.

Or in Terminal:

```bash
xattr -dr com.apple.quarantine /Applications/PollenForge.app
open /Applications/PollenForge.app
```

The lasting fix is Apple Developer ID signing + notarization.

## After it is installed

Later versions install from inside the app (**Update**, or Settings → Updates). You do not download a zip of source or `git pull` to update.
