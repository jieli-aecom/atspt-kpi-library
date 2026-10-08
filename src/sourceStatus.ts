import type { DataSourceField, KpiPoolConfig, KpiSourceItem } from './types.js';

export const sourceStatuses = ['Not Ready', 'With Sample', 'Ready'] as const;
export type SourceStatus = typeof sourceStatuses[number];
export type SourceStatusFilter = '' | 'With Sample' | 'Ready';
export const sourceStatusColors: Record<SourceStatus, string> = {
  'Not Ready': '#6b7280', 'With Sample': '#eab308', Ready: '#16a34a'
};

export const fieldStatus = (field?: Partial<Pick<DataSourceField, 'status'>>): SourceStatus =>
  sourceStatuses.find((status) => status === field?.status) ?? 'Not Ready';

// Readiness describes the table fields selected in this source cell. Other
// source types have no field status; an empty set must not imply readiness.
export function sourceStatus(config: Pick<KpiPoolConfig, 'dataSources'>, sources: readonly KpiSourceItem[]): SourceStatus {
  const fields = sources.filter((source) => source.type === 'dataField');
  if (!fields.length) return 'Not Ready';
  return sourceStatuses[Math.min(...fields.map((source) => sourceStatuses.indexOf(fieldStatus(
    config.dataSources.find((table) => table.id === source.dataSourceId)?.fields.find((field) => field.id === source.fieldId)
  ))))];
}

export const meetsSourceStatus = (status: SourceStatus | undefined, minimum: SourceStatusFilter) =>
  !minimum || sourceStatuses.indexOf(status ?? 'Not Ready') >= sourceStatuses.indexOf(minimum);
