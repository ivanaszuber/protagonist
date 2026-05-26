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
  /** Celsius deviation from baseline, e.g. +0.12 or -0.08. Roughly ±3°C — NOT the 0–100 contributor score. */
  body_temperature_deviation: number | null
  activity_score: number | null
  steps: number | null
  active_calories: number | null
  resilience_level: string | null
  hrv_average: number | null
  deep_sleep_seconds: number | null
  rem_sleep_seconds: number | null
  light_sleep_seconds: number | null
  respiratory_rate: number | null
  skin_temperature_deviation: number | null
  cycle_day: number | null
  cycle_phase: string | null
}

export interface OuraDbRow {
  date: string
  sleep_score?: number | null
  sleep_total_seconds?: number | null
  sleep_rem_seconds?: number | null
  sleep_deep_seconds?: number | null
  sleep_efficiency?: number | null
  sleep_latency_seconds?: number | null
  readiness_score?: number | null
  hrv_balance?: number | null
  recovery_index?: number | null
  body_temperature_deviation?: number | null
  activity_score?: number | null
  steps?: number | null
  active_calories?: number | null
  resilience_level?: string | null
  hrv_average?: number | null
  deep_sleep_seconds?: number | null
  rem_sleep_seconds?: number | null
  light_sleep_seconds?: number | null
  respiratory_rate?: number | null
  skin_temperature_deviation?: number | null
  cycle_day?: number | null
  cycle_phase?: string | null
}

interface OuraSleepPeriod {
  type?: string
  total_sleep_duration?: number
  rem_sleep_duration?: number
  deep_sleep_duration?: number
  light_sleep_duration?: number
  efficiency?: number
  latency?: number
  average_breath?: number
}

/** Reject contributor scores (0–100) mistakenly stored as °C deviation. */
function sanitizeTemperatureDeviation(value: number | null | undefined): number | null {
  if (value == null || Number.isNaN(value)) return null
  if (Math.abs(value) > 5) return null
  return value
}

export interface OuraDashboardData {
  readiness_score: number | null
  sleep_score: number | null
  activity_score: number | null
  cycle_day: number | null
  cycle_phase: string | null
}

export function ouraToDashboardPayload(data: OuraDailyData): OuraDashboardData {
  return {
    readiness_score: data.readiness_score,
    sleep_score: data.sleep_score,
    activity_score: data.activity_score,
    cycle_day: data.cycle_day,
    cycle_phase: data.cycle_phase,
  }
}

/** Map a stored oura_daily row to the dashboard API shape (explicit field list). */
export function ouraRowToDashboardPayload(row: OuraDbRow): OuraDashboardData {
  return ouraToDashboardPayload(ouraRowToDailyData(row))
}

