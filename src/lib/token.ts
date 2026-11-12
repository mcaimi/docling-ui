// The scheduler prints a URL with the API token in the fragment
// (http://127.0.0.1:8765/#token=...). Fragments never reach the server, so the
// token is moved to sessionStorage and removed from the address bar.

const KEY = 'scheduler-token'

export function captureTokenFromLocation(location: Location = window.location): void {
  const match = /(?:^#|&)token=([^&]+)/.exec(location.hash)
  if (!match?.[1]) return
  setToken(decodeURIComponent(match[1]))
  const rest = location.hash.replace(/(^#|&)token=[^&]+/, '').replace(/^#&?/, '')
  window.history.replaceState(null, '', location.pathname + location.search + (rest ? `#${rest}` : ''))
}

export function getToken(): string | null {
  return sessionStorage.getItem(KEY)
}

export function setToken(token: string): void {
  sessionStorage.setItem(KEY, token.trim())
}

export function clearToken(): void {
  sessionStorage.removeItem(KEY)
}
