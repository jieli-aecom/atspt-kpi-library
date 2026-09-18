import assert from 'node:assert/strict';
import test from 'node:test';
import { createBlankConfig, repairConfig } from '../src/configSchema.ts';
import type { TableRelation } from '../src/types.ts';

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