export function ouraRowToDailyData(row: OuraDbRow): OuraDailyData {
  const deep =
    row.deep_sleep_seconds ?? row.sleep_deep_seconds ?? null
  const rem = row.rem_sleep_seconds ?? row.sleep_rem_seconds ?? null

  return {
    date: row.date,
    sleep_score: row.sleep_score ?? null,
    sleep_total_seconds: row.sleep_total_seconds ?? null,
    sleep_rem_seconds: row.sleep_rem_seconds ?? null,
    sleep_deep_seconds: row.sleep_deep_seconds ?? deep,
    sleep_efficiency: row.sleep_efficiency ?? null,
    sleep_latency_seconds: row.sleep_latency_seconds ?? null,
    readiness_score: row.readiness_score ?? null,
    hrv_balance: row.hrv_balance ?? null,
    recovery_index: row.recovery_index ?? null,
    body_temperature_deviation: sanitizeTemperatureDeviation(
      row.body_temperature_deviation
    ),
    activity_score: row.activity_score ?? null,
    steps: row.steps ?? null,
    active_calories: row.active_calories ?? null,
    resilience_level: row.resilience_level ?? null,
    hrv_average: row.hrv_average ?? null,
    deep_sleep_seconds: deep,
    rem_sleep_seconds: rem,
    light_sleep_seconds: row.light_sleep_seconds ?? null,
    respiratory_rate: row.respiratory_rate ?? null,
    skin_temperature_deviation: row.skin_temperature_deviation ?? null,
    cycle_day: row.cycle_day ?? null,
    cycle_phase: row.cycle_phase ?? null,
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

  const [sleepRes, readinessRes, activityRes, detailedSleepRes, cycleRes] =
    await Promise.allSettled([
      fetch(`${OURA_BASE}/usercollection/daily_sleep${params}`, { headers }),
      fetch(`${OURA_BASE}/usercollection/daily_readiness${params}`, { headers }),
      fetch(`${OURA_BASE}/usercollection/daily_activity${params}`, { headers }),
      fetch(`${OURA_BASE}/usercollection/sleep${params}`, { headers }),
      fetch(`${OURA_BASE}/usercollection/daily_cycle_insights${params}`, { headers }),
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
    deep_sleep_seconds: null,
    rem_sleep_seconds: null,
    light_sleep_seconds: null,
    respiratory_rate: null,
    skin_temperature_deviation: null,
    cycle_day: null,
    cycle_phase: null,
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
      result.body_temperature_deviation = sanitizeTemperatureDeviation(
        readiness.temperature_deviation ?? null
      )
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

  // Oura only finalises daily_activity score after ~22:00.
  // Scan back up to 7 days in one request to find the most recent finalised score.
  if (result.activity_score === null) {
    try {
      const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString().split('T')[0]
      const yesterday = new Date(Date.now() - 86_400_000).toISOString().split('T')[0]
      const rangeRes = await fetch(
        `${OURA_BASE}/usercollection/daily_activity?start_date=${weekAgo}&end_date=${yesterday}`,
        { headers }
      )
      if (rangeRes.ok) {
        const rangeData = await rangeRes.json()
        const activities = (rangeData.data ?? []) as Array<{ score?: number | null }>
        // Oura returns ascending order — reverse to get most recent first
        const recent = [...activities].reverse().find((a) => a.score != null)
        if (recent?.score != null) result.activity_score = recent.score
      }
    } catch {
      // fallback failed — leave as null
    }
  }

  if (detailedSleepRes.status === 'fulfilled' && detailedSleepRes.value.ok) {
    const sleepDetail = await detailedSleepRes.value.json()
    const periods: OuraSleepPeriod[] = sleepDetail.data ?? []
    const longSleep = periods.find((period) => period.type === 'long_sleep')
    const mainSleep =
      longSleep ??
      periods.reduce<OuraSleepPeriod | null>((best, period) => {
        const duration = period.total_sleep_duration ?? 0
        const bestDuration = best?.total_sleep_duration ?? 0
        return duration > bestDuration ? period : best
      }, null)

    if (mainSleep) {
      if (!result.sleep_total_seconds) {
        result.sleep_total_seconds = mainSleep.total_sleep_duration ?? null
      }
      result.deep_sleep_seconds = mainSleep.deep_sleep_duration ?? null
      result.rem_sleep_seconds = mainSleep.rem_sleep_duration ?? null
      result.light_sleep_seconds = mainSleep.light_sleep_duration ?? null
      result.sleep_deep_seconds = result.deep_sleep_seconds
      result.sleep_rem_seconds = result.rem_sleep_seconds
      result.respiratory_rate = mainSleep.average_breath ?? null
      if (result.sleep_efficiency === null && mainSleep.efficiency != null) {
        result.sleep_efficiency = mainSleep.efficiency
      }
      if (result.sleep_latency_seconds === null && mainSleep.latency != null) {
        result.sleep_latency_seconds = mainSleep.latency
      }
    }
  }

  if (cycleRes.status === 'fulfilled' && cycleRes.value.ok) {
    const cycleData = await cycleRes.value.json()
    const cycle = cycleData.data?.[0]
    if (cycle) {
      result.cycle_day = cycle.cycle_day ?? null
      result.cycle_phase = cycle.current_phase ?? cycle.cycle_phase ?? null
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
  if (data.cycle_phase) {
    parts.push(`Cycle: ${data.cycle_phase}${data.cycle_day ? ` (day ${data.cycle_day})` : ''}`)
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

export interface OracleVerdictOuraInput {
  readiness_score: number | null
  sleep_score: number | null
  cycle_phase: string | null
}

export function computeHp(scores: {
  readiness_score: number | null
  sleep_score: number | null
  activity_score: number | null
}): number {
  return Math.round(
    (scores.readiness_score ?? 50) * 0.4 +
      (scores.sleep_score ?? 50) * 0.3 +
      (scores.activity_score ?? 50) * 0.3
  )
}

export function getHpTier(hp: number): { color: string; label: string } {
  if (hp >= 85) return { color: '#34d399', label: 'Peak' }
  if (hp >= 70) return { color: '#a3e635', label: 'Ready' }
  if (hp >= 55) return { color: '#fb923c', label: 'Fair' }
  if (hp >= 40) return { color: '#f87171', label: 'Low' }
  return { color: '#ef4444', label: 'Drained' }
}

export function formatCyclePhase(phase: string | null, day: number | null): string {
  if (!phase) return ''
  const label = phase.charAt(0).toUpperCase() + phase.slice(1)
  return day ? `${label} · Day ${day}` : label
}

export function getOracleVerdict(
  oura: OracleVerdictOuraInput,
  moodScore: number | null
): { text: string; color: string } {
  const r = oura.readiness_score ?? 0
  const s = oura.sleep_score ?? 0
  const phase = oura.cycle_phase?.toLowerCase() ?? ''

  if (moodScore !== null && moodScore <= 2 && r >= 70) {
    return {
      color: '#fb923c',
      text: `Your body is recovered but you logged ${moodScore === 1 ? 'Depleted' : 'Drained'}. Rest your mind today — slow Forge tasks only.`,
    }
  }

  if (moodScore === 5) {
    return {
      color: '#a855f7',
      text: 'Transcendent mood — rare. Whatever you set out to do today, do it now.',
    }
  }

  if (phase === 'menstrual') {
    return {
      color: '#f472b6',
      text: 'Menstrual phase — rest is the mission today. Let Forge and Echo wait.',
    }
  }
  if (phase === 'ovulatory') {
    if (r >= 85 && s >= 75) {
      return {
        color: '#34d399',
        text: 'Ovulatory peak — your best window for interviews, negotiations, and big asks.',
      }
    }
    return {
      color: '#34d399',
      text: 'Ovulatory phase — high social energy. Push Echo quests and connect boldly.',
    }
  }
  if (phase === 'luteal') {
    if (r < 70) {
      return {
        color: '#fb923c',
        text: 'Luteal phase + low readiness — deep focus work only. Skip social heavy-lifting.',
      }
    }
    return {
      color: '#fb923c',
      text: 'Luteal phase — channel your detail focus into Forge prep work today.',
    }
  }
  if (r >= 85 && s >= 80) {
    return {
      color: '#34d399',
      text: 'All systems optimal. This is a high-leverage day — go after the hard things.',
    }
  }
  if (r >= 75) {
    return {
      color: '#34d399',
      text: 'Follicular phase — energy building. Push hard in your interviews today.',
    }
  }
  if (r >= 60) {
    return {
      color: '#fb923c',
      text: 'Moderate readiness. Prioritise Forge tasks, keep social energy for tomorrow.',
    }
  }
  return {
    color: '#f472b6',
    text: 'Low readiness — protect your energy. One focused task per character.',
  }
}
