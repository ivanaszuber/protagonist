'use client'

import React, { useCallback, useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { ALL_DIMENSIONS, type Dimension } from '@/lib/character'
import { getUserId } from '@/lib/user'
import { getLevel, getLevelProgress } from '@/lib/xp'
import { openOracle } from '@/lib/oracle-events'
import { DesktopLeftSidebar, DIM_COLORS } from './DesktopLeftSidebar'
import DesktopTopNav from './DesktopTopNav'
import { DesktopOracleModal } from './DesktopOracleModal'
import ImportContextModal from './ImportContextModal'
import type { UserProfile } from '@/app/api/user-profile/route'
import type { ArchetypeInsights } from '@/app/api/user-profile/archetype-insights/route'

// ── Types ─────────────────────────────────────────────────────────────────────

interface JournalEntry {
  id: string
  type: 'morning-checkin' | 'voice-reflection' | 'achievement'
  content: string
  oracleReply: string | null
  moodSignal: string | null
  dimensions: string[]
  brief: string | null
  xpReward?: number
  createdAt: string
}

interface PulseDay {
  date: string
  score: number | null
  label: string | null
  hasEntry: boolean
}

interface PatternCard {
  dimension: string
  mentionCount: number
  energyPercent: number
  label: string
}

interface UnheardVoice {
  dimension: string
  lastSeen: string | null
  message: string
}

interface GrowthMarker {
  dimension: string
  completedTasks: number
  xpEarned: number
}

interface Portrait {
  essence?: string
  strengths?: string[]
  patterns?: string[]
  growth?: string
  calling?: string
  dimensionInsights?: Record<string, string>
  generatedAt?: string
  memoryCount?: number
  summary?: string
}

interface TraitPill {
  label: string
  color: 'blue' | 'green' | 'purple' | 'orange' | 'amber'
}

interface DimensionInsight {
  dimension: string
  insight: string
  color: string
}

interface IdentityData {
  chapterTitle: string
  essenceQuote: string
  strengths: TraitPill[]
  growthEdges: TraitPill[]
  dimensionInsights: DimensionInsight[]
  generatedAt: string
}

const PILL_COLORS: Record<string, string> = {
  blue:   '#4DC4FF',
  green:  '#6EE7A4',
  purple: '#C4A8FF',
  orange: '#FF9A5C',
  amber:  '#FFD47A',
}

const IDENTITY_CACHE_KEY_J = (uid: string) => `protagonist-identity-${uid}`
const IDENTITY_CACHE_TTL_J = 12 * 60 * 60 * 1000

type Tab = 'stream' | 'pulse' | 'portrait' | 'growth'

const ALL_DIMS: Dimension[] = ['career', 'social', 'wealth', 'vitality', 'mind', 'love', 'family']

const DIM_LABELS: Record<Dimension, string> = {
  career: 'Career', social: 'Social', wealth: 'Wealth',
  vitality: 'Vitality', mind: 'Mind', love: 'Love', family: 'Family',
}

const DIM_CHAR_NAMES: Record<Dimension, string> = {
  career: 'Forge', social: 'Echo', wealth: 'Vault',
  vitality: 'Ember', mind: 'Sage', love: 'Sol', family: 'Root',
}

// ── CSS ───────────────────────────────────────────────────────────────────────

const PAGE_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&display=swap');
  * { box-sizing: border-box; }
  ::-webkit-scrollbar { display: none; }

  @keyframes v2-pulse-dot { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.15);opacity:0.75} }
  @keyframes v2-pulse-btn { 0%,100%{box-shadow:0 0 0 0 rgba(255,122,101,0.4)} 50%{box-shadow:0 0 0 8px rgba(255,122,101,0)} }
  @keyframes jrn-fade-in  { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
  @keyframes jrn-shimmer  { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
  @keyframes jrn-pulse    { 0%,100%{transform:scale(1);opacity:0.6} 50%{transform:scale(1.06);opacity:1} }

  .jrn-entry { animation: jrn-fade-in 0.35s ease both; }
  .jrn-tab-btn {
    background: none; border: none; cursor: pointer;
    padding: 7px 14px; border-radius: 8px;
    font-family: 'Space Grotesk', sans-serif;
    font-size: 13px; font-weight: 600;
    transition: all 0.2s;
    color: rgba(255,255,255,0.45);
    display: flex; align-items: center; gap: 6px;
  }
  .jrn-tab-btn:hover { color: rgba(255,255,255,0.75); background: rgba(255,255,255,0.06); }
  .jrn-tab-btn.active { color: #fff; background: rgba(255,255,255,0.1); }
  .jrn-dim-pill {
    border: none; cursor: pointer; border-radius: 20px;
    font-family: 'Space Grotesk', sans-serif; font-size: 11px; font-weight: 600;
    padding: 4px 10px; transition: all 0.18s; white-space: nowrap;
  }
  .jrn-entry-card {
    border-radius: 14px; padding: 16px;
    transition: background 0.2s;
    border: 1px solid rgba(255,255,255,0.06);
  }
  .jrn-entry-card:hover { background: rgba(255,255,255,0.04) !important; }
  .jrn-portrait-section { animation: jrn-fade-in 0.4s ease both; }
  .jrn-portrait-section:nth-child(1) { animation-delay: 0.05s }
  .jrn-portrait-section:nth-child(2) { animation-delay: 0.10s }
  .jrn-portrait-section:nth-child(3) { animation-delay: 0.15s }
  .jrn-portrait-section:nth-child(4) { animation-delay: 0.20s }
  .jrn-portrait-section:nth-child(5) { animation-delay: 0.25s }
`

const font: CSSProperties = { fontFamily: "'Space Grotesk', system-ui, sans-serif" }

// ── SVG Icons ─────────────────────────────────────────────────────────────────

function Icon({ name, size = 14, color = 'currentColor' }: { name: string; size?: number; color?: string }) {
  const s = { width: size, height: size, flexShrink: 0 } as CSSProperties
  switch (name) {
    case 'journal':
      return <svg style={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
      </svg>
    case 'stream':
      return <svg style={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 12a5 5 0 0 1-5 5m0-10a5 5 0 0 0-5 5m14-5s-1.5 2-4 2-4-2-4-2-1.5-2-4-2-4 2-4 2"/>
      </svg>
    case 'pulse':
      return <svg style={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
      </svg>
    case 'portrait':
      return <svg style={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2z"/><path d="M12 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"/><path d="M6.8 18a6 6 0 0 1 10.4 0"/>
      </svg>
    case 'growth':
      return <svg style={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
      </svg>
    case 'sun':
      return <svg style={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
        <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
      </svg>
    case 'message':
      return <svg style={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    case 'sword':
      return <svg style={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"/><line x1="13" y1="19" x2="19" y2="13"/>
        <line x1="16" y1="16" x2="20" y2="20"/><line x1="19" y1="21" x2="21" y2="19"/>
      </svg>
    case 'zap':
      return <svg style={s} viewBox="0 0 24 24" fill={color} stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
      </svg>
    case 'entries':
      return <svg style={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
        <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
      </svg>
    case 'flame':
      return <svg style={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>
      </svg>
    case 'calendar':
      return <svg style={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
    case 'arc':
      return <svg style={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="4"/><path d="M6 20v-2a6 6 0 0 1 12 0v2"/>
        <path d="M19 11a7 7 0 0 1-7 7"/>
      </svg>
    case 'refresh':
      return <svg style={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
      </svg>
    case 'sparkle':
      return <svg style={s} viewBox="0 0 24 24" fill={color} stroke="none">
        <path d="M12 2l2.4 7.6H22l-6.4 4.6 2.4 7.6L12 17.2l-6 4.6 2.4-7.6L2 9.6h7.6L12 2z"/>
      </svg>
    case 'waves':
      return <svg style={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/>
        <path d="M2 12c.6.5 1.2 1 2.5 1C7 13 7 11 9.5 11c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/>
        <path d="M2 18c.6.5 1.2 1 2.5 1C7 19 7 17 9.5 17c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/>
      </svg>
    default:
      return <svg style={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8"><circle cx="12" cy="12" r="8"/></svg>
  }
}

// Mood indicator — colored dot instead of emoji
function MoodDot({ signal }: { signal: string | null }) {
  const color = (() => {
    if (!signal) return 'rgba(255,255,255,0.2)'
    const s = signal.toLowerCase()
    if (['excited', 'very_positive', 'great'].some(k => s.includes(k))) return '#FF9A5C'
    if (['positive', 'happy', 'good', 'proud', 'energized', 'motivated', 'grateful'].some(k => s.includes(k))) return '#6EE7A4'
    if (['neutral', 'calm', 'content', 'okay', 'fine'].some(k => s.includes(k))) return '#4DC4FF'
    if (['anxious', 'stressed', 'worried'].some(k => s.includes(k))) return '#FFD47A'
    if (['tired', 'low', 'sad', 'negative', 'frustrated', 'overwhelmed'].some(k => s.includes(k))) return '#FF6B9D'
    return 'rgba(255,255,255,0.3)'
  })()
  return (
    <span title={signal ?? ''} style={{
      display: 'inline-block', width: 7, height: 7, borderRadius: '50%',
      background: color, boxShadow: `0 0 5px ${color}88`, flexShrink: 0,
    }} />
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatRelTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const mins = Math.floor(diff / 60000)
  const hrs = Math.floor(mins / 60)
  const days = Math.floor(hrs / 24)
  if (mins < 2) return 'just now'
  if (mins < 60) return `${mins}m ago`
  if (hrs < 24) return `${hrs}h ago`
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days}d ago`
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function getScoreColor(score: number): string {
  if (score >= 4) return '#6EE7A4'
  if (score >= 3) return '#FFD47A'
  if (score >= 2) return '#FF9A5C'
  return '#FF6B9D'
}

// ── Stream Entry Card ─────────────────────────────────────────────────────────

function EntryCard({ entry }: { entry: JournalEntry }) {
  const [expanded, setExpanded] = useState(false)

  const typeConfig = {
    'morning-checkin': { label: 'Morning Brief', color: '#FFD47A', bg: 'rgba(255,212,122,0.12)', icon: 'sun' as const },
    'voice-reflection': { label: 'Reflection', color: '#C4A8FF', bg: 'rgba(196,168,255,0.12)', icon: 'message' as const },
    'achievement': { label: 'Achievement', color: '#6EE7A4', bg: 'rgba(110,231,164,0.12)', icon: 'sword' as const },
  }[entry.type]

  const primaryDim = entry.dimensions[0] as Dimension | undefined
  const dimColor = primaryDim ? DIM_COLORS[primaryDim] : '#C4A8FF'

  const previewText = entry.type === 'achievement'
    ? entry.content
    : entry.brief ?? (entry.content.length > 130 ? entry.content.slice(0, 130) + '…' : entry.content)

  return (
    <div
      className="jrn-entry jrn-entry-card"
      style={{ background: 'rgba(255,255,255,0.025)', marginBottom: 10, cursor: 'pointer' }}
      onClick={() => setExpanded(e => !e)}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10, flexWrap: 'wrap' }}>
        <span style={{
          ...font, fontSize: 11, fontWeight: 700,
          background: typeConfig.bg, color: typeConfig.color,
          padding: '3px 9px', borderRadius: 20,
          display: 'flex', alignItems: 'center', gap: 5,
        }}>
          <Icon name={typeConfig.icon} size={10} color={typeConfig.color} />
          {typeConfig.label}
        </span>

        {entry.dimensions.slice(0, 3).map(dim => (
          <span key={dim} style={{
            ...font, fontSize: 10, fontWeight: 600,
            background: `${DIM_COLORS[dim as Dimension] ?? '#C4A8FF'}18`,
            color: DIM_COLORS[dim as Dimension] ?? '#C4A8FF',
            border: `1px solid ${DIM_COLORS[dim as Dimension] ?? '#C4A8FF'}30`,
            padding: '2px 7px', borderRadius: 20,
          }}>
            {DIM_LABELS[dim as Dimension] ?? dim}
          </span>
        ))}

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5 }}>
          <MoodDot signal={entry.moodSignal} />
          <span style={{ ...font, fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
            {formatRelTime(entry.createdAt)}
          </span>
        </div>
      </div>

      {/* Content */}
      {entry.type === 'achievement' ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Icon name="sword" size={18} color="#6EE7A4" />
          <div>
            <p style={{ ...font, fontSize: 14, color: 'rgba(255,255,255,0.85)', lineHeight: 1.5 }}>
              {entry.content}
            </p>
            {entry.xpReward && (
              <span style={{ ...font, fontSize: 11, color: '#6EE7A4', fontWeight: 700 }}>
                +{entry.xpReward} XP earned
              </span>
            )}
          </div>
        </div>
      ) : (
        <>
          <p style={{
            ...font, fontSize: 13.5, color: 'rgba(255,255,255,0.75)',
            lineHeight: 1.65,
          }}>
            {expanded && !entry.brief ? entry.content : previewText}
          </p>

          {expanded && entry.oracleReply && (
            <div style={{
              marginTop: 12,
              borderLeft: `2px solid ${dimColor}`,
              paddingLeft: 12,
            }}>
              <p style={{ ...font, fontSize: 10, color: dimColor, fontWeight: 700, marginBottom: 4, letterSpacing: '1.2px' }}>
                ARC'S INSIGHT
              </p>
              <p style={{ ...font, fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 1.65 }}>
                {entry.oracleReply}
              </p>
            </div>
          )}

          {!expanded && entry.oracleReply && (
            <p style={{ ...font, fontSize: 11, color: 'rgba(255,255,255,0.28)', marginTop: 6 }}>
              tap to see Arc's insight
            </p>
          )}
        </>
      )}
    </div>
  )
}

