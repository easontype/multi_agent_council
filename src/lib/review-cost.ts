export interface ReviewCostEstimate {
  minUsd: number
  maxUsd: number
  turnsEstimate: number
}

export function estimateHostedReviewCost(activeAgents: number, rounds: 1 | 2): ReviewCostEstimate {
  const safeAgents = Math.max(1, activeAgents)
  const effectiveRoundFactor = rounds === 2 ? 1.4 : 1

  const minReviewerCostPerAgent = 0.013
  const maxReviewerCostPerAgent = 0.024
  const moderatorMin = 0.015
  const moderatorMax = 0.03

  const minUsd = Number(((safeAgents * minReviewerCostPerAgent * effectiveRoundFactor) + moderatorMin).toFixed(3))
  const maxUsd = Number(((safeAgents * maxReviewerCostPerAgent * effectiveRoundFactor) + moderatorMax).toFixed(3))

  return {
    minUsd,
    maxUsd,
    turnsEstimate: Math.max(safeAgents, Math.round(safeAgents * effectiveRoundFactor)),
  }
}
