import assert from 'node:assert/strict';
import test from 'node:test';
import JSZip from 'jszip';
import { createBlankConfig, createBlankKpi, repairConfig, prepareForExport, kpiPoolConfigSchema, reconcileRelationFields, setPrincipalFieldExpanded } from '../src/configSchema.ts';
import { createTableSchemaExcelWorkbook } from '../src/excelExport.ts';
import { buildTableSchemaJsonExport } from '../src/tableSchemaJsonExport.ts';
import type { DataSource, DataSourceField, TableRelation, TableSourceCategory } from '../src/types.ts';

const field = (id: string, extra: Partial<DataSourceField> = {}): DataSourceField => ({
  id, name: id, meaning: '', details: '', preprocessingNeeded: false, preferredLatex: '', dataType: 'id', valueUnit: '', options: [], ...extra
});
const table = (id: string, category: TableSourceCategory = 'Preprocessed Constants'): DataSource => ({
  id, name: id, category, spatialUnit: '', primaryKeyFieldId: `${id}ID`, fields: [field(`${id}ID`)], fieldGroups: []
});
const relation = (cardinality: TableRelation['cardinality'], principalDataSourceId?: string): TableRelation => ({
  id: 'r', sourceDataSourceId: 'a', targetDataSourceId: 'b', cardinality, ...(principalDataSourceId ? { principalDataSourceId } : {})
});
const migrate = (tables: DataSource[], join: TableRelation) => repairConfig({
  ...createBlankConfig(), schemaVersion: 53, dataSources: tables, tableRelations: [join]
}).config;

for (const cardinality of ['oneToOne', 'manyToMany'] as const) {
  test(`${cardinality}: migration prioritizes categories then table order, independent of join direction`, () => {
    for (const [tables, expected] of [
      [[table('b'), table('a')], 'b'],
      [[table('b', 'Scenario Upstream'), table('a')], 'a'],
      [[table('a', 'KPI Preparation'), table('b', 'Scenario Upstream')], 'b']
    ] as [DataSource[], string][]) {
      const config = migrate(tables, relation(cardinality));
      assert.equal(config.tableRelations[0].principalDataSourceId, expected);
      const principal = config.dataSources.find((entry) => entry.id === expected)!;
      const secondary = config.dataSources.find((entry) => entry.id !== expected)!;
      assert.equal(principal.fields.length, 1);
      assert.equal(secondary.fields[1].name, `${expected}ID${cardinality === 'manyToMany' ? 's' : ''}`);
      assert.equal(secondary.fields[1].dataType, cardinality === 'manyToMany' ? 'collection' : 'id');
      assert.equal(repairConfig(config).config, config);
      assert.deepEqual(prepareForExport(config).tableRelations, config.tableRelations);
      assert.ok(kpiPoolConfigSchema.safeParse(config).success);
    }
  });

  test(`${cardinality}: explicit principal survives reorder, repair, and export`, () => {
    const config = migrate([table('a'), table('b', 'KPI Preparation')], relation(cardinality, 'b'));
    config.dataSources.reverse();
    assert.equal(prepareForExport(config).tableRelations[0].principalDataSourceId, 'b');
    const exported = buildTableSchemaJsonExport(config);
    assert.equal(exported.KPIPreparation.b.Fields.length, 1);
    assert.equal(exported.PreprocessedConstants.a.Fields[1].Virtual, true);
    assert.deepEqual(exported.KPIPreparation.b.Joins[0], {
      With: 'a', Type: cardinality === 'manyToMany' ? 'N:N' : '1:1', LeftOn: 'bID', RightOn: cardinality === 'manyToMany' ? 'bIDs' : 'bID'
    });
  });
}

test('migration uses group category and displayed group placement', () => {
  const original = { ...createBlankConfig(), schemaVersion: 53,
    dataSources: [table('a'), table('b')], tableRelations: [relation('manyToMany')],
    dataSourceGroups: [{ id: 'g', name: 'First group', category: 'Preprocessed Constants', itemIds: ['b'], position: 0 }]
  };
  assert.equal(repairConfig(original).config.tableRelations[0].principalDataSourceId, 'b');
  original.dataSourceGroups[0].category = 'Scenario Upstream';
  assert.equal(repairConfig(original).config.tableRelations[0].principalDataSourceId, 'a');
});

