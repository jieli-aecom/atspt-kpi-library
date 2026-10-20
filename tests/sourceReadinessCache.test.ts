import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { createBlankConfig, createBlankKpi } from '../src/configSchema.ts';
import { matchesSourceFilters, sourceFilterEntry } from '../src/sourceFilters.ts';
import { enumCategoryKeys, type KpiPoolConfig, type KpiSourceItem } from '../src/types.ts';

// Exercise the actual index reuse and filter cache gates used by the app.
const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const indexCode = app.slice(app.indexOf('const buildEnumMaps ='), app.indexOf('const compileFilters ='));
const filterCode = app.slice(app.indexOf('  const activeDeferredFilterCount ='), app.indexOf('  const filteredKpis ='));
const compile = (code: string) => ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const buildIndexes = runInNewContext(compile(`${indexCode}\nbuildAppIndexes;`), {
  enumCategoryKeys, sourceFilterEntry,
  normalize: (value: string) => value.toLowerCase(),
  formulaItemsText: () => ''
});
const filterRows = runInNewContext(compile(`
  (config, indexes, deferredFilters, filterMatchCacheRef) => {
    const focusedAssignment = undefined;
    const pinnedFilterIdSet = new Set();
    ${filterCode}
    return filterMatchIds;
  };
`), {
  activeFilterCount: () => 1,
  compileFilters: (filters: unknown) => filters,
  matchesFilters: (indexes: any, kpi: { id: string }, filters: any) =>
    matchesSourceFilters(indexes.searchByKpiId.get(kpi.id).sources, new Set(), [], filters.sourceStatus)
});

const fieldSource = (fieldId: string): KpiSourceItem => ({ id: 'field-source', type: 'dataField', dataSourceId: 'table', fieldId, latex: '' });
const kpiSource = (kpiId: string): KpiSourceItem => ({ id: `source-${kpiId}`, type: 'kpi', kpiId, latex: '' });
const fixture = (): KpiPoolConfig => ({
  ...createBlankConfig(),
  dataSources: [{ id: 'table', name: 'Table', spatialUnit: '', fieldGroups: [], fields: [
    { id: 'sample', name: 'Sample', status: 'With Sample', meaning: '', details: '', preprocessingNeeded: false, preferredLatex: '', dataType: 'number', valueUnit: '', options: [] },
    { id: 'ready', name: 'Ready', status: 'Ready', meaning: '', details: '', preprocessingNeeded: false, preferredLatex: '', dataType: 'number', valueUnit: '', options: [] }
  ] }],
  kpis: [
    { ...createBlankKpi(), id: 'leaf', sources: [fieldSource('sample')] },
    { ...createBlankKpi(), id: 'middle', sources: [kpiSource('leaf')] },
    { ...createBlankKpi(), id: 'dependent', sources: [kpiSource('middle')] }
  ]
});

test('cached indexes and an active readiness filter refresh unchanged dependent KPIs', () => {
  const previous = fixture();
  const indexes = buildIndexes(previous);
  const filters = { sourceStatus: 'Ready', sourceFlags: [] };
  const cache = { current: undefined };
  assert.deepEqual([...filterRows(previous, indexes, filters, cache)], []);

  const next = { ...previous, kpis: previous.kpis.map((kpi) => kpi.id === 'leaf' ? { ...kpi, sources: [fieldSource('ready')] } : kpi) };
  const nextIndexes = buildIndexes(next, previous, indexes);
  assert.equal(nextIndexes.searchByKpiId.get('dependent').sources.status, 'Ready');
  assert.deepEqual([...filterRows(next, nextIndexes, filters, cache)], ['leaf', 'middle', 'dependent']);

  const restoredIndexes = buildIndexes(previous, next, nextIndexes);
  assert.equal(restoredIndexes.searchByKpiId.get('dependent').sources.status, 'With Sample');
  assert.deepEqual([...filterRows(previous, restoredIndexes, filters, cache)], []);
});

test('readiness caches detect deleted prerequisites and preserve filter results for unrelated edits', () => {
  const previous = fixture();
  const indexes = buildIndexes(previous);
  const filters = { sourceStatus: 'With Sample', sourceFlags: [] };
  const cache = { current: undefined };
  const matches = filterRows(previous, indexes, filters, cache);
  const renamed = { ...previous, kpis: previous.kpis.map((kpi) => kpi.id === 'leaf' ? { ...kpi, name: 'Updated name' } : kpi) };
  const renamedIndexes = buildIndexes(renamed, previous, indexes);
  assert.equal(filterRows(renamed, renamedIndexes, filters, cache), matches, 'unrelated edits retain the stable result set');

  const removed = { ...renamed, kpis: renamed.kpis.filter((kpi) => kpi.id !== 'leaf') };
  const removedIndexes = buildIndexes(removed, renamed, renamedIndexes);
  assert.equal(removedIndexes.searchByKpiId.get('dependent').sources.status, 'Not Ready');
  assert.deepEqual([...filterRows(removed, removedIndexes, filters, cache)], []);
});
