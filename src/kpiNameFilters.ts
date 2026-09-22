import type { KpiMetric } from './types.js';

export const matchesKpiNumberAndScenario = (
  kpi: KpiMetric,
  number: string,
  scenarios: readonly KpiMetric['scenarioType'][]
): boolean =>
  (!number.trim() || (Number.isFinite(Number(number)) && kpi.displayNumber === Number(number))) &&
  (!scenarios.length || scenarios.includes(kpi.scenarioType));
