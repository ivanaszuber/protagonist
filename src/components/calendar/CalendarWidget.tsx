'use client'

import { useEffect, useState, useCallback } from 'react'
import { getUserId } from '@/lib/user'

interface CalendarEvent {
  id?: string
  google_event_id?: string
  title: string
  start_time: string | null
  end_time: string | null
  all_day: boolean
  location: string | null
  event_date: string
  calendar_name?: string
}

function eventKey(event: CalendarEvent): string {
  return event.id ?? event.google_event_id ?? `${event.title}-${event.start_time}`
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function isNow(event: CalendarEvent): boolean {
  if (!event.start_time || !event.end_time) return false
  const now = Date.now()
  return (
    now >= new Date(event.start_time).getTime() &&
    now <= new Date(event.end_time).getTime()
  )
}

function isNext(events: CalendarEvent[], event: CalendarEvent): boolean {
  const upcoming = events.filter(
    (e) => e.start_time && new Date(e.start_time).getTime() > Date.now()
  )
  return eventKey(upcoming[0] ?? {}) === eventKey(event)
}

export default function CalendarWidget() {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [connected, setConnected] = useState<boolean | null>(null)
  const [syncing, setSyncing] = useState(false)

  const checkAndSync = useCallback(async () => {
    const userId = getUserId()
    setSyncing(true)
    try {
      const statusRes = await fetch(
        `/api/calendar/sync?userId=${encodeURIComponent(userId)}`
      )
      const status = await statusRes.json()

      if (!status.connected) {
        setConnected(false)
        setEvents([])
        return
      }

      setConnected(true)

      const syncRes = await fetch('/api/calendar/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      const syncData = await syncRes.json()

      const today = new Date().toISOString().split('T')[0]
      if (syncData.events) {
        setEvents(
          syncData.events.filter((e: CalendarEvent) => e.event_date === today)
        )
      } else if (status.events) {
        setEvents(status.events)
      }
    } catch (err) {
      console.error('Calendar widget error:', err)
    } finally {
      setSyncing(false)
    }
  }, [])

  useEffect(() => {
    void checkAndSync()
  }, [checkAndSync])

  function connectCalendar() {
    const userId = getUserId()
    window.location.href = `/api/calendar/connect?userId=${encodeURIComponent(userId)}`
  }

  const cardStyle = {
    background: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    padding: 16,
    border: '1px solid rgba(255,255,255,0.08)',
    marginBottom: 24,
  }

  if (connected === null || syncing) {
    return (
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: 18 }}>📅</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#9B8EC4' }}>Calendar</span>
          <span
            style={{
              fontSize: 11,
              color: '#6B5E8C',
              marginLeft: 'auto',
              animation: 'pulse 1.5s ease-in-out infinite',
            }}
          >
            syncing...
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                height: 32,
                borderRadius: 10,
                background: 'rgba(255,255,255,0.05)',
              }}
            />
          ))}
        </div>
      </div>
    )
  }

  if (!connected) {
    return (
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 18 }}>📅</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#9B8EC4' }}>
            Google Calendar
          </span>
        </div>
        <p style={{ fontSize: 12, color: '#6B5E8C', marginBottom: 12, lineHeight: 1.5 }}>
          Let the Oracle see your day so it can fit quests around your schedule.
        </p>
        <button
          type="button"
          onClick={connectCalendar}
          style={{
            width: '100%',
            padding: '10px 16px',
            borderRadius: 12,
            border: 'none',
            background: 'linear-gradient(90deg, #2563eb, #06b6d4)',
            color: '#fff',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Connect Google Calendar
        </button>
      </div>
    )
  }

  if (events.length === 0) {
    return (
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 18 }}>📅</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#F0ECFF' }}>Calendar</span>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: '#6EE7A4',
              marginLeft: 'auto',
            }}
            title="Connected"
          />
        </div>
        <p style={{ fontSize: 12, color: '#9B8EC4', fontStyle: 'italic', lineHeight: 1.5 }}>
          No events today — full day to own.
        </p>
      </div>
    )
  }

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 18 }}>📅</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#F0ECFF' }}>Today</span>
        <span style={{ fontSize: 11, color: '#6B5E8C', marginLeft: 'auto' }}>
          {events.length} event{events.length > 1 ? 's' : ''}
        </span>
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: '#6EE7A4',
          }}
          title="Connected"
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {events.map((event) => {
          const happening = isNow(event)
          const next = isNext(events, event)
          const past =
            event.end_time && new Date(event.end_time).getTime() < Date.now()

          return (
            <div
              key={eventKey(event)}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                borderRadius: 12,
                padding: '8px 10px',
                opacity: past ? 0.4 : 1,
                background: happening
                  ? 'rgba(123, 63, 228, 0.2)'
                  : next
                    ? 'rgba(255,255,255,0.05)'
                    : 'transparent',
                border: happening
                  ? '1px solid rgba(123, 63, 228, 0.3)'
                  : next
                    ? '1px solid rgba(255,255,255,0.1)'
                    : '1px solid transparent',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  minWidth: 42,
                  marginTop: 2,
                }}
              >
                {event.all_day ? (
                  <span style={{ fontSize: 11, color: '#6B5E8C' }}>All day</span>
                ) : event.start_time ? (
                  <>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: happening ? '#A87EF8' : '#9B8EC4',
                      }}
                    >
                      {formatTime(event.start_time)}
                    </span>
                    {event.end_time && (
                      <span style={{ fontSize: 11, color: '#6B5E8C' }}>
                        {formatTime(event.end_time)}
                      </span>
                    )}
                  </>
                ) : null}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <p
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: happening ? '#F0ECFF' : '#9B8EC4',
                      margin: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {event.title}
                  </p>
                  {happening && (
                    <span
                      style={{
                        flexShrink: 0,
                        fontSize: 10,
                        background: '#7B3FE4',
                        color: '#fff',
                        padding: '2px 6px',
                        borderRadius: 999,
                        fontWeight: 700,
                      }}
                    >
                      NOW
                    </span>
                  )}
                  {next && !happening && (
                    <span style={{ flexShrink: 0, fontSize: 10, color: '#00D4B8' }}>
                      next
                    </span>
                  )}
                </div>
                {event.location && (
                  <p
                    style={{
                      fontSize: 11,
                      color: '#6B5E8C',
                      margin: '2px 0 0',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    📍 {event.location}
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
