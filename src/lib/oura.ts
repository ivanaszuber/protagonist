const OURA_BASE = 'https://api.ouraring.com/v2'
const OURA_AUTH = 'https://cloud.ouraring.com/oauth'

export interface OuraTokens {
  access_token: string
  refresh_token: string
  expires_at: Date
}

export interface OuraDailyData {
  date: string
  sleep_score: number | null
  sleep_total_seconds: number | null
  sleep_rem_seconds: number | null
  sleep_deep_seconds: number | null
  sleep_efficiency: number | null
  sleep_latency_seconds: number | null
  readiness_score: number | null
  hrv_balance: number | null
  recovery_index: number | null
  body_temperature_deviation: number | null
  activity_score: number | null
  steps: number | null
  active_calories: number | null
  resilience_level: string | null
  hrv_average: number | null
}

export interface OuraDbRow {
  date: string
  sleep_score: number | null
  sleep_total_seconds: number | null
  sleep_rem_seconds: number | null
  sleep_deep_seconds: number | null
  sleep_efficiency: number | null
  sleep_latency_seconds: number | null
  readiness_score: number | null
  hrv_balance: number | null
  recovery_index: number | null
  body_temperature_deviation: number | null
  activity_score: number | null
  steps: number | null
  active_calories: number | null
  resilience_level: string | null
  hrv_average: number | null
}

export function ouraRowToDailyData(row: OuraDbRow): OuraDailyData {
  return {
    date: row.date,
    sleep_score: row.sleep_score,
    sleep_total_seconds: row.sleep_total_seconds,
    sleep_rem_seconds: row.sleep_rem_seconds,
    sleep_deep_seconds: row.sleep_deep_seconds,
    sleep_efficiency: row.sleep_efficiency,
    sleep_latency_seconds: row.sleep_latency_seconds,
    readiness_score: row.readiness_score,
    hrv_balance: row.hrv_balance,
    recovery_index: row.recovery_index,
    body_temperature_deviation: row.body_temperature_deviation,
    activity_score: row.activity_score,
    steps: row.steps,
    active_calories: row.active_calories,
    resilience_level: row.resilience_level,
    hrv_average: row.hrv_average,
  }
}

export function getOuraAuthUrl(state: string, baseUrl: string): string {
  const redirectUri = `${baseUrl}/api/oura/callback`
  const params = new URLSearchParams({
    client_id: process.env.OURA_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'daily heartrate personal session sleep workout',
    state,
  })
  return `${OURA_AUTH}/authorize?${params}`
}

export async function exchangeOuraCode(code: string, baseUrl: string): Promise<OuraTokens> {
  const redirectUri = `${baseUrl}/api/oura/callback`
  console.log('Exchanging code with redirect_uri:', redirectUri)

  const res = await fetch(`${OURA_AUTH}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: process.env.OURA_CLIENT_ID!,
      client_secret: process.env.OURA_CLIENT_SECRET!,
    }),
  })
  if (!res.ok) {
    const errText = await res.text()
    console.error('Oura token exchange error:', errText)
    throw new Error(`Oura token exchange failed: ${errText}`)
  }
  const data = await res.json()
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: new Date(Date.now() + data.expires_in * 1000),
  }
}

export async function refreshOuraTokens(refreshToken: string): Promise<OuraTokens> {
  const res = await fetch(`${OURA_AUTH}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: process.env.OURA_CLIENT_ID!,
      client_secret: process.env.OURA_CLIENT_SECRET!,
    }),
  })
  if (!res.ok) throw new Error(`Oura token refresh failed: ${await res.text()}`)
  const data = await res.json()
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: new Date(Date.now() + data.expires_in * 1000),
  }
}

export async function fetchOuraDailyData(
  accessToken: string,
  date: string
): Promise<OuraDailyData> {
  const headers = { Authorization: `Bearer ${accessToken}` }
  const params = `?start_date=${date}&end_date=${date}`

  const [sleepRes, readinessRes, activityRes] = await Promise.allSettled([
    fetch(`${OURA_BASE}/usercollection/daily_sleep${params}`, { headers }),
    fetch(`${OURA_BASE}/usercollection/daily_readiness${params}`, { headers }),
    fetch(`${OURA_BASE}/usercollection/daily_activity${params}`, { headers }),
  ])

  const result: OuraDailyData = {
    date,
    sleep_score: null,
    sleep_total_seconds: null,
    sleep_rem_seconds: null,
    sleep_deep_seconds: null,
    sleep_efficiency: null,
    sleep_latency_seconds: null,
    readiness_score: null,
    hrv_balance: null,
    recovery_index: null,
    body_temperature_deviation: null,
    activity_score: null,
    steps: null,
    active_calories: null,
    resilience_level: null,
    hrv_average: null,
  }

  if (sleepRes.status === 'fulfilled' && sleepRes.value.ok) {
    const sleepData = await sleepRes.value.json()
    const sleep = sleepData.data?.[0]
    if (sleep) {
      result.sleep_score = sleep.score ?? null
      result.sleep_efficiency = sleep.contributors?.efficiency ?? null
    }
  }

  if (readinessRes.status === 'fulfilled' && readinessRes.value.ok) {
    const readinessData = await readinessRes.value.json()
    const readiness = readinessData.data?.[0]
    if (readiness) {
      result.readiness_score = readiness.score ?? null
      result.hrv_balance = readiness.contributors?.hrv_balance ?? null
      result.recovery_index = readiness.contributors?.recovery_index ?? null
      result.body_temperature_deviation =
        readiness.contributors?.body_temperature ?? null
    }
  }

  if (activityRes.status === 'fulfilled' && activityRes.value.ok) {
    const activityData = await activityRes.value.json()
    const activity = activityData.data?.[0]
    if (activity) {
      result.activity_score = activity.score ?? null
      result.steps = activity.steps ?? null
      result.active_calories = activity.active_calories ?? null
    }
  }

  return result
}

export function buildOuraContext(data: OuraDailyData): string {
  const parts: string[] = []
  if (data.readiness_score !== null) {
    const level =
      data.readiness_score >= 85
        ? 'excellent'
        : data.readiness_score >= 70
          ? 'good'
          : data.readiness_score >= 55
            ? 'fair'
            : 'low'
    parts.push(`Readiness: ${data.readiness_score}/100 (${level})`)
  }
  if (data.sleep_score !== null) {
    parts.push(`Sleep: ${data.sleep_score}/100`)
  }
  if (data.hrv_balance !== null) {
    parts.push(`HRV balance: ${data.hrv_balance}`)
  }
  if (data.activity_score !== null) {
    parts.push(`Activity: ${data.activity_score}/100`)
  }
  if (data.steps !== null) {
    parts.push(`Steps: ${data.steps.toLocaleString()}`)
  }
  return parts.length === 0
    ? 'No Oura data available.'
    : `Today's Oura data:\n${parts.join('\n')}`
}

export function getReadinessGuidance(readinessScore: number | null): string {
  if (readinessScore === null) return ''
  if (readinessScore >= 85) return 'Body is primed — push if you want to.'
  if (readinessScore >= 70) return 'Good readiness — normal intensity.'
  if (readinessScore >= 55) return 'Moderate readiness — mix effort with recovery.'
  if (readinessScore >= 40) return 'Low readiness — rest IS the quest today.'
  return 'Very low readiness — active rest only.'
}

export function ouraToArcPayload(data: OuraDailyData): {
  sleepScore?: number
  readiness?: number
  hrv?: number
} {
  return {
    sleepScore: data.sleep_score ?? undefined,
    readiness: data.readiness_score ?? undefined,
    hrv: data.hrv_balance ?? undefined,
  }
}
