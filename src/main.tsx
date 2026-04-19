import React from 'react'
import ReactDOM from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import './index.css'

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

const shouldRecoverFromError = (value: unknown) => {
  const message =
    value instanceof Error
      ? value.message
      : typeof value === 'string'
        ? value
        : value && typeof value === 'object' && 'message' in value
          ? String((value as any).message ?? '')
          : ''
  const lower = message.toLowerCase()
  return (
    lower.includes('chunkloaderror') ||
    lower.includes('loading chunk') ||
    lower.includes('failed to fetch dynamically imported module') ||
    lower.includes('importing a module script failed') ||
    lower.includes('net::err_failed') ||
    lower.includes('net::err_aborted')
  )
}

if (typeof window !== 'undefined') {
  const RECOVERY_KEY = 'quantia.recovery.v1'
  const recoverOnce = async (reason: unknown) => {
    try {
      if (window.sessionStorage.getItem(RECOVERY_KEY) === '1') return
      if (!shouldRecoverFromError(reason)) return
      window.sessionStorage.setItem(RECOVERY_KEY, '1')
    } catch {
      // ignore
    }

    await cleanupLegacyBrowserState()
    window.location.reload()
  }

  window.addEventListener('error', (event) => {
    void recoverOnce((event as any).error ?? (event as any).message ?? 'error')
  })

  window.addEventListener('unhandledrejection', (event) => {
    void recoverOnce((event as any).reason ?? 'unhandledrejection')
  })
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
  ;(window as any).__QUANTIA_BOOT_RENDERED__ = true
}
