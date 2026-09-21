import { fieldFlags, fieldFlagDefinitions } from './fieldFlags.js';
import type { KpiMetric, KpiPoolConfig, KpiSourceItem } from './types.js';

export const sourceFlagOptions = fieldFlagDefinitions;
export type SourceFlag = typeof sourceFlagOptions[number]['key'];

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
  keys: new Set(kpi.sources.map(sourceFilterKey)),
  flags: new Set(kpi.sources.flatMap((source) => source.type === 'dataField'
    ? fieldFlags(config.dataSources.find((table) => table.id === source.dataSourceId)?.fields.find((field) => field.id === source.fieldId)).map((flag) => flag.key)
    : []))
});

export const matchesSourceFilters = (
  entry: ReturnType<typeof sourceFilterEntry> | undefined,
  selectedKeys: ReadonlySet<string>,
  selectedFlags: readonly SourceFlag[]
) => (!selectedKeys.size || [...selectedKeys].some((key) => entry?.keys.has(key)))
  && selectedFlags.every((flag) => entry?.flags.has(flag));
