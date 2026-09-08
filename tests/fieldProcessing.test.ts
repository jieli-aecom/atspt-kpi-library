import assert from 'node:assert/strict';
import test from 'node:test';
import { createBlankConfig, createBlankKpi, repairConfig, prepareForExport, kpiPoolConfigSchema, reconcileFieldSources } from '../src/configSchema.ts';
import { mergeConcurrentConfig } from '../src/configMerge.ts';
import { moveTableField } from '../src/tableFieldMove.ts';
import { CURRENT_SCHEMA_VERSION, type DataSource, type DataSourceField, type KpiFormulaItem } from '../src/types.ts';

const field = (id: string): DataSourceField => ({ id, name: id, meaning: '', details: '', preprocessingNeeded: false, preferredLatex: '', dataType: 'number', valueUnit: '', options: [] });
const formula: KpiFormulaItem = { tag: 'Adjusted', formula: 'y = x + c', leftExpression: 'y', rightExpression: 'x + c', generalExplanation: 'Adjust the observation', terms: [{ term: 'c', explanation: 'Calibration' }] };
const fixture = () => {
  const config = createBlankConfig();
  const table: DataSource = { id: 'table', name: 'Observations', description: 'Observed values', spatialUnit: 'Link', fieldGroups: [], fields: [field('raw'), { ...field('processed'), sources: [
    { id: 'input', type: 'dataField', dataSourceId: 'table', fieldId: 'raw', latex: 'x' },
    { id: 'constant', type: 'variable', variableId: 'offset', latex: 'c' },
    { id: 'lookup', type: 'lookup', lookupId: 'lookup', latex: 'f(x)' },
    { id: 'custom', type: 'custom', name: 'Custom input', latex: 'z' }
  ], formulas: [structuredClone(formula)] }] };
  config.dataSources = [table, { id: 'target', name: 'Target', spatialUnit: 'Link', fields: [], fieldGroups: [] }];
  config.dataSourceGroups = [{ id: 'group', name: 'Traffic', description: 'Traffic observations', itemIds: ['table'], position: 0 }];
  config.variables = [{ id: 'offset', name: 'Offset', explanation: '', defaultValue: '1', unit: '' }];
  config.lookups = [{ id: 'lookup', outputName: 'Adjustment', outputExplanation: '', outputValueType: 'number', outputOptions: [], text: '', inputs: [] }];
  config.kpis = [createBlankKpi()];
  return config;
};

test('v39 migration preserves field setup and existing KPI formulae', () => {
  const original = fixture();
  delete original.dataSources[0].description;
  delete original.dataSourceGroups[0].description;
  delete original.dataSources[0].fields[1].sources;
  delete original.dataSources[0].fields[1].formulas;
  original.dataSources[0].fields[1].details = 'Keep these notes';
  const result = repairConfig({ ...original, schemaVersion: 39 });
  assert.equal(result.config.schemaVersion, CURRENT_SCHEMA_VERSION);
  assert.equal(result.config.dataSources[0].fields[1].details, 'Keep these notes');
  assert.deepEqual(result.config.dataSources[0].fields[1].sources, []);
  assert.deepEqual(result.config.dataSources[0].fields[1].formulas, []);
  assert.deepEqual(result.config.kpis, original.kpis);
  assert.ok(kpiPoolConfigSchema.safeParse(result.config).success);
  assert.equal(repairConfig(result.config).config, result.config);
});

test('descriptions, all allowed sources, and flat formulae survive repair and export', () => {
  const original = fixture();
  const migrated = repairConfig({ ...original, schemaVersion: 39 }).config;
  const roundTrip = repairConfig(JSON.parse(JSON.stringify(prepareForExport(migrated)))).config;
  assert.equal(roundTrip.dataSources[0].description, original.dataSources[0].description);
  assert.equal(roundTrip.dataSourceGroups[0].description, original.dataSourceGroups[0].description);
  assert.deepEqual(roundTrip.dataSources[0].fields[1].sources, original.dataSources[0].fields[1].sources);
  assert.deepEqual(roundTrip.dataSources[0].fields[1].formulas, [formula]);
  assert.ok(kpiPoolConfigSchema.safeParse(roundTrip).success);
});

test('rejects KPI, self, duplicate and missing field inputs without losing formula text', () => {
  const original = fixture();
  const raw = JSON.parse(JSON.stringify(original));
  raw.dataSources[0].fields[1].sources.push(
    { id: 'kpi', type: 'kpi', kpiId: original.kpis[0].id, latex: 'K' },
    { id: 'self', type: 'dataField', dataSourceId: 'table', fieldId: 'processed', latex: 'y' },
    { id: 'missing', type: 'dataField', dataSourceId: 'table', fieldId: 'gone', latex: 'missing' },
    { id: 'duplicate', type: 'variable', variableId: 'offset', latex: 'd' }
  );
  assert.equal(kpiPoolConfigSchema.safeParse(raw).success, false);
  const repaired = repairConfig(raw);
  assert.deepEqual(repaired.config.dataSources[0].fields[1].sources, original.dataSources[0].fields[1].sources);
  assert.deepEqual(repaired.config.dataSources[0].fields[1].formulas, [formula]);
  assert.ok(repaired.warnings.length > 0);
});

test('moves referenced and processing fields while preserving formulae and dependencies', () => {
  const original = fixture();
  const result = moveTableField(original, 'table', 'raw', 'target');
  assert.equal(result.moved, true);
  assert.deepEqual(result.config.dataSources[0].fields[0].sources?.[0], { id: 'input', type: 'dataField', dataSourceId: 'target', fieldId: 'raw', latex: 'x' });
  assert.deepEqual(result.config.dataSources[0].fields[0].formulas, [formula]);
  const movedProcessing = moveTableField(result.config, 'table', 'processed', 'target');
  assert.deepEqual(movedProcessing.config.dataSources[1].fields[1].formulas, [formula]);
  assert.equal(reconcileFieldSources(movedProcessing.config), movedProcessing.config.dataSources);
});

test('deleted library inputs are cleared but formulae survive', () => {
  const config = fixture();
  config.variables = [];
  config.lookups = [];
  config.dataSources[0].fields = config.dataSources[0].fields.slice(1);
  const tables = reconcileFieldSources(config);
  assert.deepEqual(tables[0].fields[0].sources?.map((source) => source.type), ['custom']);
  assert.deepEqual(tables[0].fields[0].formulas, [formula]);
});

test('hosted merge preserves field processing and table descriptions', () => {
  const base = fixture();
  const incoming = structuredClone(base);
  incoming.dataSources[0].description = 'Edited description';
  incoming.dataSources[0].fields[1].formulas = [];
  const remote = structuredClone(base);
  remote.title = 'Remote title';
  const merged = mergeConcurrentConfig(remote, base, incoming);
  assert.equal(merged.title, 'Remote title');
  assert.equal(merged.dataSources[0].description, 'Edited description');
  assert.deepEqual(merged.dataSources[0].fields[1].formulas, []);
});

test('future schemas still fail closed', () => {
  assert.throws(() => repairConfig({ ...fixture(), schemaVersion: CURRENT_SCHEMA_VERSION + 1 }), /newer than/);
});
