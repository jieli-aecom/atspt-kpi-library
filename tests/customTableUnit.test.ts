import assert from 'node:assert/strict';
import test from 'node:test';
import { createBlankConfig, createBlankKpi, repairConfig, prepareForExport, kpiPoolConfigSchema } from '../src/configSchema.ts';
import { moveTableField } from '../src/tableFieldMove.ts';
import { renameCustomTableUnit, unitSubscriptReplacer } from '../src/customTableUnit.ts';

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

test('unit renames update global formula components, field formulas, source variants and math in prose', async () => {
  const config = fixture();
  const expression = String.raw`Vehicle + x_{Vehicle_i,Mode} + y_{Vehicle_{j,k},NoBuild} + z_{OtherVehicle}`;
  const expected = String.raw`Vehicle + x_{ServiceArea_i,Mode} + y_{ServiceArea_{j,k},NoBuild} + z_{OtherVehicle}`;
  const item = { tag: 'Vehicle', formula: `y=${expression}`, leftExpression: 'y_{Vehicle}', rightExpression: expression,
    generalExplanation: 'Vehicle prose with $x_{Vehicle}$', terms: [{ term: 'x_{Vehicle}', explanation: 'Vehicle prose' }] };
  const kpi = createBlankKpi();
  kpi.sources = [{ id: 'ref', type: 'dataField', dataSourceId: 'vehicles', fieldId: 'speed', latex: 'x_{Vehicle,Build}', scenarioBaseLatex: 'x_{Vehicle}', scenarioSlot: 1 }];
  kpi.description.formulas = [{ name: '', items: [item] }];
  kpi.spatialScales.cell.rightExpression = expression;
  config.kpis = [kpi, { ...createBlankKpi(), id: 'unaffected' }];
  config.dataSources[0].fields[0] = { ...config.dataSources[0].fields[0], preferredLatex: 'x_{Vehicle}', formulas: [item] };
  config.dataSources.push({ id: 'other', name: 'Other', spatialUnit: '', fieldGroups: [], fields: [
    { ...config.dataSources[0].fields[0], id: 'other-field', sources: [{ id: 'ref', type: 'dataField', dataSourceId: 'vehicles', fieldId: 'speed', latex: 'x_{Vehicle}' }] }
  ] });
  const next = await renameCustomTableUnit(config, 'vehicles', 'Service Area');
  assert.equal(next.dataSources[0].customUnit, 'Service Area');
  assert.equal(next.dataSources[0].fields[0].preferredLatex, 'x_{ServiceArea}');
  assert.equal(next.dataSources[1].fields[0].formulas![0].rightExpression, expected);
  assert.equal(next.dataSources[1].fields[0].sources![0].latex, 'x_{ServiceArea}');
  assert.equal(next.kpis[0].sources[0].latex, 'x_{ServiceArea,Build}');
  assert.equal(next.kpis[0].sources[0].scenarioBaseLatex, 'x_{ServiceArea}');
  const updated = next.kpis[0].description.formulas[0].items[0];
  assert.equal(updated.rightExpression, expected);
  assert.equal(updated.formula, `y=${expected}`);
  assert.equal(updated.leftExpression, 'y_{ServiceArea}');
  assert.equal(updated.generalExplanation, 'Vehicle prose with $x_{ServiceArea}$');
  assert.equal(updated.terms[0].term, 'x_{ServiceArea}');
  assert.equal(updated.terms[0].explanation, 'Vehicle prose');
  assert.equal(next.kpis[0].spatialScales.cell.rightExpression, expected);
  assert.equal(next.kpis[1], config.kpis[1]);
  assert.equal(config.dataSources[0].customUnit, 'Vehicle');
});

test('subscript replacement respects nested commands, escapes, exact tokens and unbraced arguments', () => {
  const replace = unitSubscriptReplacer('V', 'Vehicle');
  assert.equal(replace(String.raw`V+x_V+x_{V_i,\mathrm{Mode}}+x_{VV}+x\_V+\V`), String.raw`V+x_{Vehicle}+x_{Vehicle_i,\mathrm{Mode}}+x_{VV}+x\_V+\V`);
  assert.equal(unitSubscriptReplacer('Vehicle', 'Bus')('x_{Vehicle}+x_{VehicleCount}+Vehicle'), 'x_{Bus}+x_{VehicleCount}+Vehicle');
});

test('spatial tables and empty old units cannot trigger a global replacement', async () => {
  const config = fixture();
  config.dataSources[0].spatialUnit = 'Cell';
  assert.equal(await renameCustomTableUnit(config, 'vehicles', 'Bus'), config);
  config.dataSources[0].spatialUnit = '';
  config.dataSources[0].customUnit = '';
  config.kpis = [createBlankKpi()];
  const result = await renameCustomTableUnit(config, 'vehicles', 'Bus');
  assert.equal(result.kpis, config.kpis);
});

test('large custom unit updates yield to browser tasks and retain untouched branches', async () => {
  const config = fixture();
  config.kpis = Array.from({ length: 2000 }, (_, index) => ({ ...createBlankKpi(), id: String(index),
    sources: [{ id: 'source', type: 'custom' as const, name: '', latex: 'x_{Vehicle}' }] }));
  let yields = 0;
  const next = await renameCustomTableUnit(config, 'vehicles', 'Bus', async () => { yields++; });
  assert.ok(yields > 1);
  assert.equal(next.kpis[1999].sources[0].latex, 'x_{Bus}');
  assert.equal(next.valueEnums, config.valueEnums);
});
