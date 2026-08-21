import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/globals.css'

function logDebug(message: string) {
  try {
    window.api?.debug?.log?.(message)
  } catch {
    /* ignore */
  }
}

function showCrash(message: string) {
  logDebug(message)
  const root = document.getElementById('root')
  if (!root) return
  const safe = message.replace(/&/g, '&amp;').replace(/</g, '&lt;')
  root.innerHTML = `
    <div style="min-height:100%;display:flex;align-items:center;justify-content:center;padding:32px;background:#171614;color:#ece8e1;font-family:'Segoe UI',sans-serif">
      <div style="width:100%;max-width:560px;background:#201e1b;border:1px solid #3d3933;border-radius:16px;padding:28px 32px;box-shadow:0 18px 50px rgba(0,0,0,.35)">
        <h1 style="font-size:20px;font-weight:600;margin:0 0 8px;letter-spacing:-0.02em">Nexum hit an error</h1>
        <p style="margin:0 0 16px;color:#b7b0a6;font-size:13px;line-height:1.5">The window loaded, but the UI crashed. Restart the app after you update from GitHub Releases.</p>
        <pre style="white-space:pre-wrap;color:#e07064;font-size:12px;line-height:1.5;margin:0;max-height:40vh;overflow:auto">${safe}</pre>
      </div>
    </div>`
}

window.addEventListener('error', (event) => {
  showCrash(event.error?.stack || event.message || 'Unknown window error')
})
window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason
  showCrash(reason instanceof Error ? reason.stack || reason.message : String(reason))
})

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: string | null }> {
  state = { error: null as string | null }
  static getDerivedStateFromError(error: Error) {
    return { error: error.stack || error.message }
  }
  componentDidCatch(error: Error) {
    logDebug(error.stack || error.message)
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32, background: '#171614', color: '#ece8e1', fontFamily: 'Segoe UI, sans-serif' }}>
          <div style={{ width: '100%', maxWidth: 560, background: '#201e1b', border: '1px solid #3d3933', borderRadius: 16, padding: '28px 32px' }}>
            <h1 style={{ fontSize: 20, fontWeight: 600, margin: '0 0 8px' }}>Nexum hit an error</h1>
            <p style={{ margin: '0 0 16px', color: '#b7b0a6', fontSize: 13, lineHeight: 1.5 }}>The window loaded, but the UI crashed. Restart the app after you update from GitHub Releases.</p>
            <pre style={{ whiteSpace: 'pre-wrap', color: '#e07064', fontSize: 12, lineHeight: 1.5, margin: 0, maxHeight: '40vh', overflow: 'auto' }}>{this.state.error}</pre>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

logDebug('react-boot')

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)
