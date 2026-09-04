import type { KpiPoolConfig } from './types';

export type TableFieldMoveResult = {
  config: KpiPoolConfig;
  moved: boolean;
};

/**
 * Moves a user-authored field between source tables and retargets KPI source
 * references. Source LaTeX and formula content are deliberately left intact.
 */
export const moveTableField = (
  config: KpiPoolConfig,
  sourceDataSourceId: string,
  fieldId: string,
  targetDataSourceId: string
): TableFieldMoveResult => {
  const source = config.dataSources.find((entry) => entry.id === sourceDataSourceId);
  const target = config.dataSources.find((entry) => entry.id === targetDataSourceId);
  const fieldIndex = source?.fields.findIndex((field) => field.id === fieldId) ?? -1;
  const field = fieldIndex >= 0 ? source?.fields[fieldIndex] : undefined;
  const sourceHasRelations = config.tableRelations.some(
    (relation) => relation.sourceDataSourceId === sourceDataSourceId || relation.targetDataSourceId === sourceDataSourceId
  );

  if (
    !source ||
    !target ||
    !field ||
    source.id === target.id ||
    source.spatialUnit !== target.spatialUnit ||
    field.generatedRelationId ||
    target.fields.some((targetField) => targetField.id === field.id) ||
    (source.primaryKeyFieldId === field.id && sourceHasRelations)
  ) {
    return { config, moved: false };
  }

  const dataSources = config.dataSources.map((entry) => {
    if (entry.id === source.id) {
      return {
        ...entry,
        primaryKeyFieldId: entry.primaryKeyFieldId === field.id ? undefined : entry.primaryKeyFieldId,
        fields: entry.fields.filter((entryField) => entryField.id !== field.id),
        fieldGroups: entry.fieldGroups.map((group) => ({
          ...group,
          position: group.position > fieldIndex ? group.position - 1 : group.position,
          fieldIds: group.fieldIds.filter((groupFieldId) => groupFieldId !== field.id)
        }))
      };
    }

    if (entry.id === target.id) {
      return { ...entry, fields: [...entry.fields, field] };
    }

    return entry;
  });

  const kpis = config.kpis.map((kpi) => {
    const citesMovedField = kpi.sources.some(
      (item) => item.type === 'dataField' && item.dataSourceId === source.id && item.fieldId === field.id
    );
    if (!citesMovedField) return kpi;

    return {
      ...kpi,
      sources: kpi.sources.map((item) =>
        item.type === 'dataField' && item.dataSourceId === source.id && item.fieldId === field.id
          ? { ...item, dataSourceId: target.id }
          : item
      )
    };
  });

  return { config: { ...config, dataSources, kpis }, moved: true };
};
