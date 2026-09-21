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

test('one-to-many virtual fields preserve PK spaces and pluralize only the collection', () => {
  const config = linkedTables('oneToMany');
  assert.equal(config.dataSources[0].fields.find((field) => field.generatedRelationId)?.name, 'Road Link IDs');
  assert.equal(config.dataSources[1].fields.find((field) => field.generatedRelationId)?.name, 'Zone ID');
});

test('many-to-many collections preserve punctuation and do not append a second s', () => {
  const config = linkedTables('manyToMany', 'Road-Link IDs');
  assert.equal(config.dataSources[0].fields.find((field) => field.generatedRelationId)?.name, 'Road-Link IDs');
  assert.equal(config.dataSources[1].fields.find((field) => field.generatedRelationId)?.name, 'Zone IDs');
});

test('one-to-one links do not create virtual fields', () => {
  const config = linkedTables('oneToOne');
  assert.equal(config.tableRelations.length, 1);
  assert.ok(config.dataSources.every((table) => table.fields.length === 1));
});

test('primary key renames propagate in both directions without changing IDs or metadata', () => {
  for (const cardinality of ['oneToMany', 'manyToMany'] as const) {
    const config = linkedTables(cardinality);
    const after = config.dataSources.map((table, index) => ({ ...table, fields: table.fields.map((field) =>
      field.id === table.primaryKeyFieldId ? { ...field, name: index ? 'Road Segment ID' : 'District ID' } : field) }));
    const result = synchronizeRelationKeyNames(config.dataSources, after, config.tableRelations);
    const left = result[0].fields.find((field) => field.generatedRelationId)!;
    const right = result[1].fields.find((field) => field.generatedRelationId)!;
    assert.equal(left.name, 'Road Segment IDs');
    assert.equal(right.name, cardinality === 'oneToMany' ? 'District ID' : 'District IDs');
    assert.deepEqual({ ...left, name: config.dataSources[0].fields[1].name }, config.dataSources[0].fields[1]);
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
