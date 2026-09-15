import assert from 'node:assert/strict';
import test from 'node:test';
import { buildTableSchemaJsonExport } from '../src/tableSchemaJsonExport.ts';
import type { DataSource, DataSourceField, TableRelation } from '../src/types.ts';

const field = (id: string, name: string, extra: Partial<DataSourceField> = {}): DataSourceField => ({
  id, name, meaning: '', details: '', preprocessingNeeded: false, preferredLatex: '',
  dataType: 'id', valueUnit: '', options: [], ...extra
});
const table = (id: string, name: string, extra: Partial<DataSource> = {}): DataSource => ({
  id, name, spatialUnit: '', primaryKeyFieldId: `${id}-pk`,
  fields: [field(`${id}-pk`, `${name} ID`)], fieldGroups: [], ...extra
});
const exportJson = (dataSources: DataSource[], tableRelations: TableRelation[] = []) =>
  JSON.parse(JSON.stringify(buildTableSchemaJsonExport({ dataSources, tableRelations })));

test('exports categories without groups, normalized keys and fields, and collection element types only', () => {
  const first = table('a', 'Road-Network', {
    fields: [field('a-pk', 'Road ID'), field('length', 'Length (km)', { dataType: 'number' }),
      field('tags', 'Road Tags', { dataType: 'collection', collectionItemType: 'text' })],
    fieldGroups: [{ id: 'group', dimensions: [], fieldIds: ['tags'], position: 1 }]
  });
  const input = { dataSources: [first, table('b', 'Trips', { category: 'Scenario Upstream' }),
    table('c', 'Scores', { category: 'KPI Preparation' })], tableRelations: [],
    dataSourceGroups: [{ id: 'g', name: 'Ignored group', itemIds: ['a'], position: 0 }] };
  const before = JSON.stringify(input);
  const result = JSON.parse(JSON.stringify(buildTableSchemaJsonExport(input)));
  assert.deepEqual(Object.keys(result), ['PreprocessedConstants', 'ScenarioUpstream', 'KPIPreparation']);
  assert.deepEqual(result.PreprocessedConstants, {
    RoadNetwork: { PK: 'RoadID', Fields: [{ Name: 'RoadID', Type: 'id' },
      { Name: 'Lengthkm', Type: 'number' }, { Name: 'RoadTags', Type: 'collection', ElementType: 'text' }], Joins: [] }
  });
  assert.equal(JSON.stringify(input), before);
});

test('keeps colliding names and join references unique even across categories', () => {
  const result = exportJson([
    table('a', 'Road Network', { fields: [field('a-pk', 'Road ID'), field('other', 'Road-ID')] }),
    table('b', 'Road-Network', { category: 'Scenario Upstream' }),
    table('c', 'RoadNetwork_2')
  ], [{ id: 'r', sourceDataSourceId: 'a', targetDataSourceId: 'b', cardinality: 'oneToOne' }]);
  assert.equal(result.PreprocessedConstants.RoadNetwork.Fields[1].Name, 'RoadID_2');
  assert.ok(result.PreprocessedConstants.RoadNetwork_2_2);
  assert.deepEqual(result.PreprocessedConstants.RoadNetwork.Joins, [
    { With: 'RoadNetwork_2', Type: '1:1', LeftOn: 'RoadID', RightOn: 'RoadNetworkID' }
  ]);
  assert.equal(result.ScenarioUpstream.RoadNetwork_2.Joins[0].With, 'RoadNetwork');
});

test('handles blank, punctuation-only, numeric and prototype names without losing tables', () => {
  const result = exportJson([
    table('a', '---', { primaryKeyFieldId: undefined, fields: [field('blank', '!?')] }),
    table('b', '', { fields: [] }), table('c', '123 roads'), table('d', '__proto__'), table('e', 'constructor')
  ]).PreprocessedConstants;
  assert.deepEqual(Object.keys(result), ['Table', 'Table_2', '_123roads', '__proto__', 'constructor']);
  assert.equal(result.Table.PK, null);
  assert.equal(result.Table.Fields[0].Name, 'Field');
  assert.deepEqual(result.Table_2, { PK: null, Fields: [], Joins: [] });
  assert.equal(result.__proto__.PK, '__proto__ID');
  assert.deepEqual(exportJson([]), {});
});