// ── Pulse Chart ───────────────────────────────────────────────────────────────

function PulseChart({ pulse }: { pulse: PulseDay[] }) {
  const last30 = pulse.slice(-30)
  const hasData = last30.some(d => d.hasEntry)

  if (!hasData) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        minHeight: 180, gap: 12,
      }}>
        <Icon name="pulse" size={36} color="rgba(255,255,255,0.15)" />
        <p style={{ ...font, color: 'rgba(255,255,255,0.35)', fontSize: 13, textAlign: 'center', lineHeight: 1.65 }}>
          Your emotional pulse will appear here as you journal with Oracle.
        </p>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 110 }}>
        {last30.map((day, i) => {
          const h = day.score ? (day.score / 5) * 100 : 0
          const color = day.score ? getScoreColor(day.score) : 'rgba(255,255,255,0.06)'
          return (
            <div
              key={day.date}
              title={day.score ? `${day.date}: ${day.score.toFixed(1)}/5${day.label ? ` · ${day.label}` : ''}` : day.date}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}
            >
              <div style={{
                width: '100%', maxWidth: 16,
                height: day.hasEntry ? `${Math.max(h, 8)}%` : '4%',
                background: color,
                borderRadius: '3px 3px 2px 2px',
                transition: 'height 0.4s ease',
              }} />
            </div>
          )
        })}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
        {[0, 9, 19, 29].map(i => (
          last30[i] ? (
            <span key={i} style={{ ...font, fontSize: 9, color: 'rgba(255,255,255,0.25)' }}>
              {new Date(last30[i].date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
            </span>
          ) : null
        ))}
      </div>

      <div style={{ display: 'flex', gap: 12, marginTop: 14, flexWrap: 'wrap' }}>
        {[
          { color: '#6EE7A4', label: 'Great (4–5)' },
          { color: '#FFD47A', label: 'Good (3)' },
          { color: '#FF9A5C', label: 'Low (2)' },
          { color: '#FF6B9D', label: 'Rough (1)' },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: color }} />
            <span style={{ ...font, fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Blueprint archetype lookup ────────────────────────────────────────────────

const SUN_SIGN_DATA: Record<string, { symbol: string; color: string; tagline: string; interpretation: string }> = {
  aries:       { symbol: '♈', color: '#FF6B5E', tagline: 'The Initiator', interpretation: 'You move before others finish thinking. That fire-first instinct is your superpower — just pair it with reflection before the momentum becomes friction.' },
  taurus:      { symbol: '♉', color: '#6EE7A4', tagline: 'The Builder',   interpretation: 'You create lasting things. Slow, deliberate, and deeply reliable — your challenge is letting go of comfort when growth requires it.' },
  gemini:      { symbol: '♊', color: '#4DC4FF', tagline: 'The Connector',  interpretation: 'Your mind moves fast across ideas and people. The gift is curiosity; the trap is scattering before anything roots.' },
  cancer:      { symbol: '♋', color: '#C4A8FF', tagline: 'The Nurturer',   interpretation: 'You feel everything deeply and protect what you love fiercely. The work is turning that inward radar into self-protection too.' },
  leo:         { symbol: '♌', color: '#FFD47A', tagline: 'The Performer',  interpretation: 'You shine brightest when seen — and you earn it. Watch for needing validation to fuel what only you can do.' },
  virgo:       { symbol: '♍', color: '#6EE7A4', tagline: 'The Analyst',    interpretation: 'Precision is your love language. The details you catch change outcomes — your edge is knowing when good enough is actually enough.' },
  libra:       { symbol: '♎', color: '#FF9A5C', tagline: 'The Diplomat',   interpretation: 'You read rooms and build bridges intuitively. Your challenge is making the call when consensus stays out of reach.' },
  scorpio:     { symbol: '♏', color: '#C4A8FF', tagline: 'The Transformer', interpretation: 'You go deep where others stay surface. That intensity forges real things — and demands you trust the people you let in.' },
  sagittarius: { symbol: '♐', color: '#FF9A5C', tagline: 'The Seeker',     interpretation: 'Freedom, truth, and the next horizon pull you forward. The anchor you resist is actually what makes the exploration sustainable.' },
  capricorn:   { symbol: '♑', color: '#4DC4FF', tagline: 'The Architect',  interpretation: 'Long-game thinking is your default. You build structures others rely on — just make sure you\'re also in what you build.' },
  aquarius:    { symbol: '♒', color: '#4DC4FF', tagline: 'The Visionary',  interpretation: 'You see systems before others notice them. The challenge is staying connected to the humans inside the system you\'re redesigning.' },
  pisces:      { symbol: '♓', color: '#C4A8FF', tagline: 'The Dreamer',    interpretation: 'Your empathy and imagination access what logic alone can\'t. Boundaries are the structure that makes your sensitivity a gift, not a wound.' },
}

const RISING_SIGN_DATA: Record<string, { symbol: string; color: string; tagline: string; interpretation: string }> = {
  aries:       { symbol: '↑♈', color: '#FF6B5E', tagline: 'Leads with action',    interpretation: 'First impressions: direct, bold, already moving. People feel your energy before you\'ve said a word.' },
  taurus:      { symbol: '↑♉', color: '#6EE7A4', tagline: 'Leads with presence',  interpretation: 'You arrive and the room settles. Your steadiness signals safety — a magnetic, grounding energy.' },
  gemini:      { symbol: '↑♊', color: '#4DC4FF', tagline: 'Leads with wit',       interpretation: 'You\'re immediately curious, adaptable, alive. People sense your mind and want to match your pace.' },
  cancer:      { symbol: '↑♋', color: '#C4A8FF', tagline: 'Leads with warmth',    interpretation: 'You read the room emotionally before you read it logically. That softness draws people in — and sometimes hides your real fire.' },
  leo:         { symbol: '↑♌', color: '#FFD47A', tagline: 'Leads with presence',  interpretation: 'You walk in and take up space naturally. The challenge is letting your private self match who shows up in the room.' },
  virgo:       { symbol: '↑♍', color: '#6EE7A4', tagline: 'Leads with precision', interpretation: 'You notice what\'s off before others settle in. That discernment builds trust — over time.' },
  libra:       { symbol: '↑♎', color: '#FF9A5C', tagline: 'Leads with grace',     interpretation: 'Effortlessly diplomatic on entry. You make people feel considered, which opens doors your sun sign can then walk through.' },
  scorpio:     { symbol: '↑♏', color: '#C4A8FF', tagline: 'Leads with intensity', interpretation: 'Still waters, deep current. People sense there\'s more to you — and they\'re right. That mystery is a social asset.' },
  sagittarius: { symbol: '↑♐', color: '#FF9A5C', tagline: 'Leads with enthusiasm', interpretation: 'Your optimism is contagious on contact. You expand the room\'s sense of what\'s possible.' },
  capricorn:   { symbol: '↑♑', color: '#4DC4FF', tagline: 'Leads with authority', interpretation: 'You project competence before you speak. That quiet authority earns trust — sometimes before you want responsibility.' },
  aquarius:    { symbol: '↑♒', color: '#4DC4FF', tagline: 'Leads with ideas',     interpretation: 'You enter already on a different wavelength. That distinctiveness is a signal, not a flaw.' },
  pisces:      { symbol: '↑♓', color: '#C4A8FF', tagline: 'Leads with feeling',   interpretation: 'You absorb the room\'s emotional weather instantly. Knowing that keeps you from owning others\' states as your own.' },
}

const ENNEAGRAM_DATA: Record<string, { symbol: string; color: string; tagline: string; interpretation: string }> = {
  '1':    { symbol: '①', color: '#6EE7A4', tagline: 'The Reformer',   interpretation: 'A drive for integrity and improvement that can tip into perfectionism. Your standards lift everyone — when you extend them inward with compassion.' },
  '1w2':  { symbol: '①', color: '#6EE7A4', tagline: 'The Advocate',   interpretation: 'Principled and people-focused. Your reforms come from care, not criticism — though you still feel both.' },
  '1w9':  { symbol: '①', color: '#6EE7A4', tagline: 'The Idealist',   interpretation: 'Quiet integrity. You hold your standards without the public fight — until something really matters.' },
  '2':    { symbol: '②', color: '#FF9A5C', tagline: 'The Helper',     interpretation: 'Generous to a fault. Your love shows up as action — and the work is letting yourself receive as well as give.' },
  '2w1':  { symbol: '②', color: '#FF9A5C', tagline: 'The Servant',    interpretation: 'Service with standards. You give from a place of genuine care — and occasionally martyr.' },
  '2w3':  { symbol: '②', color: '#FF9A5C', tagline: 'The Host',       interpretation: 'Warmth and ambition woven together. You charm and care simultaneously — and fear being needed for how you look, not who you are.' },
  '3':    { symbol: '③', color: '#FFD47A', tagline: 'The Achiever',   interpretation: 'Success is your language. You adapt, excel, and deliver — the depth work is knowing which wins are yours vs. the role you\'re playing.' },
  '3w2':  { symbol: '③', color: '#FFD47A', tagline: 'The Charmer',    interpretation: 'Achievement fueled by connection. You\'re magnetic and productive — and need the people around you to be real, not an audience.' },
  '3w4':  { symbol: '③', color: '#FFD47A', tagline: 'The Professional', interpretation: 'Driven to succeed AND to mean it. The 4 wing demands authenticity even inside your ambition — this is where your depth lives. The tension between "performing" and "being" is your central story.' },
  '4':    { symbol: '④', color: '#C4A8FF', tagline: 'The Individualist', interpretation: 'Depth, beauty, and the authentic self — your native territory. The challenge is not mistaking the longing for the arrival.' },
  '4w3':  { symbol: '④', color: '#C4A8FF', tagline: 'The Aristocrat',  interpretation: 'Uniqueness with ambition. You want to be seen as extraordinary — and you likely are.' },
  '4w5':  { symbol: '④', color: '#C4A8FF', tagline: 'The Bohemian',    interpretation: 'Deep, private, intensely original. Your inner world is rich; the world benefits when you share it.' },
  '5':    { symbol: '⑤', color: '#4DC4FF', tagline: 'The Investigator', interpretation: 'Knowledge as safety. You master before you move — the growth edge is engaging while still learning.' },
  '5w4':  { symbol: '⑤', color: '#4DC4FF', tagline: 'The Iconoclast',  interpretation: 'Intellectual depth with artistic soul. Your insights are rare; the barrier is letting others in to receive them.' },
  '5w6':  { symbol: '⑤', color: '#4DC4FF', tagline: 'The Problem Solver', interpretation: 'Analytical and loyal. You build systems others rely on — and need to trust that asking for help is smart, not weak.' },
  '6':    { symbol: '⑥', color: '#4DC4FF', tagline: 'The Loyalist',    interpretation: 'Trustworthy, prepared, and attuned to risk. Your anxiety is intelligence — the work is not letting preparation become paralysis.' },
  '6w5':  { symbol: '⑥', color: '#4DC4FF', tagline: 'The Defender',    interpretation: 'Cautious and analytical. You think before trusting — and when you do trust, it\'s real.' },
  '6w7':  { symbol: '⑥', color: '#4DC4FF', tagline: 'The Buddy',       interpretation: 'Warm and wary in equal measure. You want connection AND safety — and can have both.' },
  '7':    { symbol: '⑦', color: '#FF9A5C', tagline: 'The Enthusiast',  interpretation: 'Joy, possibility, and the next adventure. The depth work is sitting with what\'s already here long enough to actually have it.' },
  '7w6':  { symbol: '⑦', color: '#FF9A5C', tagline: 'The Entertainer', interpretation: 'Fun and faithful. You bring people along for the ride — and actually care about who makes it.' },
  '7w8':  { symbol: '⑦', color: '#FF9A5C', tagline: 'The Realist',     interpretation: 'Bold appetite, practical edge. You want the good life and you\'ll build it yourself if needed.' },
  '8':    { symbol: '⑧', color: '#FF6B5E', tagline: 'The Challenger',  interpretation: 'Strength, protection, and unfiltered directness. Vulnerability isn\'t weakness — it\'s the move that builds what force alone can\'t.' },
  '8w7':  { symbol: '⑧', color: '#FF6B5E', tagline: 'The Maverick',    interpretation: 'Fierce and expansive. You chase impact and freedom simultaneously — and usually get both.' },
  '8w9':  { symbol: '⑧', color: '#FF6B5E', tagline: 'The Bear',        interpretation: 'Power with patience. You move when it matters — and when you do, things shift.' },
  '9':    { symbol: '⑨', color: '#6EE7A4', tagline: 'The Peacemaker',  interpretation: 'Harmony-seeking and deeply perceptive. Your challenge is not mistaking peace for your own absence.' },
  '9w8':  { symbol: '⑨', color: '#6EE7A4', tagline: 'The Referee',     interpretation: 'Steady power. You hold the room together — and occasionally need to let yourself take up the space you make for others.' },
  '9w1':  { symbol: '⑨', color: '#6EE7A4', tagline: 'The Dreamer',     interpretation: 'Principled peace-seeker. Your quiet idealism shapes things slowly and surely.' },
}

const NEURODIVERGENT_DATA: Record<string, { symbol: string; color: string; tagline: string; interpretation: string }> = {
  'audhd':        { symbol: '∞', color: '#4DC4FF', tagline: 'AuDHD Wiring',    interpretation: 'Autism + ADHD creates a mind that hyperfocuses with incredible depth AND needs novelty to stay alive. The pattern-recognition is extraordinary; the cost is that context-switching and uncertainty can overload an otherwise high-functioning system. Structure isn\'t a cage — it\'s the rails that let you go full speed.' },
  'adhd':         { symbol: '⚡', color: '#FFD47A', tagline: 'ADHD Wiring',     interpretation: 'A dopamine-driven brain that thrives on urgency, interest, and challenge. Your spikes of focus are world-class — the work is building systems that survive the valleys in between.' },
  'autism':       { symbol: '◈',  color: '#C4A8FF', tagline: 'Autistic Wiring', interpretation: 'Deep pattern recognition, intense focus, and a commitment to authenticity. Social masking costs energy — the more you can architect environments that fit you, the more that focus becomes pure output.' },
  'dyslexia':     { symbol: '◇',  color: '#FF9A5C', tagline: 'Dyslexic Wiring', interpretation: 'Spatial, big-picture, and creative in ways linear thinkers can\'t access. The processing difference that once looked like a limitation is often the source of your most original thinking.' },
  'dyscalculia':  { symbol: '◆',  color: '#FF9A5C', tagline: 'Dyscalculia',    interpretation: 'Numbers aren\'t your native language — but ideas, patterns, and stories often are. Working with that instead of against it is how you build systems that actually stick.' },
  'sensory':      { symbol: '〜', color: '#6EE7A4', tagline: 'Sensory Processing', interpretation: 'High-fidelity inputs that most people filter out. The key is designing your environment, not battling your baseline.' },
  'hsp':          { symbol: '✦',  color: '#C4A8FF', tagline: 'Highly Sensitive', interpretation: 'You process depth — emotional, sensory, aesthetic — at a level that requires deliberate recovery alongside deliberate output.' },
}

function getNeurodivergentKey(notes: string): string {
  const n = notes.toLowerCase()
  if (n.includes('audhd') || (n.includes('autism') && n.includes('adhd'))) return 'audhd'
  if (n.includes('adhd')) return 'adhd'
  if (n.includes('autism') || n.includes('autistic') || n.includes('asd')) return 'autism'
  if (n.includes('dyslexia') || n.includes('dyslexic')) return 'dyslexia'
  if (n.includes('dyscalculia')) return 'dyscalculia'
  if (n.includes('sensory')) return 'sensory'
  if (n.includes('hsp') || n.includes('highly sensitive')) return 'hsp'
  return 'adhd'
}

// ── Arc Portrait Tab ──────────────────────────────────────────────────────────

function PortraitView({ portrait, identity, identityLoading, loading, profile, insights, onGenerate, onRefreshIdentity }: {
  portrait: Portrait | null
  identity: IdentityData | null
  identityLoading: boolean
  loading: boolean
  profile: UserProfile | null
  insights: import('@/app/api/user-profile/archetype-insights/route').ArchetypeInsights | null
  onGenerate: () => void
  onRefreshIdentity: () => void
}) {
  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 300, gap: 20 }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%',
          background: 'linear-gradient(135deg, #7B3FE4, #C4A8FF)',
          animation: 'jrn-pulse 2s ease-in-out infinite',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon name="arc" size={28} color="white" />
        </div>
        <p style={{ ...font, color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>
          Arc is synthesizing your story…
        </p>
      </div>
    )
  }

  // No data at all — show empty state
  if (!portrait && !identity && !profile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 300, gap: 16 }}>
        <div style={{
          width: 72, height: 72, borderRadius: '50%',
          background: 'rgba(123,63,228,0.15)', border: '1px solid rgba(196,168,255,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon name="portrait" size={32} color="#C4A8FF" />
        </div>
        <h3 style={{ ...font, color: '#fff', fontSize: 18, fontWeight: 700 }}>Arc's Portrait awaits</h3>
        <p style={{ ...font, color: 'rgba(255,255,255,0.45)', fontSize: 13.5, textAlign: 'center', maxWidth: 340, lineHeight: 1.7 }}>
          Arc synthesizes your memories, reflections, and growth into a living psychological portrait — a mirror of who you're becoming.
        </p>
        <button
          onClick={onGenerate}
          style={{
            ...font, cursor: 'pointer', fontWeight: 700, fontSize: 13,
            background: '#7B3FE4', color: '#fff',
            border: 'none', borderRadius: 12, padding: '11px 28px', marginTop: 4,
            display: 'flex', alignItems: 'center', gap: 7,
          }}
        >
          <Icon name="sparkle" size={13} color="white" />
          Generate My Portrait
        </button>
      </div>
    )
  }

  // Derive archetype tile data from profile
  const sunKey = profile?.sunSign?.toLowerCase().trim() ?? ''
  const risingKey = profile?.risingSign?.toLowerCase().trim() ?? ''
  const enneagramKey = profile?.enneagram?.toLowerCase().trim() ?? ''
  const neurodivKey = profile?.neurodivergentNotes ? getNeurodivergentKey(profile.neurodivergentNotes) : null

  const sunData = SUN_SIGN_DATA[sunKey]
  const risingData = RISING_SIGN_DATA[risingKey]
  const enneagramData = ENNEAGRAM_DATA[enneagramKey] ?? ENNEAGRAM_DATA[enneagramKey.charAt(0)]
  const neurodivData = neurodivKey ? NEURODIVERGENT_DATA[neurodivKey] : null

  const hasBlueprint = sunData || risingData || enneagramData || neurodivData

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ══ HERO SECTION ══ */}
      {identity && (
        <div className="jrn-portrait-section" style={{
          background: 'linear-gradient(135deg, rgba(123,63,228,0.2) 0%, rgba(77,196,255,0.07) 60%, rgba(196,168,255,0.05) 100%)',
          border: '1px solid rgba(123,63,228,0.32)',
          borderRadius: 18, padding: '20px 22px',
        }}>
          {/* Chapter badge + title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 14 }}>
            <div style={{
              background: 'rgba(123,63,228,0.4)', color: '#C4A8FF',
              fontSize: 9, fontWeight: 700, letterSpacing: '1.6px',
              padding: '3px 10px', borderRadius: 100, textTransform: 'uppercase' as const, flexShrink: 0,
            }}>
              Arc's Portrait
            </div>
            {profile?.displayName && (
              <span style={{ ...font, color: 'rgba(255,255,255,0.45)', fontSize: 12 }}>· {profile.displayName}</span>
            )}
          </div>

          {/* Chapter title — large */}
          {identity.chapterTitle && (
            <h2 style={{ ...font, fontSize: 22, fontWeight: 800, color: '#fff', lineHeight: 1.2, marginBottom: 14, letterSpacing: '-0.3px' }}>
              {identity.chapterTitle}
            </h2>
          )}

          {/* Essence quote — prominent */}
          {identity.essenceQuote && (
            <div style={{
              borderLeft: '3px solid rgba(196,168,255,0.4)',
              paddingLeft: 14, marginBottom: 16,
            }}>
              <p style={{ ...font, fontSize: 15, fontStyle: 'italic', color: 'rgba(255,255,255,0.78)', lineHeight: 1.75 }}>
                "{identity.essenceQuote}"
              </p>
            </div>
          )}

          {/* YOU ARE pills */}
          {identity.strengths?.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <span style={{ ...font, fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.32)', letterSpacing: '1.5px', textTransform: 'uppercase' as const, display: 'block', marginBottom: 7 }}>You Are</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {identity.strengths.map((pill, i) => {
                  const c = PILL_COLORS[pill.color] ?? '#C4A8FF'
                  return (
                    <span key={i} style={{
                      ...font, background: `${c}18`, color: c,
                      border: `1px solid ${c}35`,
                      fontSize: 12, fontWeight: 600,
                      padding: '5px 13px', borderRadius: 100,
                    }}>{pill.label}</span>
                  )
                })}
              </div>
            </div>
          )}

          {/* STILL GROWING pills */}
          {identity.growthEdges?.length > 0 && (
            <div>
              <span style={{ ...font, fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.32)', letterSpacing: '1.5px', textTransform: 'uppercase' as const, display: 'block', marginBottom: 7 }}>Still Growing</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {identity.growthEdges.map((pill, i) => (
                  <span key={i} style={{
                    ...font, background: 'rgba(255,212,122,0.1)', color: '#FFD47A',
                    border: '1px solid rgba(255,212,122,0.28)',
                    fontSize: 12, fontWeight: 600,
                    padding: '5px 13px', borderRadius: 100,
                  }}>△ {pill.label}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Fallback hero — portrait essence only (no identity yet) */}
      {!identity && portrait?.essence && (
        <div className="jrn-portrait-section" style={{
          background: 'linear-gradient(135deg, rgba(123,63,228,0.15), rgba(196,168,255,0.06))',
          borderRadius: 18, padding: '20px 22px', border: '1px solid rgba(196,168,255,0.18)',
        }}>
          <p style={{ ...font, fontSize: 10, fontWeight: 700, color: '#C4A8FF', letterSpacing: '1.5px', marginBottom: 12, textTransform: 'uppercase' as const }}>Your Essence</p>
          <p style={{ ...font, fontSize: 16, color: '#fff', lineHeight: 1.85, fontWeight: 500, fontStyle: 'italic' }}>"{portrait.essence}"</p>
        </div>
      )}

      {/* Identity loading placeholder */}
      {!identity && identityLoading && (
        <div style={{
          height: 90, borderRadius: 16, background: 'rgba(123,63,228,0.07)',
          border: '1px solid rgba(123,63,228,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ ...font, color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>Arc is reading your memories…</span>
        </div>
      )}

      {/* ══ BLUEPRINT ══ */}
      {hasBlueprint && (
        <div className="jrn-portrait-section">
          <p style={{ ...font, fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.3)', letterSpacing: '1.6px', textTransform: 'uppercase' as const, marginBottom: 10 }}>
            Your Blueprint
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[
              sunData    ? { ...sunData,      type: 'Sun',     label: profile?.sunSign ?? '' }            : null,
              risingData ? { ...risingData,   type: 'Rising',  label: (profile?.risingSign ?? '') + ' Rising' } : null,
              enneagramData ? { ...enneagramData, type: 'Enneagram', label: profile?.enneagram ?? '' }    : null,
              neurodivData  ? { ...neurodivData,  type: 'Wiring',    label: profile?.neurodivergentNotes ?? '' } : null,
            ].filter(Boolean).map((tile, i) => {
              if (!tile) return null
              const t = tile as { symbol: string; color: string; tagline: string; interpretation: string; type: string; label: string }
              return (
                <div key={i} style={{
                  background: `${t.color}0A`,
                  border: `1px solid ${t.color}22`,
                  borderRadius: 14, padding: '14px 15px',
                  display: 'flex', flexDirection: 'column', gap: 7,
                }}>
                  {/* Top row: symbol + type badge */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 20, lineHeight: 1 }}>{t.symbol}</span>
                    <span style={{
                      ...font, fontSize: 9, fontWeight: 700, letterSpacing: '1.2px',
                      color: t.color, textTransform: 'uppercase' as const,
                      background: `${t.color}15`, padding: '2px 8px', borderRadius: 100,
                    }}>{t.type}</span>
                  </div>
                  {/* Label + tagline */}
                  <div>
                    <p style={{ ...font, fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 1 }}>{t.label}</p>
                    <p style={{ ...font, fontSize: 11, color: t.color, fontWeight: 600 }}>{t.tagline}</p>
                  </div>
                  {/* Interpretation */}
                  <p style={{ ...font, fontSize: 11.5, color: 'rgba(255,255,255,0.58)', lineHeight: 1.6 }}>
                    {t.interpretation}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ══ YOUR GROWTH — full-width narrative ══ */}
      {portrait?.growth && (
        <div className="jrn-portrait-section" style={{
          background: 'rgba(110,231,164,0.06)', borderRadius: 14, padding: '16px 18px',
          border: '1px solid rgba(110,231,164,0.14)',
        }}>
          <p style={{ ...font, fontSize: 9, fontWeight: 700, color: '#6EE7A4', letterSpacing: '1.5px', textTransform: 'uppercase' as const, marginBottom: 10 }}>Your Growth</p>
          <p style={{ ...font, fontSize: 14, color: 'rgba(255,255,255,0.82)', lineHeight: 1.8 }}>{portrait.growth}</p>
        </div>
      )}

      {/* ══ WHAT TO WATCH ══ */}
      {insights?.watch && insights.watch.length > 0 && (
        <div className="jrn-portrait-section" style={{
          background: 'rgba(255,212,122,0.05)', borderRadius: 14, padding: '16px 18px',
          border: '1px solid rgba(255,212,122,0.12)',
        }}>
          <p style={{ ...font, fontSize: 9, fontWeight: 700, color: '#FFD47A', letterSpacing: '1.5px', textTransform: 'uppercase' as const, marginBottom: 12 }}>What to Watch</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {insights.watch.map((w, i) => (
              <div key={i} style={{ display: 'flex', gap: 11, alignItems: 'flex-start' }}>
                <span style={{
                  ...font, fontSize: 10, fontWeight: 700, color: '#FFD47A',
                  background: 'rgba(255,212,122,0.15)', border: '1px solid rgba(255,212,122,0.25)',
                  padding: '4px 9px', borderRadius: 100, flexShrink: 0, whiteSpace: 'nowrap' as const,
                  marginTop: 1,
                }}>△ {w.label}</span>
                <p style={{ ...font, fontSize: 12.5, color: 'rgba(255,255,255,0.6)', lineHeight: 1.6 }}>
                  {w.tooltip}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Fallback What to Watch from identity growthEdges (if no insights) */}
      {!insights?.watch?.length && identity?.growthEdges && identity.growthEdges.length > 0 && (
        <div className="jrn-portrait-section" style={{
          background: 'rgba(255,212,122,0.05)', borderRadius: 14, padding: '16px 18px',
          border: '1px solid rgba(255,212,122,0.12)',
        }}>
          <p style={{ ...font, fontSize: 9, fontWeight: 700, color: '#FFD47A', letterSpacing: '1.5px', textTransform: 'uppercase' as const, marginBottom: 10 }}>What to Watch</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {identity.growthEdges.map((edge, i) => (
              <p key={i} style={{ ...font, fontSize: 13, color: 'rgba(255,255,255,0.62)', lineHeight: 1.6 }}>△ {edge.label}</p>
            ))}
          </div>
        </div>
      )}

      {/* ══ YOUR WIRING (from archetype insights) ══ */}
      {insights?.wiring && insights.wiring.length > 0 && (
        <div className="jrn-portrait-section">
          <p style={{ ...font, fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.3)', letterSpacing: '1.6px', textTransform: 'uppercase' as const, marginBottom: 10 }}>
            Your Wiring
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
            {insights.wiring.map((w, i) => {
              const c = PILL_COLORS[w.color] ?? '#C4A8FF'
              return (
                <div key={i} title={w.tooltip} style={{
                  background: `${c}12`, border: `1px solid ${c}28`,
                  borderRadius: 100, padding: '6px 14px',
                  display: 'flex', alignItems: 'center', gap: 6, cursor: 'default',
                }}>
                  <div style={{ width: 5, height: 5, borderRadius: '50%', background: c, flexShrink: 0 }} />
                  <span style={{ ...font, fontSize: 12, fontWeight: 600, color: c }}>{w.label}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ══ ARC'S LENS by dimension ══ */}
      {identity?.dimensionInsights && identity.dimensionInsights.length > 0 && (
        <div className="jrn-portrait-section">
          <p style={{ ...font, fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.3)', letterSpacing: '1.6px', textTransform: 'uppercase' as const, marginBottom: 10 }}>
            Arc's Lens
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {identity.dimensionInsights.map((d, i) => (
              <div key={i} style={{
                background: 'rgba(255,255,255,0.022)', borderRadius: 11, padding: '10px 14px',
                display: 'flex', gap: 10, alignItems: 'flex-start',
                border: `1px solid ${d.color}18`,
              }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: d.color, marginTop: 5 }} />
                <div>
                  <p style={{ ...font, fontSize: 9, fontWeight: 700, color: d.color, marginBottom: 3, letterSpacing: '1px', textTransform: 'uppercase' as const }}>
                    {d.dimension}
                  </p>
                  <p style={{ ...font, fontSize: 12.5, color: 'rgba(255,255,255,0.68)', lineHeight: 1.6 }}>
                    {d.insight}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 4, flexWrap: 'wrap', gap: 8 }}>
        <p style={{ ...font, fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>
          {portrait?.memoryCount ? `${portrait.memoryCount} memories` : ''}
          {identity?.generatedAt ? ` · ${formatRelTime(identity.generatedAt)}` : portrait?.generatedAt ? ` · ${formatRelTime(portrait.generatedAt)}` : ''}
        </p>
        <div style={{ display: 'flex', gap: 6 }}>
          {!portrait?.essence && (
            <button onClick={onGenerate} style={{
              ...font, cursor: 'pointer', fontSize: 11, fontWeight: 600,
              background: '#7B3FE4', color: '#fff',
              border: 'none', borderRadius: 8, padding: '6px 14px',
              display: 'flex', alignItems: 'center', gap: 5,
            }}>
              <Icon name="sparkle" size={11} color="white" />
              Generate Portrait
            </button>
          )}
          <button onClick={onRefreshIdentity} style={{
            ...font, cursor: 'pointer', fontSize: 11, fontWeight: 600,
            background: 'rgba(123,63,228,0.15)', color: '#C4A8FF',
            border: '1px solid rgba(196,168,255,0.18)', borderRadius: 8, padding: '6px 14px',
            display: 'flex', alignItems: 'center', gap: 5,
          }}>
            <Icon name="refresh" size={11} color="#C4A8FF" />
            Refresh
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Growth Map Tab ────────────────────────────────────────────────────────────

function GrowthMapView({ growthMarkers, achievements }: {
  growthMarkers: GrowthMarker[]
  achievements: JournalEntry[]
}) {
  const maxTasks = Math.max(...growthMarkers.map(g => g.completedTasks), 1)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <p style={{ ...font, fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.35)', letterSpacing: '1.5px', marginBottom: 14 }}>
          TASKS COMPLETED · LAST 30 DAYS
        </p>
        {growthMarkers.length === 0 ? (
          <p style={{ ...font, fontSize: 13, color: 'rgba(255,255,255,0.3)', lineHeight: 1.6 }}>
            Complete tasks with Oracle to see your growth here.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
            {ALL_DIMS.map(dim => {
              const marker = growthMarkers.find(g => g.dimension === dim)
              const count = marker?.completedTasks ?? 0
              const xp = marker?.xpEarned ?? 0
              const pct = (count / maxTasks) * 100
              return (
                <div key={dim}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ ...font, fontSize: 12, color: count > 0 ? DIM_COLORS[dim] : 'rgba(255,255,255,0.3)', fontWeight: 600 }}>
                      {DIM_CHAR_NAMES[dim]} · {DIM_LABELS[dim]}
                    </span>
                    <span style={{ ...font, fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
                      {count > 0 ? `${count} tasks · ${xp} XP` : '—'}
                    </span>
                  </div>
                  <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 4 }}>
                    <div style={{
                      height: '100%', borderRadius: 4,
                      width: count > 0 ? `${pct}%` : '0%',
                      background: `linear-gradient(90deg, ${DIM_COLORS[dim]}66, ${DIM_COLORS[dim]})`,
                      transition: 'width 0.8s ease',
                    }} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div>
        <p style={{ ...font, fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.35)', letterSpacing: '1.5px', marginBottom: 12 }}>
          RECENT WINS
        </p>
        {achievements.length === 0 ? (
          <p style={{ ...font, fontSize: 13, color: 'rgba(255,255,255,0.3)', lineHeight: 1.6 }}>
            Your completed tasks will appear here as trophies.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {achievements.slice(0, 15).map(a => {
              const dim = a.dimensions[0] as Dimension | undefined
              const color = dim ? DIM_COLORS[dim] : '#C4A8FF'
              return (
                <div key={a.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  background: 'rgba(255,255,255,0.025)', borderRadius: 10, padding: '10px 14px',
                }}>
                  <Icon name="sword" size={14} color={color} />
                  <p style={{ ...font, fontSize: 13, color: 'rgba(255,255,255,0.75)', flex: 1 }}>{a.content}</p>
                  {a.xpReward && <span style={{ ...font, fontSize: 11, color, fontWeight: 700, flexShrink: 0 }}>+{a.xpReward}</span>}
                  <span style={{ ...font, fontSize: 11, color: 'rgba(255,255,255,0.22)', flexShrink: 0 }}>{formatRelTime(a.createdAt)}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Right Panel ───────────────────────────────────────────────────────────────

function RightPanel({ patternCards, unheardVoices, growthMarkers, stats, pulse }: {
  patternCards: PatternCard[]
  unheardVoices: UnheardVoice[]
  growthMarkers: GrowthMarker[]
  stats: { totalEntries: number; totalCompleted: number; activeStreak: number; mostActiveDay: string }
  pulse: PulseDay[]
}) {
  const last14 = pulse.slice(-14)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Stats */}
      <div style={{
        background: 'rgba(255,255,255,0.03)', borderRadius: 14, padding: '14px 16px',
        border: '1px solid rgba(255,255,255,0.06)',
      }}>
        <p style={{ ...font, fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.3)', letterSpacing: '1.4px', marginBottom: 12 }}>YOUR STATS</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[
            { label: 'Entries', value: stats?.totalEntries ?? 0, icon: 'entries' as const },
            { label: 'Streak', value: `${stats?.activeStreak ?? 0}d`, icon: 'flame' as const, color: '#FF9A5C' },
            { label: 'Completed', value: stats?.totalCompleted ?? 0, icon: 'sword' as const, color: '#6EE7A4' },
            { label: 'Peak Day', value: stats?.mostActiveDay ?? '—', icon: 'calendar' as const },
          ].map(({ label, value, icon, color }) => (
            <div key={label} style={{ textAlign: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 3 }}>
                <Icon name={icon} size={14} color={color ?? 'rgba(255,255,255,0.4)'} />
              </div>
              <p style={{ ...font, fontSize: 16, fontWeight: 700, color: '#fff' }}>{value}</p>
              <p style={{ ...font, fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Mini pulse */}
      {last14.some(d => d.hasEntry) && (
        <div style={{
          background: 'rgba(255,255,255,0.03)', borderRadius: 14, padding: '14px 16px',
          border: '1px solid rgba(255,255,255,0.06)',
        }}>
          <p style={{ ...font, fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.3)', letterSpacing: '1.4px', marginBottom: 10 }}>
            14-DAY PULSE
          </p>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 40 }}>
            {last14.map(day => {
              const h = day.score ? (day.score / 5) * 100 : 0
              const color = day.score ? getScoreColor(day.score) : 'rgba(255,255,255,0.05)'
              return (
                <div key={day.date} title={day.date}
                  style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                  <div style={{
                    width: '100%', height: day.hasEntry ? `${Math.max(h, 12)}%` : '6%',
                    background: color, borderRadius: '2px 2px 1px 1px',
                  }} />
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Pattern cards */}
      {patternCards.length > 0 && (
        <div style={{
          background: 'rgba(255,255,255,0.03)', borderRadius: 14, padding: '14px 16px',
          border: '1px solid rgba(255,255,255,0.06)',
        }}>
          <p style={{ ...font, fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.3)', letterSpacing: '1.4px', marginBottom: 10 }}>FOCUS PATTERNS</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {patternCards.map(pc => {
              const color = DIM_COLORS[pc.dimension as Dimension] ?? '#C4A8FF'
              return (
                <div key={pc.dimension} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0, boxShadow: `0 0 5px ${color}88` }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                      <span style={{ ...font, fontSize: 12, color: 'rgba(255,255,255,0.65)', fontWeight: 600 }}>
                        {DIM_LABELS[pc.dimension as Dimension] ?? pc.dimension}
                      </span>
                      <span style={{ ...font, fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>{pc.mentionCount}×</span>
                    </div>
                    <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
                      <div style={{ height: '100%', borderRadius: 2, width: `${pc.energyPercent}%`, background: color, opacity: 0.65 }} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Unheard voices */}
      {unheardVoices.length > 0 && (
        <div style={{
          background: 'rgba(255,107,157,0.04)', borderRadius: 14, padding: '14px 16px',
          border: '1px solid rgba(255,107,157,0.08)',
        }}>
          <p style={{ ...font, fontSize: 9, fontWeight: 700, color: '#FF6B9D', letterSpacing: '1.4px', marginBottom: 10 }}>UNHEARD VOICES</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {unheardVoices.slice(0, 3).map(uv => {
              const color = DIM_COLORS[uv.dimension as Dimension] ?? '#C4A8FF'
              return (
                <div key={uv.dimension} style={{ borderLeft: `2px solid ${color}40`, paddingLeft: 9 }}>
                  <p style={{ ...font, fontSize: 11, color, fontWeight: 600, marginBottom: 2 }}>
                    {DIM_LABELS[uv.dimension as Dimension] ?? uv.dimension}
                  </p>
                  <p style={{ ...font, fontSize: 11, color: 'rgba(255,255,255,0.35)', lineHeight: 1.5 }}>{uv.message}</p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Growth markers */}
      {growthMarkers.length > 0 && (
        <div style={{
          background: 'rgba(110,231,164,0.03)', borderRadius: 14, padding: '14px 16px',
          border: '1px solid rgba(110,231,164,0.07)',
        }}>
          <p style={{ ...font, fontSize: 9, fontWeight: 700, color: '#6EE7A4', letterSpacing: '1.4px', marginBottom: 10 }}>GROWTH THIS MONTH</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {growthMarkers.slice(0, 4).map(gm => {
              const color = DIM_COLORS[gm.dimension as Dimension] ?? '#C4A8FF'
              return (
                <div key={gm.dimension} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ ...font, fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>
                    {DIM_LABELS[gm.dimension as Dimension] ?? gm.dimension}
                  </span>
                  <span style={{ ...font, fontSize: 12, color, fontWeight: 700 }}>+{gm.xpEarned} XP</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function DesktopJournalPage() {
  const [userId, setUserId] = useState<string>('')

  // Data
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [achievements, setAchievements] = useState<JournalEntry[]>([])
  const [pulse, setPulse] = useState<PulseDay[]>([])
  const [portrait, setPortrait] = useState<Portrait | null>(null)
  const [patternCards, setPatternCards] = useState<PatternCard[]>([])
  const [unheardVoices, setUnheardVoices] = useState<UnheardVoice[]>([])
  const [growthMarkers, setGrowthMarkers] = useState<GrowthMarker[]>([])
  const [stats, setStats] = useState({ totalEntries: 0, totalCompleted: 0, activeStreak: 0, mostActiveDay: '—' })

  // Sidebar scores
  const [dimXpMap, setDimXpMap] = useState<Record<string, number>>({})
  const [dimBaselineMap, setDimBaselineMap] = useState<Record<string, number>>({})

  // Identity
  const [identity, setIdentity] = useState<IdentityData | null>(null)
  const [identityLoading, setIdentityLoading] = useState(false)

  // User profile + archetype insights (for Portrait page)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [insights, setInsights] = useState<import('@/app/api/user-profile/archetype-insights/route').ArchetypeInsights | null>(null)

  // UI
  const [activeTab, setActiveTab] = useState<Tab>('stream')
  const [activeDimFilter, setActiveDimFilter] = useState<Dimension | null>(null)
  const [loadingEntries, setLoadingEntries] = useState(true)
  const [loadingInsights, setLoadingInsights] = useState(true)
  const [loadingPortrait, setLoadingPortrait] = useState(false)
  const [showImport, setShowImport] = useState(false)

  // Init
  useEffect(() => {
    const id = getUserId()
    setUserId(id)
    // Load cached portrait
    try {
      const cached = localStorage.getItem(`protagonist-portrait-${id}`)
      if (cached) {
        const parsed = JSON.parse(cached) as Portrait
        const age = Date.now() - new Date(parsed.generatedAt ?? 0).getTime()
        // Only restore if fresh AND has real content (not the empty-state fallback)
        if (age < 24 * 60 * 60 * 1000 && parsed.essence) setPortrait(parsed)
        else if (!parsed.essence) localStorage.removeItem(`protagonist-portrait-${id}`)
      }
    } catch { /* ignore */ }
  }, [])

  // Load entries
  const loadEntries = useCallback((uid: string, dim: string) => {
    setLoadingEntries(true)
    fetch(`/api/journal/entries?userId=${uid}&limit=40${dim ? `&dimension=${dim}` : ''}`)
      .then(r => r.json())
      .then((d: { entries?: JournalEntry[]; achievements?: JournalEntry[] }) => {
        setEntries(d.entries ?? [])
        setAchievements(d.achievements ?? [])
      })
      .catch(() => {})
      .finally(() => setLoadingEntries(false))
  }, [])

  useEffect(() => {
    if (!userId) return
    loadEntries(userId, activeDimFilter ?? '')
  }, [userId, activeDimFilter, loadEntries])

  // Refresh stream when a check-in or Oracle note is saved
  useEffect(() => {
    const handler = () => {
      if (userId) loadEntries(userId, activeDimFilter ?? '')
    }
    window.addEventListener('protagonist:checkin-done', handler)
    window.addEventListener('protagonist:note-saved', handler)
    return () => {
      window.removeEventListener('protagonist:checkin-done', handler)
      window.removeEventListener('protagonist:note-saved', handler)
    }
  }, [userId, activeDimFilter, loadEntries])

  // Load pulse
  useEffect(() => {
    if (!userId) return
    fetch(`/api/journal/pulse?userId=${userId}&days=30`)
      .then(r => r.json())
      .then((d: { pulse?: PulseDay[] }) => setPulse(d.pulse ?? []))
      .catch(() => {})
  }, [userId])

  // Load insights
  useEffect(() => {
    if (!userId) return
    setLoadingInsights(true)
    fetch(`/api/journal/insights?userId=${userId}`)
      .then(r => r.json())
      .then((d: { patternCards?: PatternCard[]; unheardVoices?: UnheardVoice[]; growthMarkers?: GrowthMarker[]; stats?: typeof stats }) => {
        setPatternCards(d.patternCards ?? [])
        setUnheardVoices(d.unheardVoices ?? [])
        setGrowthMarkers(d.growthMarkers ?? [])
        if (d.stats) setStats(d.stats)
      })
      .catch(() => {})
      .finally(() => setLoadingInsights(false))
  }, [userId])

  // Load sidebar scores
  useEffect(() => {
    if (!userId) return
    Promise.all([
      fetch(`/api/quests/main?userId=${userId}`).then(r => r.json()).catch(() => ({})),
      fetch(`/api/dimension-score?userId=${userId}`).then(r => r.json()).catch(() => ({})),
    ]).then(([questData, scoreData]: [Record<string, unknown>, Record<string, unknown>]) => {
      const xpMap = (questData.dimXpMap ?? {}) as Record<string, number>
      const baselines = (scoreData.scores ?? {}) as Record<string, number>
      setDimXpMap(xpMap)
      setDimBaselineMap(baselines)
    })
  }, [userId])

  // Load identity synthesis
  const fetchIdentity = useCallback((uid: string, bust = false) => {
    if (!uid) return
    if (!bust) {
      try {
        const cached = localStorage.getItem(IDENTITY_CACHE_KEY_J(uid))
        if (cached) {
          const parsed = JSON.parse(cached) as IdentityData & { cachedAt?: number }
          if (Date.now() - (parsed.cachedAt ?? 0) < IDENTITY_CACHE_TTL_J && parsed.chapterTitle) {
            setIdentity(parsed)
            return
          }
          localStorage.removeItem(IDENTITY_CACHE_KEY_J(uid))
        }
      } catch { /* ignore */ }
    }
    setIdentityLoading(true)
    fetch(`/api/identity/synthesize?userId=${uid}`)
      .then(r => r.ok ? r.json() : null)
      .then((data: IdentityData | null) => {
        if (data?.chapterTitle) {
          const toCache = { ...data, cachedAt: Date.now() }
          try { localStorage.setItem(IDENTITY_CACHE_KEY_J(uid), JSON.stringify(toCache)) } catch { /* ignore */ }
          setIdentity(data)
        }
      })
      .catch(() => {/* silent */})
      .finally(() => setIdentityLoading(false))
  }, [])

  useEffect(() => {
    if (userId) fetchIdentity(userId)
  }, [userId, fetchIdentity])

  // Load user profile + archetype insights (cached 1h, same key as sidebar)
  useEffect(() => {
    if (!userId) return
    const CACHE_KEY = `protagonist-profile-${userId}`
    const CACHE_TTL = 60 * 60 * 1000
    try {
      const cached = localStorage.getItem(CACHE_KEY)
      if (cached) {
        const parsed = JSON.parse(cached) as UserProfile & { cachedAt?: number }
        if (Date.now() - (parsed.cachedAt ?? 0) < CACHE_TTL) {
          setProfile(parsed)
          if (parsed.archetypeInsights) setInsights(parsed.archetypeInsights)
          return
        }
      }
    } catch { /* ignore */ }
    fetch(`/api/user-profile?userId=${userId}`)
      .then(r => r.json())
      .then((d: { profile?: UserProfile }) => {
        if (d.profile) {
          setProfile(d.profile)
          if (d.profile.archetypeInsights) setInsights(d.profile.archetypeInsights)
          try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ...d.profile, cachedAt: Date.now() })) } catch { /* ignore */ }
        }
      })
      .catch(() => {})
  }, [userId])

  function xpScore(xp: number): number {
    const level = getLevel(xp)
    const progress = getLevelProgress(xp)
    return Math.min(10, Math.max(1, Math.round(level * 1.5 + progress)))
  }

  const sidebarScores = Object.fromEntries(
    ALL_DIMENSIONS.map(dim => {
      const xp = dimXpMap[dim] ?? 0
      const baseline = dimBaselineMap[dim]
      const score = baseline != null ? baseline : xpScore(xp)
      return [dim, score] as const
    })
  ) as Partial<Record<Dimension, number>>

  const generatePortrait = useCallback(async () => {
    if (!userId) return
    setLoadingPortrait(true)
    try {
      const r = await fetch('/api/journal/portrait', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      const d = await r.json() as { portrait?: Portrait }
      if (d.portrait) {
        setPortrait(d.portrait)
        try { localStorage.setItem(`protagonist-portrait-${userId}`, JSON.stringify(d.portrait)) } catch { /* ignore */ }
      }
    } catch { /* ignore */ }
    finally { setLoadingPortrait(false) }
  }, [userId])

  const allEntries = [...entries, ...achievements]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  const tabs: { id: Tab; icon: string; label: string }[] = [
    { id: 'stream', icon: 'stream', label: 'Stream' },
    { id: 'pulse', icon: 'pulse', label: 'Pulse' },
    { id: 'portrait', icon: 'portrait', label: "Arc's Portrait" },
    { id: 'growth', icon: 'growth', label: 'Growth Map' },
  ]

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      width: '100vw', height: '100vh', overflow: 'hidden',
      background: '#0D0820',
      fontFamily: "'Space Grotesk', system-ui, sans-serif",
    }}>
      <style>{PAGE_CSS}</style>

      {/* Shared top nav */}
      <DesktopTopNav activePage="journal" />

      {/* Oracle modal — required for the check-in button to work */}
      <DesktopOracleModal />

      {/* ChatGPT import modal */}
      {showImport && userId && (
        <ImportContextModal
          userId={userId}
          onClose={() => setShowImport(false)}
        />
      )}

      {/* Body */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {/* Left sidebar */}
        <DesktopLeftSidebar scores={sidebarScores} />

        {/* Main content */}
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          minWidth: 0, overflow: 'hidden', padding: '20px 16px 0',
        }}>
          {/* Header */}
          <div style={{ marginBottom: 16, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Icon name="journal" size={22} color="rgba(255,255,255,0.7)" />
            <div>
              <h1 style={{ ...font, fontWeight: 800, fontSize: 21, color: '#fff', lineHeight: 1.2 }}>Your Journal</h1>
              <p style={{ ...font, fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>
                Your thoughts, growth, and story — all in one place.
              </p>
            </div>
          </div>

          {/* Tab bar + dim filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginBottom: 14, flexShrink: 0, flexWrap: 'wrap' }}>
            {tabs.map(tab => (
              <button
                key={tab.id}
                className={`jrn-tab-btn${activeTab === tab.id ? ' active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon name={tab.icon} size={13} color={activeTab === tab.id ? '#fff' : 'rgba(255,255,255,0.4)'} />
                {tab.label}
              </button>
            ))}

            {activeTab === 'stream' && (
              <div style={{ display: 'flex', gap: 4, marginLeft: 8, flexWrap: 'wrap' }}>
                <button
                  className="jrn-dim-pill"
                  onClick={() => setActiveDimFilter(null)}
                  style={{
                    background: !activeDimFilter ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.03)',
                    color: !activeDimFilter ? '#fff' : 'rgba(255,255,255,0.35)',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}
                >All</button>
                {ALL_DIMS.map(dim => (
                  <button
                    key={dim}
                    className="jrn-dim-pill"
                    onClick={() => setActiveDimFilter(activeDimFilter === dim ? null : dim)}
                    style={{
                      background: activeDimFilter === dim ? `${DIM_COLORS[dim]}20` : 'rgba(255,255,255,0.02)',
                      color: activeDimFilter === dim ? DIM_COLORS[dim] : 'rgba(255,255,255,0.3)',
                      border: `1px solid ${activeDimFilter === dim ? DIM_COLORS[dim] + '35' : 'rgba(255,255,255,0.06)'}`,
                    }}
                  >{DIM_LABELS[dim]}</button>
                ))}
              </div>
            )}
          </div>

          {/* Content area (no right panel here — it lives as a sibling at body level) */}
          <div style={{ flex: 1, overflow: 'auto', minWidth: 0, paddingBottom: 20 }}>
              {activeTab === 'stream' && (
                loadingEntries ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {[1, 2, 3].map(i => (
                      <div key={i} style={{
                        height: 88, borderRadius: 14,
                        background: 'linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.03) 75%)',
                        backgroundSize: '200% 100%',
                        animation: `jrn-shimmer 1.6s infinite`,
                        animationDelay: `${i * 0.1}s`,
                      }} />
                    ))}
                  </div>
                ) : allEntries.length === 0 ? (
                  <div style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    justifyContent: 'center', minHeight: 260, gap: 14,
                  }}>
                    <Icon name="waves" size={52} color="rgba(255,255,255,0.1)" />
                    <h3 style={{ ...font, color: '#fff', fontSize: 17, fontWeight: 700 }}>Your story begins here</h3>
                    <p style={{ ...font, color: 'rgba(255,255,255,0.35)', fontSize: 13, textAlign: 'center', maxWidth: 310, lineHeight: 1.7 }}>
                      {activeDimFilter
                        ? `No entries for ${DIM_LABELS[activeDimFilter]} yet.`
                        : 'Start journaling with Oracle — speak your thoughts, share your wins, or check in each morning.'
                      }
                    </p>
                    <button
                      onClick={() => openOracle('', 'morning_checkin')}
                      style={{
                        ...font, cursor: 'pointer', fontWeight: 700, fontSize: 13,
                        background: '#FF7A65', color: '#fff',
                        border: 'none', borderRadius: 10, padding: '10px 22px',
                      }}
                    >Morning Check-In</button>
                  </div>
                ) : (
                  allEntries.map(entry => <EntryCard key={entry.id} entry={entry} />)
                )
              )}

              {activeTab === 'pulse' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{
                    background: 'rgba(255,255,255,0.03)', borderRadius: 16, padding: 20,
                    border: '1px solid rgba(255,255,255,0.06)',
                  }}>
                    <h3 style={{ ...font, fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 3 }}>30-Day Emotional Pulse</h3>
                    <p style={{ ...font, fontSize: 12, color: 'rgba(255,255,255,0.35)', marginBottom: 18 }}>Your mood energy across the last month.</p>
                    <PulseChart pulse={pulse} />
                  </div>

                  {pulse.some(p => p.hasEntry) && (
                    <div style={{
                      background: 'rgba(255,255,255,0.03)', borderRadius: 16, padding: 20,
                      border: '1px solid rgba(255,255,255,0.06)',
                    }}>
                      <h3 style={{ ...font, fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 14 }}>Mood Distribution</h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                        {[
                          { label: 'Great (4–5)', min: 3.5, color: '#6EE7A4' },
                          { label: 'Good (3–4)', min: 2.5, max: 3.5, color: '#FFD47A' },
                          { label: 'Low (2–3)', min: 1.5, max: 2.5, color: '#FF9A5C' },
                          { label: 'Rough (1–2)', max: 1.5, color: '#FF6B9D' },
                        ].map(({ label, min, max: maxV, color }) => {
                          const count = pulse.filter(p => {
                            if (!p.score) return false
                            if (min !== undefined && p.score < min) return false
                            if (maxV !== undefined && p.score >= maxV) return false
                            return true
                          }).length
                          const total = pulse.filter(p => p.hasEntry).length
                          const pct = total > 0 ? (count / total) * 100 : 0
                          return (
                            <div key={label}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                <span style={{ ...font, fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>{label}</span>
                                <span style={{ ...font, fontSize: 12, color, fontWeight: 700 }}>{count} days</span>
                              </div>
                              <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3 }}>
                                <div style={{ height: '100%', borderRadius: 3, width: `${pct}%`, background: color, opacity: 0.75, transition: 'width 0.8s ease' }} />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'portrait' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {/* Import banner — shown when no portrait yet or always accessible */}
                  <div style={{
                    background: 'linear-gradient(135deg, rgba(123,63,228,0.12), rgba(196,168,255,0.06))',
                    borderRadius: 14, padding: '14px 18px',
                    border: '1px solid rgba(196,168,255,0.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
                  }}>
                    <div>
                      <p style={{ ...font, fontSize: 13, fontWeight: 700, color: '#C4A8FF', marginBottom: 2 }}>
                        Coming from ChatGPT?
                      </p>
                      <p style={{ ...font, fontSize: 12, color: 'rgba(255,255,255,0.4)', lineHeight: 1.5 }}>
                        Import your conversation history so Arc already knows you from day one.
                      </p>
                    </div>
                    <button
                      onClick={() => setShowImport(true)}
                      style={{
                        ...font, cursor: 'pointer', fontWeight: 700, fontSize: 12,
                        background: 'rgba(196,168,255,0.15)', color: '#C4A8FF',
                        border: '1px solid rgba(196,168,255,0.25)', borderRadius: 9,
                        padding: '8px 16px', whiteSpace: 'nowrap', flexShrink: 0,
                      }}
                    >
                      Import context →
                    </button>
                  </div>
                  <PortraitView
                    portrait={portrait}
                    identity={identity}
                    identityLoading={identityLoading}
                    loading={loadingPortrait}
                    profile={profile}
                    insights={insights}
                    onGenerate={() => void generatePortrait()}
                    onRefreshIdentity={() => fetchIdentity(userId, true)}
                  />
                </div>
              )}

              {activeTab === 'growth' && (
                <GrowthMapView growthMarkers={growthMarkers} achievements={achievements} />
              )}
          </div>
        </div>

        {/* Right sidebar — true sibling of left sidebar and main content */}
        <div style={{
          width: 240, flexShrink: 0,
          borderLeft: '1px solid rgba(255,255,255,0.06)',
          overflowY: 'auto', overflowX: 'hidden',
          padding: '20px 14px',
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(123,63,228,0.25) transparent',
        }}>
          {!loadingInsights && (
            <RightPanel
              patternCards={patternCards}
              unheardVoices={unheardVoices}
              growthMarkers={growthMarkers}
              stats={stats}
              pulse={pulse}
            />
          )}
        </div>
      </div>
    </div>
  )
}
