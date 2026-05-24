'use client'

import { useState, useEffect, Component, type ReactNode } from 'react'
import {
  Quest,
  DimensionXPState,
  INITIAL_XP,
  DimensionId,
  CheckInData,
} from '@/types'
import { VoiceCheckin } from '@/components/checkin/VoiceCheckin'
import OuraWidget from '@/components/oura/OuraWidget'
import CalendarWidget from '@/components/calendar/CalendarWidget'
import { QuestCard } from '@/components/quests/QuestCard'
import { QuestProof } from '@/components/quests/QuestProof'
import { DimensionBars } from '@/components/xp/DimensionBars'
import {
  getTotalXP,
  getLevel,
  getXPToNextLevel,
} from '@/lib/xp'
import {
  loadDimensionXP,
  getCompletedQuestIds,
  getTodayQuests,
  saveQuests,
  markQuestComplete,
  addDimensionXP,
  saveCheckIn,
  getTodayCheckIn,
  deleteTodayQuests,
} from '@/lib/db'
import { isSupabaseConfigured } from '@/lib/supabase'
import {
  loadXP,
  loadCompletedQuests,
  loadTodayQuests,
  saveTodayQuests,
  clearTodayQuestProgress,
  addXP,
  saveCompletedQuest,
} from '@/lib/xp'

interface XPToast {
  id: string
  amount: number
  dimensionId: string
  x: number
  y: number
}

class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) return null
    return this.props.children
  }
}