test('migration removes one-side fields and stale KPI/field/group references while preserving secondary metadata', () => {
  const a = table('a');
  const b = table('b');
  a.fields.push(field('oldCollection', { dataType: 'collection', generatedRelationId: 'r', generatedRelationRole: 'oneCollection' }));
  a.fieldGroups = [{ id: 'group', position: 2, fieldIds: ['oldCollection'], dimensions: [] }];
  b.fields.push(field('foreign', { generatedRelationId: 'r', generatedRelationRole: 'manyForeignKey', details: 'Keep my notes' }));
  b.fields.push(field('derived', { sources: [{ id: 'ref', type: 'dataField', dataSourceId: 'a', fieldId: 'oldCollection', latex: 'x' }] }));
  const config = repairConfig({ ...createBlankConfig(), schemaVersion: 53, dataSources: [a, b], tableRelations: [relation('oneToMany')],
    kpis: [{ ...createBlankKpi(), sources: [{ id: 'kpi-ref', type: 'dataField', dataSourceId: 'a', fieldId: 'oldCollection', latex: 'x' }] }]
  }).config;
  assert.equal(config.dataSources[0].fields.length, 1);
  assert.deepEqual(config.dataSources[0].fieldGroups[0].fieldIds, []);
  assert.equal(config.dataSources[0].fieldGroups[0].position, 1);
  assert.equal(config.dataSources[1].fields[1].id, 'foreign');
  assert.equal(config.dataSources[1].fields[1].details, 'Keep my notes');
  assert.deepEqual(config.dataSources[1].fields[2].sources, []);
  assert.deepEqual(config.kpis[0].sources, []);
});

test('reconciliation handles switching principals and reversing one-to-many direction', () => {
  const config = migrate([table('a'), table('b')], relation('manyToMany', 'a'));
  const swapped = reconcileRelationFields(config.dataSources, [relation('manyToMany', 'b')]);
  assert.equal(swapped[0].fields[1].generatedRelationRole, 'sourceCollection');
  assert.equal(swapped[1].fields.length, 1);
  const reversed = reconcileRelationFields(swapped, [{ ...relation('oneToMany'), sourceDataSourceId: 'b', targetDataSourceId: 'a' }]);
  assert.equal(reversed[0].fields[1].dataType, 'id');
  assert.equal(reversed[0].fields[1].name, 'bID');
  assert.equal(reversed[1].fields.length, 1);
});

test('Excel excludes legacy principal/one-side fields and keeps secondary fields in both directions', async () => {
  for (const cardinality of ['oneToMany', 'oneToOne', 'manyToMany'] as const) {
    for (const principal of cardinality === 'oneToMany' ? ['a'] : ['a', 'b']) {
      const config = migrate([table('a'), table('b')], relation(cardinality, principal));
      const first = config.dataSources.find((entry) => entry.id === principal)!;
      first.fields.push(field('obsolete-virtual', { name: 'OBSOLETE FIELD', generatedRelationId: 'r',
        generatedRelationRole: cardinality === 'oneToMany' ? 'oneCollection' : cardinality === 'oneToOne' ? 'secondaryForeignKey' : principal === 'a' ? 'sourceCollection' : 'targetCollection' }));
      const zip = await JSZip.loadAsync(await createTableSchemaExcelWorkbook(config));
      for (const [index, source] of config.dataSources.entries()) {
        const sheet = await zip.file(`xl/worksheets/sheet${index + 1}.xml`)!.async('string');
        assert.doesNotMatch(sheet, /OBSOLETE FIELD/);
        if (source.id === principal) {
          assert.doesNotMatch(sheet, />Joins</);
          assert.match(sheet, /1 field\./);
          assert.match(sheet, /dimension ref="A1:J4"/);
        } else {
          assert.match(sheet, />Joins</);
          assert.match(sheet, new RegExp(`>${principal}ID${cardinality === 'manyToMany' ? 's' : ''}<`));
        }
      }
    }
  }
});

