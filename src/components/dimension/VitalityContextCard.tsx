'use client'

import React, { useState } from 'react'
import type { CSSProperties } from 'react'
import { useDimensionContext } from './useDimensionContext'

interface VitalityCtx {
  weight: string
  height: string
  goal: string
  training_frequency: string
  focus: string[]
  oracle_notes: string
}

const EMPTY: VitalityCtx = { weight: '', height: '', goal: '', training_frequency: '', focus: [], oracle_notes: '' }
const font: CSSProperties = { fontFamily: "'Space Grotesk', system-ui, sans-serif" }
const ACCENT = '#F0882A'

export function VitalityContextCard({ userId }: { userId: string }) {
  const [ctx, loading, save] = useDimensionContext<VitalityCtx>(userId, 'vitality')
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<VitalityCtx>(EMPTY)
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

  if (editing) return (
    <div style={{ background: '#140C28', border: '0.5px solid #2D1B55', borderRadius: 14, padding: '13px 14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ ...font, fontSize: 8, fontWeight: 700, letterSpacing: '1.1px', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.22)' }}>Vitality</span>
        {ctx && <button type="button" onClick={() => setEditing(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', fontSize: 10, cursor: 'pointer', fontFamily: 'inherit' }}>cancel</button>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 2 }}>
        <div><div style={{ ...font, fontSize: 8, color: 'rgba(255,255,255,0.3)', marginBottom: 3, textTransform: 'uppercase' as const, letterSpacing: '.08em' }}>Weight</div><input style={inputStyle} placeholder="62 kg" value={form.weight} onChange={e => setForm(f => ({ ...f, weight: e.target.value }))} /></div>
        <div><div style={{ ...font, fontSize: 8, color: 'rgba(255,255,255,0.3)', marginBottom: 3, textTransform: 'uppercase' as const, letterSpacing: '.08em' }}>Height</div><input style={inputStyle} placeholder="168 cm" value={form.height} onChange={e => setForm(f => ({ ...f, height: e.target.value }))} /></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 2 }}>
        <div><div style={{ ...font, fontSize: 8, color: 'rgba(255,255,255,0.3)', marginBottom: 3, textTransform: 'uppercase' as const, letterSpacing: '.08em' }}>Goal</div><input style={inputStyle} placeholder="Lean & strong" value={form.goal} onChange={e => setForm(f => ({ ...f, goal: e.target.value }))} /></div>
        <div><div style={{ ...font, fontSize: 8, color: 'rgba(255,255,255,0.3)', marginBottom: 3, textTransform: 'uppercase' as const, letterSpacing: '.08em' }}>Training</div><input style={inputStyle} placeholder="5× / week" value={form.training_frequency} onChange={e => setForm(f => ({ ...f, training_frequency: e.target.value }))} /></div>
      </div>
      <div style={{ marginBottom: 2 }}><div style={{ ...font, fontSize: 8, color: 'rgba(255,255,255,0.3)', marginBottom: 3, textTransform: 'uppercase' as const, letterSpacing: '.08em' }}>Focus (comma-separated)</div><input style={inputStyle} placeholder="Strength, Mobility" value={form.focus.join(', ')} onChange={e => setForm(f => ({ ...f, focus: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }))} /></div>
      <div style={{ marginBottom: 10 }}><div style={{ ...font, fontSize: 8, color: `${ACCENT}80`, marginBottom: 3, textTransform: 'uppercase' as const, letterSpacing: '.08em' }}>Oracle knows</div><textarea style={{ ...inputStyle, resize: 'none', lineHeight: 1.5, marginBottom: 0 }} rows={2} placeholder="Post-burnout rebuild, Oura-tracked…" value={form.oracle_notes} onChange={e => setForm(f => ({ ...f, oracle_notes: e.target.value }))} /></div>
      <button type="button" onClick={() => void handleSave()} disabled={saving} style={{ ...font, background: `${ACCENT}18`, border: `0.5px solid ${ACCENT}40`, borderRadius: 8, color: ACCENT, fontSize: 12, fontWeight: 600, padding: '7px 0', cursor: 'pointer', width: '100%' }}>{saving ? 'Saving…' : 'Save'}</button>
    </div>
  )

  if (!ctx) return null
  return (
    <div style={{ background: '#140C28', border: '0.5px solid #2D1B55', borderRadius: 14, padding: '13px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ fontSize: 13 }}>🔥</span><span style={{ ...font, fontSize: 8, fontWeight: 700, letterSpacing: '1.1px', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.22)' }}>Vitality</span></div>
        <button type="button" onClick={() => setEditing(true)} style={{ background: 'transparent', border: 'none', color: ACCENT, fontSize: 10, cursor: 'pointer', fontFamily: 'inherit', padding: 0, opacity: 0.6 }}>edit</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
        {[['Weight', ctx.weight], ['Height', ctx.height], ['Goal', ctx.goal], ['Training', ctx.training_frequency]].map(([label, val]) => val ? (
          <div key={label} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 7, padding: '6px 8px' }}>
            <div style={{ ...font, fontSize: 7, color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase' as const, letterSpacing: '.08em', marginBottom: 2 }}>{label}</div>
            <div style={{ ...font, fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>{val}</div>
          </div>
        ) : null)}
      </div>
      {ctx.focus.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
          {ctx.focus.map(f => <span key={f} style={{ background: `${ACCENT}10`, border: `0.5px solid ${ACCENT}25`, borderRadius: 20, padding: '2px 9px', fontSize: 9.5, color: `${ACCENT}CC` }}>{f}</span>)}
        </div>
      )}
      {ctx.oracle_notes && (
        <div style={{ background: `${ACCENT}06`, border: `0.5px solid ${ACCENT}18`, borderRadius: 8, padding: '7px 9px' }}>
          <div style={{ ...font, fontSize: 7.5, color: `${ACCENT}55`, letterSpacing: '.08em', textTransform: 'uppercase' as const, marginBottom: 2 }}>Oracle knows</div>
          <div style={{ ...font, fontSize: 10, color: 'rgba(255,255,255,0.5)', lineHeight: 1.45 }}>{ctx.oracle_notes}</div>
        </div>
      )}
    </div>
  )
}
