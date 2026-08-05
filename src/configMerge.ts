import { CURRENT_SCHEMA_VERSION, enumCategoryKeys, type DataLibraryGroup, type KpiPoolConfig } from './types.js';

export type ConfigMergeResult = {
  config: KpiPoolConfig;
  importedKpiIds: Set<string>;
  addedKpis: number;
  updatedKpis: number;
  addedEnumOptions: number;
  enumConflicts: number;
  addedValueEnums: number;
  valueEnumConflicts: number;
  addedDataSources: number;
  dataSourceConflicts: number;
  addedLookups: number;
  lookupConflicts: number;
  addedVariables: number;
  variableConflicts: number;
};

const sameValue = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);

const mergeConcurrentCollection = <T extends { id: string }>(
  current: T[],
  base: T[],
  incoming: T[]
) => {
  const currentById = new Map(current.map((entry) => [entry.id, entry]));
  const baseById = new Map(base.map((entry) => [entry.id, entry]));
  const incomingById = new Map(incoming.map((entry) => [entry.id, entry]));
  const localStructureChanged = !sameValue(
    base.map((entry) => entry.id),
    incoming.map((entry) => entry.id)
  );
  const orderedIds = localStructureChanged
    ? [
        ...incoming.map((entry) => entry.id),
        ...current.filter((entry) => !baseById.has(entry.id) && !incomingById.has(entry.id)).map((entry) => entry.id)
      ]
    : [
        ...current.map((entry) => entry.id),
        ...incoming.filter((entry) => !currentById.has(entry.id)).map((entry) => entry.id)
      ];

  return [...new Set(orderedIds)].flatMap((id): T[] => {
    const currentEntry = currentById.get(id);
    const baseEntry = baseById.get(id);
    const incomingEntry = incomingById.get(id);

    // It existed when this editor last synchronized and is now absent:
    // this editor explicitly deleted it, so deletion wins over remote edits.
    if (baseEntry && !incomingEntry) return [];
    if (!incomingEntry) return currentEntry ? [currentEntry] : [];

    // A locally edited entity wins as a whole. This also preserves every
    // nested deletion inside data sources, lookups, and KPIs.
    if (baseEntry && !sameValue(baseEntry, incomingEntry)) return [incomingEntry];

    // If this editor left the entity untouched, retain the hosted edit or
    // deletion. Brand-new local entities are appended unless their ID collided.
    if (currentEntry) return [currentEntry];
    if (baseEntry) return [];
    return [incomingEntry];
  });
};

/**
 * Three-way hosted merge using the configuration this editor last synchronized.
 * Local deletions win, untouched records retain remote edits/deletions, and
 * independent top-level additions from both editors are preserved.
 */
export const mergeConcurrentConfig = (
  current: KpiPoolConfig,
  base: KpiPoolConfig,
  incoming: KpiPoolConfig
): KpiPoolConfig => ({
  ...current,
  schemaVersion: CURRENT_SCHEMA_VERSION,
  title: incoming.title !== base.title ? incoming.title : current.title,
  defaultFocus: !sameValue(incoming.defaultFocus, base.defaultFocus)
    ? incoming.defaultFocus
    : current.defaultFocus,
  enums: Object.fromEntries(
    enumCategoryKeys.map((category) => [
      category,
      mergeConcurrentCollection(current.enums[category], base.enums[category], incoming.enums[category])
    ])
  ) as KpiPoolConfig['enums'],
  valueEnums: mergeConcurrentCollection(current.valueEnums, base.valueEnums, incoming.valueEnums),
  valueEnumGroups: mergeConcurrentCollection(current.valueEnumGroups, base.valueEnumGroups, incoming.valueEnumGroups),
  dataSources: mergeConcurrentCollection(current.dataSources, base.dataSources, incoming.dataSources),
  tableRelations: mergeConcurrentCollection(current.tableRelations, base.tableRelations, incoming.tableRelations),
  lookups: mergeConcurrentCollection(current.lookups, base.lookups, incoming.lookups),
  lookupGroups: mergeConcurrentCollection(current.lookupGroups, base.lookupGroups, incoming.lookupGroups),
  variables: mergeConcurrentCollection(current.variables, base.variables, incoming.variables),
  variableGroups: mergeConcurrentCollection(current.variableGroups, base.variableGroups, incoming.variableGroups),
  kpis: mergeConcurrentCollection(current.kpis, base.kpis, incoming.kpis)
});

