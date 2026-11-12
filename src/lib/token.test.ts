import { describe, expect, it } from 'vitest'
import { captureTokenFromLocation, getToken } from './token'

describe('token capture', () => {
  it('moves the fragment token to sessionStorage and cleans the URL', () => {
    window.history.replaceState(null, '', '/runs#token=abc%2F123')
    captureTokenFromLocation()
    expect(getToken()).toBe('abc/123')
    expect(window.location.hash).toBe('')
    expect(window.location.pathname).toBe('/runs')
  })

  it('leaves other fragments alone', () => {
    window.history.replaceState(null, '', '/#section')
    captureTokenFromLocation()
    expect(getToken()).toBeNull()
    expect(window.location.hash).toBe('#section')
  })
})
