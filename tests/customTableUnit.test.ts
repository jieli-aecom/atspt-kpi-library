import assert from 'node:assert/strict';
import test from 'node:test';
import { createBlankConfig, createBlankKpi, repairConfig, prepareForExport, kpiPoolConfigSchema } from '../src/configSchema.ts';
import { moveTableField } from '../src/tableFieldMove.ts';

const fixture = () => {
  const config = createBlankConfig();
  config.dataSources = [{
    id: 'vehicles', name: 'Vehicles', spatialUnit: '', customUnit: 'Vehicle', fieldGroups: [],
    fields: [{ id: 'speed', name: 'Speed', meaning: '', details: '', preprocessingNeeded: false, preferredLatex: '', dataType: 'collection', valueUnit: '', options: [] }]
  }];
  return config;
};

test('custom units survive validation, repair and export/import', () => {
  const config = fixture();
  const parsed = kpiPoolConfigSchema.parse(config);
  assert.equal(parsed.dataSources[0].customUnit, 'Vehicle');
  for (const schemaVersion of [39, config.schemaVersion]) {
    const repaired = repairConfig({ ...config, schemaVersion }).config;
    const restored = repairConfig(JSON.parse(JSON.stringify(prepareForExport(repaired)))).config;
    assert.equal(restored.dataSources[0].spatialUnit, '');
    assert.equal(restored.dataSources[0].customUnit, 'Vehicle');
  }
});

test('generated collection LaTeX includes the custom table unit in its subscript', () => {
  const config = fixture();
  const kpi = createBlankKpi();
  kpi.sources = [{ id: 'speed-source', type: 'dataField', dataSourceId: 'vehicles', fieldId: 'speed', latex: '\\{Speed\\}' }];
  config.kpis = [kpi];
  const repaired = repairConfig({ ...config, schemaVersion: 39 }).config;
  assert.equal(repaired.kpis[0].sources[0].latex, '\\{Speed\\}_{Vehicle}');
});

test('fields cannot move between tables with different custom units', () => {
  const config = fixture();
  config.dataSources.push({ id: 'people', name: 'People', spatialUnit: '', customUnit: 'Person', fields: [], fieldGroups: [] });
  assert.equal(moveTableField(config, 'vehicles', 'speed', 'people').moved, false);
  config.dataSources[1].customUnit = 'Vehicle';
  assert.equal(moveTableField(config, 'vehicles', 'speed', 'people').moved, true);
});
