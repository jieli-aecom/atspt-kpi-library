import assert from 'node:assert/strict';
import test from 'node:test';
import { relationTargetTables } from '../src/tableRelations.ts';
import type { DataSource, TableRelation } from '../src/types.ts';

const table = (id: string, spatialUnit: string, customUnit?: string): DataSource => ({
  id, name: id, spatialUnit, customUnit, fields: [], fieldGroups: []
});
const relation = (cardinality: TableRelation['cardinality']): TableRelation => ({
  id: 'join', sourceDataSourceId: 'zones', targetDataSourceId: 'links', cardinality
});
const ids = (tables: DataSource[]) => tables.map((entry) => entry.id);

test('replacement geography matches the original other endpoint from either side of every join type', () => {
  const tables = [table('zones', 'TAZ'), table('links', 'Link'), table('other-zones', 'TAZ'), table('other-links', 'Link')];
  for (const cardinality of ['oneToOne', 'oneToMany', 'manyToMany'] as const) {
    assert.deepEqual(ids(relationTargetTables(tables, 'zones', relation(cardinality))), ['links', 'other-links']);
    assert.deepEqual(ids(relationTargetTables(tables, 'links', relation(cardinality))), ['zones', 'other-zones']);
  }
});

test('custom geography units are matched by their trimmed value, distinct from unspecified units', () => {
  const tables = [table('zones', 'TAZ'), table('links', '', ' Route '), table('routes', '', 'Route'),
    table('stops', '', 'Stop'), table('unspecified', '')];
  assert.deepEqual(ids(relationTargetTables(tables, 'zones', relation('oneToMany'))), ['links', 'routes']);
  const withoutCustomUnit = tables.map((entry) => entry.id === 'links' ? { ...entry, customUnit: undefined } : entry);
  assert.deepEqual(ids(relationTargetTables(withoutCustomUnit, 'zones', relation('oneToMany'))), ['links', 'unspecified']);
});

test('new joins allow different geography units and always exclude the anchor table', () => {
  const tables = [table('zones', 'TAZ'), table('links', 'Link'), table('other-zones', 'TAZ')];
  assert.deepEqual(ids(relationTargetTables(tables, 'zones')), ['links', 'other-zones']);
  assert.deepEqual(ids(relationTargetTables(tables, 'zones', { ...relation('oneToOne'), targetDataSourceId: 'other-zones' })), ['other-zones']);
});

test('missing endpoints or an unrelated anchor cannot loosen an existing join geography constraint', () => {
  const tables = [table('zones', 'TAZ'), table('other-zones', 'TAZ')];
  assert.deepEqual(relationTargetTables(tables, 'zones', relation('oneToMany')), []);
  assert.deepEqual(relationTargetTables(tables, 'other-zones', relation('oneToMany')), []);
});
