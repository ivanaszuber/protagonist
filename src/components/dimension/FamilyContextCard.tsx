'use client'

import React, { useState } from 'react'
import type { CSSProperties } from 'react'
import { useDimensionContext } from './useDimensionContext'

interface FamilyMember {
  emoji: string
  name: string
  relation: string
}

interface FamilyCtx {
  members: FamilyMember[]
  living_situation: string
  family_vision: string
  oracle_notes: string
}

const EMPTY: FamilyCtx = { members: [], living_situation: '', family_vision: '', oracle_notes: '' }
const font: CSSProperties = { fontFamily: "'Space Grotesk', system-ui, sans-serif" }
const ACCENT = '#FB923C'

export function FamilyContextCard({ userId }: { userId: string }) {
  const [ctx, loading, save] = useDimensionContext<FamilyCtx>(userId, 'family')
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<FamilyCtx>(EMPTY)
  const [saving, setSaving] = useState(false)
  // For editing members as a simple text representation: "emoji Name (relation), ..."
  const [membersText, setMembersText] = useState('')

  React.useEffect(() => {
    if (ctx) {
      setForm(ctx)
      setMembersText(ctx.members.map(m => `${m.emoji} ${m.name} (${m.relation})`).join('\n'))
    } else if (!loading) setEditing(true)
  }, [ctx, loading])

  function parseMembersText(text: string): FamilyMember[] {
    return text.split('\n').map(line => line.trim()).filter(Boolean).map(line => {
      // Try to parse "emoji Name (relation)"
      const match = line.match(/^(\S+)\s+(.+?)\s*\((.+?)\)\s*$/)
      if (match) return { emoji: match[1], name: match[2].trim(), relation: match[3].trim() }
      // Fallback: treat whole line as name
      return { emoji: '👤', name: line, relation: '' }
    })
  }

  async function handleSave() {
    setSaving(true)
    const toSave = { ...form, members: parseMembersText(membersText) }
    await save(toSave)
    setSaving(false)
    setEditing(false)
  }

  const inputStyle: CSSProperties = { ...font, width: '100%', background: '#0D0820', border: `0.5px solid ${ACCENT}40`, borderRadius: 8, color: '#E8E0F0', fontSize: 12, padding: '6px 9px', outline: 'none', marginBottom: 6 }

  if (editing) return (
    <div style={{ background: '#140C28', border: '0.5px solid #2D1B55', borderRadius: 14, padding: '13px 14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ ...font, fontSize: 8, fontWeight: 700, letterSpacing: '1.1px', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.22)' }}>Family</span>
        {ctx && <button type="button" onClick={() => setEditing(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', fontSize: 10, cursor: 'pointer', fontFamily: 'inherit' }}>cancel</button>}
      </div>
      <div style={{ marginBottom: 2 }}>
        <div style={{ ...font, fontSize: 8, color: 'rgba(255,255,255,0.3)', marginBottom: 3, textTransform: 'uppercase' as const, letterSpacing: '.08em' }}>Family members (one per line: emoji Name (relation))</div>
        <textarea style={{ ...inputStyle, resize: 'none', lineHeight: 1.6, marginBottom: 0 }} rows={3} placeholder={'👩 Maria (Mom)\n👨 Luca (Brother)\n🐶 Biscuit (Dog)'} value={membersText} onChange={e => setMembersText(e.target.value)} />
      </div>
      <div style={{ marginBottom: 2 }}>
        <div style={{ ...font, fontSize: 8, color: 'rgba(255,255,255,0.3)', marginBottom: 3, textTransform: 'uppercase' as const, letterSpacing: '.08em' }}>Living situation</div>
        <input style={inputStyle} placeholder="Living with partner in Milan" value={form.living_situation} onChange={e => setForm(f => ({ ...f, living_situation: e.target.value }))} />
      </div>
      <div style={{ marginBottom: 2 }}>
        <div style={{ ...font, fontSize: 8, color: 'rgba(255,255,255,0.3)', marginBottom: 3, textTransform: 'uppercase' as const, letterSpacing: '.08em' }}>Family vision</div>
        <input style={inputStyle} placeholder="Build a warm, intentional home" value={form.family_vision} onChange={e => setForm(f => ({ ...f, family_vision: e.target.value }))} />
      </div>
      <div style={{ marginBottom: 10 }}><div style={{ ...font, fontSize: 8, color: `${ACCENT}80`, marginBottom: 3, textTransform: 'uppercase' as const, letterSpacing: '.08em' }}>Oracle knows</div><textarea style={{ ...inputStyle, resize: 'none', lineHeight: 1.5, marginBottom: 0 }} rows={2} placeholder="Close to parents, working on sibling relationship…" value={form.oracle_notes} onChange={e => setForm(f => ({ ...f, oracle_notes: e.target.value }))} /></div>
      <button type="button" onClick={() => void handleSave()} disabled={saving} style={{ ...font, background: `${ACCENT}18`, border: `0.5px solid ${ACCENT}40`, borderRadius: 8, color: ACCENT, fontSize: 12, fontWeight: 600, padding: '7px 0', cursor: 'pointer', width: '100%' }}>{saving ? 'Saving…' : 'Save'}</button>
    </div>
  )

  if (!ctx) return null
  return (
    <div style={{ background: '#140C28', border: '0.5px solid #2D1B55', borderRadius: 14, padding: '13px 14px', display: 'flex', flexDirection: 'column', gap: 9 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ fontSize: 13 }}>🏡</span><span style={{ ...font, fontSize: 8, fontWeight: 700, letterSpacing: '1.1px', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.22)' }}>Family</span></div>
        <button type="button" onClick={() => setEditing(true)} style={{ background: 'transparent', border: 'none', color: ACCENT, fontSize: 10, cursor: 'pointer', fontFamily: 'inherit', padding: 0, opacity: 0.6 }}>edit</button>
      </div>
      {ctx.members.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {ctx.members.map((m, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: `${ACCENT}15`, border: `0.5px solid ${ACCENT}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{m.emoji}</div>
              <div style={{ ...font, fontSize: 8, color: 'rgba(255,255,255,0.6)', fontWeight: 500 }}>{m.name}</div>
              {m.relation && <div style={{ ...font, fontSize: 7, color: 'rgba(255,255,255,0.3)' }}>{m.relation}</div>}
            </div>
          ))}
        </div>
      )}
      {ctx.living_situation && <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}><span style={{ ...font, fontSize: 9, color: 'rgba(255,255,255,0.3)', flexShrink: 0 }}>Living</span><span style={{ ...font, fontSize: 9.5, color: 'rgba(255,255,255,0.65)', textAlign: 'right' }}>{ctx.living_situation}</span></div>}
      {ctx.family_vision && <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}><span style={{ ...font, fontSize: 9, color: 'rgba(255,255,255,0.3)', flexShrink: 0 }}>Vision</span><span style={{ ...font, fontSize: 9.5, color: 'rgba(255,255,255,0.65)', textAlign: 'right', lineHeight: 1.4 }}>{ctx.family_vision}</span></div>}
      {ctx.oracle_notes && (
        <div style={{ background: `${ACCENT}06`, border: `0.5px solid ${ACCENT}18`, borderRadius: 8, padding: '7px 9px', marginTop: 2 }}>
          <div style={{ ...font, fontSize: 7.5, color: `${ACCENT}55`, letterSpacing: '.08em', textTransform: 'uppercase' as const, marginBottom: 2 }}>Oracle knows</div>
          <div style={{ ...font, fontSize: 10, color: 'rgba(255,255,255,0.5)', lineHeight: 1.45 }}>{ctx.oracle_notes}</div>
        </div>
      )}
    </div>
  )
}
