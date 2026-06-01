'use client'

import React, { useState } from 'react'
import type { CSSProperties } from 'react'
import { useDimensionContext } from './useDimensionContext'

interface MindCtx {
  currently_reading: string
  practice: string
  learning_focus: string
  cognitive_style: string
  oracle_notes: string
}

const EMPTY: MindCtx = { currently_reading: '', practice: '', learning_focus: '', cognitive_style: '', oracle_notes: '' }
const font: CSSProperties = { fontFamily: "'Space Grotesk', system-ui, sans-serif" }
const ACCENT = '#A78BFA'

export function MindContextCard({ userId }: { userId: string }) {
  const [ctx, loading, save] = useDimensionContext<MindCtx>(userId, 'mind')
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<MindCtx>(EMPTY)
  const [saving, setSaving] = useState(false)

  React.useEffect(() => {
    if (ctx) setForm(ctx)
    else if (!loading) setEditing(true)
  }, [ctx, loading])

  async function handleSave() {
    setSaving(true)
    await save(form)
    setSaving(false)
    setEditing(false)
  }

  const inputStyle: CSSProperties = { ...font, width: '100%', background: '#0D0820', border: `0.5px solid ${ACCENT}40`, borderRadius: 8, color: '#E8E0F0', fontSize: 12, padding: '6px 9px', outline: 'none', marginBottom: 6 }

  const fields: Array<[keyof MindCtx, string, string]> = [
    ['currently_reading', 'Currently reading', 'The Body Keeps the Score'],
    ['practice', 'Practice', 'Meditation · 10 min daily'],
    ['learning_focus', 'Learning focus', 'Systems thinking'],
    ['cognitive_style', 'Cognitive style', 'Pattern-first thinker'],
  ]

  if (editing) return (
    <div style={{ background: '#140C28', border: '0.5px solid #2D1B55', borderRadius: 14, padding: '13px 14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ ...font, fontSize: 8, fontWeight: 700, letterSpacing: '1.1px', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.22)' }}>Mind</span>
        {ctx && <button type="button" onClick={() => setEditing(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', fontSize: 10, cursor: 'pointer', fontFamily: 'inherit' }}>cancel</button>}
      </div>
      {fields.map(([key, label, placeholder]) => (
        <div key={key}>
          <div style={{ ...font, fontSize: 8, color: 'rgba(255,255,255,0.3)', marginBottom: 3, textTransform: 'uppercase' as const, letterSpacing: '.08em' }}>{label}</div>
          <input style={inputStyle} placeholder={placeholder} value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
        </div>
      ))}
      <div style={{ marginBottom: 10 }}><div style={{ ...font, fontSize: 8, color: `${ACCENT}80`, marginBottom: 3, textTransform: 'uppercase' as const, letterSpacing: '.08em' }}>Oracle knows</div><textarea style={{ ...inputStyle, resize: 'none', lineHeight: 1.5, marginBottom: 0 }} rows={2} placeholder="Overthinks under stress. Journaling helps…" value={form.oracle_notes} onChange={e => setForm(f => ({ ...f, oracle_notes: e.target.value }))} /></div>
      <button type="button" onClick={() => void handleSave()} disabled={saving} style={{ ...font, background: `${ACCENT}18`, border: `0.5px solid ${ACCENT}40`, borderRadius: 8, color: ACCENT, fontSize: 12, fontWeight: 600, padding: '7px 0', cursor: 'pointer', width: '100%' }}>{saving ? 'Saving…' : 'Save'}</button>
    </div>
  )

  if (!ctx) return null
  return (
    <div style={{ background: '#140C28', border: '0.5px solid #2D1B55', borderRadius: 14, padding: '13px 14px', display: 'flex', flexDirection: 'column', gap: 9 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ fontSize: 13 }}>🧠</span><span style={{ ...font, fontSize: 8, fontWeight: 700, letterSpacing: '1.1px', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.22)' }}>Mind</span></div>
        <button type="button" onClick={() => setEditing(true)} style={{ background: 'transparent', border: 'none', color: ACCENT, fontSize: 10, cursor: 'pointer', fontFamily: 'inherit', padding: 0, opacity: 0.6 }}>edit</button>
      </div>
      {fields.map(([key, label]) => ctx[key] ? (
        <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <span style={{ ...font, fontSize: 9, color: 'rgba(255,255,255,0.3)', flexShrink: 0 }}>{label}</span>
          <span style={{ ...font, fontSize: 9.5, color: 'rgba(255,255,255,0.65)', fontWeight: 500, textAlign: 'right' }}>{ctx[key]}</span>
        </div>
      ) : null)}
      {ctx.oracle_notes && (
        <div style={{ background: `${ACCENT}06`, border: `0.5px solid ${ACCENT}18`, borderRadius: 8, padding: '7px 9px', marginTop: 2 }}>
          <div style={{ ...font, fontSize: 7.5, color: `${ACCENT}55`, letterSpacing: '.08em', textTransform: 'uppercase' as const, marginBottom: 2 }}>Oracle knows</div>
          <div style={{ ...font, fontSize: 10, color: 'rgba(255,255,255,0.5)', lineHeight: 1.45 }}>{ctx.oracle_notes}</div>
        </div>
      )}
    </div>
  )
}