for (const cardinality of ['oneToMany', 'oneToOne', 'manyToMany'] as const) {
  for (const principalId of cardinality === 'oneToMany' ? ['a'] : ['a', 'b']) {
    test(`${cardinality} / ${principalId}: expand, export, collapse and restore optional field`, async () => {
      const original = migrate([table('a'), table('b')], relation(cardinality, principalId));
      const expanded = setPrincipalFieldExpanded(original, 'r', true);
      const principal = expanded.dataSources.find((source) => source.id === principalId)!;
      const otherId = principalId === 'a' ? 'b' : 'a';
      const optionalField = principal.fields.find((entry) => entry.generatedRelationId === 'r')!;
      assert.ok(optionalField);
      assert.equal(optionalField.dataType, cardinality === 'oneToOne' ? 'id' : 'collection');
      assert.equal(optionalField.name, `${otherId}ID${cardinality === 'oneToOne' ? '' : 's'}`);
      assert.equal(original.dataSources.find((source) => source.id === principalId)!.fields.length, 1);
      optionalField.name = 'Custom linked records';
      optionalField.details = 'Preserve these notes';
      const json = buildTableSchemaJsonExport(expanded).PreprocessedConstants;
      assert.ok(json[principalId].Fields.some((entry) => entry.Name === 'Customlinkedrecords'));
      const zip = await JSZip.loadAsync(await createTableSchemaExcelWorkbook(expanded));
      const sheetIndex = expanded.dataSources.findIndex((source) => source.id === principalId) + 1;
      assert.match(await zip.file(`xl/worksheets/sheet${sheetIndex}.xml`)!.async('string'), /Custom linked records/);
      assert.equal(repairConfig(expanded).config, expanded);
      assert.ok(kpiPoolConfigSchema.safeParse(expanded).success);
      const persisted = repairConfig(JSON.parse(JSON.stringify(prepareForExport(expanded)))).config;
      assert.equal(persisted.tableRelations[0].principalFieldExpanded, true);
      const collapsed = setPrincipalFieldExpanded(persisted, 'r', false);
      assert.equal(collapsed.tableRelations.length, 1);
      assert.equal(collapsed.dataSources.find((source) => source.id === principalId)!.fields.length, 1);
      assert.equal(collapsed.dataSources.find((source) => source.id === otherId)!.fields.length, 2);
      const collapsedJson = buildTableSchemaJsonExport(collapsed).PreprocessedConstants;
      assert.equal(collapsedJson[principalId].Fields.length, 1);
      assert.deepEqual(collapsedJson[principalId].Joins, json[principalId].Joins);
      const collapsedZip = await JSZip.loadAsync(await createTableSchemaExcelWorkbook(collapsed));
      assert.doesNotMatch(await collapsedZip.file(`xl/worksheets/sheet${sheetIndex}.xml`)!.async('string'), /Custom linked records/);
      // Force the repair path as well as the already-current fast path.
      const restored = setPrincipalFieldExpanded(repairConfig({ ...collapsed, schemaVersion: 54 }).config, 'r', true);
      const restoredField = restored.dataSources.find((source) => source.id === principalId)!.fields.find((entry) => entry.generatedRelationId === 'r')!;
      assert.equal(restoredField.id, optionalField.id);
      assert.equal(restoredField.name, optionalField.name);
      assert.equal(restoredField.details, optionalField.details);
      assert.equal(restoredField.dataType, optionalField.dataType);
      assert.equal(setPrincipalFieldExpanded(restored, 'r', true), restored);
    });
  }
}

test('expanding the one side creates a usable many-side primary key when needed', () => {
  const many = { ...table('b'), primaryKeyFieldId: undefined, fields: [] };
  const collapsed = migrate([table('a'), many], relation('oneToMany'));
  const expanded = setPrincipalFieldExpanded(collapsed, 'r', true);
  const key = expanded.dataSources[1].fields.find((entry) => entry.id === expanded.dataSources[1].primaryKeyFieldId)!;
  assert.equal(key.dataType, 'id');
  assert.equal(key.generatedRelationId, undefined);
  assert.equal(expanded.dataSources[0].fields[1].name, `${key.name}s`);
  assert.equal(repairConfig(expanded).config, expanded);
});

test('collapsing removes references to the optional field without deleting the join', () => {
  const expanded = setPrincipalFieldExpanded(migrate([table('a'), table('b')], relation('manyToMany', 'a')), 'r', true);
  const optionalField = expanded.dataSources[0].fields[1];
  expanded.kpis = [{ ...createBlankKpi(), sources: [{ id: 'ref', type: 'dataField', dataSourceId: 'a', fieldId: optionalField.id, latex: 'x' }] }];
  const collapsed = setPrincipalFieldExpanded(expanded, 'r', false);
  assert.deepEqual(collapsed.kpis[0].sources, []);
  assert.equal(collapsed.tableRelations[0].id, 'r');
});
