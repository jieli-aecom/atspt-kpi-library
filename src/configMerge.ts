import { CURRENT_SCHEMA_VERSION, enumCategoryKeys, type KpiPoolConfig } from './types.js';

export type ConfigMergeResult = {
  config: KpiPoolConfig;
  importedKpiIds: Set<string>;
  addedKpis: number;
  updatedKpis: number;
  addedEnumOptions: number;
  enumConflicts: number;
  addedDataSources: number;
  dataSourceConflicts: number;
  addedLookups: number;
  lookupConflicts: number;
};

const sameValue = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);

export const mergeImportedConfig = (current: KpiPoolConfig, incoming: KpiPoolConfig): ConfigMergeResult => {
  let addedEnumOptions = 0;
  let enumConflicts = 0;
  const enums = Object.fromEntries(
    enumCategoryKeys.map((category) => {
      const currentById = new Map(current.enums[category].map((option) => [option.id, option]));
      const additions = incoming.enums[category].filter((option) => {
        const existing = currentById.get(option.id);
        if (!existing) {
          addedEnumOptions += 1;
          return true;
        }
        if (!sameValue(existing, option)) {
          enumConflicts += 1;
        }
        return false;
      });
      return [category, [...current.enums[category], ...additions]];
    })
  ) as KpiPoolConfig['enums'];

  const incomingById = new Map(incoming.kpis.map((kpi) => [kpi.id, kpi]));
  const currentIds = new Set(current.kpis.map((kpi) => kpi.id));
  const importedKpiIds = new Set<string>();
  let updatedKpis = 0;
  const mergedCurrentKpis = current.kpis.map((currentKpi) => {
    const importedKpi = incomingById.get(currentKpi.id);
    if (!importedKpi || Date.parse(importedKpi.lastModified) <= Date.parse(currentKpi.lastModified)) {
      return currentKpi;
    }

    importedKpiIds.add(importedKpi.id);
    updatedKpis += 1;
    return importedKpi;
  });
  const addedKpis = incoming.kpis.filter((kpi) => !currentIds.has(kpi.id));
  addedKpis.forEach((kpi) => importedKpiIds.add(kpi.id));

  let dataSourceConflicts = 0;
  const currentDataSourcesById = new Map(current.dataSources.map((source) => [source.id, source]));
  const addedDataSources = incoming.dataSources.filter((source) => {
    const existing = currentDataSourcesById.get(source.id);
    if (!existing) {
      return true;
    }
    if (!sameValue(existing, source)) {
      dataSourceConflicts += 1;
    }
    return false;
  });

  let lookupConflicts = 0;
  const currentLookupsById = new Map(current.lookups.map((lookup) => [lookup.id, lookup]));
  const addedLookups = incoming.lookups.filter((lookup) => {
    const existing = currentLookupsById.get(lookup.id);
    if (!existing) {
      return true;
    }
    if (!sameValue(existing, lookup)) {
      lookupConflicts += 1;
    }
    return false;
  });

  const currentIsEmpty =
    current.kpis.length === 0 &&
    current.dataSources.length === 0 &&
    current.lookups.length === 0 &&
    enumCategoryKeys.every((category) => current.enums[category].length === 0);

  return {
    config: {
      ...current,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      title: currentIsEmpty ? incoming.title : current.title,
      defaultFocus: currentIsEmpty ? incoming.defaultFocus : current.defaultFocus,
      enums,
      dataSources: [...current.dataSources, ...addedDataSources],
      lookups: [...current.lookups, ...addedLookups],
      kpis: [...mergedCurrentKpis, ...addedKpis]
    },
    importedKpiIds,
    addedKpis: addedKpis.length,
    updatedKpis,
    addedEnumOptions,
    enumConflicts,
    addedDataSources: addedDataSources.length,
    dataSourceConflicts,
    addedLookups: addedLookups.length,
    lookupConflicts
  };
};

const mergeAdditiveCollection = <T extends { id: string }>(current: T[], incoming: T[]) => {
  const incomingIds = new Set(incoming.map((entry) => entry.id));
  return [...incoming, ...current.filter((entry) => !incomingIds.has(entry.id))];
};

/**
 * Applies a normal hosted save when the editor still has the latest server ETag.
 * Existing incoming values are updated, new values are added, and deletions are ignored.
 */
export const mergeCurrentAdditiveConfig = (current: KpiPoolConfig, incoming: KpiPoolConfig): KpiPoolConfig => ({
  ...current,
  schemaVersion: CURRENT_SCHEMA_VERSION,
  title: incoming.title,
  defaultFocus: incoming.defaultFocus,
  enums: Object.fromEntries(
    enumCategoryKeys.map((category) => [
      category,
      mergeAdditiveCollection(current.enums[category], incoming.enums[category])
    ])
  ) as KpiPoolConfig['enums'],
  dataSources: mergeAdditiveCollection(current.dataSources, incoming.dataSources),
  lookups: mergeAdditiveCollection(current.lookups, incoming.lookups),
  kpis: mergeAdditiveCollection(current.kpis, incoming.kpis)
});

/**
 * Applies explicit KPI deletion tombstones after an additive hosted merge.
 * References to deleted KPIs are removed along with the KPI records.
 */
export const applyKpiDeletions = (config: KpiPoolConfig, deletedKpiIds: readonly string[]): KpiPoolConfig => {
  if (deletedKpiIds.length === 0) {
    return config;
  }

  const deletedIds = new Set(deletedKpiIds);
  return {
    ...config,
    kpis: config.kpis
      .filter((kpi) => !deletedIds.has(kpi.id))
      .map((kpi) => ({
        ...kpi,
        sources: kpi.sources.filter((source) => source.type !== 'kpi' || !deletedIds.has(source.kpiId)),
        prerequisite: {
          ...kpi.prerequisite,
          kpis: kpi.prerequisite.kpis.filter((id) => !deletedIds.has(id))
        }
      }))
  };
};
