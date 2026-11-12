export type Theme = 'system' | 'light' | 'dark'
const KEY = 'scheduler-theme'

export function getTheme(): Theme {
  const value = localStorage.getItem(KEY)
  return value === 'light' || value === 'dark' ? value : 'system'
}

export function setTheme(theme: Theme): void {
  if (theme === 'system') localStorage.removeItem(KEY)
  else localStorage.setItem(KEY, theme)
  applyStoredTheme()
}

export function applyStoredTheme(): void {
  const theme = getTheme()
  if (theme === 'system') delete document.documentElement.dataset.theme
  else document.documentElement.dataset.theme = theme
}
