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
    <div style={{ background: '#140C28', border: '0.5px solid #2D1B55', borderRadius: 14, padding: '16px 18px', marginBottom: 14 }}>
      {/* Partner row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {/* You */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
            <div style={{
              width: 44, height: 44, borderRadius: '50%',
              background: `${accentColor}15`, border: `1.5px solid ${accentColor}35`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
            }}>🧑</div>
            <span style={{ ...font, fontSize: 9, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.05em' }}>You</span>
          </div>
          {/* Heart connector */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
            <svg width="28" height="20" viewBox="0 0 28 20" fill="none">
              <path d="M2 10 Q6 3 14 10 Q22 3 26 10" stroke={`${accentColor}30`} strokeWidth="1" fill="none"/>
              <path d="M14 7 C14 7 10 4 10 7.5 C10 10 14 13 14 13 C14 13 18 10 18 7.5 C18 4 14 7 14 7Z" fill={accentColor} opacity="0.6"/>
            </svg>
            {duration && <span style={{ ...font, fontSize: 8, color: `${accentColor}60`, letterSpacing: '0.05em' }}>{duration}</span>}
          </div>
          {/* Partner */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
            <div style={{
              width: 44, height: 44, borderRadius: '50%',
              background: 'rgba(180,140,255,0.1)', border: '1.5px solid rgba(180,140,255,0.28)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
            }}>{partnerEmoji}</div>
            <span style={{ ...font, fontSize: 9, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.05em' }}>{partnerName}</span>
          </div>
        </div>

        {/* Right: stage + edit */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 7 }}>
          <span style={{
            ...font, fontSize: 9, fontWeight: 700, letterSpacing: '0.06em',
            background: 'rgba(29,158,117,0.1)', border: '0.5px solid rgba(29,158,117,0.3)',
            color: '#1D9E75', padding: '3px 10px', borderRadius: 20,
          }}>{stage}</span>
          {ctx.living_situation && (
            <span style={{ ...font, fontSize: 9, color: 'rgba(255,255,255,0.25)' }}>{ctx.living_situation}</span>
          )}
          <button type="button" onClick={() => setEditing(true)} style={{
            background: 'transparent', border: 'none',
            color: accentColor, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', padding: 0, opacity: 0.7,
          }}>edit</button>
        </div>
      </div>

      {/* Info tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        {ctx.together_since && (
          <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '8px 10px' }}>
            <div style={{ ...font, fontSize: 8, color: 'rgba(255,255,255,0.28)', letterSpacing: '0.08em', textTransform: 'uppercase' as const, marginBottom: 3 }}>Together since</div>
            <div style={{ ...font, fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>
              {new Date(ctx.together_since).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
            </div>
          </div>
        )}
        {ctx.oracle_notes && (
          <div style={{ background: `${accentColor}05`, border: `0.5px solid ${accentColor}15`, borderRadius: 8, padding: '8px 10px', gridColumn: ctx.together_since ? 'span 1' : 'span 2' }}>
            <div style={{ ...font, fontSize: 8, color: `${accentColor}60`, letterSpacing: '0.08em', textTransform: 'uppercase' as const, marginBottom: 3 }}>Oracle knows</div>
            <div style={{ ...font, fontSize: 11, color: 'rgba(255,255,255,0.6)', lineHeight: 1.45 }}>{ctx.oracle_notes}</div>
          </div>
        )}
      </div>
    </div>
  )
}
