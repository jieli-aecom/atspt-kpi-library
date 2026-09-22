import { relationPrincipalId, visibleRelationFields } from './tableRelations.js';
import type { DataSource, DataSourceField, KpiPoolConfig, TableSourceCategory } from './types.js';
import { fieldFlags } from './fieldFlags.js';

type SchemaJoin = {
  With: string;
  Type: '1:1' | '1:N' | 'N:1' | 'N:N';
  LeftOn: string;
  RightOn: string;
};

type SchemaTable = {
  PK: string | null;
  Flags?: { Name: string; Note?: string }[];
  Fields: { Name: string; Type: string; ElementType?: string; Virtual?: true; Flags?: { Name: string; Note?: string }[] }[];
  Joins: SchemaJoin[];
};

const categoryKeys: Record<TableSourceCategory, string> = {
  'Preprocessed Constants': 'PreprocessedConstants',
  'Scenario Upstream': 'ScenarioUpstream',
  'KPI Preparation': 'KPIPreparation'
};

// Allocate table names globally so cross-category joins stay unambiguous.
// Field names only need to be unique within their table.
const stripName = (name: string, fallback: string) => name.replace(/[^a-zA-Z0-9_]/g, '') || fallback;

const nameAllocator = (fallback: string) => {
  const used = new Set<string>();
  return (rawName: string) => {
    const stripped = stripName(rawName, fallback);
    const base = /^\d/.test(stripped) ? `_${stripped}` : stripped;
    let name = base;
    for (let suffix = 2; used.has(name); suffix += 1) name = `${base}_${suffix}`;
    used.add(name);
    return name;
  };
};

export function buildTableSchemaJsonExport(config: Pick<KpiPoolConfig, 'dataSources' | 'tableRelations'>) {
  const allocateTableName = nameAllocator('Table');
  const tableNames = new Map(config.dataSources.map((table) => [table.id, allocateTableName(table.name)]));
  const fieldNames = new Map<string, Map<string, string[]>>();
  const tablesById = new Map(config.dataSources.map((table) => [table.id, table]));
  const exportedById = new Map<string, SchemaTable>();
  const result: Record<string, Record<string, SchemaTable>> = {};

  for (const table of config.dataSources) {
    const names = new Map<string, string[]>();
    const allocateFieldName = nameAllocator('Field');
    const fields = visibleRelationFields(table, config.dataSources, config.tableRelations).flatMap((field) => {
      const dimensions = table.fieldGroups.find((group) => group.fieldIds.includes(field.id))?.dimensions ?? [];
      // Cartesian product, preserving dimension and option order. A dimension
      // with no options contributes no concrete fields to the schema.
      const suffixes = dimensions.reduce<string[]>((prefixes, dimension) =>
        prefixes.flatMap((prefix) => dimension.options.map((option) => `${prefix}_${stripName(option, 'Option')}`)), ['']);
      const expandedNames = suffixes.map((suffix) => allocateFieldName(`${stripName(field.name, 'Field')}${suffix}`));
      names.set(field.id, expandedNames);
      return expandedNames.map((name) => ({
        Name: name,
        Type: field.dataType,
        ...(fieldFlags(field).length ? { Flags: fieldFlags(field).map(({ label, note }) => ({ Name: label, ...(note.trim() ? { Note: note } : {}) })) } : {}),
        ...(field.generatedRelationId ? { Virtual: true as const } : {}),
        ...(field.dataType === 'collection' ? { ElementType: field.collectionItemType ?? (field.enumId ? 'enum' : field.generatedRelationId ? 'id' : 'number') } : {})
      }));
    });
    fieldNames.set(table.id, names);
    const exported: SchemaTable = {
      ...(table.potentiallyUnavailable ? { Flags: [{ Name: 'Potentially Unavailable', ...(table.potentiallyUnavailableNote?.trim() ? { Note: table.potentiallyUnavailableNote } : {}) }] } : {}),
      PK: names.get(table.primaryKeyFieldId ?? '')?.[0] ?? null,
      Fields: fields,
      Joins: []
    };
    const category = categoryKeys[table.category ?? 'Preprocessed Constants'];
    result[category] ??= Object.create(null) as Record<string, SchemaTable>;
    result[category][tableNames.get(table.id)!] = exported;
    exportedById.set(table.id, exported);
  }

  const primaryKey = (table: DataSource) => table.fields.find((field) => field.id === table.primaryKeyFieldId);
  const relationField = (table: DataSource, relationId: string, role: DataSourceField['generatedRelationRole']) =>
    table.fields.find((field) => field.generatedRelationId === relationId && field.generatedRelationRole === role);
  const addJoin = (left: DataSource, right: DataSource, type: SchemaJoin['Type'], leftField?: DataSourceField, rightField?: DataSourceField) => {
    // Incomplete relations cannot produce valid field references.
    if (!leftField || !rightField) return;
    for (const leftName of fieldNames.get(left.id)!.get(leftField.id)!) {
      for (const rightName of fieldNames.get(right.id)!.get(rightField.id)!) {
        exportedById.get(left.id)!.Joins.push({
          With: tableNames.get(right.id)!, Type: type, LeftOn: leftName, RightOn: rightName
        });
      }
    }
  };

  for (const relation of config.tableRelations) {
    const source = tablesById.get(relation.sourceDataSourceId);
    const target = tablesById.get(relation.targetDataSourceId);
    if (!source || !target) continue;
    if (relation.cardinality === 'oneToMany') {
      const foreignKey = relationField(target, relation.id, 'manyForeignKey');
      addJoin(source, target, '1:N', primaryKey(source), foreignKey);
      addJoin(target, source, 'N:1', foreignKey, primaryKey(source));
    } else {
      const principal = relationPrincipalId(relation, config.dataSources) === source.id ? source : target;
      const secondary = principal === source ? target : source;
      const foreignKey = relationField(secondary, relation.id, relation.cardinality === 'oneToOne'
        ? 'secondaryForeignKey' : secondary === source ? 'sourceCollection' : 'targetCollection');
      const type = relation.cardinality === 'oneToOne' ? '1:1' : 'N:N';
      addJoin(principal, secondary, type, primaryKey(principal), foreignKey);
      addJoin(secondary, principal, type, foreignKey, primaryKey(principal));
    }
  }

  return result;
}
