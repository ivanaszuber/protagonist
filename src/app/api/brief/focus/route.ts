import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function PATCH(request: Request) {
  const body = (await request.json()) as {
    userId?: string
    noteId?: string
    index?: number
    done?: boolean
  }
  const { userId, noteId, index, done } = body

  if (!userId || !noteId || index === undefined || done === undefined) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const { data: note, error: fetchError } = await supabase
    .from('voice_notes')
    .select('focus_list')
    .eq('id', noteId)
    .eq('user_id', userId)
    .maybeSingle()

  if (fetchError || !note) {
    return NextResponse.json({ error: 'Note not found' }, { status: 404 })
  }

  const focusList = [...((note.focus_list as Array<Record<string, unknown>>) ?? [])]
  if (index < 0 || index >= focusList.length) {
    return NextResponse.json({ error: 'Invalid index' }, { status: 400 })
  }

  focusList[index] = { ...focusList[index], done }

  const { error } = await supabase
    .from('voice_notes')
    .update({ focus_list: focusList })
    .eq('id', noteId)
    .eq('user_id', userId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, focus_list: focusList })
}
