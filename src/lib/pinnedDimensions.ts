import {
  type Dimension,
  DEFAULT_PINNED_DIMENSIONS,
  ALL_DIMENSIONS,
} from '@/lib/character'

const STORAGE_KEY = 'protagonist:pinned_dimensions'

export function getPinnedDimensions(): [Dimension, Dimension, Dimension] {
  if (typeof window === 'undefined') {
    return [...DEFAULT_PINNED_DIMENSIONS] as [Dimension, Dimension, Dimension]
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return [...DEFAULT_PINNED_DIMENSIONS] as [Dimension, Dimension, Dimension]
    const parsed = JSON.parse(raw) as unknown[]
    const valid = parsed
      .filter((d): d is Dimension => ALL_DIMENSIONS.includes(d as Dimension))
      .slice(0, 3) as Dimension[]
    while (valid.length < 3) {
      const fallback = DEFAULT_PINNED_DIMENSIONS.find((d) => !valid.includes(d))
      if (fallback) valid.push(fallback)
      else break
    }
    return valid as [Dimension, Dimension, Dimension]
  } catch {
    return [...DEFAULT_PINNED_DIMENSIONS] as [Dimension, Dimension, Dimension]
  }
}

export function savePinnedDimensions(dims: Dimension[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(dims.slice(0, 3)))
}