const mergeImportedLibraryGroups = <T extends { id: string }>(
  currentGroups: DataLibraryGroup[],
  incomingGroups: DataLibraryGroup[],
  currentItems: T[],
  incomingItems: T[],
  addedItems: T[]
) => {
  if (currentItems.length === 0 && currentGroups.length === 0) return incomingGroups;
  const existingGroupIds = new Set(currentGroups.map((group) => group.id));
  const addedItemIds = new Set(addedItems.map((item) => item.id));
  const assignedItemIds = new Set(currentGroups.flatMap((group) => group.itemIds));
  return [
    ...currentGroups,
    ...incomingGroups.flatMap((group) => {
      if (existingGroupIds.has(group.id)) return [];
      const itemIds = group.itemIds.filter((id) => {
        if (!addedItemIds.has(id) || assignedItemIds.has(id)) return false;
        assignedItemIds.add(id);
        return true;
      });
      const addedBeforeGroup = incomingItems
        .slice(0, Math.max(0, Math.min(group.position, incomingItems.length)))
        .filter((item) => addedItemIds.has(item.id))
        .length;
      return [{ ...group, itemIds, position: currentItems.length + addedBeforeGroup }];
    })
  ];
};

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
  let valueEnumConflicts = 0;
  const currentValueEnumsById = new Map(current.valueEnums.map((definition) => [definition.id, definition]));
  const addedValueEnums = incoming.valueEnums.filter((definition) => {
    const existing = currentValueEnumsById.get(definition.id);
    if (!existing) return true;
    if (!sameValue(existing, definition)) valueEnumConflicts += 1;
    return false;
  });

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
    current.lookupGroups.length === 0 &&
    current.variables.length === 0 &&
    current.variableGroups.length === 0 &&
    current.valueEnums.length === 0 &&
    current.valueEnumGroups.length === 0 &&
    enumCategoryKeys.every((category) => current.enums[category].length === 0);

  return {
    config: {
      ...current,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      title: currentIsEmpty ? incoming.title : current.title,
      defaultFocus: currentIsEmpty ? incoming.defaultFocus : current.defaultFocus,
      enums,
      valueEnums: [...current.valueEnums, ...addedValueEnums],
      valueEnumGroups: mergeImportedLibraryGroups(
        current.valueEnumGroups,
        incoming.valueEnumGroups,
        current.valueEnums,
        incoming.valueEnums,
        addedValueEnums
      ),
      dataSources: [...current.dataSources, ...addedDataSources],
      tableRelations: [...current.tableRelations, ...addedTableRelations],
      lookups: [...current.lookups, ...addedLookups],
      lookupGroups: mergeImportedLibraryGroups(
        current.lookupGroups,
        incoming.lookupGroups,
        current.lookups,
        incoming.lookups,
        addedLookups
      ),
      variables: [...current.variables, ...addedVariables],
      variableGroups: mergeImportedLibraryGroups(
        current.variableGroups,
        incoming.variableGroups,
        current.variables,
        incoming.variables,
        addedVariables
      ),
      kpis: [...mergedCurrentKpis, ...addedKpis]
    },
    importedKpiIds,
    addedKpis: addedKpis.length,
    updatedKpis,
    addedEnumOptions,
    enumConflicts,
    addedValueEnums: addedValueEnums.length,
    valueEnumConflicts,
    addedDataSources: addedDataSources.length,
    dataSourceConflicts,
    addedLookups: addedLookups.length,
    lookupConflicts,
    addedVariables: addedVariables.length,
    variableConflicts
  };
};

export type ConfigDeletions = {
  kpiIds: readonly string[];
  dataSourceIds: readonly string[];
  relationIds: readonly string[];
  lookupIds: readonly string[];
};

/**
 * Applies explicit deletion tombstones after an additive hosted merge.
 * Applying these last makes the deleting editor's intent win over both the
 * hosted copy and concurrent edits. References to deleted records are removed
 * along with those records.
 */
export const applyConfigDeletions = (config: KpiPoolConfig, deletions: ConfigDeletions): KpiPoolConfig => {
  if (
    deletions.kpiIds.length === 0 &&
    deletions.dataSourceIds.length === 0 &&
    deletions.relationIds.length === 0 &&
    deletions.lookupIds.length === 0
  ) {
    return config;
  }

  const deletedKpiIds = new Set(deletions.kpiIds);
  const deletedDataSourceIds = new Set(deletions.dataSourceIds);
  const deletedLookupIds = new Set(deletions.lookupIds);
  const deletedRelationIds = new Set([
    ...deletions.relationIds,
    ...config.tableRelations
      .filter((relation) => deletedDataSourceIds.has(relation.sourceDataSourceId) || deletedDataSourceIds.has(relation.targetDataSourceId))
      .map((relation) => relation.id)
  ]);
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
    lookups: config.lookups.filter((lookup) => !deletedLookupIds.has(lookup.id)),
    lookupGroups: config.lookupGroups.map((group) => ({
      ...group,
      itemIds: group.itemIds.filter((id) => !deletedLookupIds.has(id))
    })),
    kpis: config.kpis
      .filter((kpi) => !deletedKpiIds.has(kpi.id))
      .map((kpi) => ({
        ...kpi,
        sources: kpi.sources.filter(
          (source) =>
            (source.type !== 'kpi' || !deletedKpiIds.has(source.kpiId)) &&
            (source.type !== 'lookup' || !deletedLookupIds.has(source.lookupId)) &&
            (source.type !== 'dataField' || (!deletedDataSourceIds.has(source.dataSourceId) && !removedGeneratedFieldKeys.has(`${source.dataSourceId}\u0000${source.fieldId}`)))
        ),
        prerequisite: {
          ...kpi.prerequisite,
          kpis: kpi.prerequisite.kpis.filter((id) => !deletedKpiIds.has(id))
        }
      }))
  };
};
