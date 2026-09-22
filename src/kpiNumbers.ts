import type { KpiMetric } from './types.js';

export const isKpiNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

export const hasUniqueKpiNumbers = (kpis: readonly { displayNumber: number | null }[]): boolean => {
  const numbers = kpis.map((kpi) => kpi.displayNumber).filter(isKpiNumber);
  return new Set(numbers).size === numbers.length;
};

/** Leave unassigned numbers blank; the first duplicate keeps its number. */
export const reconcileKpiNumbers = <T extends { displayNumber: number | null }>(kpis: T[]): T[] => {
  const seen = new Set<number>();
  return kpis.map((kpi) => {
    if (isKpiNumber(kpi.displayNumber) && !seen.has(kpi.displayNumber)) {
      seen.add(kpi.displayNumber);
      return kpi;
    }
    return kpi.displayNumber === null ? kpi : { ...kpi, displayNumber: null };
  });
};

export const kpiNumberError = (text: string, kpiId: string, kpis: readonly KpiMetric[]): string => {
  if (!text.trim()) return '';
  if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(text.trim()) || !isKpiNumber(Number(text))) {
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
  return [...kpis].sort((left, right) => {
    const primary = primaryCompare?.(left, right) || 0;
    if (primary) return primary;
    // Unnumbered rows stay last in either direction, retaining their stored order.
    if (left.displayNumber === null) return right.displayNumber === null ? 0 : 1;
    if (right.displayNumber === null) return -1;
    return (order === 'desc' ? -1 : 1) * (left.displayNumber - right.displayNumber);
  });
};
