import type { DataSource, DataSourceField, TableRelation } from './types.js';

export const collectionRelationName = (name: string) => {
  const trimmed = name.trim() || 'Table';
  return trimmed.endsWith('s') ? trimmed : `${trimmed}s`;
};
export const fallbackRelationKeyName = (source: DataSource) => `${source.name.trim().replace(/[^\p{L}\p{N}_]+/gu, '') || 'Table'}ID`;

export const uniqueRelationName = (names: Set<string>, preferred: string) => {
  let name = preferred;
  for (let suffix = 2; names.has(name.toLocaleLowerCase()); suffix++) name = `${preferred}${suffix}`;
  names.add(name.toLocaleLowerCase());
  return name;
};

/** Follow key identities, never name matches; unrelated equal-named fields stay untouched. */
export const synchronizeRelationKeyNames = (
  before: DataSource[],
  after: DataSource[],
  relations: TableRelation[]
): DataSource[] => {
  const previous = new Map(before.map((source) => [source.id, source]));
  const relationById = new Map(relations.map((relation) => [relation.id, relation]));
  const renamedKeys = new Map<string, string>();
  for (const source of after) {
    const old = previous.get(source.id);
    if (!old || old === source) continue;
    const keyName = source.fields.find((field) => field.id === source.primaryKeyFieldId)?.name || fallbackRelationKeyName(source);
    const oldKeyName = old.fields.find((field) => field.id === old.primaryKeyFieldId)?.name || fallbackRelationKeyName(old);
    if (keyName !== oldKeyName || source.primaryKeyFieldId !== old.primaryKeyFieldId) renamedKeys.set(source.id, keyName);
  }
  if (!renamedKeys.size) return after;
  return after.map((source) => {
    const desired = new Map<string, string>();
    for (const field of source.fields) {
      const relation = field.generatedRelationId && relationById.get(field.generatedRelationId);
      if (!relation || relation.cardinality === 'oneToOne') continue;
      const ownerId = relation.sourceDataSourceId === source.id ? relation.targetDataSourceId : relation.sourceDataSourceId;
      const keyName = renamedKeys.get(ownerId);
      if (keyName !== undefined) desired.set(field.id, field.dataType === 'collection' ? collectionRelationName(keyName) : keyName.trim());
    }
    if (!desired.size) return source;
    const names = new Set(source.fields.filter((field) => !desired.has(field.id)).map((field) => field.name.trim().toLocaleLowerCase()));
    let changed = false;
    const fields = source.fields.map((field): DataSourceField => {
      const preferred = desired.get(field.id);
      if (preferred === undefined) return field;
      const name = uniqueRelationName(names, preferred);
      if (field.name === name) return field;
      changed = true;
      return { ...field, name };
    });
    return changed ? { ...source, fields } : source;
  });
};

export const updateRelationFieldRole = (field: DataSourceField, replacement: DataSourceField): DataSourceField => ({
  ...field,
  name: replacement.name,
  dataType: replacement.dataType,
  collectionItemType: replacement.collectionItemType,
  generatedRelationRole: replacement.generatedRelationRole
});
