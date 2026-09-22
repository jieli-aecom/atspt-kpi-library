import assert from 'node:assert/strict';
import test from 'node:test';
import { createBlankConfig, createBlankKpi, kpiPoolConfigSchema, prepareForExport, repairConfig } from '../src/configSchema.ts';
import { mergeConcurrentConfig, mergeImportedConfig } from '../src/configMerge.ts';
import { kpiNumberError, sortKpisByNumber } from '../src/kpiNumbers.ts';
import { matchesKpiNumberAndScenario } from '../src/kpiNameFilters.ts';
import { CURRENT_SCHEMA_VERSION } from '../src/types.ts';
import { compareFocusedPerformanceAreas, compareUseCaseAssignments } from '../src/useCaseFilters.ts';

test('schema 51 leaves numbers blank without changing internal IDs, references or timestamps', () => {
  const originals = [createBlankKpi(), createBlankKpi(), createBlankKpi()];
  originals[1].prerequisite.kpis = [originals[0].id];
  const legacy = originals.map(({ displayNumber, ...kpi }) => kpi);
  const { config } = repairConfig({ ...createBlankConfig(), schemaVersion: 51, kpis: legacy });
  assert.equal(config.schemaVersion, CURRENT_SCHEMA_VERSION);
  assert.deepEqual(config.kpis.map((kpi) => kpi.displayNumber), [null, null, null]);
  assert.deepEqual(config.kpis.map(({ displayNumber, ...kpi }) => kpi), legacy);
  assert.equal(repairConfig(config).config, config);
  assert.deepEqual(repairConfig(JSON.parse(JSON.stringify(prepareForExport(config)))).config.kpis, config.kpis);
  assert.throws(() => repairConfig({ ...config, schemaVersion: CURRENT_SCHEMA_VERSION + 1 }));
});

test('repair preserves valid numbers and leaves missing, invalid and duplicate numbers blank', () => {
  const input = [undefined, 1, 1, -2.5, 0, Infinity, 10].map((displayNumber) => ({ ...createBlankKpi(), displayNumber }));
  const config = repairConfig({ ...createBlankConfig(), kpis: input }).config;
  assert.deepEqual(config.kpis.map((kpi) => kpi.displayNumber), [null, 1, null, -2.5, 0, null, 10]);
  assert.ok(kpiPoolConfigSchema.safeParse(config).success);
  assert.equal(kpiPoolConfigSchema.safeParse({ ...config, kpis: [config.kpis[1], { ...config.kpis[2], displayNumber: 1 }] }).success, false);
});

test('number edits accept unused finite numbers and reject duplicates across all rows', () => {
  const kpis = [{ ...createBlankKpi(), displayNumber: 2 }, { ...createBlankKpi(), displayNumber: 10 }];
  for (const value of ['', ' ', '2', '2.0', '0', '-3', '1.5', '1e2']) assert.equal(kpiNumberError(value, kpis[0].id, kpis), '');
  assert.match(kpiNumberError('10.0', kpis[0].id, kpis), /already taken/);
  for (const value of ['abc', 'Infinity', '1e999', '0x10']) assert.match(kpiNumberError(value, kpis[0].id, kpis), /valid number/);
  assert.equal(createBlankKpi().displayNumber, null);
});

test('imports and concurrent additions repair collisions without losing KPI identity or references', () => {
  const base = { ...createBlankConfig(), kpis: [createBlankKpi()] };
  const current = { ...base, kpis: [...base.kpis, { ...createBlankKpi(), displayNumber: 2 }] };
  const incoming = { ...base, kpis: [...base.kpis, { ...createBlankKpi(), displayNumber: 2 }] };
  incoming.kpis[1].prerequisite.kpis = [base.kpis[0].id];
  for (const merged of [mergeImportedConfig(current, incoming).config, mergeConcurrentConfig(current, base, incoming)]) {
    assert.equal(merged.kpis.length, 3);
    assert.deepEqual(merged.kpis.map((kpi) => kpi.displayNumber), [null, 2, null]);
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
  assert.ok(matchesKpiNumberAndScenario(createBlankKpi(), '', []));
  assert.equal(matchesKpiNumberAndScenario(createBlankKpi(), '0', []), false);
});

test('schema 52 preserves assigned numbers while allowing multiple blank values and clearing to null', () => {
  const input = { ...createBlankConfig(), schemaVersion: 52, kpis: [
    { ...createBlankKpi(), displayNumber: 0 },
    { ...createBlankKpi(), displayNumber: 12.5 },
    createBlankKpi(), createBlankKpi()
  ] };
  const config = repairConfig(input).config;
  assert.deepEqual(config.kpis.map((kpi) => kpi.displayNumber), [0, 12.5, null, null]);
  const cleared = { ...config, kpis: config.kpis.map((kpi) => ({ ...kpi, displayNumber: null })) };
  assert.ok(kpiPoolConfigSchema.safeParse(cleared).success);
  assert.deepEqual(repairConfig(JSON.parse(JSON.stringify(prepareForExport(cleared)))).config.kpis, cleared.kpis);
  assert.equal(repairConfig(cleared).config, cleared);
});

test('blank numbers sort last in either direction, keeping their original order within primary ties', () => {
  const kpis = [null, 10, null, 2].map((displayNumber) => ({ ...createBlankKpi(), displayNumber }));
  for (const order of ['asc', 'desc'] as const) {
    const sorted = sortKpisByNumber(kpis, order, () => 0);
    assert.deepEqual(sorted.map((kpi) => kpi.displayNumber), order === 'asc' ? [2, 10, null, null] : [10, 2, null, null]);
    assert.deepEqual(sorted.slice(2).map((kpi) => kpi.id), [kpis[0].id, kpis[2].id]);
  }
});
