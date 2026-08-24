# Install Nexum (macOS and Windows)

Installers: [GitHub Releases](https://github.com/ganya002/PollenForge-Desktop/releases/latest) — use the **Releases** tab, not Tags.

You need **[uv](https://docs.astral.sh/uv/)** (recommended) or **Python 3**. The desktop UI is packaged; the local tools backend is Python.

- uv: `brew install uv`, or `curl -LsSf https://astral.sh/uv/install.sh | sh` ([docs](https://docs.astral.sh/uv/))
- Windows uv: `powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"`
- Or Python 3 from https://www.python.org/downloads/ (Windows: enable **Add python.exe to PATH**)

First launch may download a Python runtime into app data. Later launches are fast.

Then install Nexum and open **Settings** to paste an API key.

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
4. Run `Nexum-*-Windows-Setup.exe` again.

You can also unblock the downloaded file:

1. Right-click the `.exe` → **Properties**.
2. If you see **Unblock** at the bottom, check it → **Apply** → **OK**.
3. Or in PowerShell:

```powershell
Unblock-File .\Nexum-*-Windows-Setup.exe
```

Then run the installer. Open Nexum from the Start menu.

The lasting fix is an Authenticode certificate in CI. Until then, use the steps above. Do not tell users to clone the repo to “avoid” this.

## macOS: “Nexum is damaged and can’t be opened”

That message is Gatekeeper blocking an **unsigned** build. It is not a corrupt download.

1. Open the `.dmg` (`Mac-arm64` for Apple Silicon, `Mac-x64` for Intel).
2. Drag **Nexum** into **Applications**.
3. In Terminal, run:

```bash
xattr -cr /Applications/Nexum.app
open /Applications/Nexum.app
```

If it still blocks: **System Settings** → **Privacy & Security** → **Open Anyway**. Right-click → Open often is not enough for this specific “damaged” dialog.

If Settings → Updates shows a **code signature / ShipIt** error, ignore Check for updates. Use **Install this version** to download the `.dmg`, then run the `xattr` command above.

## After it is installed

Later versions install from inside the app (**Update**, or Settings → Updates). You do not download a zip of source or `git pull` to update.
