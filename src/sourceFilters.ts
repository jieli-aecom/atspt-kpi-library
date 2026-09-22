import { fieldFlags, fieldFlagDefinitions } from './fieldFlags.js';
import type { KpiMetric, KpiPoolConfig, KpiSourceItem } from './types.js';

export const sourceFlagOptions = fieldFlagDefinitions;
export type SourceFlag = typeof sourceFlagOptions[number]['key'];
export const sourceTableFilterKey = (tableId: string) => JSON.stringify(['table', tableId]);

// Match catalog identities, independently of row IDs, notation and scenario slots.
export const sourceFilterKey = (source: KpiSourceItem): string => {
  switch (source.type) {
    case 'dataField': return JSON.stringify([source.type, source.dataSourceId, source.fieldId]);
    case 'kpi': return JSON.stringify([source.type, source.kpiId]);
    case 'lookup': return JSON.stringify([source.type, source.lookupId]);
    case 'variable': return JSON.stringify([source.type, source.variableId]);
    case 'custom': return JSON.stringify([source.type, source.name.trim()]);
  }
};

export const sourceFilterEntry = (config: KpiPoolConfig, kpi: KpiMetric) => ({
  keys: new Set(kpi.sources.flatMap((source) => source.type === 'dataField'
    ? [sourceFilterKey(source), sourceTableFilterKey(source.dataSourceId)] : [sourceFilterKey(source)])),
  flags: new Set(kpi.sources.flatMap((source) => {
    if (source.type !== 'dataField') return [];
    const table = config.dataSources.find((table) => table.id === source.dataSourceId);
    return [...fieldFlags(table?.fields.find((field) => field.id === source.fieldId)).map((flag) => flag.key),
      ...(table?.potentiallyUnavailable ? ['unavailable' as const] : [])];
  }))
});

export const matchesSourceFilters = (
  entry: ReturnType<typeof sourceFilterEntry> | undefined,
  selectedKeys: ReadonlySet<string>,
  selectedFlags: readonly SourceFlag[]
) => (!selectedKeys.size || [...selectedKeys].some((key) => entry?.keys.has(key)))
  && selectedFlags.every((flag) => entry?.flags.has(flag));
