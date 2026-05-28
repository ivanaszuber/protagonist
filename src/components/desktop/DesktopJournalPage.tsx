'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { CSSProperties } from 'react'
import { type Dimension } from '@/lib/character'
import { getUserId } from '@/lib/user'
import { openOracle } from '@/lib/oracle-events'
import { DesktopLeftSidebar, DIM_COLORS } from './DesktopLeftSidebar'
import { isCheckinDoneToday } from './DesktopOracleModal'

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
  * { box-sizing: border-box; margin: 0; padding: 0; }
  ::-webkit-scrollbar { display: none; }

  @keyframes jrn-pulse-btn { 0%,100%{box-shadow:0 0 0 0 rgba(255,122,101,0.4)} 50%{box-shadow:0 0 0 8px rgba(255,122,101,0)} }
  @keyframes jrn-fade-in   { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
  @keyframes jrn-shimmer   { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
  @keyframes jrn-pulse-orb { 0%,100%{transform:scale(1);opacity:0.6} 50%{transform:scale(1.05);opacity:0.9} }
  @keyframes jrn-twinkle   { 0%,100%{opacity:0.08} 50%{opacity:0.5} }
  @keyframes jrn-bar-grow  { from{transform:scaleY(0)} to{transform:scaleY(1)} }

  .jrn-entry { animation: jrn-fade-in 0.35s ease both; }
  .jrn-tab-btn {
    background: none; border: none; cursor: pointer;
    padding: 8px 16px; border-radius: 8px;
    font-family: 'Space Grotesk', sans-serif;
    font-size: 13px; font-weight: 600;
    transition: all 0.2s;
    color: rgba(255,255,255,0.45);
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

function getMoodEmoji(signal: string | null): string {
  if (!signal) return '💭'
  const s = signal.toLowerCase()
  if (['excited', 'very_positive', 'great'].some(k => s.includes(k))) return '🔥'
  if (['positive', 'happy', 'good', 'proud', 'energized', 'motivated', 'grateful'].some(k => s.includes(k))) return '✨'
  if (['neutral', 'calm', 'content', 'okay', 'fine'].some(k => s.includes(k))) return '🌊'
  if (['anxious', 'stressed', 'worried'].some(k => s.includes(k))) return '⚡'
  if (['tired', 'low', 'sad', 'negative', 'frustrated', 'overwhelmed'].some(k => s.includes(k))) return '🌧️'
  return '💭'
}

function getScoreColor(score: number): string {
  if (score >= 4) return '#6EE7A4'
  if (score >= 3) return '#FFD47A'
  if (score >= 2) return '#FF9A5C'
  return '#FF6B9D'
}

function SettingsIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

// ── Stream Entry Card ─────────────────────────────────────────────────────────

function EntryCard({ entry }: { entry: JournalEntry }) {
  const [expanded, setExpanded] = useState(false)

  const typeConfig = {
    'morning-checkin': { label: 'Morning Check-In', color: '#FFD47A', bg: 'rgba(255,212,122,0.12)', icon: '☀️' },
    'voice-reflection': { label: 'Reflection', color: '#C4A8FF', bg: 'rgba(196,168,255,0.12)', icon: '💭' },
    'achievement': { label: 'Achievement', color: '#6EE7A4', bg: 'rgba(110,231,164,0.12)', icon: '⚔️' },
  }[entry.type]

  const primaryDim = entry.dimensions[0] as Dimension | undefined
  const dimColor = primaryDim ? DIM_COLORS[primaryDim] : '#C4A8FF'

  const previewText = entry.type === 'achievement'
    ? entry.content
    : entry.brief ?? (entry.content.length > 120 ? entry.content.slice(0, 120) + '…' : entry.content)

  return (
    <div
      className="jrn-entry jrn-entry-card"
      style={{ background: 'rgba(255,255,255,0.025)', marginBottom: 10, cursor: 'pointer' }}
      onClick={() => setExpanded(e => !e)}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        {/* Type badge */}
        <span style={{
          ...font, fontSize: 11, fontWeight: 700,
          background: typeConfig.bg, color: typeConfig.color,
          padding: '3px 9px', borderRadius: 20,
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          {typeConfig.icon} {typeConfig.label}
        </span>

        {/* Dimension tags */}
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

        <span style={{ ...font, fontSize: 11, color: 'rgba(255,255,255,0.3)', marginLeft: 'auto' }}>
          {getMoodEmoji(entry.moodSignal)} {formatRelTime(entry.createdAt)}
        </span>
      </div>

      {/* Content */}
      {entry.type === 'achievement' ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>⚔️</span>
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
            lineHeight: 1.65, marginBottom: entry.oracleReply && expanded ? 10 : 0,
          }}>
            {expanded && !entry.brief ? entry.content : previewText}
          </p>

          {/* Oracle reply */}
          {expanded && entry.oracleReply && (
            <div style={{
              marginTop: 10,
              borderLeft: `2px solid ${dimColor}`,
              paddingLeft: 12,
            }}>
              <p style={{ ...font, fontSize: 11, color: dimColor, fontWeight: 700, marginBottom: 4 }}>
                ARC'S INSIGHT
              </p>
              <p style={{ ...font, fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 1.6 }}>
                {entry.oracleReply}
              </p>
            </div>
          )}

          {!expanded && entry.oracleReply && (
            <p style={{ ...font, fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 6 }}>
              tap to see Arc's insight →
            </p>
          )}
        </>
      )}
    </div>
  )
}

// ── Pulse Chart ───────────────────────────────────────────────────────────────

function PulseChart({ pulse }: { pulse: PulseDay[] }) {
  const maxScore = 5
  const last30 = pulse.slice(-30)
  const hasData = last30.some(d => d.hasEntry)

  if (!hasData) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        minHeight: 200, gap: 12,
      }}>
        <span style={{ fontSize: 40 }}>🌊</span>
        <p style={{ ...font, color: 'rgba(255,255,255,0.4)', fontSize: 14, textAlign: 'center' }}>
          Your emotional pulse will appear here as you journal with Oracle.
          <br />Start by sharing how you're feeling today.
        </p>
      </div>
    )
  }

  return (
    <div>
      {/* Score labels */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        {['1', '2', '3', '4', '5'].reverse().map(s => (
          <span key={s} style={{ ...font, fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>{s}</span>
        ))}
      </div>

      {/* Bar chart */}
      <div style={{
        display: 'flex', alignItems: 'flex-end', gap: 3,
        height: 120, padding: '0 4px',
      }}>
        {last30.map((day, i) => {
          const height = day.score ? (day.score / maxScore) * 100 : 0
          const color = day.score ? getScoreColor(day.score) : 'rgba(255,255,255,0.06)'
          const isWeekend = [0, 6].includes(new Date(day.date).getDay())

          return (
            <div
              key={day.date}
              title={day.score ? `${day.date}: ${day.score}/5${day.label ? ` (${day.label})` : ''}` : day.date}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'flex-end', height: '100%',
              }}
            >
              <div style={{
                width: '100%', maxWidth: 18,
                height: day.hasEntry ? `${Math.max(height, 8)}%` : '4%',
                background: color,
                borderRadius: '3px 3px 2px 2px',
                opacity: isWeekend ? 0.7 : 1,
                transition: 'height 0.4s ease',
                transformOrigin: 'bottom',
                animation: day.hasEntry ? 'jrn-bar-grow 0.5s ease both' : 'none',
                animationDelay: `${i * 0.02}s`,
              }} />
            </div>
          )
        })}
      </div>

      {/* X-axis labels */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, padding: '0 4px' }}>
        {[0, 6, 13, 20, 27, 29].map(i => (
          last30[i] ? (
            <span key={i} style={{ ...font, fontSize: 9, color: 'rgba(255,255,255,0.25)' }}>
              {new Date(last30[i].date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
            </span>
          ) : null
        ))}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 12, marginTop: 16, flexWrap: 'wrap' }}>
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

// ── Arc Portrait Tab ──────────────────────────────────────────────────────────

function PortraitView({
  portrait, loading, onGenerate,
}: {
  portrait: Portrait | null
  loading: boolean
  onGenerate: () => void
}) {
  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 300, gap: 20 }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%',
          background: 'linear-gradient(135deg, #7B3FE4, #C4A8FF)',
          animation: 'jrn-pulse-orb 2s ease-in-out infinite',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 28,
        }}>
          🌀
        </div>
        <p style={{ ...font, color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>
          Arc is reading your soul…
        </p>
      </div>
    )
  }

  if (!portrait) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 300, gap: 16 }}>
        <div style={{ fontSize: 56 }}>🪩</div>
        <h3 style={{ ...font, color: '#fff', fontSize: 18, fontWeight: 700 }}>
          Arc's Portrait awaits
        </h3>
        <p style={{ ...font, color: 'rgba(255,255,255,0.45)', fontSize: 14, textAlign: 'center', maxWidth: 340, lineHeight: 1.65 }}>
          Arc synthesizes your memories, reflections, and growth into a living psychological portrait — a mirror of who you're becoming.
        </p>
        <button
          onClick={onGenerate}
          style={{
            ...font, cursor: 'pointer', fontWeight: 700, fontSize: 13,
            background: 'linear-gradient(135deg, #7B3FE4, #C4A8FF)',
            color: '#fff', border: 'none', borderRadius: 12,
            padding: '12px 28px', marginTop: 8,
          }}
        >
          ✨ Generate My Portrait
        </button>
      </div>
    )
  }

  // portrait.summary = simple fallback
  if (portrait.summary && !portrait.essence) {
    return (
      <div className="jrn-portrait-section" style={{
        background: 'rgba(123,63,228,0.08)', borderRadius: 16, padding: 24,
        border: '1px solid rgba(196,168,255,0.15)',
      }}>
        <p style={{ ...font, fontSize: 15, color: 'rgba(255,255,255,0.8)', lineHeight: 1.75 }}>
          {portrait.summary}
        </p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Essence */}
      {portrait.essence && (
        <div className="jrn-portrait-section" style={{
          background: 'linear-gradient(135deg, rgba(123,63,228,0.15), rgba(196,168,255,0.08))',
          borderRadius: 16, padding: 22,
          border: '1px solid rgba(196,168,255,0.2)',
        }}>
          <p style={{ ...font, fontSize: 11, fontWeight: 700, color: '#C4A8FF', letterSpacing: '1.4px', marginBottom: 10 }}>
            YOUR ESSENCE
          </p>
          <p style={{ ...font, fontSize: 16, color: '#fff', lineHeight: 1.75, fontWeight: 500 }}>
            "{portrait.essence}"
          </p>
        </div>
      )}

      {/* Growth */}
      {portrait.growth && (
        <div className="jrn-portrait-section" style={{
          background: 'rgba(110,231,164,0.06)', borderRadius: 14, padding: 18,
          border: '1px solid rgba(110,231,164,0.12)',
        }}>
          <p style={{ ...font, fontSize: 11, fontWeight: 700, color: '#6EE7A4', letterSpacing: '1.4px', marginBottom: 8 }}>
            YOUR GROWTH
          </p>
          <p style={{ ...font, fontSize: 14, color: 'rgba(255,255,255,0.8)', lineHeight: 1.7 }}>
            {portrait.growth}
          </p>
        </div>
      )}

      {/* Strengths */}
      {portrait.strengths && portrait.strengths.length > 0 && (
        <div className="jrn-portrait-section">
          <p style={{ ...font, fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', letterSpacing: '1.4px', marginBottom: 10 }}>
            WHAT MAKES YOU POWERFUL
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {portrait.strengths.map((s, i) => (
              <div key={i} style={{
                background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: '12px 16px',
                border: '1px solid rgba(255,255,255,0.07)',
                display: 'flex', gap: 12, alignItems: 'flex-start',
              }}>
                <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>⚡</span>
                <p style={{ ...font, fontSize: 13.5, color: 'rgba(255,255,255,0.75)', lineHeight: 1.6 }}>{s}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Patterns */}
      {portrait.patterns && portrait.patterns.length > 0 && (
        <div className="jrn-portrait-section">
          <p style={{ ...font, fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', letterSpacing: '1.4px', marginBottom: 10 }}>
            YOUR RECURRING PATTERNS
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {portrait.patterns.map((p, i) => (
              <div key={i} style={{
                background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: '12px 16px',
                borderLeft: '3px solid rgba(255,212,122,0.4)',
              }}>
                <p style={{ ...font, fontSize: 13.5, color: 'rgba(255,255,255,0.7)', lineHeight: 1.6 }}>{p}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Calling */}
      {portrait.calling && (
        <div className="jrn-portrait-section" style={{
          background: 'linear-gradient(135deg, rgba(255,107,157,0.1), rgba(255,154,92,0.08))',
          borderRadius: 14, padding: 18,
          border: '1px solid rgba(255,107,157,0.15)',
        }}>
          <p style={{ ...font, fontSize: 11, fontWeight: 700, color: '#FF6B9D', letterSpacing: '1.4px', marginBottom: 8 }}>
            WHAT'S CALLING YOU
          </p>
          <p style={{ ...font, fontSize: 14, color: 'rgba(255,255,255,0.8)', lineHeight: 1.7, fontStyle: 'italic' }}>
            {portrait.calling}
          </p>
        </div>
      )}

      {/* Dimension insights */}
      {portrait.dimensionInsights && Object.keys(portrait.dimensionInsights).length > 0 && (
        <div className="jrn-portrait-section">
          <p style={{ ...font, fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', letterSpacing: '1.4px', marginBottom: 10 }}>
            ACROSS YOUR LIFE AREAS
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {ALL_DIMS.filter(d => portrait.dimensionInsights?.[d]).map(dim => (
              <div key={dim} style={{
                background: 'rgba(255,255,255,0.025)', borderRadius: 12, padding: '11px 14px',
                display: 'flex', gap: 10, alignItems: 'flex-start',
                border: `1px solid ${DIM_COLORS[dim]}20`,
              }}>
                <div style={{
                  width: 3, borderRadius: 4, flexShrink: 0,
                  background: DIM_COLORS[dim], alignSelf: 'stretch',
                }} />
                <div>
                  <p style={{ ...font, fontSize: 10, fontWeight: 700, color: DIM_COLORS[dim], marginBottom: 4, letterSpacing: '1px' }}>
                    {DIM_LABELS[dim].toUpperCase()}
                  </p>
                  <p style={{ ...font, fontSize: 13, color: 'rgba(255,255,255,0.7)', lineHeight: 1.6 }}>
                    {portrait.dimensionInsights?.[dim]}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8 }}>
        <p style={{ ...font, fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>
          {portrait.memoryCount ? `Synthesized from ${portrait.memoryCount} memories` : ''}
          {portrait.generatedAt ? ` · ${formatRelTime(portrait.generatedAt)}` : ''}
        </p>
        <button
          onClick={onGenerate}
          style={{
            ...font, cursor: 'pointer', fontSize: 11, fontWeight: 600,
            background: 'rgba(123,63,228,0.15)', color: '#C4A8FF',
            border: '1px solid rgba(196,168,255,0.2)', borderRadius: 8,
            padding: '6px 14px',
          }}
        >
          ↻ Refresh
        </button>
      </div>
    </div>
  )
}

// ── Growth Map Tab ────────────────────────────────────────────────────────────

function GrowthMapView({
  growthMarkers, achievements,
}: {
  growthMarkers: GrowthMarker[]
  achievements: JournalEntry[]
}) {
  const maxTasks = Math.max(...growthMarkers.map(g => g.completedTasks), 1)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Dimension progress bars */}
      <div>
        <p style={{ ...font, fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', letterSpacing: '1.4px', marginBottom: 14 }}>
          TASKS COMPLETED (LAST 30 DAYS)
        </p>
        {growthMarkers.length === 0 ? (
          <p style={{ ...font, fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>
            Complete tasks with Oracle to see your growth here.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {ALL_DIMS.map(dim => {
              const marker = growthMarkers.find(g => g.dimension === dim)
              const count = marker?.completedTasks ?? 0
              const xp = marker?.xpEarned ?? 0
              const pct = (count / maxTasks) * 100

              return (
                <div key={dim}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ ...font, fontSize: 12, color: DIM_COLORS[dim], fontWeight: 600 }}>
                      {DIM_CHAR_NAMES[dim]} · {DIM_LABELS[dim]}
                    </span>
                    <span style={{ ...font, fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                      {count} tasks · {xp} XP
                    </span>
                  </div>
                  <div style={{ height: 7, background: 'rgba(255,255,255,0.06)', borderRadius: 4 }}>
                    <div style={{
                      height: '100%', borderRadius: 4,
                      width: count > 0 ? `${pct}%` : '0%',
                      background: `linear-gradient(90deg, ${DIM_COLORS[dim]}88, ${DIM_COLORS[dim]})`,
                      transition: 'width 0.8s ease',
                    }} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Recent achievements */}
      <div>
        <p style={{ ...font, fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', letterSpacing: '1.4px', marginBottom: 12 }}>
          RECENT WINS
        </p>
        {achievements.length === 0 ? (
          <p style={{ ...font, fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>
            Your completed tasks will appear here as trophies. Time to start!
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {achievements.slice(0, 15).map((a) => {
              const dim = a.dimensions[0] as Dimension | undefined
              const color = dim ? DIM_COLORS[dim] : '#C4A8FF'
              return (
                <div key={a.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  background: 'rgba(255,255,255,0.025)', borderRadius: 10,
                  padding: '10px 14px',
                }}>
                  <span style={{ fontSize: 14 }}>⚔️</span>
                  <p style={{ ...font, fontSize: 13, color: 'rgba(255,255,255,0.75)', flex: 1 }}>
                    {a.content}
                  </p>
                  {a.xpReward && (
                    <span style={{ ...font, fontSize: 11, color, fontWeight: 700, flexShrink: 0 }}>
                      +{a.xpReward} XP
                    </span>
                  )}
                  <span style={{ ...font, fontSize: 11, color: 'rgba(255,255,255,0.25)', flexShrink: 0 }}>
                    {formatRelTime(a.createdAt)}
                  </span>
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

function RightPanel({
  patternCards, unheardVoices, growthMarkers, stats, pulse,
}: {
  patternCards: PatternCard[]
  unheardVoices: UnheardVoice[]
  growthMarkers: GrowthMarker[]
  stats: { totalEntries: number; totalCompleted: number; activeStreak: number; mostActiveDay: string }
  pulse: PulseDay[]
}) {
  // Mini pulse — last 14 days
  const last14 = pulse.slice(-14)
  const maxScore = 5

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Stats strip */}
      <div style={{
        background: 'rgba(255,255,255,0.03)', borderRadius: 14, padding: '14px 16px',
        border: '1px solid rgba(255,255,255,0.07)',
      }}>
        <p style={{ ...font, fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.35)', letterSpacing: '1.3px', marginBottom: 12 }}>
          YOUR STATS
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[
            { label: 'Entries', value: stats?.totalEntries ?? 0, icon: '📓' },
            { label: 'Streak', value: `${stats?.activeStreak ?? 0}d`, icon: '🔥' },
            { label: 'Completed', value: stats?.totalCompleted ?? 0, icon: '⚔️' },
            { label: 'Peak Day', value: stats?.mostActiveDay ?? '—', icon: '📅' },
          ].map(({ label, value, icon }) => (
            <div key={label} style={{ textAlign: 'center' }}>
              <p style={{ ...font, fontSize: 18, marginBottom: 2 }}>{icon}</p>
              <p style={{ ...font, fontSize: 15, fontWeight: 700, color: '#fff' }}>{value}</p>
              <p style={{ ...font, fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Mini pulse */}
      {last14.some(d => d.hasEntry) && (
        <div style={{
          background: 'rgba(255,255,255,0.03)', borderRadius: 14, padding: '14px 16px',
          border: '1px solid rgba(255,255,255,0.07)',
        }}>
          <p style={{ ...font, fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.35)', letterSpacing: '1.3px', marginBottom: 10 }}>
            14-DAY PULSE
          </p>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 44 }}>
            {last14.map((day, i) => {
              const h = day.score ? (day.score / maxScore) * 100 : 0
              const color = day.score ? getScoreColor(day.score) : 'rgba(255,255,255,0.05)'
              return (
                <div
                  key={day.date}
                  title={day.score ? `${day.date}: ${day.score}/5` : day.date}
                  style={{
                    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                    justifyContent: 'flex-end', height: '100%',
                  }}
                >
                  <div style={{
                    width: '100%', height: day.hasEntry ? `${Math.max(h, 12)}%` : '6%',
                    background: color, borderRadius: '3px 3px 2px 2px',
                    transition: 'height 0.4s ease',
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
          border: '1px solid rgba(255,255,255,0.07)',
        }}>
          <p style={{ ...font, fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.35)', letterSpacing: '1.3px', marginBottom: 10 }}>
            YOUR FOCUS PATTERNS
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {patternCards.map(pc => {
              const color = DIM_COLORS[pc.dimension as Dimension] ?? '#C4A8FF'
              return (
                <div key={pc.dimension} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0,
                    boxShadow: `0 0 6px ${color}88`,
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                      <span style={{ ...font, fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>
                        {DIM_LABELS[pc.dimension as Dimension] ?? pc.dimension}
                      </span>
                      <span style={{ ...font, fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>
                        {pc.mentionCount}×
                      </span>
                    </div>
                    <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
                      <div style={{
                        height: '100%', borderRadius: 2,
                        width: `${pc.energyPercent}%`,
                        background: color,
                        opacity: 0.7,
                      }} />
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
          background: 'rgba(255,107,157,0.05)', borderRadius: 14, padding: '14px 16px',
          border: '1px solid rgba(255,107,157,0.1)',
        }}>
          <p style={{ ...font, fontSize: 10, fontWeight: 700, color: '#FF6B9D', letterSpacing: '1.3px', marginBottom: 10 }}>
            UNHEARD VOICES
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {unheardVoices.slice(0, 3).map(uv => {
              const color = DIM_COLORS[uv.dimension as Dimension] ?? '#C4A8FF'
              return (
                <div key={uv.dimension} style={{
                  borderLeft: `2px solid ${color}50`,
                  paddingLeft: 10,
                }}>
                  <p style={{ ...font, fontSize: 11, color, fontWeight: 600, marginBottom: 3 }}>
                    {DIM_LABELS[uv.dimension as Dimension] ?? uv.dimension}
                  </p>
                  <p style={{ ...font, fontSize: 11, color: 'rgba(255,255,255,0.4)', lineHeight: 1.5 }}>
                    {uv.message}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Growth markers summary */}
      {growthMarkers.length > 0 && (
        <div style={{
          background: 'rgba(110,231,164,0.04)', borderRadius: 14, padding: '14px 16px',
          border: '1px solid rgba(110,231,164,0.08)',
        }}>
          <p style={{ ...font, fontSize: 10, fontWeight: 700, color: '#6EE7A4', letterSpacing: '1.3px', marginBottom: 10 }}>
            GROWTH THIS MONTH
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {growthMarkers.slice(0, 4).map(gm => {
              const color = DIM_COLORS[gm.dimension as Dimension] ?? '#C4A8FF'
              return (
                <div key={gm.dimension} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ ...font, fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>
                    {DIM_LABELS[gm.dimension as Dimension] ?? gm.dimension}
                  </span>
                  <span style={{ ...font, fontSize: 12, color, fontWeight: 700 }}>
                    +{gm.xpEarned} XP
                  </span>
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
  const router = useRouter()
  const [userId, setUserId] = useState<string>('')
  const [checkinDone, setCheckinDone] = useState(false)

  // Data
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [achievements, setAchievements] = useState<JournalEntry[]>([])
  const [pulse, setPulse] = useState<PulseDay[]>([])
  const [portrait, setPortrait] = useState<Portrait | null>(null)
  const [patternCards, setPatternCards] = useState<PatternCard[]>([])
  const [unheardVoices, setUnheardVoices] = useState<UnheardVoice[]>([])
  const [growthMarkers, setGrowthMarkers] = useState<GrowthMarker[]>([])
  const [stats, setStats] = useState({ totalEntries: 0, totalCompleted: 0, activeStreak: 0, mostActiveDay: '—' })

  // UI state
  const [activeTab, setActiveTab] = useState<Tab>('stream')
  const [activeDimFilter, setActiveDimFilter] = useState<Dimension | null>(null)
  const [loadingEntries, setLoadingEntries] = useState(true)
  const [loadingInsights, setLoadingInsights] = useState(true)
  const [loadingPortrait, setLoadingPortrait] = useState(false)
  const portraitCacheKey = useRef('')

  // Init
  useEffect(() => {
    const id = getUserId()
    setUserId(id)
    setCheckinDone(isCheckinDoneToday())
    portraitCacheKey.current = `protagonist-portrait-${id}`
  }, [])

  // Checkin done listener
  useEffect(() => {
    const handler = () => setCheckinDone(true)
    window.addEventListener('protagonist:checkin-done', handler)
    return () => window.removeEventListener('protagonist:checkin-done', handler)
  }, [])

  // Load entries
  useEffect(() => {
    if (!userId) return
    setLoadingEntries(true)
    const dim = activeDimFilter ?? ''
    fetch(`/api/journal/entries?userId=${userId}&limit=40${dim ? `&dimension=${dim}` : ''}`)
      .then(r => r.json())
      .then(d => {
        setEntries(d.entries ?? [])
        setAchievements(d.achievements ?? [])
      })
      .catch(() => {})
      .finally(() => setLoadingEntries(false))
  }, [userId, activeDimFilter])

  // Load pulse
  useEffect(() => {
    if (!userId) return
    fetch(`/api/journal/pulse?userId=${userId}&days=30`)
      .then(r => r.json())
      .then(d => setPulse(d.pulse ?? []))
      .catch(() => {})
  }, [userId])

  // Load insights
  useEffect(() => {
    if (!userId) return
    setLoadingInsights(true)
    fetch(`/api/journal/insights?userId=${userId}`)
      .then(r => r.json())
      .then(d => {
        setPatternCards(d.patternCards ?? [])
        setUnheardVoices(d.unheardVoices ?? [])
        setGrowthMarkers(d.growthMarkers ?? [])
        setStats(d.stats ?? { totalEntries: 0, totalCompleted: 0, activeStreak: 0, mostActiveDay: '—' })
      })
      .catch(() => {})
      .finally(() => setLoadingInsights(false))
  }, [userId])

  // Load cached portrait
  useEffect(() => {
    if (!userId) return
    const key = `protagonist-portrait-${userId}`
    try {
      const cached = localStorage.getItem(key)
      if (cached) {
        const parsed = JSON.parse(cached) as Portrait
        // Only use cache if less than 24h old
        const age = Date.now() - new Date(parsed.generatedAt ?? 0).getTime()
        if (age < 24 * 60 * 60 * 1000) {
          setPortrait(parsed)
          return
        }
      }
    } catch {}
  }, [userId])

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
        try { localStorage.setItem(`protagonist-portrait-${userId}`, JSON.stringify(d.portrait)) } catch {}
      }
    } catch {}
    finally { setLoadingPortrait(false) }
  }, [userId])

  const allEntries = [...entries, ...achievements]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      width: '100vw', height: '100vh', overflow: 'hidden',
      background: '#0D0820',
      fontFamily: "'Space Grotesk', system-ui, sans-serif",
    }}>
      <style>{PAGE_CSS}</style>

      {/* ── Top Nav ── */}
      <nav style={{
        display: 'flex', alignItems: 'center', height: 56, flexShrink: 0,
        background: 'rgba(19,14,42,0.95)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        padding: '0 20px', gap: 6, zIndex: 50,
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 20 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8,
            background: 'linear-gradient(135deg, #7B3FE4 0%, #C4A8FF 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, flexShrink: 0,
          }}>⚡</div>
          <span style={{ ...font, fontWeight: 800, fontSize: 16, color: '#fff', letterSpacing: '-0.3px' }}>
            Protagonist
          </span>
        </div>

        {/* Nav links */}
        {[
          { label: 'Dashboard', href: '/dashboard', active: false },
          { label: 'Life Areas', href: '/character', active: false },
          { label: 'Journal', href: '/journal', active: true },
        ].map(({ label, href, active }) => (
          <button
            key={label}
            onClick={() => router.push(href)}
            style={{
              ...font, cursor: 'pointer', fontWeight: 600, fontSize: 13,
              background: active ? 'rgba(255,255,255,0.1)' : 'none',
              color: active ? '#fff' : 'rgba(255,255,255,0.45)',
              border: 'none', borderRadius: 8, padding: '6px 13px',
              transition: 'all 0.2s',
            }}
          >
            {label}
          </button>
        ))}

        <div style={{ flex: 1 }} />

        {/* Check-in button */}
        <button
          onClick={() => openOracle('', checkinDone ? 'checkin-summary' : 'morning_checkin')}
          style={{
            ...font, cursor: 'pointer', fontWeight: 700, fontSize: 12,
            background: checkinDone ? 'rgba(110,231,164,0.12)' : '#FF7A65',
            color: checkinDone ? '#6EE7A4' : 'white',
            border: checkinDone ? '1px solid rgba(110,231,164,0.35)' : 'none',
            borderRadius: 10, padding: '7px 14px',
            animation: checkinDone ? 'none' : 'jrn-pulse-btn 3s ease-in-out infinite',
          }}
        >
          {checkinDone ? '✓ Daily Brief' : 'Morning Check-In'}
        </button>

        {/* Settings */}
        <button
          onClick={() => router.push('/settings')}
          style={{
            ...font, cursor: 'pointer', background: 'none',
            color: 'rgba(255,255,255,0.4)', border: 'none',
            width: 36, height: 36, borderRadius: 8, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <SettingsIcon />
        </button>

        {/* Avatar */}
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          background: 'linear-gradient(135deg, #7B3FE4, #C4A8FF)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          ...font, fontWeight: 800, fontSize: 13, color: '#fff', cursor: 'pointer',
        }}>I</div>
      </nav>

      {/* ── Body ── */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {/* Left sidebar */}
        <DesktopLeftSidebar scores={{}} />

        {/* ── Main content ── */}
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          minWidth: 0, overflow: 'hidden', padding: '20px 16px 0',
        }}>
          {/* Header */}
          <div style={{ marginBottom: 16, flexShrink: 0 }}>
            <h1 style={{ ...font, fontWeight: 800, fontSize: 22, color: '#fff', marginBottom: 4 }}>
              📓 Your Journal
            </h1>
            <p style={{ ...font, fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
              Your thoughts, growth, and story — all in one place.
            </p>
          </div>

          {/* Tab bar + dim filter */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 4,
            marginBottom: 14, flexShrink: 0, flexWrap: 'wrap',
          }}>
            {(['stream', 'pulse', 'portrait', 'growth'] as Tab[]).map(tab => (
              <button
                key={tab}
                className={`jrn-tab-btn${activeTab === tab ? ' active' : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab === 'stream' && '🌊 Stream'}
                {tab === 'pulse' && '💓 Pulse'}
                {tab === 'portrait' && '🪩 Arc\'s Portrait'}
                {tab === 'growth' && '📈 Growth Map'}
              </button>
            ))}

            {/* Dim filter pills (stream tab only) */}
            {activeTab === 'stream' && (
              <div style={{ display: 'flex', gap: 5, marginLeft: 8, flexWrap: 'wrap' }}>
                <button
                  className="jrn-dim-pill"
                  onClick={() => setActiveDimFilter(null)}
                  style={{
                    background: !activeDimFilter ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)',
                    color: !activeDimFilter ? '#fff' : 'rgba(255,255,255,0.4)',
                    border: '1px solid rgba(255,255,255,0.1)',
                  }}
                >
                  All
                </button>
                {ALL_DIMS.map(dim => (
                  <button
                    key={dim}
                    className="jrn-dim-pill"
                    onClick={() => setActiveDimFilter(activeDimFilter === dim ? null : dim)}
                    style={{
                      background: activeDimFilter === dim ? `${DIM_COLORS[dim]}22` : 'rgba(255,255,255,0.03)',
                      color: activeDimFilter === dim ? DIM_COLORS[dim] : 'rgba(255,255,255,0.35)',
                      border: `1px solid ${activeDimFilter === dim ? DIM_COLORS[dim] + '44' : 'rgba(255,255,255,0.07)'}`,
                    }}
                  >
                    {DIM_LABELS[dim]}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Tab content + right panel */}
          <div style={{ display: 'flex', flex: 1, minHeight: 0, gap: 14 }}>
            {/* Main panel */}
            <div style={{ flex: 1, overflow: 'auto', minWidth: 0, paddingRight: 4 }}>
              {/* Stream */}
              {activeTab === 'stream' && (
                <div>
                  {loadingEntries ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {[1, 2, 3].map(i => (
                        <div key={i} style={{
                          height: 90, borderRadius: 14,
                          background: 'linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.07) 50%, rgba(255,255,255,0.04) 75%)',
                          backgroundSize: '200% 100%',
                          animation: 'jrn-shimmer 1.5s infinite',
                          animationDelay: `${i * 0.15}s`,
                        }} />
                      ))}
                    </div>
                  ) : allEntries.length === 0 ? (
                    <div style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center',
                      justifyContent: 'center', minHeight: 260, gap: 14,
                    }}>
                      <span style={{ fontSize: 52 }}>🌀</span>
                      <h3 style={{ ...font, color: '#fff', fontSize: 17, fontWeight: 700 }}>
                        Your story begins here
                      </h3>
                      <p style={{ ...font, color: 'rgba(255,255,255,0.4)', fontSize: 13, textAlign: 'center', maxWidth: 320, lineHeight: 1.7 }}>
                        {activeDimFilter
                          ? `No journal entries for ${DIM_LABELS[activeDimFilter]} yet. Start sharing with Oracle.`
                          : 'Start journaling with Oracle — speak your thoughts, share your wins, or check in each morning.'
                        }
                      </p>
                      <button
                        onClick={() => openOracle('', 'morning_checkin')}
                        style={{
                          ...font, cursor: 'pointer', fontWeight: 700, fontSize: 13,
                          background: '#FF7A65', color: '#fff',
                          border: 'none', borderRadius: 12, padding: '11px 24px',
                        }}
                      >
                        Start Morning Check-In
                      </button>
                    </div>
                  ) : (
                    allEntries.map(entry => <EntryCard key={entry.id} entry={entry} />)
                  )}
                </div>
              )}

              {/* Pulse */}
              {activeTab === 'pulse' && (
                <div>
                  <div style={{
                    background: 'rgba(255,255,255,0.03)', borderRadius: 16, padding: 20,
                    border: '1px solid rgba(255,255,255,0.07)', marginBottom: 16,
                  }}>
                    <h3 style={{ ...font, fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 4 }}>
                      30-Day Emotional Pulse
                    </h3>
                    <p style={{ ...font, fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 20 }}>
                      Your mood energy across the last month — highs, lows, and everything in between.
                    </p>
                    <PulseChart pulse={pulse} />
                  </div>

                  {/* Mood distribution */}
                  {pulse.some(p => p.hasEntry) && (
                    <div style={{
                      background: 'rgba(255,255,255,0.03)', borderRadius: 16, padding: 20,
                      border: '1px solid rgba(255,255,255,0.07)',
                    }}>
                      <h3 style={{ ...font, fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 14 }}>
                        Mood Distribution
                      </h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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
                                <span style={{ ...font, fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>{label}</span>
                                <span style={{ ...font, fontSize: 12, color, fontWeight: 700 }}>{count} days</span>
                              </div>
                              <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3 }}>
                                <div style={{
                                  height: '100%', borderRadius: 3, width: `${pct}%`,
                                  background: color, opacity: 0.8,
                                  transition: 'width 0.8s ease',
                                }} />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Portrait */}
              {activeTab === 'portrait' && (
                <div>
                  <PortraitView
                    portrait={portrait}
                    loading={loadingPortrait}
                    onGenerate={() => void generatePortrait()}
                  />
                </div>
              )}

              {/* Growth Map */}
              {activeTab === 'growth' && (
                <GrowthMapView growthMarkers={growthMarkers} achievements={achievements} />
              )}
            </div>

            {/* Right panel */}
            <div style={{
              width: 240, flexShrink: 0,
              overflow: 'auto', paddingBottom: 20,
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
      </div>
    </div>
  )
}
