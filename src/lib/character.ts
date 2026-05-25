import { getTier } from '@/lib/xp'

export type Dimension =
  | 'career'
  | 'social'
  | 'wealth'
  | 'vitality'
  | 'mind'
  | 'love'
  | 'family'

export interface CharacterConfig {
  name: string
  dimension: Dimension
  color: string
  bgColor: string
  badgeBg: string
  badgeBorder: string
  tierLabels: [string, string, string]
  /** memory dimension_id used in dimension_memories table */
  memoryId: string
  /** short description shown on Settings page */
  tagline: string
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
    memoryId: 'create',
    tagline: 'Work, career & purpose',
  },
  social: {
    name: 'Echo',
    dimension: 'social',
    color: '#F0997B',
    bgColor: 'rgba(240,153,123,0.12)',
    badgeBg: 'rgba(240,153,123,0.12)',
    badgeBorder: 'rgba(240,153,123,0.28)',
    tierLabels: ['Newcomer', 'Connector', 'Community Sage'],
    memoryId: 'social',
    tagline: 'Friendships & community',
  },
  wealth: {
    name: 'Vault',
    dimension: 'wealth',
    color: '#1D9E75',
    bgColor: 'rgba(29,158,117,0.12)',
    badgeBg: 'rgba(29,158,117,0.12)',
    badgeBorder: 'rgba(29,158,117,0.28)',
    tierLabels: ['Saver', 'Investor', 'Financially Free'],
    memoryId: 'wealth',
    tagline: 'Money, savings & growth',
  },
  vitality: {
    name: 'Blaze',
    dimension: 'vitality',
    color: '#F43F5E',
    bgColor: 'rgba(244,63,94,0.12)',
    badgeBg: 'rgba(244,63,94,0.12)',
    badgeBorder: 'rgba(244,63,94,0.28)',
    tierLabels: ['Spark', 'Ember', 'Flame'],
    memoryId: 'vitality',
    tagline: 'Body, movement & energy',
  },
  mind: {
    name: 'Sage',
    dimension: 'mind',
    color: '#818CF8',
    bgColor: 'rgba(129,140,248,0.12)',
    badgeBg: 'rgba(129,140,248,0.12)',
    badgeBorder: 'rgba(129,140,248,0.28)',
    tierLabels: ['Curious', 'Scholar', 'Illuminated'],
    memoryId: 'mind',
    tagline: 'Learning, focus & clarity',
  },
  love: {
    name: 'Sol',
    dimension: 'love',
    color: '#F472B6',
    bgColor: 'rgba(244,114,182,0.12)',
    badgeBg: 'rgba(244,114,182,0.12)',
    badgeBorder: 'rgba(244,114,182,0.28)',
    tierLabels: ['Tender', 'Devoted', 'Radiant'],
    memoryId: 'love',
    tagline: 'Romance & intimacy',
  },
  family: {
    name: 'Root',
    dimension: 'family',
    color: '#4ADE80',
    bgColor: 'rgba(74,222,128,0.12)',
    badgeBg: 'rgba(74,222,128,0.12)',
    badgeBorder: 'rgba(74,222,128,0.28)',
    tierLabels: ['Seedling', 'Grounded', 'Rooted'],
    memoryId: 'family',
    tagline: 'Family & home',
  },
}

export const ALL_DIMENSIONS: Dimension[] = [
  'career',
  'social',
  'wealth',
  'vitality',
  'mind',
  'love',
  'family',
]

export const DEFAULT_PINNED_DIMENSIONS: Dimension[] = ['career', 'social', 'wealth']

export function getCharacterTierLabel(dimension: Dimension, xp: number): string {
  const tier = getTier(xp)
  return CHARACTERS[dimension].tierLabels[tier - 1]
}
