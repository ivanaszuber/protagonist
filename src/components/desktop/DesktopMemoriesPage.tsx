'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { getUserId } from '@/lib/user'
import { DesktopLeftSidebar, DIM_COLORS } from './DesktopLeftSidebar'
import DesktopTopNav from './DesktopTopNav'
import { DesktopOracleModal } from './DesktopOracleModal'
import { ALL_DIMENSIONS, type Dimension } from '@/lib/character'
import { getLevel, getLevelProgress } from '@/lib/xp'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Memory {
  id: string
  photo_url: string
  caption: string | null
  reflection: string | null
  dimensions: string[]
  chapter: string | null
  location: string | null
  created_at: string
}

// ── CSS ───────────────────────────────────────────────────────────────────────

const PAGE_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&display=swap');
  * { box-sizing: border-box; }
  ::-webkit-scrollbar { display: none; }

  @keyframes mem-fade-in  { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
  @keyframes mem-shimmer  { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
  @keyframes mem-spin     { to{transform:rotate(360deg)} }
  @keyframes mem-pulse    { 0%,100%{opacity:0.5;transform:scale(1)} 50%{opacity:1;transform:scale(1.05)} }

  .mem-tile {
    break-inside: avoid;
    margin-bottom: 12px;
    border-radius: 14px;
    overflow: hidden;
    cursor: pointer;
    position: relative;
    animation: mem-fade-in 0.4s ease both;
  }
  .mem-tile img {
    width: 100%;
    display: block;
    transition: transform 0.4s ease;
  }
  .mem-tile:hover img { transform: scale(1.03); }
  .mem-tile-overlay {
    position: absolute; bottom: 0; left: 0; right: 0;
    padding: 28px 14px 14px;
    background: linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0) 100%);
    transition: opacity 0.2s;
  }
  .mem-dim-pill {
    border: none; cursor: pointer; border-radius: 20px;
    font-family: 'Space Grotesk', sans-serif; font-size: 11px; font-weight: 600;
    padding: 4px 12px; transition: all 0.15s; white-space: nowrap;
  }
  .mem-upload-zone {
    border: 2px dashed rgba(255,255,255,0.15);
    border-radius: 18px;
    transition: all 0.2s;
    cursor: pointer;
  }
  .mem-upload-zone.dragover {
    border-color: rgba(196,168,255,0.6);
    background: rgba(123,63,228,0.08);
  }
  .mem-upload-zone:hover {
    border-color: rgba(255,255,255,0.28);
    background: rgba(255,255,255,0.03);
  }
