import assert from 'node:assert/strict';
import test from 'node:test';
import { createBlankConfig, createBlankKpi } from '../src/configSchema.ts';
import { sameKpiMaterial } from '../src/kpiEquality.ts';
import { reconcileKpiScenarios } from '../src/scenarios.ts';
import { kpiScenarioTypes } from '../src/types.ts';

test('dropdown transitions are material even with no selected sources', () => {
  const config = createBlankConfig();
  for (const from of kpiScenarioTypes) {
    for (const to of kpiScenarioTypes) {
      const previous = { ...createBlankKpi(), scenarioType: from };
      const candidate = reconcileKpiScenarios(config, { ...previous, scenarioType: to });
      assert.equal(sameKpiMaterial(previous, candidate), from === to, `${from} to ${to}`);
      const committed = sameKpiMaterial(previous, candidate) ? previous : candidate;
      assert.equal(committed.scenarioType, to);
    }
  }
});

test('scenario name edits are material before sources are selected', () => {
  const previous = { ...createBlankKpi(), scenarioType: 'Inter-Scenario' as const };
  for (const scenarioNames of [['Build', 'Scenario 2'], ['Scenario', 'No Build']] as [string, string][]) {
    assert.equal(sameKpiMaterial(previous, { ...previous, scenarioNames }), false);
  }
});

test('equivalent content ignores timestamp and object key order', () => {
  const previous = createBlankKpi();
  const reordered = Object.fromEntries(Object.entries(structuredClone(previous)).reverse()) as typeof previous;
  assert.equal(sameKpiMaterial(previous, { ...reordered, lastModified: '2000-01-01T00:00:00.000Z' }), true);
  assert.equal(sameKpiMaterial(previous, { ...previous, description: { ...previous.description, overview: 'Changed' } }), false);
});
