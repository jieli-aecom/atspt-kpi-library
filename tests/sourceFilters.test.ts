import assert from 'node:assert/strict';
import test from 'node:test';
import { createBlankConfig, createBlankKpi } from '../src/configSchema.ts';
import { matchesSourceFilters, sourceFilterEntry, sourceFilterKey, sourceTableFilterKey } from '../src/sourceFilters.ts';
import type { DataSourceField, KpiSourceItem } from '../src/types.ts';

const field = (id: string, flags: Partial<DataSourceField> = {}): DataSourceField => ({
  id, name: id, meaning: '', details: '', preprocessingNeeded: false,
  preferredLatex: '', dataType: 'number', valueUnit: '', options: [], ...flags
});
const config = {
  ...createBlankConfig(),
  dataSources: [{ id: 'table', name: 'Table', spatialUnit: '', fieldGroups: [], fields: [
    field('clean', { preprocessingNeeded: true }), field('computed', { derived: true }),
    field('ordinary', { details: 'A note is not a flag' })
  ] }]
};
const data: KpiSourceItem = { id: 'row-field', type: 'dataField', dataSourceId: 'table', fieldId: 'clean', latex: 'x' };
const lookup: KpiSourceItem = { id: 'row-lookup', type: 'lookup', lookupId: 'lookup', latex: 'f(x)' };
const metric = (sources: KpiSourceItem[]) => ({ ...createBlankKpi(), sources });
const keys = (...sources: KpiSourceItem[]) => new Set(sources.map(sourceFilterKey));

test('catalog identity matches across row IDs, notation and scenarios for all source types', () => {
  const sources: KpiSourceItem[] = [data, lookup,
    { id: 'k', type: 'kpi', kpiId: 'metric', latex: 'k' },
    { id: 'v', type: 'variable', variableId: 'constant', latex: 'v' },
    { id: 'c', type: 'custom', name: 'Custom input', latex: 'c' }
  ];
  for (const source of sources) {
    const rowSource = { ...source, id: 'another-row', latex: 'changed', scenarioSlot: 1 as const };
    assert.equal(matchesSourceFilters(sourceFilterEntry(config, metric([rowSource])), keys(source), []), true);
  }
  assert.notEqual(sourceFilterKey(data), sourceFilterKey({ ...data, dataSourceId: 'other-table' }));
  assert.notEqual(sourceFilterKey(lookup), sourceFilterKey({ ...lookup, lookupId: 'other-lookup' }));
});

test('sources are OR alternatives; empty selections include KPIs with no sources', () => {
  assert.equal(matchesSourceFilters(sourceFilterEntry(config, metric([lookup])), keys(data, lookup), []), true);
  assert.equal(matchesSourceFilters(sourceFilterEntry(config, metric([data])), keys(data, lookup), []), true);
  assert.equal(matchesSourceFilters(sourceFilterEntry(config, metric([])), keys(data, lookup), []), false);
  assert.equal(matchesSourceFilters(sourceFilterEntry(config, metric([])), keys(), []), true);
});

test('field flags are independent AND requirements across the KPI source fields', () => {
  const entry = sourceFilterEntry(config, metric([data, { ...data, id: 'derived-row', fieldId: 'computed' }]));
  assert.equal(matchesSourceFilters(entry, keys(data, lookup), ['preprocessing', 'derived']), true);
  assert.equal(matchesSourceFilters(entry, keys(lookup), ['preprocessing']), false);
  assert.equal(matchesSourceFilters(entry, keys(data), ['unavailable']), false);
  assert.equal(matchesSourceFilters(entry, keys(), ['derived']), true);
  assert.equal(matchesSourceFilters(entry, keys(), ['preprocessing', 'derived', 'unavailable']), false);
});

test('flags use explicit current field values, ignore missing fields and do not traverse other KPIs', () => {
  const kpi = metric([data]);
  const updated = structuredClone(config);
  updated.dataSources[0].fields[0].preprocessingNeeded = false;
  updated.dataSources[0].fields[0].potentiallyUnavailable = true;
  assert.equal(matchesSourceFilters(sourceFilterEntry(updated, kpi), keys(), ['preprocessing']), false);
  assert.equal(matchesSourceFilters(sourceFilterEntry(updated, kpi), keys(), ['unavailable']), true);
  for (const sources of [[], [{ ...data, fieldId: 'missing' }], [{ ...data, fieldId: 'ordinary' }],
    [{ id: 'ref', type: 'kpi' as const, kpiId: kpi.id, latex: '' }]]) {
    assert.equal(matchesSourceFilters(sourceFilterEntry({ ...config, kpis: [kpi] }, metric(sources)), keys(), ['preprocessing']), false);
  }
});

test('entire-table selections match any referenced field and combine with fields using OR', () => {
  const tableKeys = new Set([sourceTableFilterKey('table')]);
  for (const fieldId of ['clean', 'computed', 'ordinary', 'new-field']) {
    assert.equal(matchesSourceFilters(sourceFilterEntry(config, metric([{ ...data, fieldId }])), tableKeys, []), true);
  }
  assert.equal(matchesSourceFilters(sourceFilterEntry(config, metric([{ ...data, dataSourceId: 'other' }])), tableKeys, []), false);
  assert.equal(matchesSourceFilters(sourceFilterEntry(config, metric([lookup])), tableKeys, []), false);
  assert.equal(matchesSourceFilters(sourceFilterEntry(config, metric([lookup])), new Set([...tableKeys, ...keys(lookup)]), []), true);
  assert.equal(matchesSourceFilters(sourceFilterEntry(config, metric([data])), tableKeys, ['derived']), false);
});

test('table unavailability contributes to flags without modifying individual fields', () => {
  const flagged = structuredClone(config);
  flagged.dataSources[0].potentiallyUnavailable = true;
  const kpi = metric([{ ...data, fieldId: 'ordinary' }]);
  const entry = sourceFilterEntry(flagged, kpi);
  assert.equal(matchesSourceFilters(entry, keys(), ['unavailable']), true);
  assert.equal(matchesSourceFilters(entry, new Set([sourceTableFilterKey('table')]), ['unavailable']), true);
  assert.equal(matchesSourceFilters(entry, keys(), ['unavailable', 'derived']), false);
  assert.equal(flagged.dataSources[0].fields[2].potentiallyUnavailable, undefined);
  assert.equal(matchesSourceFilters(sourceFilterEntry(flagged, metric([lookup])), keys(), ['unavailable']), false);
  flagged.dataSources[0].potentiallyUnavailable = false;
  assert.equal(matchesSourceFilters(sourceFilterEntry(flagged, kpi), keys(), ['unavailable']), false);
  flagged.dataSources[0].fields[2].potentiallyUnavailable = true;
  assert.equal(matchesSourceFilters(sourceFilterEntry(flagged, kpi), keys(), ['unavailable']), true);
});
