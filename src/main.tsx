import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/globals.css'

function report(message: string) {
  try {
    window.api?.debug?.log?.(message)
  } catch {
    /* ignore */
  }
  const root = document.getElementById('root')
  if (!root) return
  root.innerHTML = `<div style="padding:40px;max-width:640px;font-family:Segoe UI,sans-serif;color:#f0f0f0">
    <h1 style="font-size:20px;margin:0 0 12px">Nexum hit an error</h1>
    <pre style="white-space:pre-wrap;color:#fca5a5;font-size:12px;line-height:1.5">${message
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')}</pre>
  </div>`
}

window.addEventListener('error', (event) => {
  report(event.error?.stack || event.message || 'Unknown window error')
})
window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason
  report(reason instanceof Error ? reason.stack || reason.message : String(reason))
})

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: string | null }> {
  state = { error: null as string | null }
  static getDerivedStateFromError(error: Error) {
    return { error: error.stack || error.message }
  }
  componentDidCatch(error: Error) {
    report(error.stack || error.message)
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 40, color: '#f0f0f0', fontFamily: 'Segoe UI, sans-serif' }}>
          <h1 style={{ fontSize: 20 }}>Nexum hit an error</h1>
          <pre style={{ whiteSpace: 'pre-wrap', color: '#fca5a5', fontSize: 12 }}>{this.state.error}</pre>
        </div>
      )
    }
    return this.props.children
  }
}

report('react-boot')

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)
