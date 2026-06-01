'use client'

import { useEffect, useState } from 'react'

export function useDimensionContext<T extends object>(
  userId: string,
  dimensionId: string
): [T | null, boolean, (data: T) => Promise<void>] {
  const [ctx, setCtx] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void fetch(`/api/dimension/context?userId=${encodeURIComponent(userId)}&dimensionId=${encodeURIComponent(dimensionId)}`)
      .then(r => r.json())
      .then((data: T | null) => { setCtx(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [userId, dimensionId])

  async function save(data: T) {
    setCtx(data)
    await fetch('/api/dimension/context', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, dimensionId, data }),
    })
  }

  return [ctx, loading, save]
}
