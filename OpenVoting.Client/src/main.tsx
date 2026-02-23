import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './app.tsx'
import { ToastProvider } from './components'

type ThemeMode = 'system' | 'light' | 'dark'
type ResolvedTheme = 'light' | 'dark'

const THEME_STORAGE_KEY = 'openvoting.theme.mode'
const DARK_MODE_MEDIA_QUERY = '(prefers-color-scheme: dark)'

function resolveInitialTheme(): ResolvedTheme {
  const storedMode = window.localStorage.getItem(THEME_STORAGE_KEY)
  const mode: ThemeMode = storedMode === 'light' || storedMode === 'dark' || storedMode === 'system'
    ? storedMode
    : 'system'

  if (mode === 'light' || mode === 'dark') {
    return mode
  }

  return window.matchMedia(DARK_MODE_MEDIA_QUERY).matches ? 'dark' : 'light'
}

const initialTheme = resolveInitialTheme()
document.documentElement.dataset.theme = initialTheme
document.documentElement.style.colorScheme = initialTheme

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <App />
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>,
)
