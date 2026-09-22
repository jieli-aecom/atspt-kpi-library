import { tableSourceCategories, type DataLibraryGroup, type DataSource, type DataSourceField, type TableRelation } from './types.js';

/** Match the table library's category and group display order during migration. */
export const relationTableOrder = (tables: DataSource[], groups: DataLibraryGroup[]): DataSource[] => {
  const grouped = new Set(groups.flatMap((group) => group.itemIds));
  return tableSourceCategories.flatMap((category) => tables.flatMap((table, index) => [
    ...groups.filter((group) => group.position === index && (group.category ?? 'Preprocessed Constants') === category)
      .flatMap((group) => tables.filter((entry) => group.itemIds.includes(entry.id)).map((entry) => ({ ...entry, category }))),
    ...(!grouped.has(table.id) && (table.category ?? 'Preprocessed Constants') === category ? [table] : [])
  ]).concat(groups.filter((group) => group.position === tables.length && (group.category ?? 'Preprocessed Constants') === category)
    .flatMap((group) => tables.filter((entry) => group.itemIds.includes(entry.id)).map((entry) => ({ ...entry, category })))));
};

/** Legacy joins use category order, then the saved table order. Explicit choices persist. */
export const relationPrincipalId = (relation: TableRelation, tables: DataSource[]): string => {
  if (relation.cardinality === 'oneToMany') return relation.sourceDataSourceId;
  const endpoints = [relation.sourceDataSourceId, relation.targetDataSourceId];
  if (endpoints.includes(relation.principalDataSourceId ?? '')) return relation.principalDataSourceId!;
  return tables.filter((table) => endpoints.includes(table.id)).sort((a, b) =>
    tableSourceCategories.indexOf(a.category ?? 'Preprocessed Constants') -
    tableSourceCategories.indexOf(b.category ?? 'Preprocessed Constants'))[0]?.id ?? relation.sourceDataSourceId;
};

export const relationFieldRole = (relation: TableRelation, tableId: string): DataSourceField['generatedRelationRole'] => {
  if (relation.cardinality === 'oneToOne') return undefined;
  if (tableId !== relation.sourceDataSourceId && tableId !== relation.targetDataSourceId) return undefined;
  if (relation.cardinality === 'oneToMany') return tableId === relation.targetDataSourceId ? 'manyForeignKey' : relation.principalFieldExpanded ? 'oneCollection' : undefined;
  if (tableId === relation.principalDataSourceId && !relation.principalFieldExpanded) return undefined;
  return tableId === relation.sourceDataSourceId ? 'sourceCollection' : 'targetCollection';
};

export const relationFieldIsCollection = (role: DataSourceField['generatedRelationRole']) =>
  role === 'oneCollection' || role === 'sourceCollection' || role === 'targetCollection';

export const visibleRelationFields = (table: DataSource, tables: DataSource[], relations: TableRelation[]) =>
  table.fields.filter((field) => {
    if (!field.generatedRelationId) return true;
    const relation = relations.find((entry) => entry.id === field.generatedRelationId);
    return relation && relationFieldRole({ ...relation, principalDataSourceId: relationPrincipalId(relation, tables) }, table.id) === field.generatedRelationRole;
  });
