import type { Load, SpotRate, Driver, DispatchDecision } from './types'

export function determineStrategy(
  load: Load,
  spotRate: SpotRate | null,
  driver: Driver
): DispatchDecision {
  if (!spotRate) {
    return {
      load,
      driver,
      spotRate: null,
      strategy: 'accept',
      targetRate: load.posted_rate,
      reason: 'No spot rate data available — accept posted rate',
    }
  }

  if (load.posted_rate >= spotRate.high_rate) {
    return {
      load,
      driver,
      spotRate,
      strategy: 'accept',
      targetRate: load.posted_rate,
      reason: `Posted rate $${load.posted_rate} >= high spot $${spotRate.high_rate}`,
    }
  }

  if (load.posted_rate >= spotRate.avg_rate) {
    return {
      load,
      driver,
      spotRate,
      strategy: 'accept',
      targetRate: load.posted_rate,
      reason: `Posted rate $${load.posted_rate} >= avg spot $${spotRate.avg_rate}`,
    }
  }

  return {
    load,
    driver,
    spotRate,
    strategy: 'negotiate',
    targetRate: spotRate.avg_rate,
    reason: `Posted rate $${load.posted_rate} < avg spot $${spotRate.avg_rate} — negotiate to $${spotRate.avg_rate}`,
  }
}