export default function QuestsPage() {
  const [quests, setQuests] = useState<Quest[]>([])
  const [activeQuest, setActiveQuest] = useState<Quest | null>(null)
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set())
  const [dimensionXP, setDimensionXP] = useState<DimensionXPState>(INITIAL_XP)
  const [xpToasts, setXpToasts] = useState<XPToast[]>([])
  const [highlightDimension, setHighlightDimension] = useState<string | null>(null)
  const [showCheckin, setShowCheckin] = useState(false)
  const [lastCheckIn, setLastCheckIn] = useState<CheckInData | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const ouraStatus = params.get('oura')
    const calendarStatus = params.get('calendar')
    if (
      ouraStatus === 'connected' ||
      ouraStatus === 'error' ||
      calendarStatus === 'connected' ||
      calendarStatus === 'error'
    ) {
      window.history.replaceState({}, '', '/quests')
    }
  }, [])

  useEffect(() => {
    async function loadFromDatabase() {
      if (isSupabaseConfigured()) {
        const [xp, completedQuestIds, todayQuests, todayCheckIn] = await Promise.all([
          loadDimensionXP(),
          getCompletedQuestIds(),
          getTodayQuests(),
          getTodayCheckIn(),
        ])
        setDimensionXP(xp)
        setCompletedIds(completedQuestIds)
        if (todayQuests.length > 0) {
          setQuests(todayQuests)
        }
        if (todayCheckIn) {
          setLastCheckIn(todayCheckIn)
        }
      } else {
        setDimensionXP(loadXP())
        setCompletedIds(loadCompletedQuests())
        const savedQuests = loadTodayQuests()
        if (savedQuests.length > 0) {
          setQuests(savedQuests)
        }
      }
      setMounted(true)
    }
    void loadFromDatabase()
  }, [])

  const handleQuestsGenerated = async (
    newQuests: Quest[],
    checkIn: CheckInData,
    transcript: string
  ) => {
    setCompletedIds(new Set())
    setQuests(newQuests)
    setLastCheckIn(checkIn)
    setShowCheckin(false)

    if (isSupabaseConfigured()) {
      await saveCheckIn({ ...checkIn, transcript })
      await deleteTodayQuests()
      await saveQuests(newQuests)
    } else {
      clearTodayQuestProgress()
      saveTodayQuests(newQuests)
    }
  }

  const handleCompleteClick = (quest: Quest) => {
    setActiveQuest(quest)
  }

  const handleProofComplete = async (
    xpAwarded: number,
    dimensionId: string,
    proofTranscript: string,
    arcResponse: string
  ) => {
    if (!activeQuest) return

    setCompletedIds((prev) => {
      const next = new Set(prev)
      next.add(activeQuest.id)
      return next
    })

    if (isSupabaseConfigured()) {
      await markQuestComplete(
        activeQuest.id,
        xpAwarded,
        proofTranscript,
        arcResponse
      )
    } else {
      saveCompletedQuest(activeQuest.id)
    }

    if (xpAwarded > 0) {
      if (isSupabaseConfigured()) {
        await addDimensionXP(dimensionId as DimensionId, xpAwarded)
        setDimensionXP((prev) => ({
          ...prev,
          [dimensionId]: (prev[dimensionId as DimensionId] || 0) + xpAwarded,
        }))
      } else {
        setDimensionXP((prev) => addXP(prev, dimensionId as DimensionId, xpAwarded))
      }

      setHighlightDimension(dimensionId)
      setTimeout(() => setHighlightDimension(null), 3000)

      const toast: XPToast = {
        id: `${Date.now()}`,
        amount: xpAwarded,
        dimensionId,
        x: Math.random() * 40 + 30,
        y: Math.random() * 20 + 40,
      }
      setXpToasts((prev) => [...prev, toast])
      setTimeout(() => {
        setXpToasts((prev) => prev.filter((t) => t.id !== toast.id))
      }, 2500)
    }

    setActiveQuest(null)
  }

  const totalXP = getTotalXP(dimensionXP)
  const level = getLevel(totalXP)
  const { current: xpProgress, needed: xpNeeded } = getXPToNextLevel(totalXP)
  const allComplete = quests.length > 0 && quests.every((q) => completedIds.has(q.id))

  if (!mounted) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: '#0D0820',
        }}
      />
    )
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0D0820',
        color: '#F0ECFF',
        fontFamily: "'Space Grotesk', system-ui, sans-serif",
        padding: '32px 24px',
        maxWidth: '680px',
        margin: '0 auto',
        position: 'relative',
      }}
    >
      {xpToasts.map((toast) => (
        <div
          key={toast.id}
          style={{
            position: 'fixed',
            left: `${toast.x}%`,
            top: `${toast.y}%`,
            fontSize: '22px',
            fontWeight: 700,
            color: '#FFB347',
            pointerEvents: 'none',
            zIndex: 200,
            animation: 'xpFloat 2.5s ease-out forwards',
            textShadow: '0 0 20px rgba(255,179,71,0.8)',
          }}
        >
          +{toast.amount} XP ✦
        </div>
      ))}

      <div style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div
              style={{
                fontSize: '11px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '2px',
                color: '#9B8EC4',
                marginBottom: '4px',
              }}
            >
              Protagonist
            </div>
            <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#F0ECFF', margin: 0 }}>
              Today&apos;s Quests
            </h1>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '22px', fontWeight: 700, color: '#FF7A65' }}>
              LVL {level}
            </div>
            <div style={{ fontSize: '11px', color: '#6B5E8C' }}>
              {xpProgress}/{xpNeeded} XP
            </div>
          </div>
        </div>

        <div
          style={{
            height: '4px',
            background: 'rgba(255,255,255,0.06)',
            borderRadius: '2px',
            marginTop: '12px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${(xpProgress / xpNeeded) * 100}%`,
              background: 'linear-gradient(90deg, #7B3FE4, #FF7A65)',
              borderRadius: '2px',
              transition: 'width 0.6s ease',
            }}
          />
        </div>
      </div>

      <DimensionBars xp={dimensionXP} highlightDimension={highlightDimension} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0, marginBottom: 8 }}>
        <ErrorBoundary>
          <OuraWidget />
        </ErrorBoundary>
        <ErrorBoundary>
          <CalendarWidget />
        </ErrorBoundary>
      </div>

      {quests.length === 0 || showCheckin ? (
        <div>
          <div
            style={{
              fontSize: '14px',
              color: '#9B8EC4',
              marginBottom: '20px',
              lineHeight: 1.6,
            }}
          >
            Talk to Arc. Tell it how you&apos;re feeling — it&apos;ll generate your 3
            missions for today.
          </div>
          <VoiceCheckin onQuestsGenerated={handleQuestsGenerated} />
        </div>
      ) : (
        <div>
          {lastCheckIn && (
            <div
              style={{
                background: 'rgba(123,63,228,0.1)',
                border: '1px solid rgba(123,63,228,0.25)',
                borderRadius: '16px',
                padding: '20px 24px',
                marginBottom: '24px',
              }}
            >
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: '#A87EF8',
                  letterSpacing: '1px',
                  textTransform: 'uppercase',
                  marginBottom: '8px',
                }}
              >
                Arc · Energy {lastCheckIn.energyLevel}/10 · {lastCheckIn.mood}
              </div>
              <p
                style={{
                  fontSize: '14px',
                  color: '#F0ECFF',
                  lineHeight: 1.65,
                  fontStyle: 'italic',
                  margin: 0,
                }}
              >
                &ldquo;{lastCheckIn.arcResponse}&rdquo;
              </p>
            </div>
          )}

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '20px',
            }}
          >
            <div style={{ fontSize: '13px', color: '#9B8EC4' }}>
              {completedIds.size > 0
                ? `${Math.min(completedIds.size, quests.length)} of ${quests.length} complete`
                : `${quests.length} quests awaiting`}
            </div>
            <button
              type="button"
              onClick={() => setShowCheckin(true)}
              style={{
                background: 'transparent',
                color: '#9B8EC4',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '100px',
                padding: '7px 16px',
                fontSize: '12px',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              New check-in
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {quests.map((quest) => (
              <QuestCard
                key={quest.id}
                quest={quest}
                isCompleted={completedIds.has(quest.id)}
                onComplete={handleCompleteClick}
              />
            ))}
          </div>

          {allComplete && (
            <div
              style={{
                marginTop: '32px',
                padding: '28px',
                background: 'rgba(110,231,164,0.06)',
                border: '1px solid rgba(110,231,164,0.2)',
                borderRadius: '16px',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '36px', marginBottom: '10px' }}>🏆</div>
              <div
                style={{
                  fontSize: '18px',
                  fontWeight: 700,
                  color: '#6EE7A4',
                  marginBottom: '6px',
                }}
              >
                All quests complete.
              </div>
              <div style={{ fontSize: '14px', color: '#9B8EC4' }}>
                Arc witnessed everything. Come back tomorrow.
              </div>
            </div>
          )}
        </div>
      )}

      {activeQuest && (
        <QuestProof
          quest={activeQuest}
          onComplete={handleProofComplete}
          onClose={() => setActiveQuest(null)}
        />
      )}

      <style>{`
        @keyframes xpFloat {
          0% { opacity: 0; transform: translateY(0) scale(0.8); }
          20% { opacity: 1; transform: translateY(-10px) scale(1.1); }
          80% { opacity: 1; transform: translateY(-50px) scale(1); }
          100% { opacity: 0; transform: translateY(-80px) scale(0.9); }
        }
      `}</style>
    </div>
  )
}
