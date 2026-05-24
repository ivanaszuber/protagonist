export const DIMENSIONS = {
  vitality: {
    id: 'vitality' as const,
    name: 'Vitality',
    champion: 'Blaze',
    emoji: '💪',
    color: '#FF6B35',
    glowColor: 'rgba(255, 107, 53, 0.25)',
    description: 'Energy, movement, sleep, recovery',
  },
  mind: {
    id: 'mind' as const,
    name: 'Mind',
    champion: 'Sage',
    emoji: '🧠',
    color: '#A87EF8',
    glowColor: 'rgba(168, 126, 248, 0.25)',
    description: 'Meditation, learning, focus, growth',
  },
  create: {
    id: 'create' as const,
    name: 'Create',
    champion: 'Forge',
    emoji: '✨',
    color: '#FFB347',
    glowColor: 'rgba(255, 179, 71, 0.25)',
    description: 'Work, projects, building, shipping',
  },
  social: {
    id: 'social' as const,
    name: 'Social',
    champion: 'Echo',
    emoji: '🤝',
    color: '#6EE7A4',
    glowColor: 'rgba(110, 231, 164, 0.25)',
    description: 'Friends, community, connection',
  },
  love: {
    id: 'love' as const,
    name: 'Love',
    champion: 'Sol',
    emoji: '💕',
    color: '#FF7A65',
    glowColor: 'rgba(255, 122, 101, 0.25)',
    description: 'Relationship, romance, partnership',
  },
  family: {
    id: 'family' as const,
    name: 'Family',
    champion: 'Root',
    emoji: '👧',
    color: '#C4A8FF',
    glowColor: 'rgba(196, 168, 255, 0.25)',
    description: 'Daughter, family, intentional time',
  },
  wealth: {
    id: 'wealth' as const,
    name: 'Wealth',
    champion: 'Vault',
    emoji: '💰',
    color: '#6EE7A4',
    glowColor: 'rgba(110, 231, 164, 0.25)',
    description: 'Finances, career, FIRE progress',
  },
} as const

export type DimensionId = keyof typeof DIMENSIONS

export function getDimension(id: DimensionId) {
  return DIMENSIONS[id]
}
