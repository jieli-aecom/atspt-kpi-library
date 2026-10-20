import type { DataSourceField, KpiPoolConfig, KpiSourceItem } from './types.js';

export const sourceStatuses = ['Not Ready', 'With Sample', 'Ready'] as const;
export type SourceStatus = typeof sourceStatuses[number];
export type SourceStatusFilter = '' | 'With Sample' | 'Ready';
export const sourceStatusColors: Record<SourceStatus, string> = {
  'Not Ready': '#6b7280', 'With Sample': '#eab308', Ready: '#16a34a'
};

export const fieldStatus = (field?: Partial<Pick<DataSourceField, 'status'>>): SourceStatus =>
  sourceStatuses.find((status) => status === field?.status) ?? 'Not Ready';

// Readiness is limited by every selected table field and prerequisite KPI.
// Other source types have no status; an empty set must not imply readiness.
export function sourceStatus(config: Pick<KpiPoolConfig, 'dataSources' | 'kpis'>, sources: readonly KpiSourceItem[]): SourceStatus {
  const kpisById = new Map(config.kpis.map((kpi) => [kpi.id, kpi]));
  const resolved = new Map<string, SourceStatus>();
  const resolving = new Set<string>();

  const prerequisiteStatus = (kpiId: string): SourceStatus => {
    const cached = resolved.get(kpiId);
    if (cached) return cached;
    const kpi = kpisById.get(kpiId);
    // Missing prerequisites and dependency cycles cannot establish readiness.
    if (!kpi || resolving.has(kpiId)) return 'Not Ready';
    resolving.add(kpiId);
    const status = selectedSourceStatus(kpi.sources);
    resolving.delete(kpiId);
    resolved.set(kpiId, status);
    return status;
  };

  const selectedSourceStatus = (selected: readonly KpiSourceItem[]): SourceStatus => {
    let minimum = sourceStatuses.length - 1;
    let hasStatus = false;
    for (const source of selected) {
      if (source.type !== 'dataField' && source.type !== 'kpi') continue;
      hasStatus = true;
      const status = source.type === 'kpi' ? prerequisiteStatus(source.kpiId) : fieldStatus(
        config.dataSources.find((table) => table.id === source.dataSourceId)?.fields.find((field) => field.id === source.fieldId)
      );
      minimum = Math.min(minimum, sourceStatuses.indexOf(status));
      if (minimum === 0) return 'Not Ready';
    }
    return hasStatus ? sourceStatuses[minimum] : 'Not Ready';
  };

  return selectedSourceStatus(sources);
}

export const meetsSourceStatus = (status: SourceStatus | undefined, minimum: SourceStatusFilter) =>
  !minimum || sourceStatuses.indexOf(status ?? 'Not Ready') >= sourceStatuses.indexOf(minimum);
