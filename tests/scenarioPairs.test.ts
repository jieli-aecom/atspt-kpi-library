import assert from 'node:assert/strict';
import test from 'node:test';
import { createBlankConfig, createBlankKpi, repairConfig, prepareForExport } from '../src/configSchema.ts';
import { groupSourceSelections, reconcileKpiScenarios, sourceSelectionKey, scenarioLatex } from '../src/scenarios.ts';
import type { KpiDataFieldSource, KpiPoolConfig } from '../src/types.ts';

const fixture = (): KpiPoolConfig => ({ ...createBlankConfig(), dataSources: [{ id: 't', name: 'Network', category: 'Scenario Upstream', spatialUnit: 'Link', fieldGroups: [], fields: [{ id: 'f', name: 'Volume', meaning: '', details: '', preprocessingNeeded: false, preferredLatex: '', dataType: 'number', valueUnit: '', options: [] }] }], kpis: [{ ...createBlankKpi(), id: 'k', scenarioType: 'Inter-Scenario', sources: [{ id: 's', type: 'dataField', dataSourceId: 't', fieldId: 'f', latex: 'Volume_{Link}' }] }] });

test('selecting one dependent field produces one logical selection with two expressions', () => {
  const config = fixture();
  const kpi = reconcileKpiScenarios(config, config.kpis[0]);
  assert.equal(groupSourceSelections(kpi.sources).length, 1);
  assert.equal(kpi.sources.length, 2);
  assert.deepEqual(kpi.sources.map((source) => source.latex), [scenarioLatex('Volume_{Link}', 'Scenario'), scenarioLatex('Volume_{Link}', 'Scenario 2')]);
  assert.equal(reconcileKpiScenarios(config, kpi), kpi);
  const key = sourceSelectionKey(kpi.sources[0]);
  const removed = { ...kpi, sources: kpi.sources.filter((source) => sourceSelectionKey(source) !== key) };
  assert.equal(reconcileKpiScenarios(config, removed).sources.length, 0);
});

test('schema 44 completes a second-only selection while preserving its ID and custom expression', () => {
  const config = fixture();
  const source = config.kpis[0].sources[0] as KpiDataFieldSource;
  source.scenarioSlot = 1;
  source.scenarioBaseLatex = 'custom_{Link}';
  source.latex = scenarioLatex(source.scenarioBaseLatex, 'Scenario 2');
  const repaired = repairConfig({ ...config, schemaVersion: 44 }).config;
  assert.equal(repaired.kpis[0].sources.length, 2);
  assert.equal(repaired.kpis[0].sources[1].id, 's');
  assert.equal(repaired.kpis[0].sources[1].latex, source.latex);
  assert.deepEqual(prepareForExport(repaired).kpis[0].sources, repaired.kpis[0].sources);
});

test('existing pair keeps independent base expressions and stable IDs', () => {
  const config = fixture();
  const first = config.kpis[0].sources[0] as KpiDataFieldSource;
  config.kpis[0].sources = [{ ...first, scenarioSlot: 0, scenarioBaseLatex: 'a', latex: scenarioLatex('a', 'Scenario') }, { ...first, id: 'second', scenarioSlot: 1, scenarioBaseLatex: 'b', latex: scenarioLatex('b', 'Scenario 2') }];
  const updated = reconcileKpiScenarios(config, { ...config.kpis[0], scenarioNames: ['Normal', 'Disruption'] });
  assert.deepEqual(updated.sources.map((source) => source.id), ['s', 'second']);
  assert.deepEqual(updated.sources.map((source) => source.latex), [scenarioLatex('a', 'Normal'), scenarioLatex('b', 'Disruption')]);
});

test('new pair IDs avoid existing source IDs, and constant tables stay single', () => {
  const config = fixture();
  config.kpis[0].sources.push({ id: 's-scenario-1', type: 'custom', name: 'Other', latex: 'z' });
  const updated = reconcileKpiScenarios(config, config.kpis[0]);
  assert.equal(new Set(updated.sources.map((source) => source.id)).size, 3);
  config.dataSources[0].category = 'Preprocessed Constants';
  assert.equal(reconcileKpiScenarios(config, updated).sources.length, 2);
});
