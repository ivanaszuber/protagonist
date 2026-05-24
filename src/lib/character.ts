import { getTier } from '@/lib/xp'

export type Dimension = 'career' | 'social' | 'wealth'

export interface CharacterConfig {
  name: string
  dimension: Dimension
  color: string
  bgColor: string
  badgeBg: string
  badgeBorder: string
  tierLabels: [string, string, string]
}

export const CHARACTERS: Record<Dimension, CharacterConfig> = {
  career: {
    name: 'Forge',
    dimension: 'career',
    color: '#EF9F27',
    bgColor: 'rgba(239,159,39,0.12)',
    badgeBg: 'rgba(239,159,39,0.12)',
    badgeBorder: 'rgba(239,159,39,0.28)',
    tierLabels: ['Apprentice Maker', 'Craftsman', 'Master Maker'],
  },
  social: {
    name: 'Echo',
    dimension: 'social',
    color: '#F0997B',
    bgColor: 'rgba(240,153,123,0.12)',
    badgeBg: 'rgba(240,153,123,0.12)',
    badgeBorder: 'rgba(240,153,123,0.28)',
    tierLabels: ['Newcomer', 'Connector', 'Community Sage'],
  },
  wealth: {
    name: 'Vault',
    dimension: 'wealth',
    color: '#1D9E75',
    bgColor: 'rgba(29,158,117,0.12)',
    badgeBg: 'rgba(29,158,117,0.12)',
    badgeBorder: 'rgba(29,158,117,0.28)',
    tierLabels: ['Saver', 'Investor', 'Financially Free'],
  },
}

export function getCharacterTierLabel(dimension: Dimension, xp: number): string {
  const tier = getTier(xp)
  return CHARACTERS[dimension].tierLabels[tier - 1]
}
