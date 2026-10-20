import assert from 'node:assert/strict';
import test from 'node:test';
import { createBlankConfig, createBlankKpi } from '../src/configSchema.ts';
import { kpiCatalogChangeAffectsRow } from '../src/kpiCatalogChanges.ts';
import { kpiNumberError } from '../src/kpiNumbers.ts';

test('a mounted row refreshes number validation when another row frees or claims its draft number', () => {
  const owner = { ...createBlankKpi(), name: 'Original owner', displayNumber: 10 };
  const target = { ...createBlankKpi(), name: 'Access to Retail' };
  const previous = { ...createBlankConfig(), kpis: [owner, target] };
  assert.match(kpiNumberError('10', target.id, previous.kpis), /Original owner/);

  for (const displayNumber of [null, 12]) {
    const next = { ...previous, kpis: [{ ...owner, displayNumber }, target] };
    // This is the invalidation gate used by MemoizedMeasuredKpiRow. Without it,
    // the untouched target keeps the old config and rejects the available 10.
    assert.equal(kpiCatalogChangeAffectsRow(previous, next, target.id), true);
    assert.equal(kpiNumberError('10', target.id, next.kpis), '');
    assert.equal(kpiCatalogChangeAffectsRow(next, previous, target.id), true);
    assert.match(kpiNumberError('10', target.id, previous.kpis), /Original owner/);
  }
});

test('number changes invalidate every other row but unrelated edits retain the optimization', () => {
  const owner = { ...createBlankKpi(), displayNumber: 10 };
  const target = createBlankKpi();
  const previous = { ...createBlankConfig(), kpis: [owner, target] };
  const renumbered = { ...previous, kpis: [{ ...owner, displayNumber: 11 }, target] };
  assert.equal(kpiCatalogChangeAffectsRow(previous, renumbered, target.id), true);
  assert.equal(kpiCatalogChangeAffectsRow(previous, renumbered, target.id), true, 'cached summary retains number changes');
  const noteEdited = { ...previous, kpis: [{ ...owner, note: 'A note' }, target] };
  assert.equal(kpiCatalogChangeAffectsRow(previous, noteEdited, target.id), false);
  assert.equal(kpiCatalogChangeAffectsRow(previous, previous, target.id), false);
});

test('a saved number belongs to its own KPI and does not conflict with itself', () => {
  const target = { ...createBlankKpi(), displayNumber: 10 };
  const config = { ...createBlankConfig(), kpis: [createBlankKpi(), target] };
  assert.equal(kpiNumberError('10', target.id, config.kpis), '');
});

test('source edits refresh mounted prerequisite badges through multiple levels', () => {
  const leaf = { ...createBlankKpi(), id: 'leaf' };
  const middle = { ...createBlankKpi(), id: 'middle', sources: [{ id: 'leaf-source', type: 'kpi' as const, kpiId: leaf.id, latex: '' }] };
  const target = { ...createBlankKpi(), sources: [{ id: 'middle-source', type: 'kpi' as const, kpiId: middle.id, latex: '' }] };
  const previous = { ...createBlankConfig(), kpis: [leaf, middle, target] };
  const next = { ...previous, kpis: [{ ...leaf, sources: [{ id: 'field-source', type: 'dataField' as const, dataSourceId: 'table', fieldId: 'ready', latex: '' }] }, middle, target] };
  assert.equal(kpiCatalogChangeAffectsRow(previous, next, middle.id), true);
  assert.equal(kpiCatalogChangeAffectsRow(previous, next, target.id), true);
  assert.equal(kpiCatalogChangeAffectsRow(next, previous, target.id), true);
});
