import { DimensionId } from '@/types'

const DIMENSION_KEYWORDS: Record<DimensionId, string[]> = {
  vitality: [
    'sleep',
    'energy',
    'tired',
    'exhausted',
    'workout',
    'exercise',
    'run',
    'walk',
    'gym',
    'recovery',
    'oura',
    'hrv',
    'readiness',
    'body',
    'movement',
    'steps',
    'rest',
    'fatigue',
    'sick',
    'ill',
    'sauna',
    'cold shower',
    'pt session',
  ],
  mind: [
    'focus',
    'anxious',
    'anxiety',
    'stress',
    'stressed',
    'overwhelmed',
    'scattered',
    'meditation',
    'meditate',
    'reading',
    'learn',
    'learning',
    'study',
    'think',
    'thinking',
    'mental',
    'clarity',
    'mind',
    'worried',
    'worry',
    'brain',
    'deep work',
  ],
  create: [
    'work',
    'project',
    'build',
    'building',
    'ship',
    'shipping',
    'protagonist',
    'code',
    'coding',
    'create',
    'creating',
    'design',
    'write',
    'writing',
    'deadline',
    'idea',
    'ideas',
    'startup',
    'product',
    'feature',
    'launch',
  ],
  social: [
    'friend',
    'friends',
    'social',
    'meetup',
    'event',
    'people',
    'lonely',
    'alone',
    'community',
    'connection',
    'party',
    'drinks',
    'coffee',
    'networking',
    'went out',
    'stayed home',
    'cancel',
    'cancelled',
  ],
  love: [
    'partner',
    'relationship',
    'romance',
    'date',
    'intimacy',
    'together',
    'boyfriend',
    'girlfriend',
    'husband',
    'wife',
    'couple',
    'argument',
    'fight',
    'quality time',
    'connected',
    'disconnected',
  ],
  family: [
    'zara',
    "zara's",
    'daughter',
    'school',
    'autism',
    'autistic',
    'parenting',
    'parent',
    'family',
    'mum',
    'mom',
    'morning routine',
    'meltdown',
    'sensory',
    'pickup',
    'drop off',
    'homework',
    'teacher',
    'weekend with',
    'after school',
  ],
  wealth: [
    'money',
    'finance',
    'financial',
    'savings',
    'save',
    'invest',
    'investing',
    'fire',
    'salary',
    'income',
    'expense',
    'budget',
    'portfolio',
    'stocks',
    'index fund',
    'pension',
    'freelance',
    'side income',
    'career',
    'promotion',
    'raise',
    'rich',
    'wealthy',
    'afford',
    'cost',
  ],
}

const HARD_OVERRIDES: Partial<Record<DimensionId, string[]>> = {
  family: ['zara', "zara's", 'my daughter'],
  wealth: ['fire', 'my fire number', 'financial independence'],
}

export function detectDimensions(message: string): DimensionId[] {
  const lower = message.toLowerCase()
  const detected = new Set<DimensionId>()

  for (const [dimension, keywords] of Object.entries(HARD_OVERRIDES)) {
    if (keywords!.some((kw) => lower.includes(kw))) {
      detected.add(dimension as DimensionId)
    }
  }

  for (const [dimension, keywords] of Object.entries(DIMENSION_KEYWORDS)) {
    if (keywords.some((keyword) => lower.includes(keyword))) {
      detected.add(dimension as DimensionId)
    }
  }

  if (detected.size === 0) {
    detected.add('mind')
  }

  return Array.from(detected)
}

export function isCheckIn(message: string): boolean {
  const lower = message.toLowerCase()
  const checkInSignals = [
    'good morning',
    'morning check',
    'check in',
    'how i feel',
    'feeling today',
    'starting my day',
    'just woke',
    'energy today',
  ]
  return checkInSignals.some((s) => lower.includes(s))
}
