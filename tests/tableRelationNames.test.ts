import assert from 'node:assert/strict';
import test from 'node:test';
import { createBlankConfig, repairConfig } from '../src/configSchema.ts';
import type { TableRelation } from '../src/types.ts';
import { synchronizeRelationKeyNames, updateRelationFieldRole } from '../src/tableRelationNames.ts';

const linkedTables = (cardinality: TableRelation['cardinality'], targetKey = 'Road Link ID') => repairConfig({
  ...createBlankConfig(),
  dataSources: ['Zone ID', targetKey].map((name, index) => ({
    id: `table-${index}`,
    name: `Table ${index}`,
    spatialUnit: '',
    primaryKeyFieldId: `key-${index}`,
    fields: [{ id: `key-${index}`, name, dataType: 'id' }],
    fieldGroups: []
  })),
  tableRelations: [{ id: 'relation', sourceDataSourceId: 'table-0', targetDataSourceId: 'table-1', cardinality }]
}).config;

test('one-to-many keeps only the singular foreign key on the many side', () => {
  const config = linkedTables('oneToMany');
  assert.equal(config.dataSources[0].fields.length, 1);
  assert.equal(config.dataSources[1].fields.find((field) => field.generatedRelationId)?.name, 'Zone ID');
});

test('many-to-many collections preserve punctuation and do not append a second s', () => {
  const original = linkedTables('manyToMany', 'Road-Link IDs');
  const config = repairConfig({ ...original, tableRelations: original.tableRelations.map((relation) => ({ ...relation, principalDataSourceId: 'table-1' })) }).config;
  assert.equal(config.dataSources[1].fields.length, 1);
  assert.equal(config.dataSources[0].fields.find((field) => field.generatedRelationId)?.name, 'Road-Link IDs');
});

test('one-to-one creates a singular principal ID only on the secondary table', () => {
  const config = linkedTables('oneToOne');
  assert.equal(config.tableRelations.length, 1);
  assert.equal(config.dataSources[0].fields.length, 1);
  assert.equal(config.dataSources[1].fields[1].name, 'Zone ID');
  assert.equal(config.dataSources[1].fields[1].dataType, 'id');
});

test('principal primary key renames propagate without changing field IDs or metadata', () => {
  for (const cardinality of ['oneToOne', 'oneToMany', 'manyToMany'] as const) {
    const config = linkedTables(cardinality);
    const after = config.dataSources.map((table, index) => ({ ...table, fields: table.fields.map((field) =>
      field.id === table.primaryKeyFieldId ? { ...field, name: index ? 'Road Segment ID' : 'District ID' } : field) }));
    const result = synchronizeRelationKeyNames(config.dataSources, after, config.tableRelations);
    assert.equal(result[0].fields.length, 1);
    const right = result[1].fields.find((field) => field.generatedRelationId)!;
    assert.equal(right.name, cardinality === 'manyToMany' ? 'District IDs' : 'District ID');
    assert.deepEqual({ ...right, name: config.dataSources[1].fields[1].name }, config.dataSources[1].fields[1]);
    assert.equal(synchronizeRelationKeyNames(result, result, config.tableRelations), result);
  }
});

test('changing the designated primary key updates every linked table, with stable collision suffixes', () => {
  const config = linkedTables('oneToMany');
  const third = { ...config.dataSources[1], id: 'third' };
  config.dataSources.push(third);
  config.tableRelations.push({ ...config.tableRelations[0], id: 'other', targetDataSourceId: third.id });
  third.fields = third.fields.map((field) => field.generatedRelationId ? { ...field, generatedRelationId: 'other' } : field);
  const after = config.dataSources.map((table, index) => index ? table : {
    ...table, primaryKeyFieldId: 'new-key', fields: [...table.fields, { ...table.fields[0], id: 'new-key', name: 'Road Link ID' }]
  });
  const next = synchronizeRelationKeyNames(config.dataSources, after, config.tableRelations);
  for (const table of next.slice(1)) assert.equal(table.fields[1].name, 'Road Link ID2');
});

test('editing a virtual field never renames its primary key or unrelated virtual fields', () => {
  const config = linkedTables('oneToMany');
  const after = config.dataSources.map((table, index) => index ? { ...table, fields: table.fields.map((field) =>
    field.generatedRelationId ? { ...field, name: 'Local key alias' } : field) } : table);
  assert.equal(synchronizeRelationKeyNames(config.dataSources, after, config.tableRelations), after);
});

test('cardinality and direction changes use the new name and role while preserving field identity and user metadata', () => {
  const oneMany = linkedTables('oneToMany');
  const manyMany = linkedTables('manyToMany');
  const original = { ...oneMany.dataSources[1].fields[1], details: 'User notes', preferredLatex: 'custom', derived: true };
  const collection = updateRelationFieldRole(original, manyMany.dataSources[1].fields[1]);
  assert.equal(collection.name, 'Zone IDs');
  assert.equal(collection.dataType, 'collection');
  const singular = updateRelationFieldRole(collection, oneMany.dataSources[1].fields[1]);
  assert.deepEqual(singular, { ...original, collectionItemType: undefined });
  const reversed = updateRelationFieldRole(collection, { ...oneMany.dataSources[1].fields[1], name: 'Road Link ID' });
  assert.equal(reversed.name, 'Road Link ID');
  assert.equal(reversed.id, original.id);
  assert.equal(reversed.details, 'User notes');
});
