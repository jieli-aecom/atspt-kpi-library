import assert from 'node:assert/strict';
import test from 'node:test';
import { traceKpiSupport } from '../src/kpiSupport.ts';
import type { KpiPoolConfig, KpiSourceItem } from '../src/types.ts';
const ref = (fieldId: string, dataSourceId = 't'): KpiSourceItem => ({ id: fieldId, type: 'dataField', dataSourceId, fieldId, latex: '' });
const kr = (kpiId: string): KpiSourceItem => ({ id: kpiId, type: 'kpi', kpiId, latex: '' });
const kpi = (id: string, sources: KpiSourceItem[], prerequisites: string[] = []) => ({ id, name: id, sources, prerequisite: { kpis: prerequisites } });
const config = (kpis: unknown[], fields: unknown[] = [{ id: 'raw', name: 'raw' }, { id: 'derived', name: 'derived', sources: [ref('raw')] }]) => ({ dataSources: [{ id: 't', name: 'Table', fields }], kpis } as KpiPoolConfig);

test('traces fields through processing, KPI sources and legacy prerequisites', () => {
  const result = traceKpiSupport(config([kpi('a', [ref('raw')]), kpi('b', [ref('derived')]), kpi('c', [kr('b')]), kpi('d', [], ['c'])]), { dataSourceId: 't', fieldId: 'raw' });
  assert.deepEqual(result.map((r) => [r.kpiId, Boolean(r.direct), Boolean(r.indirect)]), [['a', true, false], ['b', false, true], ['c', false, true], ['d', false, true]]);
  assert.deepEqual(result[3].indirect?.map((n) => n.label), ['Table.raw', 'Table.derived', 'b', 'c', 'd']);
});
test('keeps direct and indirect support and deduplicates table totals', () => {
  const result = traceKpiSupport(config([kpi('a', [ref('raw'), ref('derived'), ref('raw')])]), { dataSourceId: 't' });
  assert.equal(result.length, 1);
  assert.equal(result[0].direct?.length, 2);
  assert.equal(result[0].indirect?.length, 3);
});
test('handles field and KPI cycles without repeated nodes in paths', () => {
  const result = traceKpiSupport(config([kpi('a', [ref('derived'), kr('b')]), kpi('b', [kr('a')])], [{ id: 'raw', sources: [ref('derived')] }, { id: 'derived', name: 'derived', sources: [ref('raw')] }]), { dataSourceId: 't', fieldId: 'raw' });
  assert.equal(result.length, 2);
  result.forEach((r) => assert.equal(new Set(r.indirect?.map((n) => n.key)).size, r.indirect?.length));
});
test('ignores dangling references and distinguishes identical field IDs in different tables', () => {
  const c = config([kpi('a', [ref('raw', 'other'), ref('missing'), kr('missing')])]);
  assert.deepEqual(traceKpiSupport(c, { dataSourceId: 't', fieldId: 'raw' }), []);
  assert.deepEqual(traceKpiSupport(c, { dataSourceId: 'missing' }), []);
  assert.deepEqual(traceKpiSupport(c, { dataSourceId: 't', fieldId: 'missing' }), []);
});
