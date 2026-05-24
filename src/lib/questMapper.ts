import type { Quest as AppQuest } from '@/types'
import type { DimensionId } from '@/types'
import type { Quest as ApiQuest } from '@/app/api/quests/generate/route'

function energyFromDifficulty(difficulty: ApiQuest['difficulty']): number {
  switch (difficulty) {
    case 'gentle':
      return 3
    case 'stretch':
      return 8
    default:
      return 5
  }
}

export function mapApiQuestToAppQuest(apiQuest: ApiQuest): AppQuest {
  return {
    id: apiQuest.id,
    dimensionId: apiQuest.dimension as DimensionId,
    title: apiQuest.title,
    description: apiQuest.description,
    xpReward: apiQuest.xpReward,
    energyRequired: energyFromDifficulty(apiQuest.difficulty),
    championName: apiQuest.champion,
  }
}

export function mapApiQuestsToAppQuests(apiQuests: ApiQuest[]): AppQuest[] {
  return apiQuests.map(mapApiQuestToAppQuest)
}
