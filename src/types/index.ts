export type DimensionId =
  | 'vitality'
  | 'mind'
  | 'create'
  | 'social'
  | 'love'
  | 'family'
  | 'wealth'

export interface Quest {
  id: string
  dimensionId: DimensionId
  title: string
  description: string
  xpReward: number
  energyRequired: number
  championName: string
}

export interface CheckInData {
  energyLevel: number
  mood: string
  socialBattery: number
  mainConcern: string
  mainDesire: string
  arcResponse: string
}

export interface CompletionResult {
  completed: boolean
  partialCredit: boolean
  xpAwarded: number
  arcResponse: string
  encouragement: string
}

export interface DimensionXPState {
  vitality: number
  mind: number
  create: number
  social: number
  love: number
  family: number
  wealth: number
}

export const INITIAL_XP: DimensionXPState = {
  vitality: 0,
  mind: 0,
  create: 0,
  social: 0,
  love: 0,
  family: 0,
  wealth: 0,
}
