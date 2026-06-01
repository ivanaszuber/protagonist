'use client'

import React, { useState } from 'react'
import type { CSSProperties } from 'react'
import { useDimensionContext } from './useDimensionContext'

interface CareerCtx {
  role: string
  company: string
  stage: string
  north_star: string
  oracle_notes: string
}

const EMPTY: CareerCtx = { role: '', company: '', stage: '', north_star: '', oracle_notes: '' }
const font: CSSProperties = { fontFamily: "'Space Grotesk', system-ui, sans-serif" }
const ACCENT = '#60A5FA'

const STAGES = ['Solo freelancer', 'Early-stage', 'Growth', 'Corporate', 'Executive', 'Founder', 'Transitioning']

export function CareerContextCard({ userId }: { userId: string }) {
  const [ctx, loading, save] = useDimensionContext<CareerCtx>(userId, 'career')
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<CareerCtx>(EMPTY)
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
        <span style={{ ...font, fontSize: 8, fontWeight: 700, letterSpacing: '1.1px', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.22)' }}>Career</span>
        {ctx && <button type="button" onClick={() => setEditing(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', fontSize: 10, cursor: 'pointer', fontFamily: 'inherit' }}>cancel</button>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 2 }}>
        <div><div style={{ ...font, fontSize: 8, color: 'rgba(255,255,255,0.3)', marginBottom: 3, textTransform: 'uppercase' as const, letterSpacing: '.08em' }}>Role</div><input style={inputStyle} placeholder="Founder / CEO" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} /></div>
        <div><div style={{ ...font, fontSize: 8, color: 'rgba(255,255,255,0.3)', marginBottom: 3, textTransform: 'uppercase' as const, letterSpacing: '.08em' }}>Company</div><input style={inputStyle} placeholder="Protagonist" value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} /></div>
      </div>
      <div style={{ marginBottom: 2 }}>
        <div style={{ ...font, fontSize: 8, color: 'rgba(255,255,255,0.3)', marginBottom: 3, textTransform: 'uppercase' as const, letterSpacing: '.08em' }}>Stage</div>
        <select style={{ ...inputStyle }} value={form.stage} onChange={e => setForm(f => ({ ...f, stage: e.target.value }))}>
          <option value="">Select…</option>
          {STAGES.map(s => <option key={s}>{s}</option>)}
        </select>
      </div>
      <div style={{ marginBottom: 2 }}><div style={{ ...font, fontSize: 8, color: 'rgba(255,255,255,0.3)', marginBottom: 3, textTransform: 'uppercase' as const, letterSpacing: '.08em' }}>North star</div><input style={inputStyle} placeholder="Build the OS for 1M people" value={form.north_star} onChange={e => setForm(f => ({ ...f, north_star: e.target.value }))} /></div>
      <div style={{ marginBottom: 10 }}><div style={{ ...font, fontSize: 8, color: `${ACCENT}80`, marginBottom: 3, textTransform: 'uppercase' as const, letterSpacing: '.08em' }}>Oracle knows</div><textarea style={{ ...inputStyle, resize: 'none', lineHeight: 1.5, marginBottom: 0 }} rows={2} placeholder="Solo founder, struggles to delegate…" value={form.oracle_notes} onChange={e => setForm(f => ({ ...f, oracle_notes: e.target.value }))} /></div>
      <button type="button" onClick={() => void handleSave()} disabled={saving} style={{ ...font, background: `${ACCENT}18`, border: `0.5px solid ${ACCENT}40`, borderRadius: 8, color: ACCENT, fontSize: 12, fontWeight: 600, padding: '7px 0', cursor: 'pointer', width: '100%' }}>{saving ? 'Saving…' : 'Save'}</button>
    </div>
  )

  if (!ctx) return null
  return (
    <div style={{ background: '#140C28', border: '0.5px solid #2D1B55', borderRadius: 14, padding: '13px 14px', display: 'flex', flexDirection: 'column', gap: 9 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ fontSize: 13 }}>⚡</span><span style={{ ...font, fontSize: 8, fontWeight: 700, letterSpacing: '1.1px', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.22)' }}>Career</span></div>
        <button type="button" onClick={() => setEditing(true)} style={{ background: 'transparent', border: 'none', color: ACCENT, fontSize: 10, cursor: 'pointer', fontFamily: 'inherit', padding: 0, opacity: 0.6 }}>edit</button>
      </div>
      {ctx.role && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ ...font, fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>Role</span><span style={{ ...font, fontSize: 9.5, color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>{ctx.role}</span></div>}
      {ctx.company && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ ...font, fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>Company</span><span style={{ ...font, fontSize: 9.5, color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>{ctx.company}</span></div>}
      {ctx.stage && <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ ...font, fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>Stage</span><span style={{ background: `${ACCENT}12`, border: `0.5px solid ${ACCENT}30`, borderRadius: 20, padding: '2px 9px', fontSize: 8.5, fontWeight: 600, color: ACCENT }}>{ctx.stage}</span></div>}
      {ctx.north_star && <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}><span style={{ ...font, fontSize: 9, color: 'rgba(255,255,255,0.3)', flexShrink: 0 }}>North star</span><span style={{ ...font, fontSize: 9.5, color: 'rgba(255,255,255,0.65)', textAlign: 'right', lineHeight: 1.4 }}>{ctx.north_star}</span></div>}
      {ctx.oracle_notes && (
        <div style={{ background: `${ACCENT}06`, border: `0.5px solid ${ACCENT}18`, borderRadius: 8, padding: '7px 9px', marginTop: 2 }}>
          <div style={{ ...font, fontSize: 7.5, color: `${ACCENT}55`, letterSpacing: '.08em', textTransform: 'uppercase' as const, marginBottom: 2 }}>Oracle knows</div>
          <div style={{ ...font, fontSize: 10, color: 'rgba(255,255,255,0.5)', lineHeight: 1.45 }}>{ctx.oracle_notes}</div>
        </div>
      )}
    </div>
  )
}
