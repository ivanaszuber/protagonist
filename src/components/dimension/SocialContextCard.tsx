'use client'

import React, { useState } from 'react'
import type { CSSProperties } from 'react'
import { useDimensionContext } from './useDimensionContext'

interface SocialCtx {
  energy_type: string
  close_friends: string
  recharges_via: string[]
  currently_avoiding: string
  oracle_notes: string
}

const EMPTY: SocialCtx = { energy_type: '', close_friends: '', recharges_via: [], currently_avoiding: '', oracle_notes: '' }
const font: CSSProperties = { fontFamily: "'Space Grotesk', system-ui, sans-serif" }
const ACCENT = '#F472B6'

const ENERGY_TYPES = ['Introvert', 'Ambivert', 'Extrovert']

export function SocialContextCard({ userId }: { userId: string }) {
  const [ctx, loading, save] = useDimensionContext<SocialCtx>(userId, 'social')
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<SocialCtx>(EMPTY)
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
        <span style={{ ...font, fontSize: 8, fontWeight: 700, letterSpacing: '1.1px', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.22)' }}>Social</span>
        {ctx && <button type="button" onClick={() => setEditing(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', fontSize: 10, cursor: 'pointer', fontFamily: 'inherit' }}>cancel</button>}
      </div>
      <div style={{ marginBottom: 2 }}>
        <div style={{ ...font, fontSize: 8, color: 'rgba(255,255,255,0.3)', marginBottom: 3, textTransform: 'uppercase' as const, letterSpacing: '.08em' }}>Energy Type</div>
        <select style={{ ...inputStyle }} value={form.energy_type} onChange={e => setForm(f => ({ ...f, energy_type: e.target.value }))}>
          <option value="">Select…</option>
          {ENERGY_TYPES.map(t => <option key={t}>{t}</option>)}
        </select>
      </div>
      <div style={{ marginBottom: 2 }}>
        <div style={{ ...font, fontSize: 8, color: 'rgba(255,255,255,0.3)', marginBottom: 3, textTransform: 'uppercase' as const, letterSpacing: '.08em' }}>Close Friends</div>
        <input style={inputStyle} placeholder="5 deep relationships" value={form.close_friends} onChange={e => setForm(f => ({ ...f, close_friends: e.target.value }))} />
      </div>
      <div style={{ marginBottom: 2 }}>
        <div style={{ ...font, fontSize: 8, color: 'rgba(255,255,255,0.3)', marginBottom: 3, textTransform: 'uppercase' as const, letterSpacing: '.08em' }}>Recharges via (comma-separated)</div>
        <input style={inputStyle} placeholder="Solo time, Nature, Reading" value={form.recharges_via.join(', ')} onChange={e => setForm(f => ({ ...f, recharges_via: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }))} />
      </div>
      <div style={{ marginBottom: 2 }}>
        <div style={{ ...font, fontSize: 8, color: 'rgba(255,255,255,0.3)', marginBottom: 3, textTransform: 'uppercase' as const, letterSpacing: '.08em' }}>Currently avoiding</div>
        <input style={inputStyle} placeholder="Large group events" value={form.currently_avoiding} onChange={e => setForm(f => ({ ...f, currently_avoiding: e.target.value }))} />
      </div>
      <div style={{ marginBottom: 10 }}><div style={{ ...font, fontSize: 8, color: `${ACCENT}80`, marginBottom: 3, textTransform: 'uppercase' as const, letterSpacing: '.08em' }}>Oracle knows</div><textarea style={{ ...inputStyle, resize: 'none', lineHeight: 1.5, marginBottom: 0 }} rows={2} placeholder="Selective with energy, prioritizes depth over breadth…" value={form.oracle_notes} onChange={e => setForm(f => ({ ...f, oracle_notes: e.target.value }))} /></div>
      <button type="button" onClick={() => void handleSave()} disabled={saving} style={{ ...font, background: `${ACCENT}18`, border: `0.5px solid ${ACCENT}40`, borderRadius: 8, color: ACCENT, fontSize: 12, fontWeight: 600, padding: '7px 0', cursor: 'pointer', width: '100%' }}>{saving ? 'Saving…' : 'Save'}</button>
    </div>
  )

  if (!ctx) return null
  return (
    <div style={{ background: '#140C28', border: '0.5px solid #2D1B55', borderRadius: 14, padding: '13px 14px', display: 'flex', flexDirection: 'column', gap: 9 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ fontSize: 13 }}>🫂</span><span style={{ ...font, fontSize: 8, fontWeight: 700, letterSpacing: '1.1px', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.22)' }}>Social</span></div>
        <button type="button" onClick={() => setEditing(true)} style={{ background: 'transparent', border: 'none', color: ACCENT, fontSize: 10, cursor: 'pointer', fontFamily: 'inherit', padding: 0, opacity: 0.6 }}>edit</button>
      </div>
      {ctx.energy_type && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ ...font, fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>Energy type</span>
          <span style={{ background: `${ACCENT}12`, border: `0.5px solid ${ACCENT}30`, borderRadius: 20, padding: '2px 9px', fontSize: 8.5, fontWeight: 600, color: ACCENT }}>{ctx.energy_type}</span>
        </div>
      )}
      {ctx.close_friends && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ ...font, fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>Close friends</span><span style={{ ...font, fontSize: 9.5, color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>{ctx.close_friends}</span></div>}
      {ctx.recharges_via.length > 0 && (
        <div>
          <div style={{ ...font, fontSize: 8, color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase' as const, letterSpacing: '.08em', marginBottom: 5 }}>Recharges via</div>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {ctx.recharges_via.map(r => <span key={r} style={{ background: `${ACCENT}10`, border: `0.5px solid ${ACCENT}25`, borderRadius: 20, padding: '2px 9px', fontSize: 9.5, color: `${ACCENT}CC` }}>{r}</span>)}
          </div>
        </div>
      )}
      {ctx.currently_avoiding && <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}><span style={{ ...font, fontSize: 9, color: 'rgba(255,255,255,0.3)', flexShrink: 0 }}>Avoiding</span><span style={{ ...font, fontSize: 9.5, color: 'rgba(255,255,255,0.65)', textAlign: 'right' }}>{ctx.currently_avoiding}</span></div>}
      {ctx.oracle_notes && (
        <div style={{ background: `${ACCENT}06`, border: `0.5px solid ${ACCENT}18`, borderRadius: 8, padding: '7px 9px', marginTop: 2 }}>
          <div style={{ ...font, fontSize: 7.5, color: `${ACCENT}55`, letterSpacing: '.08em', textTransform: 'uppercase' as const, marginBottom: 2 }}>Oracle knows</div>
          <div style={{ ...font, fontSize: 10, color: 'rgba(255,255,255,0.5)', lineHeight: 1.45 }}>{ctx.oracle_notes}</div>
        </div>
      )}
    </div>
  )
}
