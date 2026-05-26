import { getGoogleTokensForUser, refreshAndSaveGoogleTokens } from '@/lib/db'

export async function resolveGoogleAccessToken(
  userId: string
): Promise<{ accessToken: string } | { error: 'not_connected' }> {
  const tokens = await getGoogleTokensForUser(userId)
  if (!tokens) return { error: 'not_connected' }

  let accessToken = tokens.access_token as string
  const expiresAt = new Date(tokens.expires_at as string)

  if (expiresAt.getTime() < Date.now()) {
    if (!tokens.refresh_token) return { error: 'not_connected' }
    const refreshed = await refreshAndSaveGoogleTokens(
      userId,
      tokens.refresh_token as string
    )
    accessToken = refreshed.access_token
  } else if (Date.now() + 5 * 60 * 1000 > expiresAt.getTime() && tokens.refresh_token) {
    try {
      const refreshed = await refreshAndSaveGoogleTokens(
        userId,
        tokens.refresh_token as string
      )
      accessToken = refreshed.access_token
    } catch {
      /* use existing token */
    }
  }

  return { accessToken }
}
