// User identity — stored in cookie (survives OAuth redirects) + localStorage (fallback)

export function getUserId(): string {
  if (typeof window === 'undefined') return 'server'

  // Check cookie first — survives OAuth redirects
  const cookieMatch = document.cookie.match(/(?:^|;\s*)protagonist_user_id=([^;]+)/)
  if (cookieMatch) {
    const id = decodeURIComponent(cookieMatch[1])
    // Keep localStorage in sync
    localStorage.setItem('protagonist_user_id', id)
    return id
  }

  // Fallback to localStorage
  const localId = localStorage.getItem('protagonist_user_id')
  if (localId) {
    setCookie(localId)
    return localId
  }

  // Generate new ID — save to both
  const newId = crypto.randomUUID()
  setCookie(newId)
  localStorage.setItem('protagonist_user_id', newId)
  return newId
}

function setCookie(id: string) {
  const expires = new Date()
  expires.setFullYear(expires.getFullYear() + 1)
  document.cookie = `protagonist_user_id=${encodeURIComponent(id)}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`
}
