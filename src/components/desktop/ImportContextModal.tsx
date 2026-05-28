'use client'

import React, { useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { DIM_COLORS } from './DesktopLeftSidebar'
import type { ExtractedMemory } from '@/app/api/journal/import-context/route'

// ── Types ─────────────────────────────────────────────────────────────────────

type Step = 'paste' | 'analyzing' | 'preview' | 'saving' | 'done'

interface Props {
  userId: string
  onClose: () => void
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DIM_LABELS: Record<string, string> = {
  career: 'Career', social: 'Social', wealth: 'Wealth',
  vitality: 'Vitality', mind: 'Mind', love: 'Love', family: 'Family',
}

const DIM_ORDER = ['career', 'social', 'wealth', 'vitality', 'mind', 'love', 'family']

const font: CSSProperties = { fontFamily: "'Space Grotesk', system-ui, sans-serif" }

const MODAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&display=swap');
  * { box-sizing: border-box; }

  @keyframes imp-spin   { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
  @keyframes imp-fade-in{ from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
  @keyframes imp-pulse  { 0%,100%{opacity:0.5;transform:scale(0.97)} 50%{opacity:1;transform:scale(1)} }
  @keyframes imp-shimmer{ 0%{background-position:-400px 0} 100%{background-position:400px 0} }

  .imp-memory-card { animation: imp-fade-in 0.3s ease both; }
  .imp-dim-section:nth-child(1) .imp-memory-card { animation-delay: 0.03s }
  .imp-dim-section:nth-child(2) .imp-memory-card { animation-delay: 0.06s }
  .imp-dim-section:nth-child(3) .imp-memory-card { animation-delay: 0.09s }

  .imp-checkbox {
    appearance: none; width: 16px; height: 16px; border-radius: 4px;
    border: 1.5px solid rgba(255,255,255,0.2); background: transparent;
    cursor: pointer; flex-shrink: 0; position: relative;
    transition: all 0.15s;
  }
  .imp-checkbox:checked {
    background: #7B3FE4; border-color: #7B3FE4;
  }
  .imp-checkbox:checked::after {
    content: ''; position: absolute; left: 4px; top: 1px;
    width: 5px; height: 9px;
    border: 2px solid white; border-top: none; border-left: none;
    transform: rotate(45deg);
  }

  .imp-textarea {
    width: 100%; background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.1); border-radius: 12px;
    color: rgba(255,255,255,0.85); font-size: 13px; line-height: 1.6;
    padding: 14px 16px; resize: none; outline: none;
    font-family: 'Space Grotesk', system-ui, sans-serif;
    transition: border-color 0.2s;
  }
  .imp-textarea:focus { border-color: rgba(123,63,228,0.5); }
  .imp-textarea::placeholder { color: rgba(255,255,255,0.25); }

  ::-webkit-scrollbar { display: none; }
`

// ── SVG Icons ─────────────────────────────────────────────────────────────────

function SpinnerIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round"
      style={{ animation: 'imp-spin 0.9s linear infinite', color: '#C4A8FF' }}>
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  )
}

function CheckIcon({ size = 16, color = '#6EE7A4' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function UploadIcon({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.25)"
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  )
}

function BrainIcon({ size = 20, color = '#C4A8FF' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-1.66z"/>
      <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-1.66z"/>
    </svg>
  )
}

function CloseIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function ImportContextModal({ userId, onClose }: Props) {
  const [step, setStep] = useState<Step>('paste')
  const [text, setText] = useState('')
  const [memories, setMemories] = useState<ExtractedMemory[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [savedCount, setSavedCount] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Group memories by dimension for preview
  const grouped = DIM_ORDER.reduce<Record<string, { mem: ExtractedMemory; idx: number }[]>>((acc, dim) => {
    acc[dim] = memories
      .map((m, idx) => ({ mem: m, idx }))
      .filter(({ mem }) => mem.dimension === dim)
    return acc
  }, {})

  const selectedCount = selected.size

  function toggleAll(on: boolean) {
    setSelected(on ? new Set(memories.map((_, i) => i)) : new Set())
  }

  function toggleOne(idx: number) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  async function handleAnalyze() {
    if (!text.trim()) return
    setError(null)
    setStep('analyzing')

    try {
      const res = await fetch('/api/journal/import-context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, text }),
      })
      const data = await res.json() as { memories?: ExtractedMemory[]; error?: string }
      if (data.error) throw new Error(data.error)
      const mems = data.memories ?? []
      setMemories(mems)
      setSelected(new Set(mems.map((_, i) => i)))
      setStep('preview')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Analysis failed')
      setStep('paste')
    }
  }

  async function handleSave() {
    const toSave = memories.filter((_, i) => selected.has(i))
    if (toSave.length === 0) return
    setStep('saving')

    try {
      const res = await fetch('/api/journal/import-context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, memories: toSave, save: true }),
      })
      const data = await res.json() as { saved?: number; error?: string }
      if (data.error) throw new Error(data.error)
      setSavedCount(data.saved ?? toSave.length)
      setStep('done')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
      setStep('preview')
    }
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const content = ev.target?.result as string
      setText(content)
    }
    reader.readAsText(file)
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{MODAL_CSS}</style>

      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 999,
          background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)',
        }}
      />

      {/* Modal */}
      <div style={{
        position: 'fixed', zIndex: 1000,
        top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 'min(680px, 95vw)',
        maxHeight: '88vh',
        background: '#130E2A',
        borderRadius: 20,
        border: '1px solid rgba(255,255,255,0.1)',
        boxShadow: '0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(123,63,228,0.15)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        ...font,
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '20px 24px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          flexShrink: 0,
        }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background: 'linear-gradient(135deg, rgba(123,63,228,0.3), rgba(196,168,255,0.15))',
            border: '1px solid rgba(196,168,255,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <BrainIcon size={18} />
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{ ...font, fontSize: 16, fontWeight: 700, color: '#fff', margin: 0 }}>
              Import Context from ChatGPT
            </h2>
            <p style={{ ...font, fontSize: 12, color: 'rgba(255,255,255,0.4)', margin: 0, marginTop: 1 }}>
              Arc reads your history and builds a head-start on knowing you
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'rgba(255,255,255,0.4)', padding: 6, borderRadius: 8,
              display: 'flex', alignItems: 'center',
            }}
          >
            <CloseIcon size={16} />
          </button>
        </div>

        {/* Step indicator */}
        {step !== 'done' && (
          <div style={{
            display: 'flex', gap: 0,
            padding: '12px 24px 0',
            flexShrink: 0,
          }}>
            {[
              { key: 'paste', label: '1. Paste' },
              { key: 'preview', label: '2. Review' },
              { key: 'done', label: '3. Saved' },
            ].map(({ key, label }, i) => {
              const active = key === step || (key === 'paste' && step === 'analyzing') || (key === 'preview' && step === 'saving')
              const stepVal: string = step
              const done = (key === 'paste' && ['preview', 'saving', 'done'].includes(stepVal)) ||
                           (key === 'preview' && stepVal === 'done')
              return (
                <React.Fragment key={key}>
                  {i > 0 && (
                    <div style={{ flex: 1, height: 1, background: done ? '#7B3FE4' : 'rgba(255,255,255,0.1)', alignSelf: 'center', margin: '0 8px' }} />
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{
                      width: 20, height: 20, borderRadius: '50%',
                      background: done ? '#7B3FE4' : active ? 'rgba(123,63,228,0.3)' : 'rgba(255,255,255,0.06)',
                      border: `1.5px solid ${done || active ? '#7B3FE4' : 'rgba(255,255,255,0.12)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {done
                        ? <CheckIcon size={11} color="white" />
                        : <span style={{ fontSize: 10, fontWeight: 700, color: active ? '#C4A8FF' : 'rgba(255,255,255,0.3)' }}>{i + 1}</span>
                      }
                    </div>
                    <span style={{ fontSize: 12, fontWeight: active ? 600 : 400, color: active ? '#fff' : 'rgba(255,255,255,0.35)' }}>
                      {label}
                    </span>
                  </div>
                </React.Fragment>
              )
            })}
          </div>
        )}

        {/* Body */}
        <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px 24px' }}>

          {/* ── PASTE step ── */}
          {(step === 'paste' || step === 'analyzing') && (
            <div>
              {/* How-to */}
              <div style={{
                background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: '14px 16px',
                border: '1px solid rgba(255,255,255,0.06)', marginBottom: 18,
              }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#C4A8FF', marginBottom: 8, letterSpacing: '0.5px' }}>
                  HOW TO EXPORT FROM CHATGPT
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {[
                    'Go to ChatGPT → Settings → Data Controls',
                    'Click "Export data" → you\'ll receive a zip file by email',
                    'Open the zip and find conversations.json — paste its contents below',
                    'Or simply copy-paste any conversation text directly',
                  ].map((step, i) => (
                    <div key={i} style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#7B3FE4', flexShrink: 0, marginTop: 1 }}>{i + 1}.</span>
                      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', lineHeight: 1.5 }}>{step}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Textarea */}
              <textarea
                className="imp-textarea"
                rows={10}
                placeholder="Paste your ChatGPT conversation text or JSON export here…"
                value={text}
                onChange={e => setText(e.target.value)}
                disabled={step === 'analyzing'}
              />

              <div style={{ display: 'flex', gap: 10, marginTop: 10, alignItems: 'center' }}>
                {/* Upload file */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={step === 'analyzing'}
                  style={{
                    ...font, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                    background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.55)',
                    border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8,
                    padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 6,
                  }}
                >
                  <UploadIcon size={13} />
                  Upload file
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,.txt"
                  style={{ display: 'none' }}
                  onChange={handleFileUpload}
                />

                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>
                  {text.length > 0 ? `${(text.length / 1000).toFixed(0)}k characters` : 'accepts .json or .txt'}
                </span>

                <div style={{ flex: 1 }} />

                <button
                  onClick={() => void handleAnalyze()}
                  disabled={!text.trim() || step === 'analyzing'}
                  style={{
                    ...font, cursor: !text.trim() || step === 'analyzing' ? 'not-allowed' : 'pointer',
                    fontWeight: 700, fontSize: 13,
                    background: !text.trim() ? 'rgba(123,63,228,0.2)' : '#7B3FE4',
                    color: !text.trim() ? 'rgba(255,255,255,0.3)' : '#fff',
                    border: 'none', borderRadius: 10, padding: '10px 24px',
                    display: 'flex', alignItems: 'center', gap: 8,
                    opacity: step === 'analyzing' ? 0.7 : 1,
                  }}
                >
                  {step === 'analyzing'
                    ? <><SpinnerIcon size={15} /> Analysing…</>
                    : <>
                        <BrainIcon size={14} color="white" />
                        Analyse with Arc
                      </>
                  }
                </button>
              </div>

              {error && (
                <p style={{ fontSize: 12, color: '#FF6B9D', marginTop: 10 }}>{error}</p>
              )}
            </div>
          )}

          {/* ── PREVIEW step ── */}
          {(step === 'preview' || step === 'saving') && (
            <div>
              {/* Summary bar */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: 16, flexWrap: 'wrap', gap: 8,
              }}>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: '#fff', margin: 0 }}>
                    Arc found {memories.length} memories
                  </p>
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', margin: 0, marginTop: 2 }}>
                    Deselect anything you don't want saved. {selectedCount} selected.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => toggleAll(true)}
                    style={{
                      ...font, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                      background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)',
                      border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '5px 10px',
                    }}
                  >Select all</button>
                  <button
                    onClick={() => toggleAll(false)}
                    style={{
                      ...font, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                      background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.4)',
                      border: '1px solid rgba(255,255,255,0.07)', borderRadius: 6, padding: '5px 10px',
                    }}
                  >Deselect all</button>
                </div>
              </div>

              {/* Memories grouped by dimension */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {DIM_ORDER.filter(dim => (grouped[dim]?.length ?? 0) > 0).map(dim => {
                  const color = DIM_COLORS[dim as keyof typeof DIM_COLORS] ?? '#C4A8FF'
                  const items = grouped[dim] ?? []
                  return (
                    <div key={dim} className="imp-dim-section">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, boxShadow: `0 0 6px ${color}88` }} />
                        <span style={{ fontSize: 11, fontWeight: 700, color, letterSpacing: '1px' }}>
                          {DIM_LABELS[dim]?.toUpperCase()}
                        </span>
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
                          {items.filter(({ idx }) => selected.has(idx)).length}/{items.length}
                        </span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {items.map(({ mem, idx }) => {
                          const isSelected = selected.has(idx)
                          return (
                            <div
                              key={idx}
                              className="imp-memory-card"
                              onClick={() => toggleOne(idx)}
                              style={{
                                display: 'flex', gap: 10, alignItems: 'flex-start',
                                background: isSelected ? `${color}0D` : 'rgba(255,255,255,0.02)',
                                border: `1px solid ${isSelected ? color + '25' : 'rgba(255,255,255,0.06)'}`,
                                borderRadius: 10, padding: '10px 12px', cursor: 'pointer',
                                transition: 'all 0.15s',
                              }}
                            >
                              <input
                                type="checkbox"
                                className="imp-checkbox"
                                checked={isSelected}
                                onChange={() => toggleOne(idx)}
                                onClick={e => e.stopPropagation()}
                                style={{ marginTop: 2 }}
                              />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, gap: 8 }}>
                                  <span style={{ fontSize: 10, fontWeight: 700, color: isSelected ? color : 'rgba(255,255,255,0.3)', letterSpacing: '0.5px' }}>
                                    {mem.label}
                                  </span>
                                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', flexShrink: 0 }}>
                                    importance {mem.importance}/10
                                  </span>
                                </div>
                                <p style={{ fontSize: 13, color: isSelected ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.35)', lineHeight: 1.6, margin: 0 }}>
                                  {mem.content}
                                </p>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>

              {error && (
                <p style={{ fontSize: 12, color: '#FF6B9D', marginTop: 12 }}>{error}</p>
              )}
            </div>
          )}

          {/* ── DONE step ── */}
          {step === 'done' && (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', minHeight: 220, gap: 16, textAlign: 'center',
            }}>
              <div style={{
                width: 64, height: 64, borderRadius: '50%',
                background: 'linear-gradient(135deg, #7B3FE4, #6EE7A4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <CheckIcon size={28} color="white" />
              </div>
              <div>
                <h3 style={{ ...font, fontSize: 20, fontWeight: 800, color: '#fff', marginBottom: 8 }}>
                  Arc now knows you better
                </h3>
                <p style={{ ...font, fontSize: 14, color: 'rgba(255,255,255,0.55)', lineHeight: 1.7, maxWidth: 360 }}>
                  {savedCount} memories saved across your life areas. Arc will use these to give you more personal, contextual coaching from day one.
                </p>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => {
                    setStep('paste')
                    setText('')
                    setMemories([])
                    setSelected(new Set())
                  }}
                  style={{
                    ...font, cursor: 'pointer', fontWeight: 600, fontSize: 13,
                    background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)',
                    border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 20px',
                  }}
                >
                  Import more
                </button>
                <button
                  onClick={onClose}
                  style={{
                    ...font, cursor: 'pointer', fontWeight: 700, fontSize: 13,
                    background: '#7B3FE4', color: '#fff',
                    border: 'none', borderRadius: 10, padding: '10px 24px',
                  }}
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer action bar (preview step) */}
        {(step === 'preview' || step === 'saving') && (
          <div style={{
            padding: '14px 24px',
            borderTop: '1px solid rgba(255,255,255,0.07)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexShrink: 0,
          }}>
            <button
              onClick={() => setStep('paste')}
              disabled={step === 'saving'}
              style={{
                ...font, cursor: 'pointer', fontWeight: 600, fontSize: 13,
                background: 'none', color: 'rgba(255,255,255,0.4)',
                border: 'none', padding: '8px 0',
              }}
            >
              ← Back
            </button>

            <button
              onClick={() => void handleSave()}
              disabled={selectedCount === 0 || step === 'saving'}
              style={{
                ...font,
                cursor: selectedCount === 0 || step === 'saving' ? 'not-allowed' : 'pointer',
                fontWeight: 700, fontSize: 13,
                background: selectedCount === 0 ? 'rgba(123,63,228,0.2)' : '#7B3FE4',
                color: selectedCount === 0 ? 'rgba(255,255,255,0.3)' : '#fff',
                border: 'none', borderRadius: 10, padding: '10px 28px',
                display: 'flex', alignItems: 'center', gap: 8,
                opacity: step === 'saving' ? 0.7 : 1,
              }}
            >
              {step === 'saving'
                ? <><SpinnerIcon size={15} /> Saving…</>
                : <>Save {selectedCount} memories to Arc</>
              }
            </button>
          </div>
        )}
      </div>
    </>
  )
}
