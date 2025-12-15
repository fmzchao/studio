import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type Theme = 'light' | 'dark'

interface ThemeState {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: 'light',
      setTheme: (theme) => {
        set({ theme })
        applyTheme(theme)
      },
      toggleTheme: () => {
        const newTheme = get().theme === 'light' ? 'dark' : 'light'
        set({ theme: newTheme })
        applyTheme(newTheme)
      },
    }),
    {
      name: 'shipsec-theme',
      onRehydrateStorage: () => (state) => {
        // Apply theme when store is rehydrated from localStorage
        if (state) {
          applyTheme(state.theme)
        }
      },
    }
  )
)

function applyTheme(theme: Theme) {
  const root = document.documentElement
  
  // Disable all transitions during theme switch for instant, uniform change
  root.classList.add('theme-switching')
  
  // Apply the theme
  if (theme === 'dark') {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }
  
  // Force a reflow to ensure the theme is applied before re-enabling transitions
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  root.offsetHeight
  
  // Re-enable transitions after a brief delay
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      root.classList.remove('theme-switching')
    })
  })
}

// Initialize theme on module load (handles initial page load)
export function initializeTheme() {
  const stored = localStorage.getItem('shipsec-theme')
  if (stored) {
    try {
      const parsed = JSON.parse(stored)
      if (parsed?.state?.theme) {
        applyTheme(parsed.state.theme)
      }
    } catch {
      // Invalid stored value, use default
    }
  }
}
