import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

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

void cleanupLegacyBrowserState()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
