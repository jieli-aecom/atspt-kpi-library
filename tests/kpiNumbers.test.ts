import assert from 'node:assert/strict';
import test from 'node:test';
import { createBlankConfig, createBlankKpi, kpiPoolConfigSchema, prepareForExport, repairConfig } from '../src/configSchema.ts';
import { mergeConcurrentConfig, mergeImportedConfig } from '../src/configMerge.ts';
import { kpiNumberError, sortKpisByNumber } from '../src/kpiNumbers.ts';
import { matchesKpiNumberAndScenario } from '../src/kpiNameFilters.ts';
import { CURRENT_SCHEMA_VERSION } from '../src/types.ts';
import { compareFocusedPerformanceAreas, compareUseCaseAssignments } from '../src/useCaseFilters.ts';

test('schema 51 gains sequential numbers without changing internal IDs, references or timestamps', () => {
  const originals = [createBlankKpi(), createBlankKpi(), createBlankKpi()];
  originals[1].prerequisite.kpis = [originals[0].id];
  const legacy = originals.map(({ displayNumber, ...kpi }) => kpi);
  const { config } = repairConfig({ ...createBlankConfig(), schemaVersion: 51, kpis: legacy });
  assert.equal(config.schemaVersion, CURRENT_SCHEMA_VERSION);
  assert.deepEqual(config.kpis.map((kpi) => kpi.displayNumber), [1, 2, 3]);
  assert.deepEqual(config.kpis.map(({ displayNumber, ...kpi }) => kpi), legacy);
  assert.equal(repairConfig(config).config, config);
  assert.deepEqual(repairConfig(JSON.parse(JSON.stringify(prepareForExport(config)))).config.kpis, config.kpis);
  assert.throws(() => repairConfig({ ...config, schemaVersion: CURRENT_SCHEMA_VERSION + 1 }));
});

test('repair reserves valid numbers before assigning missing, invalid and duplicate numbers', () => {
  const input = [undefined, 1, 1, -2.5, 0, Infinity, 10].map((displayNumber) => ({ ...createBlankKpi(), displayNumber }));
  const config = repairConfig({ ...createBlankConfig(), kpis: input }).config;
  assert.deepEqual(config.kpis.map((kpi) => kpi.displayNumber), [2, 1, 3, -2.5, 0, 4, 10]);
  assert.ok(kpiPoolConfigSchema.safeParse(config).success);
  assert.equal(kpiPoolConfigSchema.safeParse({ ...config, kpis: [config.kpis[0], { ...config.kpis[1], displayNumber: 2 }] }).success, false);
});

test('number edits accept unused finite numbers and reject duplicates across all rows', () => {
  const kpis = [{ ...createBlankKpi(), displayNumber: 2 }, { ...createBlankKpi(), displayNumber: 10 }];
  for (const value of ['2', '2.0', '0', '-3', '1.5', '1e2']) assert.equal(kpiNumberError(value, kpis[0].id, kpis), '');
  assert.match(kpiNumberError('10.0', kpis[0].id, kpis), /already taken/);
  for (const value of ['', ' ', 'abc', 'Infinity', '1e999', '0x10']) assert.match(kpiNumberError(value, kpis[0].id, kpis), /valid number/);
  assert.equal(createBlankKpi(kpis).displayNumber, 1);
});

test('imports and concurrent additions repair collisions without losing KPI identity or references', () => {
  const base = { ...createBlankConfig(), kpis: [createBlankKpi()] };
  const current = { ...base, kpis: [...base.kpis, createBlankKpi(base.kpis)] };
  const incoming = { ...base, kpis: [...base.kpis, createBlankKpi(base.kpis)] };
  incoming.kpis[1].prerequisite.kpis = [base.kpis[0].id];
  for (const merged of [mergeImportedConfig(current, incoming).config, mergeConcurrentConfig(current, base, incoming)]) {
    assert.equal(merged.kpis.length, 3);
    assert.equal(new Set(merged.kpis.map((kpi) => kpi.displayNumber)).size, 3);
    assert.deepEqual(merged.kpis.find((kpi) => kpi.id === incoming.kpis[1].id)?.prerequisite.kpis, [base.kpis[0].id]);
    assert.ok(kpiPoolConfigSchema.safeParse(merged).success);
  }
});

test('numeric sorting persists as the tie-breaker in both other column sorts', () => {
  const kpis = [10, 2, -1].map((displayNumber) => ({ ...createBlankKpi(), displayNumber }));
  assert.deepEqual(sortKpisByNumber(kpis, 'asc').map((kpi) => kpi.displayNumber), [-1, 2, 10]);
  for (const primary of [
    (left: typeof kpis[number], right: typeof kpis[number]) => compareUseCaseAssignments([], [], left, right, 'asc'),
    (left: typeof kpis[number], right: typeof kpis[number]) => compareFocusedPerformanceAreas([], left, right, 'case', 'desc')
  ]) {
    assert.deepEqual(sortKpisByNumber(kpis, 'desc', primary).map((kpi) => kpi.displayNumber), [10, 2, -1]);
  }
  assert.equal(sortKpisByNumber(kpis, undefined), kpis);
  assert.deepEqual(kpis.map((kpi) => kpi.displayNumber), [10, 2, -1]);
});

test('exact number and scenario filters intersect; selected scenarios form a union', () => {
  const kpi = { ...createBlankKpi(), displayNumber: 12, scenarioType: 'Base Year' as const };
  assert.ok(matchesKpiNumberAndScenario(kpi, '', []));
  assert.ok(matchesKpiNumberAndScenario(kpi, '12.0', ['Base Year', 'Inter-Scenario']));
  assert.equal(matchesKpiNumberAndScenario(kpi, '1', []), false);
  assert.equal(matchesKpiNumberAndScenario(kpi, '12', ['Scenario']), false);
  assert.equal(matchesKpiNumberAndScenario(kpi, 'invalid', []), false);
});
