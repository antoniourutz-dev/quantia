import React from 'react'
import ReactDOM from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import './index.css'

declare global {
  interface Window {
    __QUANTIA_BOOT_RENDERED__?: boolean
  }
}

const rootEl = typeof document !== 'undefined' ? document.getElementById('root') : null
if (rootEl) {
  rootEl.innerHTML =
    '<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f8fafc;color:#475569;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;letter-spacing:0.02em"><div style="display:flex;align-items:center;gap:12px"><div style="width:16px;height:16px;border-radius:999px;border:2px solid rgba(71,85,105,0.25);border-top-color:rgba(71,85,105,0.9);animation:spin 0.8s linear infinite"></div><div style="font-weight:800">Cargando…</div></div><style>@keyframes spin{to{transform:rotate(360deg)}}</style></div>'
}

const cleanupLegacyBrowserState = async () => {
  if (typeof window === 'undefined') return

  if ('serviceWorker' in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations()
      await Promise.all(registrations.map((registration) => registration.unregister()))
    } catch {
      // ignore stale worker cleanup errors
    }
  }

  if ('caches' in window) {
    try {
      const cacheNames = await window.caches.keys()
      await Promise.all(cacheNames.map((cacheName) => window.caches.delete(cacheName)))
    } catch {
      // ignore stale cache cleanup errors
    }
  }
}

const isLocalHost =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')

if (import.meta.env.DEV || isLocalHost) {
  void cleanupLegacyBrowserState()
}

if (!isLocalHost) {
  registerSW({ immediate: true })
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

if (typeof window !== 'undefined') {
  window.__QUANTIA_BOOT_RENDERED__ = true
}
