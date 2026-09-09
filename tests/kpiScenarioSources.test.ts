import assert from 'node:assert/strict';
import test from 'node:test';
import { createBlankConfig, createBlankKpi, repairConfig, prepareForExport, kpiPoolConfigSchema } from '../src/configSchema.ts';
import { reconcileKpiScenarios, scenarioLatex } from '../src/scenarios.ts';
import { CURRENT_SCHEMA_VERSION, type KpiPoolConfig, type KpiReferenceSource } from '../src/types.ts';

const fixture = (): KpiPoolConfig => ({ ...createBlankConfig(), kpis: [
  { ...createBlankKpi(), id: 'input', name: 'Travel Time' },
  { ...createBlankKpi(), id: 'comparison', scenarioType: 'Inter-Scenario', scenarioNames: ['Build', 'No Build'], sources: [{ id: 'ref', type: 'kpi', kpiId: 'input', latex: 'T_{Link}' }] }
] });

test('schema 42 assigns an existing Scenario KPI reference to the first comparison scenario', () => {
  const original = fixture();
  const result = repairConfig({ ...original, schemaVersion: 42 }).config;
  assert.equal(result.schemaVersion, CURRENT_SCHEMA_VERSION);
  assert.deepEqual(result.kpis[1].sources[0], { id: 'ref', type: 'kpi', kpiId: 'input', scenarioSlot: 0, scenarioBaseLatex: 'T_{Link}', latex: scenarioLatex('T_{Link}', 'Build') });
  assert.equal(repairConfig(result).config, result);
});

test('both KPI scenario references survive slow-path repair and export', () => {
  const config = fixture();
  config.kpis[1] = reconcileKpiScenarios(config, config.kpis[1]);
  const first = config.kpis[1].sources[0] as KpiReferenceSource;
  config.kpis[1].sources.push({ ...first, id: 'ref-2', scenarioSlot: 1, latex: scenarioLatex('T_{Link}', 'No Build') });
  const result = repairConfig({ ...config, schemaVersion: 42 }).config;
  assert.equal(result.kpis[1].sources.length, 2);
  assert.deepEqual(result.kpis[1].sources.map((source) => (source as KpiReferenceSource).scenarioSlot), [0, 1]);
  const exported = prepareForExport(result);
  assert.ok(kpiPoolConfigSchema.safeParse(exported).success);
  assert.deepEqual(exported.kpis[1].sources, result.kpis[1].sources);
});

test('renaming preserves separate source IDs and updates formula references', () => {
  const config = fixture();
  let kpi = reconcileKpiScenarios(config, config.kpis[1]);
  const first = kpi.sources[0] as KpiReferenceSource;
  const second = { ...first, id: 'ref-2', scenarioSlot: 1 as const, latex: scenarioLatex('T_{Link}', 'No Build') };
  kpi.sources = [first, second];
  kpi.description.formulas = [{ name: '', items: [{ tag: '', formula: `${first.latex} - ${second.latex}`, leftExpression: '', rightExpression: `${first.latex} - ${second.latex}`, generalExplanation: '', terms: [] }] }];
  kpi = reconcileKpiScenarios(config, { ...kpi, scenarioNames: ['Alternative A', 'Alternative B'] });
  assert.deepEqual(kpi.sources.map((source) => source.id), ['ref', 'ref-2']);
  assert.equal(kpi.description.formulas[0].items[0].rightExpression, `${scenarioLatex('T_{Link}', 'Alternative A')} - ${scenarioLatex('T_{Link}', 'Alternative B')}`);
});

test('changing the referenced KPI type collapses copies and retains expression and base for reactivation', () => {
  const config = fixture();
  let kpi = reconcileKpiScenarios(config, config.kpis[1]);
  const first = kpi.sources[0] as KpiReferenceSource;
  kpi.sources.push({ ...first, id: 'ref-2', scenarioSlot: 1, latex: scenarioLatex('T_{Link}', 'No Build') });
  config.kpis[0].scenarioType = 'Base Year';
  kpi = reconcileKpiScenarios(config, kpi);
  assert.equal(kpi.sources.length, 1);
  assert.equal(kpi.sources[0].latex, first.latex);
  assert.equal((kpi.sources[0] as KpiReferenceSource).scenarioSlot, undefined);
  config.kpis[0].scenarioType = 'Scenario';
  kpi = reconcileKpiScenarios(config, kpi);
  assert.equal(kpi.sources[0].latex, first.latex);
});

test('only Scenario KPI references depend on the comparison scenario', () => {
  for (const scenarioType of ['Base Year', 'Inter-Scenario'] as const) {
    const config = fixture();
    config.kpis[0].scenarioType = scenarioType;
    assert.equal(reconcileKpiScenarios(config, config.kpis[1]), config.kpis[1]);
  }
  const config = fixture();
  config.kpis[1].scenarioType = 'Scenario';
  assert.equal(reconcileKpiScenarios(config, config.kpis[1]), config.kpis[1]);
});

test('a KPI without an output expression uses its name for scenario references', () => {
  const config = fixture();
  config.kpis[1].sources[0].latex = '';
  const kpi = reconcileKpiScenarios(config, config.kpis[1]);
  assert.equal(kpi.sources[0].latex, scenarioLatex('TravelTime', 'Build'));
});
