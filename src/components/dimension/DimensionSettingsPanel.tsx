'use client'

import React, { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import type { Dimension } from '@/lib/character'

export interface DimSettings {
  showQuests: boolean
  showMilestones: boolean
  showTasks: boolean
  showPillars: boolean
  showTopOfMind: boolean
  showPatternLog: boolean
  showConversationSeeds: boolean
}

const DEFAULTS: DimSettings = {
  showQuests: true, showMilestones: true, showTasks: true,
  showPillars: true, showTopOfMind: true, showPatternLog: true, showConversationSeeds: true,
}

const LOVE_DEFAULTS: DimSettings = {
  ...DEFAULTS, showQuests: false, showMilestones: false,
}

interface Props {
  dimension: Dimension
  userId: string
  accentColor: string
  settings: DimSettings
  onChange: (s: DimSettings) => void
}

const font: CSSProperties = { fontFamily: "'Space Grotesk', system-ui, sans-serif" }

const TOGGLES: Array<{ key: keyof DimSettings; label: string; loveOnly?: boolean }> = [
  { key: 'showPillars',           label: 'Non-negotiables / pillars' },
  { key: 'showTopOfMind',         label: 'Top of mind' },
  { key: 'showConversationSeeds', label: 'Conversation seeds', loveOnly: true },
  { key: 'showPatternLog',        label: 'Pattern log', loveOnly: true },
  { key: 'showQuests',            label: 'Quests' },
  { key: 'showMilestones',        label: 'Milestones' },
  { key: 'showTasks',             label: 'Tasks' },
]

export function useDimensionSettings(userId: string, dimension: Dimension): [DimSettings, (s: DimSettings) => void] {
  const defaultSettings = dimension === 'love' ? LOVE_DEFAULTS : DEFAULTS
  const [settings, setSettings] = useState<DimSettings>(defaultSettings)

  useEffect(() => {
    void fetch(`/api/dimension/settings?userId=${encodeURIComponent(userId)}&dimensionId=${encodeURIComponent(dimension)}`)
      .then(r => r.json())
      .then((data: DimSettings) => { if (data && typeof data.showQuests === 'boolean') setSettings(data) })
      .catch(() => {})
  }, [userId, dimension])

  function save(s: DimSettings) {
    setSettings(s)
    void fetch('/api/dimension/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, dimensionId: dimension, ...s }),
    })
  }

  return [settings, save]
}

export function DimensionSettingsPanel({ dimension, accentColor, settings, onChange }: Props) {
  const isLove = dimension === 'love'

  function toggle(key: keyof DimSettings) {
    onChange({ ...settings, [key]: !settings[key] })
  }

  function Toggle({ on }: { on: boolean }) {
    return (
      <div style={{
        width: 28, height: 15,
        background: on ? `${accentColor}30` : 'rgba(255,255,255,0.08)',
        border: `0.5px solid ${on ? `${accentColor}40` : 'rgba(255,255,255,0.1)'}`,
        borderRadius: 20, position: 'relative', flexShrink: 0,
      }}>
        <div style={{
          width: 11, height: 11, borderRadius: '50%',
          background: on ? accentColor : 'rgba(255,255,255,0.25)',
          position: 'absolute', top: 2,
          [on ? 'right' : 'left']: 2,
          transition: 'left 0.15s, right 0.15s',
        }} />
      </div>
    )
  }

  return (
    <div style={{ padding: '12px 13px', background: 'rgba(255,255,255,0.02)', border: '0.5px solid rgba(255,255,255,0.06)', borderRadius: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="3" stroke="rgba(255,255,255,0.35)" strokeWidth="2"/>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" stroke="rgba(255,255,255,0.35)" strokeWidth="2"/>
        </svg>
        <span style={{ ...font, fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.28)', letterSpacing: '1.3px', textTransform: 'uppercase' as const }}>Page settings</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {TOGGLES.filter(t => !t.loveOnly || isLove).map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => toggle(key)}
            style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: 'none', border: 'none', cursor: 'pointer', padding: 0, width: '100%',
            }}
          >
            <span style={{ ...font, fontSize: 10.5, color: settings[key] ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.25)' }}>
              {label}
            </span>
            <Toggle on={settings[key]} />
          </button>
        ))}
      </div>
    </div>
  )
}
