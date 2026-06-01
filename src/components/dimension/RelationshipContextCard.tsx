'use client'

import React, { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'

interface RelCtx {
  partner_name: string | null
  partner_emoji: string | null
  together_since: string | null
  living_situation: string | null
  relationship_stage: string | null
  oracle_notes: string | null
}

interface Props {
  userId: string
  accentColor: string
}

const font: CSSProperties = { fontFamily: "'Space Grotesk', system-ui, sans-serif" }

function yearsMonths(since: string): string {
  const d = new Date(since)
  const now = new Date()
  const months = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth())
  if (months < 12) return `${months} mo`
  const yrs = Math.floor(months / 12)
  return `${yrs} yr${yrs !== 1 ? 's' : ''}`
}

export function RelationshipContextCard({ userId, accentColor }: Props) {
  const [ctx, setCtx]     = useState<RelCtx | null>(null)
  const [editing, setEditing] = useState(false)
  const [form, setForm]   = useState<RelCtx>({ partner_name: '', partner_emoji: '🧑‍🦱', together_since: '', living_situation: '', relationship_stage: 'Established', oracle_notes: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void fetch(`/api/dimension/relationship-context?userId=${encodeURIComponent(userId)}`)
      .then(r => r.json())
      .then((data: RelCtx | null) => {
        if (data) { setCtx(data); setForm(data) }
        else setEditing(true)  // first time: open form immediately
      })
      .catch(() => {})
  }, [userId])

  async function save() {
    setSaving(true)
    try {
      const res = await fetch('/api/dimension/relationship-context', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          partnerName: form.partner_name,
          partnerEmoji: form.partner_emoji,
          togetherSince: form.together_since || undefined,
          livingSituation: form.living_situation,
          relationshipStage: form.relationship_stage,
          oracleNotes: form.oracle_notes,
        }),
      })
      const saved = await res.json() as RelCtx
      setCtx(saved)
      setEditing(false)
    } catch { /* silent */ }
    setSaving(false)
  }

  const inputStyle: CSSProperties = {
    ...font, width: '100%', background: '#0D0820', border: `0.5px solid ${accentColor}40`,
    borderRadius: 8, color: '#E8E0F0', fontSize: 12, padding: '7px 10px', outline: 'none',
    marginBottom: 8,
  }

  if (editing) {
    return (
      <div style={{ background: '#140C28', border: '0.5px solid #2D1B55', borderRadius: 14, padding: '16px 18px', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <span style={{ ...font, fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.65)' }}>Relationship Context</span>
          {ctx && <button type="button" onClick={() => setEditing(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>cancel</button>}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 2 }}>
          <div>
            <div style={{ ...font, fontSize: 9, color: 'rgba(255,255,255,0.3)', marginBottom: 4, letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>Partner name</div>
            <input style={inputStyle} placeholder="Alex" value={form.partner_name ?? ''} onChange={e => setForm(f => ({ ...f, partner_name: e.target.value }))} />
          </div>
          <div>
            <div style={{ ...font, fontSize: 9, color: 'rgba(255,255,255,0.3)', marginBottom: 4, letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>Partner emoji</div>
            <input style={{ ...inputStyle, textAlign: 'center', fontSize: 18 }} maxLength={2} value={form.partner_emoji ?? ''} onChange={e => setForm(f => ({ ...f, partner_emoji: e.target.value }))} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 2 }}>
          <div>
            <div style={{ ...font, fontSize: 9, color: 'rgba(255,255,255,0.3)', marginBottom: 4, letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>Together since</div>
            <input style={{ ...inputStyle, colorScheme: 'dark' }} type="date" value={form.together_since ?? ''} onChange={e => setForm(f => ({ ...f, together_since: e.target.value }))} />
          </div>
          <div>
            <div style={{ ...font, fontSize: 9, color: 'rgba(255,255,255,0.3)', marginBottom: 4, letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>Stage</div>
            <select style={{ ...inputStyle, marginBottom: 0 }} value={form.relationship_stage ?? ''} onChange={e => setForm(f => ({ ...f, relationship_stage: e.target.value }))}>
              <option>Dating</option>
              <option>Committed</option>
              <option>Established</option>
              <option>Engaged</option>
              <option>Married</option>
            </select>
          </div>
        </div>
        <div style={{ marginBottom: 2 }}>
          <div style={{ ...font, fontSize: 9, color: 'rgba(255,255,255,0.3)', marginBottom: 4, letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>Living situation</div>
          <input style={inputStyle} placeholder="e.g. Living together in Dublin" value={form.living_situation ?? ''} onChange={e => setForm(f => ({ ...f, living_situation: e.target.value }))} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <div style={{ ...font, fontSize: 9, color: `${accentColor}80`, marginBottom: 4, letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>Oracle knows (context for AI)</div>
          <textarea
            style={{ ...inputStyle, resize: 'none', lineHeight: 1.5, marginBottom: 0 }}
            rows={2}
            placeholder="e.g. Alex travels 2 weeks per month, Zara has a good bond with Alex..."
            value={form.oracle_notes ?? ''}
            onChange={e => setForm(f => ({ ...f, oracle_notes: e.target.value }))}
          />
        </div>
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          style={{
            ...font, background: `${accentColor}18`, border: `0.5px solid ${accentColor}40`,
            borderRadius: 8, color: accentColor, fontSize: 12, fontWeight: 600, padding: '8px 18px',
            cursor: 'pointer', width: '100%',
          }}
        >
          {saving ? 'Saving…' : 'Save context'}
        </button>
      </div>
    )
  }

  if (!ctx) return null

  const partnerName  = ctx.partner_name  ?? 'Partner'
  const partnerEmoji = ctx.partner_emoji ?? '🧑‍🦱'
  const duration     = ctx.together_since ? yearsMonths(ctx.together_since) : null
  const stage        = ctx.relationship_stage ?? 'Established'

  return (
    <div style={{ background: '#140C28', border: '0.5px solid #2D1B55', borderRadius: 14, padding: '14px 15px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Header: label + edit */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ ...font, fontSize: 8, fontWeight: 700, letterSpacing: '1.1px', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.22)' }}>Relationship</span>
        <button type="button" onClick={() => setEditing(true)} style={{ background: 'transparent', border: 'none', color: accentColor, fontSize: 10, cursor: 'pointer', fontFamily: 'inherit', padding: 0, opacity: 0.6 }}>edit</button>
      </div>
      {/* Partner avatars row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: `${accentColor}15`, border: `1.5px solid ${accentColor}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🧑</div>
        <svg width="20" height="16" viewBox="0 0 20 16" fill="none">
          <path d="M10 6 C10 6 7 4 7 7 C7 9.5 10 12 10 12 C10 12 13 9.5 13 7 C13 4 10 6 10 6Z" fill={accentColor} opacity="0.5"/>
        </svg>
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(180,140,255,0.1)', border: '1.5px solid rgba(180,140,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{partnerEmoji}</div>
        <div>
          <div style={{ ...font, fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.78)' }}>{partnerName}</div>
          {duration && <div style={{ ...font, fontSize: 9, color: `${accentColor}60` }}>{duration}</div>}
        </div>
      </div>

      {/* Meta rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ ...font, fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>Stage</span>
          <span style={{ ...font, fontSize: 9, fontWeight: 700, background: 'rgba(29,158,117,0.1)', border: '0.5px solid rgba(29,158,117,0.25)', color: '#1D9E75', padding: '2px 9px', borderRadius: 20 }}>{stage}</span>
        </div>
        {ctx.together_since && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ ...font, fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>Since</span>
            <span style={{ ...font, fontSize: 9, color: 'rgba(255,255,255,0.55)' }}>{new Date(ctx.together_since).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</span>
          </div>
        )}
        {ctx.living_situation && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ ...font, fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>Living</span>
            <span style={{ ...font, fontSize: 9, color: 'rgba(255,255,255,0.5)' }}>{ctx.living_situation}</span>
          </div>
        )}
      </div>

      {/* Oracle knows */}
      {ctx.oracle_notes && (
        <div style={{ background: `${accentColor}05`, border: `0.5px solid ${accentColor}15`, borderRadius: 8, padding: '7px 9px' }}>
          <div style={{ ...font, fontSize: 7.5, color: `${accentColor}55`, letterSpacing: '0.08em', textTransform: 'uppercase' as const, marginBottom: 3 }}>Oracle knows</div>
          <div style={{ ...font, fontSize: 10, color: 'rgba(255,255,255,0.5)', lineHeight: 1.45 }}>{ctx.oracle_notes}</div>
        </div>
      )}
    </div>
  )
}
