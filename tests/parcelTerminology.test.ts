import assert from 'node:assert/strict';
import test from 'node:test';
import { createBlankConfig, createBlankKpi, repairConfig, prepareForExport, kpiPoolConfigSchema } from '../src/configSchema.ts';
import { migrateParcelSubscripts, migrateParcelTerminology } from '../src/parcelTerminology.ts';
import { CURRENT_SCHEMA_VERSION, spatialScaleKeys, spatialScaleLabels, spatialUnitOptions } from '../src/types.ts';

test('native spatial scales and units use Cell', () => {
  assert.ok(spatialScaleKeys.includes('cell'));
  assert.equal(spatialScaleLabels.cell, 'Cell');
  assert.ok(spatialUnitOptions.includes('Cell'));
  assert.ok(!spatialUnitOptions.some((unit) => /parcel/i.test(unit)));
  assert.ok(createBlankKpi().spatialScales.cell);
});

test('subscripts migrate singular, plural, nested wrappers and multiple expressions', () => {
  assert.equal(
    migrateParcelSubscripts(String.raw`Cell + x_{Cell,NoBuild} + y_{\mathrm{Cells}} + z_{\text{cell},CELL,cells}`),
    String.raw`Cell + x_{Parcel,NoBuild} + y_{\mathrm{Parcels}} + z_{\text{parcel},PARCEL,parcels}`
  );
  const unchanged = String.raw`CellCount + x_{CellCount,cell_id,\cell} + x^{Cell} + x\_{Cell} + x_{\mathrm{Cell}`;
  assert.equal(migrateParcelSubscripts(unchanged), unchanged);
});

const fixture = (schemaVersion: number, legacyScale = 'cell', legacyUnit = 'Cell') => {
  const kpi = createBlankKpi();
  const { cell, ...scales } = kpi.spatialScales;
  const expression = `Flow_{${legacyUnit},NoBuild}`;
  return {
    ...createBlankConfig(), schemaVersion,
    dataSources: [{ id: 'cell-table', name: 'Cell observations', spatialUnit: legacyUnit, fieldGroups: [], fields: [{
      id: 'cell-field', name: 'Flow', meaning: 'Spreadsheet cells', details: '', preprocessingNeeded: false,
      preferredLatex: expression, dataType: 'number', valueUnit: '', options: []
    }] }],
    kpis: [{ ...kpi, id: 'cell-kpi', name: 'Cell KPI',
      sources: [{ id: 'cell-source', type: 'custom', name: 'Cell source', latex: expression }],
      description: { overview: 'Spreadsheet cells', formulaComment: '', formulas: [{ name: '', items: [{
        tag: '', formula: expression, leftExpression: '', rightExpression: expression,
        generalExplanation: 'Cell prose', terms: [{ term: expression, explanation: 'Cell prose' }]
      }] }] },
      spatialScales: { ...scales, [legacyScale]: { ...cell, applicable: true, aggregationMethod: 'Sum', formula: expression, rightExpression: expression } }
    }]
  };
};

test('v45 migration preserves scale settings, references and prose across export/import', () => {
  const input = fixture(45);
  const original = structuredClone(input);
  const { config, warnings } = repairConfig(input);
  assert.deepEqual(input, original);
  assert.equal(config.schemaVersion, CURRENT_SCHEMA_VERSION);
  assert.ok(warnings.some((warning) => warning.includes('45 to 47')));
  assert.equal(config.dataSources[0].spatialUnit, 'Cell');
  assert.equal(config.dataSources[0].fields[0].preferredLatex, 'Flow_{Cell,NoBuild}');
  const kpi = config.kpis[0];
  assert.equal(kpi.id, 'cell-kpi');
  assert.equal(kpi.name, 'Cell KPI');
  assert.equal(kpi.description.overview, 'Spreadsheet cells');
  assert.equal(kpi.sources[0].latex, 'Flow_{Cell,NoBuild}');
  assert.equal(kpi.description.formulas[0].items[0].rightExpression, 'Flow_{Cell,NoBuild}');
  assert.equal(kpi.description.formulas[0].items[0].terms[0].term, 'Flow_{Cell,NoBuild}');
  assert.equal(kpi.spatialScales.cell.applicable, true);
  assert.equal(kpi.spatialScales.cell.aggregationMethod, 'Sum');
  assert.equal(kpi.spatialScales.cell.rightExpression, 'Flow_{Cell,NoBuild}');
  assert.ok(!('parcel' in kpi.spatialScales));
  assert.ok(kpiPoolConfigSchema.safeParse(config).success);
  assert.equal(repairConfig(config).config, config);
  const exported = prepareForExport(config);
  const serialized = JSON.parse(JSON.stringify(exported));
  assert.deepEqual(repairConfig(serialized).config, serialized);
});

test('older Grid configs and unversioned Cell configs migrate to Cell', () => {
  for (const input of [fixture(21, 'grid', 'Grid'), { ...fixture(45), schemaVersion: undefined }]) {
    const config = repairConfig(input).config;
    assert.equal(config.dataSources[0].spatialUnit, 'Cell');
    assert.equal(config.kpis[0].spatialScales.cell.applicable, true);
    assert.equal(config.kpis[0].sources[0].latex, 'Flow_{Cell,NoBuild}');
  }
});

test('migration covers retained and nested expressions without changing unrelated strings', () => {
  const migrated = migrateParcelTerminology({
    spatialScales: { cell: { applicable: true }, parcel: { applicable: false } },
    fields: [{ sources: [{ latex: 'x_{Cell}', scenarioBaseLatex: 'x_{Cell}' }], formulas: [{ rightExpression: 'x_{Cells}' }] }],
    lookups: [{ inputs: [{ representation: 'x_{Cell}' }] }],
    description: 'x_{Cell}', id: 'cell', customUnit: 'Cell culture'
  });
  assert.deepEqual(migrated, {
    spatialScales: { parcel: { applicable: false } },
    fields: [{ sources: [{ latex: 'x_{Parcel}', scenarioBaseLatex: 'x_{Parcel}' }], formulas: [{ rightExpression: 'x_{Parcels}' }] }],
    lookups: [{ inputs: [{ representation: 'x_{Parcel}' }] }],
    description: 'x_{Cell}', id: 'cell', customUnit: 'Cell culture'
  });
});
