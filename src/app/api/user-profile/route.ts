import { NextResponse } from 'next/server'
import { supabaseAdmin as supabase, isSupabaseConfigured } from '@/lib/supabase'

export interface UserProfile {
  userId: string
  displayName: string
  location: string
  age: number | null
  familyInfo: string       // e.g. "Mum of Zara"
  financialStatus: string  // e.g. "Financially independent"
  relationshipStatus: string
  enneagram: string        // e.g. "3w4"
  sunSign: string          // e.g. "Aries"
  risingSign: string       // e.g. "Cancer"
  neurodivergentNotes: string // e.g. "AuDHD Spectrum"
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')

  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })
  if (!isSupabaseConfigured()) return NextResponse.json({ profile: null })

  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    // Table may not exist yet — return null gracefully
    console.warn('[user-profile] GET error:', error.message)
    return NextResponse.json({ profile: null })
  }

  if (!data) return NextResponse.json({ profile: null })

  const profile: UserProfile = {
    userId:              data.user_id,
    displayName:         data.display_name ?? '',
    location:            data.location ?? '',
    age:                 data.age ?? null,
    familyInfo:          data.family_info ?? '',
    financialStatus:     data.financial_status ?? '',
    relationshipStatus:  data.relationship_status ?? '',
    enneagram:           data.enneagram ?? '',
    sunSign:             data.sun_sign ?? '',
    risingSign:          data.rising_sign ?? '',
    neurodivergentNotes: data.neurodivergent_notes ?? '',
  }

  return NextResponse.json({ profile })
}

export async function POST(request: Request) {
  const body = await request.json() as Partial<UserProfile> & { userId: string }
  const { userId } = body

  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })
  if (!isSupabaseConfigured()) return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })

  const row = {
    user_id:              userId,
    display_name:         body.displayName ?? '',
    location:             body.location ?? '',
    age:                  body.age ?? null,
    family_info:          body.familyInfo ?? '',
    financial_status:     body.financialStatus ?? '',
    relationship_status:  body.relationshipStatus ?? '',
    enneagram:            body.enneagram ?? '',
    sun_sign:             body.sunSign ?? '',
    rising_sign:          body.risingSign ?? '',
    neurodivergent_notes: body.neurodivergentNotes ?? '',
    updated_at:           new Date().toISOString(),
  }

  const { error } = await supabase
    .from('user_profiles')
    .upsert(row, { onConflict: 'user_id' })

  if (error) {
    console.error('[user-profile] POST error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
