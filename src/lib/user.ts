const USER_ID_KEY = 'protagonist_user_id'

export function getUserId(): string {
  if (typeof window === 'undefined') return 'server'

  let userId = localStorage.getItem(USER_ID_KEY)
  if (!userId) {
    userId = crypto.randomUUID()
    localStorage.setItem(USER_ID_KEY, userId)
  }
  return userId
}