`

const font: CSSProperties = { fontFamily: "'Space Grotesk', system-ui, sans-serif" }

const DIM_LABELS: Record<Dimension, string> = {
  career: 'Career', social: 'Social', wealth: 'Wealth',
  vitality: 'Vitality', mind: 'Mind', love: 'Love', family: 'Family',
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

function formatMonth(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
}

// ── Upload Modal ──────────────────────────────────────────────────────────────

function UploadModal({
  onClose,
  onUploaded,
  userId,
}: {
  onClose: () => void
  onUploaded: (memory: Memory) => void
  userId: string
}) {
  const [dragover, setDragover] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [location, setLocation] = useState('')
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = (f: File) => {
    setFile(f)
    const reader = new FileReader()
    reader.onload = e => setPreview(e.target?.result as string)
    reader.readAsDataURL(f)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragover(false)
    const f = e.dataTransfer.files[0]
    if (f?.type.startsWith('image/')) handleFile(f)
  }

  const handleSubmit = async () => {
    if (!file || !preview) return
    setProcessing(true); setError(null)
    try {
      const base64 = preview.split(',')[1]
      const res = await fetch('/api/memories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, imageBase64: base64, imageMimeType: file.type, location: location.trim() || undefined }),
      })
      const json = await res.json() as { memory?: Memory; error?: string }
      if (!res.ok || !json.memory) throw new Error(json.error ?? 'Upload failed')
      onUploaded(json.memory)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: '#1A1335', borderRadius: 20, width: '100%', maxWidth: 480,
        border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden',
        ...font,
      }}>
        {/* Header */}
        <div style={{ padding: '18px 22px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ color: '#fff', fontSize: 17, fontWeight: 700, margin: 0 }}>Add a Memory</h2>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 3 }}>
              Oracle will read the context of your life right now and make it personal.
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', fontSize: 20, lineHeight: 1, padding: 4 }}>×</button>
        </div>

        <div style={{ padding: '16px 22px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Photo zone */}
          {preview ? (
            <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="preview" style={{ width: '100%', maxHeight: 260, objectFit: 'cover', display: 'block' }} />
              <button
                onClick={() => { setPreview(null); setFile(null) }}
                style={{
                  position: 'absolute', top: 8, right: 8,
                  background: 'rgba(0,0,0,0.65)', border: 'none', borderRadius: 8,
                  color: 'white', fontSize: 12, padding: '5px 10px', cursor: 'pointer', ...font,
                }}
              >
                Change
              </button>
            </div>
          ) : (
            <div
              className={`mem-upload-zone${dragover ? ' dragover' : ''}`}
              style={{ padding: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}
              onDragOver={e => { e.preventDefault(); setDragover(true) }}
              onDragLeave={() => setDragover(false)}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
            >
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, textAlign: 'center', lineHeight: 1.5 }}>
                Drop a photo here or <span style={{ color: '#C4A8FF' }}>click to browse</span>
              </p>
              <input
                ref={inputRef} type="file" accept="image/*"
                style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
              />
            </div>
          )}

          {/* Optional location */}
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.35)', letterSpacing: '1.2px', marginBottom: 6, textTransform: 'uppercase' }}>
              Location (optional)
            </label>
            <input
              type="text"
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="e.g. London, Notting Hill"
              style={{
                width: '100%', background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10,
                color: '#fff', padding: '10px 14px', fontSize: 13, ...font,
                outline: 'none',
              }}
            />
          </div>

          {error && (
            <p style={{ color: '#FF6B9D', fontSize: 12, background: 'rgba(255,107,157,0.1)', padding: '8px 12px', borderRadius: 8 }}>
              {error}
            </p>
          )}

          <button
            onClick={handleSubmit}
            disabled={!file || processing}
            style={{
              background: !file ? 'rgba(123,63,228,0.3)' : '#7B3FE4',
              color: !file ? 'rgba(255,255,255,0.4)' : 'white',
              border: 'none', borderRadius: 12, padding: '13px 22px',
              fontSize: 14, fontWeight: 700, cursor: !file ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              ...font,
            }}
          >
            {processing ? (
              <>
                <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', animation: 'mem-spin 0.7s linear infinite' }} />
                Oracle is reading your life…
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                  <path d="M12 2l2.4 7.6H22l-6.4 4.6 2.4 7.6L12 17.2l-6 4.6 2.4-7.6L2 9.6h7.6L12 2z"/>
                </svg>
                Save to Memories
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Expanded Memory Modal ─────────────────────────────────────────────────────

function MemoryModal({
  memory,
  onClose,
  onDelete,
}: {
  memory: Memory
  onClose: () => void
  onDelete: (id: string) => void
}) {
  const [confirming, setConfirming] = useState(false)

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: '#13102A', borderRadius: 20, width: '100%', maxWidth: 520,
        border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden',
        maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        ...font,
      }}>
        {/* Photo */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={memory.photo_url} alt="memory" style={{ width: '100%', maxHeight: 320, objectFit: 'cover', display: 'block' }} />
          <button
            onClick={onClose}
            style={{
              position: 'absolute', top: 12, right: 12,
              background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%',
              width: 32, height: 32, cursor: 'pointer', color: 'white',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
            }}
          >×</button>
          {memory.chapter && (
            <div style={{
              position: 'absolute', bottom: 12, left: 14,
              background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
              borderRadius: 100, padding: '4px 12px',
              fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.75)', letterSpacing: '0.8px',
              ...font,
            }}>
              {memory.chapter}
            </div>
          )}
        </div>

        {/* Content */}
        <div style={{ overflowY: 'auto', padding: '18px 22px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Caption */}
          {memory.caption && (
            <p style={{ fontSize: 16, fontWeight: 600, color: '#fff', lineHeight: 1.5 }}>
              {memory.caption}
            </p>
          )}

          {/* Meta row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
              {formatDate(memory.created_at)}
            </span>
            {memory.location && (
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', display: 'flex', alignItems: 'center', gap: 3 }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
                  <circle cx="12" cy="9" r="2.5"/>
                </svg>
                {memory.location}
              </span>
            )}
            {memory.dimensions.map(dim => {
              const c = DIM_COLORS[dim as Dimension] ?? '#C4A8FF'
              return (
                <span key={dim} style={{
                  background: `${c}18`, color: c, border: `1px solid ${c}30`,
                  fontSize: 10, fontWeight: 600, padding: '2px 9px', borderRadius: 100,
                }}>
                  {DIM_LABELS[dim as Dimension] ?? dim}
                </span>
              )
            })}
          </div>

          {/* Oracle reflection */}
          {memory.reflection && (
            <div style={{
              borderLeft: '2px solid rgba(196,168,255,0.35)',
              paddingLeft: 14,
            }}>
              <p style={{ fontSize: 9, fontWeight: 700, color: '#C4A8FF', letterSpacing: '1.3px', marginBottom: 8, textTransform: 'uppercase' }}>
                Oracle's Take
              </p>
              <p style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.72)', lineHeight: 1.75 }}>
                {memory.reflection}
              </p>
            </div>
          )}

          {/* Delete */}
          <div style={{ marginTop: 4, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            {confirming ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>Remove this memory?</span>
                <button onClick={() => { onDelete(memory.id); onClose() }} style={{ ...font, background: 'rgba(255,107,157,0.15)', color: '#FF6B9D', border: '1px solid rgba(255,107,157,0.25)', borderRadius: 8, padding: '5px 12px', fontSize: 12, cursor: 'pointer' }}>
                  Yes, delete
                </button>
                <button onClick={() => setConfirming(false)} style={{ ...font, background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', fontSize: 12, cursor: 'pointer' }}>
                  Cancel
                </button>
              </div>
            ) : (
              <button onClick={() => setConfirming(true)} style={{ ...font, background: 'none', border: 'none', color: 'rgba(255,255,255,0.22)', fontSize: 12, cursor: 'pointer', padding: 0 }}>
                Remove memory
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function DesktopMemoriesPage() {
  const [userId, setUserId] = useState('')
  const [memories, setMemories] = useState<Memory[]>([])
  const [loading, setLoading] = useState(true)
  const [activeDim, setActiveDim] = useState<Dimension | null>(null)
  const [showUpload, setShowUpload] = useState(false)
  const [expanded, setExpanded] = useState<Memory | null>(null)
  const [dimXpMap, setDimXpMap] = useState<Record<string, number>>({})
  const [dimBaselineMap, setDimBaselineMap] = useState<Record<string, number>>({})

  useEffect(() => {
    const id = getUserId()
    setUserId(id)
  }, [])

  const loadMemories = useCallback((uid: string, dim: Dimension | null) => {
    setLoading(true)
    const params = new URLSearchParams({ userId: uid, limit: '80' })
    if (dim) params.set('dimension', dim)
    fetch(`/api/memories?${params}`)
      .then(r => r.json())
      .then((d: { memories?: Memory[] }) => setMemories(d.memories ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (userId) loadMemories(userId, activeDim)
  }, [userId, activeDim, loadMemories])

  useEffect(() => {
    if (!userId) return
    Promise.all([
      fetch(`/api/quests/main?userId=${userId}`).then(r => r.json()).catch(() => ({})),
      fetch(`/api/dimension-score?userId=${userId}`).then(r => r.json()).catch(() => ({})),
    ]).then(([q, s]: [Record<string, unknown>, Record<string, unknown>]) => {
      setDimXpMap((q.dimXpMap ?? {}) as Record<string, number>)
      setDimBaselineMap((s.scores ?? {}) as Record<string, number>)
    })
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
      return [dim, baseline != null ? baseline : xpScore(xp)] as const
    })
  ) as Partial<Record<Dimension, number>>

  const handleUploaded = (mem: Memory) => {
    setMemories(prev => [mem, ...prev])
  }

  const handleDelete = async (id: string) => {
    await fetch(`/api/memories?id=${id}&userId=${userId}`, { method: 'DELETE' })
    setMemories(prev => prev.filter(m => m.id !== id))
  }

  // Group by chapter for display
  const chapterGroups: { chapter: string; items: Memory[] }[] = []
  memories.forEach(mem => {
    const key = mem.chapter ?? formatMonth(mem.created_at)
    const existing = chapterGroups.find(g => g.chapter === key)
    if (existing) existing.items.push(mem)
    else chapterGroups.push({ chapter: key, items: [mem] })
  })

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      width: '100vw', height: '100vh', overflow: 'hidden',
      background: '#0D0820',
      fontFamily: "'Space Grotesk', system-ui, sans-serif",
    }}>
      <style>{PAGE_CSS}</style>

      <DesktopTopNav activePage="memories" />
      <DesktopOracleModal />

      {showUpload && userId && (
        <UploadModal userId={userId} onClose={() => setShowUpload(false)} onUploaded={handleUploaded} />
      )}
      {expanded && (
        <MemoryModal memory={expanded} onClose={() => setExpanded(null)} onDelete={handleDelete} />
      )}

      <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <DesktopLeftSidebar scores={sidebarScores} />

        {/* Main */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden', padding: '22px 24px 0' }}>

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexShrink: 0 }}>
            <div style={{ flex: 1 }}>
              <h1 style={{ ...font, fontWeight: 800, fontSize: 22, color: '#fff', lineHeight: 1.2 }}>Memories</h1>
              <p style={{ ...font, fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
                Moments witnessed by Oracle — woven into your story.
              </p>
            </div>
            <button
              onClick={() => setShowUpload(true)}
              style={{
                ...font, cursor: 'pointer', fontWeight: 700, fontSize: 13,
                background: '#7B3FE4', color: '#fff',
                border: 'none', borderRadius: 12, padding: '10px 20px',
                display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Add Memory
            </button>
          </div>

          {/* Dim filter */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 18, flexShrink: 0, flexWrap: 'wrap' }}>
            <button
              className="mem-dim-pill"
              onClick={() => setActiveDim(null)}
              style={{
                background: !activeDim ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.03)',
                color: !activeDim ? '#fff' : 'rgba(255,255,255,0.4)',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
            >All</button>
            {ALL_DIMENSIONS.map(dim => {
              const c = DIM_COLORS[dim]
              const isActive = activeDim === dim
              return (
                <button
                  key={dim}
                  className="mem-dim-pill"
                  onClick={() => setActiveDim(isActive ? null : dim)}
                  style={{
                    background: isActive ? `${c}20` : 'rgba(255,255,255,0.02)',
                    color: isActive ? c : 'rgba(255,255,255,0.35)',
                    border: `1px solid ${isActive ? c + '35' : 'rgba(255,255,255,0.07)'}`,
                  }}
                >{DIM_LABELS[dim]}</button>
              )
            })}
          </div>

          {/* Grid */}
          <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 40 }}>
            {loading ? (
              <div style={{ columns: 3, columnGap: 12 }}>
                {[180, 240, 200, 280, 160, 220].map((h, i) => (
                  <div key={i} style={{
                    breakInside: 'avoid', marginBottom: 12, borderRadius: 14, height: h,
                    background: 'linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.07) 50%, rgba(255,255,255,0.03) 75%)',
                    backgroundSize: '200% 100%',
                    animation: `mem-shimmer 1.5s infinite`,
                    animationDelay: `${i * 0.1}s`,
                  }} />
                ))}
              </div>
            ) : memories.length === 0 ? (
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', minHeight: 320, gap: 16, textAlign: 'center',
              }}>
                <div style={{
                  width: 72, height: 72, borderRadius: '50%',
                  background: 'rgba(123,63,228,0.12)', border: '1px solid rgba(196,168,255,0.18)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(196,168,255,0.6)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2"/>
                    <circle cx="8.5" cy="8.5" r="1.5"/>
                    <polyline points="21 15 16 10 5 21"/>
                  </svg>
                </div>
                <h3 style={{ ...font, color: '#fff', fontSize: 18, fontWeight: 700 }}>Your memory wall is empty</h3>
                <p style={{ ...font, color: 'rgba(255,255,255,0.38)', fontSize: 13.5, maxWidth: 340, lineHeight: 1.7 }}>
                  Upload your first photo and Oracle will weave it into the context of your life right now.
                </p>
                <button
                  onClick={() => setShowUpload(true)}
                  style={{ ...font, background: '#7B3FE4', color: '#fff', border: 'none', borderRadius: 12, padding: '11px 26px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                >
                  Add your first memory
                </button>
              </div>
            ) : (
              <>
                {chapterGroups.map(({ chapter, items }, gi) => (
                  <div key={gi} style={{ marginBottom: 32 }}>
                    {/* Chapter divider */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                      <span style={{ ...font, fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.35)', letterSpacing: '1.4px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                        {chapter}
                      </span>
                      <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.07)' }} />
                      <span style={{ ...font, fontSize: 10, color: 'rgba(255,255,255,0.2)', whiteSpace: 'nowrap' }}>
                        {items.length} {items.length === 1 ? 'memory' : 'memories'}
                      </span>
                    </div>

                    {/* Masonry grid */}
                    <div style={{ columns: 3, columnGap: 12 }}>
                      {items.map((mem, i) => (
                        <div
                          key={mem.id}
                          className="mem-tile"
                          style={{ animationDelay: `${i * 0.05}s` }}
                          onClick={() => setExpanded(mem)}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={mem.photo_url} alt={mem.caption ?? 'memory'} loading="lazy" />
                          <div className="mem-tile-overlay">
                            {mem.caption && (
                              <p style={{ ...font, fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.92)', lineHeight: 1.45, marginBottom: mem.dimensions.length ? 6 : 0 }}>
                                {mem.caption}
                              </p>
                            )}
                            {mem.dimensions.length > 0 && (
                              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                {mem.dimensions.slice(0, 2).map(dim => {
                                  const c = DIM_COLORS[dim as Dimension] ?? '#C4A8FF'
                                  return (
                                    <span key={dim} style={{
                                      ...font, fontSize: 9, fontWeight: 700,
                                      background: `${c}30`, color: c,
                                      padding: '2px 7px', borderRadius: 100,
                                    }}>
                                      {DIM_LABELS[dim as Dimension] ?? dim}
                                    </span>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
