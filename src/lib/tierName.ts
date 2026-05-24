export type CharacterSlug = 'forge' | 'echo' | 'vault'

const TIER_NAMES: Record<CharacterSlug, string[]> = {
  forge: ['Apprentice Maker', 'Junior Maker', 'Maker', 'Senior Maker', 'Master Maker'],
  echo: ['Newcomer', 'Regular', 'Connector', 'Influencer', 'Icon'],
  vault: ['Saver', 'Builder', 'Investor', 'Wealth Manager', 'Financier'],
}

export function getTierName(level: number, character: CharacterSlug): string {
  const list = TIER_NAMES[character]
  const index = Math.min(Math.max(level, 1) - 1, list.length - 1)
  return list[index] ?? list[0]
}

export const DIMENSION_TO_SLUG: Record<'career' | 'social' | 'wealth', CharacterSlug> = {
  career: 'forge',
  social: 'echo',
  wealth: 'vault',
}