test('exports 1:N using the primary and foreign key with reversed N:1 on the other table', () => {
  const source = table('a', 'Parent', { fields: [field('a-pk', 'Parent ID'),
    field('children', 'Child IDs', { dataType: 'collection', collectionItemType: 'id', generatedRelationId: 'r', generatedRelationRole: 'oneCollection' })] });
  const target = table('b', 'Child', { fields: [field('b-pk', 'Child ID'),
    field('parent', 'Parent-ID', { generatedRelationId: 'r', generatedRelationRole: 'manyForeignKey' })] });
  const result = exportJson([source, target], [{ id: 'r', sourceDataSourceId: 'a', targetDataSourceId: 'b', cardinality: 'oneToMany' }]).PreprocessedConstants;
  assert.deepEqual(result.Parent.Joins, [{ With: 'Child', Type: '1:N', LeftOn: 'ParentID', RightOn: 'ParentID' }]);
  assert.deepEqual(result.Child.Joins, [{ With: 'Parent', Type: 'N:1', LeftOn: 'ParentID', RightOn: 'ParentID' }]);
});

test('exports N:N using each local collection of IDs and the other table primary key', () => {
  const sources = [table('a', 'Road', { fields: [field('a-pk', 'Road ID'),
    field('bs', 'Route IDs', { dataType: 'collection', collectionItemType: 'id', generatedRelationId: 'r', generatedRelationRole: 'sourceCollection' })] }),
  table('b', 'Route', { fields: [field('b-pk', 'Route ID'),
    field('as', 'Road IDs', { dataType: 'collection', collectionItemType: 'id', generatedRelationId: 'r', generatedRelationRole: 'targetCollection' })] })];
  const result = exportJson(sources, [{ id: 'r', sourceDataSourceId: 'a', targetDataSourceId: 'b', cardinality: 'manyToMany' }]).PreprocessedConstants;
  assert.deepEqual(result.Road.Joins, [{ With: 'Route', Type: 'N:N', LeftOn: 'RouteIDs', RightOn: 'RouteID' }]);
  assert.deepEqual(result.Route.Joins, [{ With: 'Road', Type: 'N:N', LeftOn: 'RoadIDs', RightOn: 'RoadID' }]);
  for (const own of Object.values(result) as any[]) {
    for (const join of own.Joins) {
      assert.ok(own.Fields.some((entry: any) => entry.Name === join.LeftOn));
      assert.ok(result[join.With].Fields.some((entry: any) => entry.Name === join.RightOn));
    }
  }
});

test('repeats dimensioned fields for every normalized option combination, retaining types', () => {
  const source = table('a', 'Metrics', {
    fields: [field('a-pk', 'Record ID'), field('speed', 'Mean-Speed', { dataType: 'number' }),
      field('tags', 'Tags', { dataType: 'collection', collectionItemType: 'text' })],
    fieldGroups: [{ id: 'g', fieldIds: ['speed', 'tags'], position: 1, dimensions: [
      { id: 'mode', name: 'Mode', options: ['Car', 'Public Transit'] },
      { id: 'time', name: 'Time', options: ['AM-peak', 'PM peak'] }
    ] }]
  });
  const result = exportJson([source]).PreprocessedConstants.Metrics;
  assert.equal(result.PK, 'RecordID');
  assert.deepEqual(result.Fields, [
    { Name: 'RecordID', Type: 'id' },
    ...['Car_AMpeak', 'Car_PMpeak', 'PublicTransit_AMpeak', 'PublicTransit_PMpeak'].map((suffix) => ({ Name: `MeanSpeed_${suffix}`, Type: 'number' })),
    ...['Car_AMpeak', 'Car_PMpeak', 'PublicTransit_AMpeak', 'PublicTransit_PMpeak'].map((suffix) => ({ Name: `Tags_${suffix}`, Type: 'collection', ElementType: 'text' }))
  ]);
});

test('disambiguates expanded names against ordinary fields and colliding options', () => {
  const source = table('a', 'Metrics', {
    fields: [field('a-pk', 'Value_AB'), field('value', 'Value')],
    fieldGroups: [{ id: 'g', fieldIds: ['value'], position: 1,
      dimensions: [{ id: 'd', name: 'Dimension', options: ['A B', 'A-B', '123', '!?'] }] }]
  });
  const result = exportJson([source]).PreprocessedConstants.Metrics;
  assert.equal(result.PK, 'Value_AB');
  assert.deepEqual(result.Fields.map((entry: any) => entry.Name), ['Value_AB', 'Value_AB_2', 'Value_AB_3', 'Value_123', 'Value_Option']);
  source.fieldGroups[0].dimensions[0].options = [];
  assert.equal(exportJson([source]).PreprocessedConstants.Metrics.Fields.length, 1);
});
