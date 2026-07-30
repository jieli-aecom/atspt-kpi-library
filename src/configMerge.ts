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
  addedVariables: number;
  variableConflicts: number;
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
  const currentRelationsById = new Map(current.tableRelations.map((relation) => [relation.id, relation]));
  const addedTableRelations = incoming.tableRelations.filter((relation) => !currentRelationsById.has(relation.id));

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

  let variableConflicts = 0;
  const currentVariablesById = new Map(current.variables.map((variable) => [variable.id, variable]));
  const addedVariables = incoming.variables.filter((variable) => {
    const existing = currentVariablesById.get(variable.id);
    if (!existing) {
      return true;
    }
    if (!sameValue(existing, variable)) {
      variableConflicts += 1;
    }
    return false;
  });

  const currentIsEmpty =
    current.kpis.length === 0 &&
    current.dataSources.length === 0 &&
    current.tableRelations.length === 0 &&
    current.lookups.length === 0 &&
    current.variables.length === 0 &&
    enumCategoryKeys.every((category) => current.enums[category].length === 0);

  return {
    config: {
      ...current,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      title: currentIsEmpty ? incoming.title : current.title,
      defaultFocus: currentIsEmpty ? incoming.defaultFocus : current.defaultFocus,
      enums,
      dataSources: [...current.dataSources, ...addedDataSources],
      tableRelations: [...current.tableRelations, ...addedTableRelations],
      lookups: [...current.lookups, ...addedLookups],
      variables: [...current.variables, ...addedVariables],
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
    lookupConflicts,
    addedVariables: addedVariables.length,
    variableConflicts
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
  tableRelations: mergeAdditiveCollection(current.tableRelations, incoming.tableRelations),
  lookups: mergeAdditiveCollection(current.lookups, incoming.lookups),
  variables: mergeAdditiveCollection(current.variables, incoming.variables),
  kpis: mergeAdditiveCollection(current.kpis, incoming.kpis)
});

export type ConfigDeletions = {
  kpiIds: readonly string[];
  dataSourceIds: readonly string[];
};

/**
 * Applies explicit deletion tombstones after an additive hosted merge.
 * Applying these last makes the deleting editor's intent win over both the
 * hosted copy and concurrent edits. References to deleted records are removed
 * along with those records.
 */
export const applyConfigDeletions = (config: KpiPoolConfig, deletions: ConfigDeletions): KpiPoolConfig => {
  if (deletions.kpiIds.length === 0 && deletions.dataSourceIds.length === 0) {
    return config;
  }

  const deletedKpiIds = new Set(deletions.kpiIds);
  const deletedDataSourceIds = new Set(deletions.dataSourceIds);
  const deletedRelationIds = new Set(config.tableRelations
    .filter((relation) => deletedDataSourceIds.has(relation.sourceDataSourceId) || deletedDataSourceIds.has(relation.targetDataSourceId))
    .map((relation) => relation.id));
  const removedGeneratedFieldKeys = new Set(config.dataSources.flatMap((source) => source.fields
    .filter((field) => field.generatedRelationId && deletedRelationIds.has(field.generatedRelationId))
    .map((field) => `${source.id}\u0000${field.id}`)));
  return {
    ...config,
    dataSources: config.dataSources
      .filter((source) => !deletedDataSourceIds.has(source.id))
      .map((source) => ({
        ...source,
        fields: source.fields.filter((field) => !field.generatedRelationId || !deletedRelationIds.has(field.generatedRelationId)),
        fieldGroups: source.fieldGroups.map((group) => ({
          ...group,
          fieldIds: group.fieldIds.filter((fieldId) => !removedGeneratedFieldKeys.has(`${source.id}\u0000${fieldId}`))
        }))
      })),
    tableRelations: config.tableRelations.filter((relation) => !deletedRelationIds.has(relation.id)),
    kpis: config.kpis
      .filter((kpi) => !deletedKpiIds.has(kpi.id))
      .map((kpi) => ({
        ...kpi,
        sources: kpi.sources.filter(
          (source) =>
            (source.type !== 'kpi' || !deletedKpiIds.has(source.kpiId)) &&
            (source.type !== 'dataField' || (!deletedDataSourceIds.has(source.dataSourceId) && !removedGeneratedFieldKeys.has(`${source.dataSourceId}\u0000${source.fieldId}`)))
        ),
        prerequisite: {
          ...kpi.prerequisite,
          kpis: kpi.prerequisite.kpis.filter((id) => !deletedKpiIds.has(id))
        }
      }))
  };
};
