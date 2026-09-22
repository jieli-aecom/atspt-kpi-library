import type { KpiMetric } from './types.js';

export const isKpiNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

/** Allocate positive integers without disturbing user-assigned numbers. */
export const nextKpiNumber = (kpis: readonly { displayNumber: number }[]): number => {
  const used = new Set(kpis.map((kpi) => kpi.displayNumber));
  let number = 1;
  while (used.has(number)) number += 1;
  return number;
};

/** Reserve all valid numbers before filling gaps; the first duplicate keeps its number. */
export const reconcileKpiNumbers = <T extends { displayNumber: number }>(kpis: T[]): T[] => {
  const reserved = new Set(kpis.map((kpi) => kpi.displayNumber).filter(isKpiNumber));
  const seen = new Set<number>();
  let next = 1;
  return kpis.map((kpi) => {
    if (isKpiNumber(kpi.displayNumber) && !seen.has(kpi.displayNumber)) {
      seen.add(kpi.displayNumber);
      return kpi;
    }
    while (reserved.has(next)) next += 1;
    const displayNumber = next++;
    reserved.add(displayNumber);
    seen.add(displayNumber);
    return { ...kpi, displayNumber };
  });
};

export const kpiNumberError = (text: string, kpiId: string, kpis: readonly KpiMetric[]): string => {
  if (!text.trim() || !/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(text.trim()) || !isKpiNumber(Number(text))) {
    return 'Enter a valid number.';
  }
  return kpis.some((kpi) => kpi.id !== kpiId && kpi.displayNumber === Number(text))
    ? `Number ${Number(text)} is already taken.` : '';
};

export const sortKpisByNumber = (
  kpis: KpiMetric[],
  order: 'asc' | 'desc' | undefined,
  primaryCompare?: (left: KpiMetric, right: KpiMetric) => number
): KpiMetric[] => {
  if (!order && !primaryCompare) return kpis;
  return [...kpis].sort((left, right) =>
    (primaryCompare?.(left, right) || 0) ||
    (order === 'desc' ? -1 : 1) * (left.displayNumber - right.displayNumber)
  );
};
