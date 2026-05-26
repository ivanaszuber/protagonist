import { cookies } from 'next/headers'

export async function resolveUserId(request: Request): Promise<string | null> {
  const fromQuery = new URL(request.url).searchParams.get('userId')
  if (fromQuery) return fromQuery
  const cookieStore = await cookies()
  return cookieStore.get('protagonist_user_id')?.value ?? null
}
