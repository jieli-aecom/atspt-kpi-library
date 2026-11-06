import assert from 'node:assert/strict';
import test from 'node:test';
import JSZip from 'jszip';
import { createBlankConfig, createBlankKpi, repairConfig, prepareForExport, kpiPoolConfigSchema } from '../src/configSchema.ts';
import { sourceStatus, sourceStatuses } from '../src/sourceStatus.ts';
import { matchesSourceFilters, sourceFilterEntry } from '../src/sourceFilters.ts';
import { buildKpiExcelRows, createKpiExcelWorkbook } from '../src/excelExport.ts';
import { buildTableSchemaJsonExport } from '../src/tableSchemaJsonExport.ts';
import { mergeConcurrentConfig } from '../src/configMerge.ts';
import type { DataSourceField, KpiSourceItem } from '../src/types.ts';

const fixture = () => {
  const config = createBlankConfig();
  config.dataSources = [{ id: 'table', name: 'Traffic', spatialUnit: '', fieldGroups: [],
    fields: sourceStatuses.map((status, index): DataSourceField => ({
      id: `field-${index}`, name: `Field ${index}`, status, meaning: '', details: '', preprocessingNeeded: false,
      preferredLatex: '', dataType: 'number', valueUnit: '', options: []
    })) }];
  return config;
};
const sources = (...indices: number[]): KpiSourceItem[] => indices.map((index) => ({
  id: `source-${index}`, type: 'dataField', dataSourceId: 'table', fieldId: `field-${index}`, latex: ''
}));
const prerequisite = (kpiId: string): KpiSourceItem => ({ id: `source-${kpiId}`, type: 'kpi', kpiId, latex: '' });

test('source status is the minimum over selected table fields, independent of order and duplicate scenarios', () => {
  const config = fixture();
  for (const [indices, expected] of [ [[3], 'Ready'], [[2], 'Partial'], [[2, 3], 'Partial'], [[3, 2], 'Partial'], [[2, 1], 'Stand-In'], [[1, 3], 'Stand-In'], [[3, 1], 'Stand-In'], [[0, 1, 2, 3], 'Unavailable'], [[], 'Unavailable'], [[99], 'Unavailable'] ] as const) {
    assert.equal(sourceStatus(config, sources(...indices)), expected);
  }
  assert.equal(sourceStatus(config, [...sources(3), { ...sources(3)[0], id: 'second-scenario', scenarioSlot: 1 }]), 'Ready');
  assert.equal(sourceStatus(config, [...sources(3), { id: 'custom', type: 'custom', name: 'Input', latex: '' }]), 'Ready');
  assert.equal(sourceStatus(config, [{ id: 'custom', type: 'custom', name: 'Input', latex: '' }]), 'Unavailable');
});

test('yellow includes green; green requires every field ready; none does not restrict; changes recompute', () => {
  const config = fixture();
  const kpi = { ...createBlankKpi(), sources: sources(1, 3) };
  const entry = sourceFilterEntry(config, kpi);
  assert.equal(matchesSourceFilters(entry, new Set(), [], 'Stand-In'), true);
  assert.equal(matchesSourceFilters(entry, new Set(), [], 'Ready'), false);
  assert.equal(matchesSourceFilters(entry, new Set(), [], ''), true);
  assert.equal(matchesSourceFilters(entry, new Set(), ['derived'], 'Stand-In'), false);
  config.dataSources[0].fields[1].status = 'Ready';
  assert.equal(matchesSourceFilters(sourceFilterEntry(config, kpi), new Set(), [], 'Ready'), true);
  assert.equal(matchesSourceFilters(sourceFilterEntry(config, createBlankKpi()), new Set(), [], 'Stand-In'), false);
});

test('prerequisite KPIs contribute their readiness alongside direct fields and other prerequisites', () => {
  const config = fixture();
  config.kpis = sourceStatuses.map((_, index) => ({ ...createBlankKpi(), id: `kpi-${index}`, sources: sources(index) }));
  for (const [index, expected] of sourceStatuses.entries()) {
    const dependency = prerequisite(`kpi-${index}`);
    assert.equal(sourceStatus(config, [dependency]), expected);
    assert.equal(sourceStatus(config, [...sources(3), dependency]), expected);
    assert.equal(sourceStatus(config, [dependency, ...sources(3)]), expected);
    assert.equal(sourceStatus(config, [prerequisite('kpi-3'), dependency]), expected);
  }
  assert.equal(sourceStatus(config, [...sources(0), prerequisite('kpi-3')]), 'Unavailable');
  assert.equal(sourceStatus(config, [...sources(1), prerequisite('kpi-3')]), 'Stand-In');
});

test('readiness follows nested and shared prerequisites, including repeated scenarios', () => {
  const config = fixture();
  const leaf = { ...createBlankKpi(), id: 'leaf', sources: sources(1) };
  const left = { ...createBlankKpi(), id: 'left', sources: [prerequisite(leaf.id)] };
  const right = { ...createBlankKpi(), id: 'right', sources: [...sources(3), prerequisite(leaf.id)] };
  const root = { ...createBlankKpi(), id: 'root', sources: [prerequisite(left.id), prerequisite(right.id)] };
  config.kpis = [root, right, left, leaf];
  const references: KpiSourceItem[] = [prerequisite(root.id), { ...prerequisite(root.id), id: 'other-scenario', scenarioSlot: 1 }];
  assert.equal(sourceStatus(config, references), 'Stand-In');
  config.dataSources[0].fields[1].status = 'Ready';
  assert.equal(sourceStatus(config, references), 'Ready');
  leaf.sources = sources(0);
  assert.equal(sourceStatus(config, references), 'Unavailable');
});

test('missing, empty and cyclic prerequisites prevent readiness even beside ready fields', () => {
  const config = fixture();
  const empty = { ...createBlankKpi(), id: 'empty' };
  const custom = { ...createBlankKpi(), id: 'custom', sources: [{ id: 'custom-input', type: 'custom' as const, name: 'Input', latex: '' }] };
  const self = { ...createBlankKpi(), id: 'self', sources: [...sources(3), prerequisite('self')] };
  const first = { ...createBlankKpi(), id: 'first', sources: [...sources(3), prerequisite('second')] };
  const second = { ...createBlankKpi(), id: 'second', sources: [prerequisite('first')] };
  config.kpis = [empty, custom, self, first, second];
  for (const id of ['missing', 'empty', 'custom', 'self', 'first', 'second']) {
    assert.equal(sourceStatus(config, [prerequisite(id)]), 'Unavailable', id);
    assert.equal(sourceStatus(config, [...sources(3), prerequisite(id)]), 'Unavailable', id);
  }
  second.sources = sources(3);
  assert.equal(sourceStatus(config, [prerequisite(first.id)]), 'Ready', 'removing a cycle restores readiness');
});

test('source filters and Excel exports use prerequisite readiness and update after dependency edits', () => {
  const config = fixture();
  const leaf = { ...createBlankKpi(), id: 'leaf', name: 'Leaf KPI', sources: sources(1) };
  const middle = { ...createBlankKpi(), id: 'middle', sources: [prerequisite(leaf.id)] };
  const dependent = { ...createBlankKpi(), sources: [prerequisite(middle.id)] };
  config.kpis = [leaf, middle, dependent];
  for (const index of [1, 2, 3, 0]) {
    config.kpis = config.kpis.map((kpi) => kpi.id === leaf.id ? { ...kpi, sources: sources(index) } : kpi);
    const entry = sourceFilterEntry(config, dependent);
    assert.equal(entry.status, sourceStatuses[index]);
    assert.equal(matchesSourceFilters(entry, new Set(), [], 'Stand-In'), index >= 1);
    assert.equal(matchesSourceFilters(entry, new Set(), [], 'Partial'), index >= 2);
    assert.equal(matchesSourceFilters(entry, new Set(), [], 'Ready'), index === 3);
    assert.equal(buildKpiExcelRows(config, [dependent], { userGroups: [], useCases: [], performanceAreas: [] })[0].sourceStatus, sourceStatuses[index]);
  }
});

test('schema migration defaults missing and invalid statuses and preserves explicit statuses through export and merge', () => {
  const config = fixture();
  const legacy = JSON.parse(JSON.stringify(config));
  legacy.schemaVersion = 56;
  delete legacy.dataSources[0].fields[0].status;
  const migrated = repairConfig(legacy).config;
  assert.deepEqual(migrated.dataSources[0].fields.map((field) => field.status), sourceStatuses);
  assert.ok(kpiPoolConfigSchema.safeParse(migrated).success);
  assert.equal(repairConfig(migrated).config, migrated);
  assert.deepEqual(repairConfig(JSON.parse(JSON.stringify(prepareForExport(migrated)))).config.dataSources[0].fields, migrated.dataSources[0].fields);
  legacy.schemaVersion = migrated.schemaVersion;
  legacy.dataSources[0].fields[0].status = 'Unknown';
  assert.equal(kpiPoolConfigSchema.safeParse(legacy).success, false);
  assert.equal(repairConfig(legacy).config.dataSources[0].fields[0].status, 'Unavailable');
  const incoming = structuredClone(config);
  incoming.dataSources[0].fields[0].status = 'Ready';
  assert.equal(mergeConcurrentConfig(config, config, incoming).dataSources[0].fields[0].status, 'Ready');
  assert.deepEqual(buildTableSchemaJsonExport(config).PreprocessedConstants.Traffic.Fields.map((field) => field.Status), sourceStatuses);
});

test('Excel always accompanies selected Source with Source Status and a dot using the matching color', async () => {
  const config = fixture();
  for (const [index, color] of ['FF6B7280', 'FFEAB308', 'FF86CC74', 'FF16A34A'].entries()) {
    const kpi = { ...createBlankKpi(), sources: sources(index) };
    const rows = buildKpiExcelRows(config, [kpi], { userGroups: [], useCases: [], performanceAreas: [] });
    assert.equal(rows[0].source, `Traffic · Field ${index}`);
    assert.equal(rows[0].sourceStatus, sourceStatuses[index]);
    const zip = await JSZip.loadAsync(await createKpiExcelWorkbook('Status test', rows, ['source']));
    const xml = await zip.file('xl/worksheets/sheet1.xml')!.async('string');
    assert.match(xml, /<dimension ref="A1:B4"/);
    assert.match(xml, />Source</);
    assert.match(xml, />Source Status</);
    const sourceCell = xml.match(/<c r="A4"[^>]*>(.*?)<\/c>/s)?.[1] ?? '';
    assert.ok(sourceCell.includes(`<color rgb="${color}"/>`));
    assert.ok(sourceCell.includes('>●</t>'));
    assert.ok(sourceCell.includes(`>Traffic · Field ${index}</t>`));
    assert.ok(xml.includes(`<color rgb="${color}"/>`));
    assert.ok(xml.includes(`<t>●</t>`));
    assert.ok(xml.includes(` ${sourceStatuses[index]}</t>`));
  }
});

test('Excel Sources preserves mixed sources and colors each field and prerequisite independently', async () => {
  const config = fixture();
  config.lookups = [{ id: 'lookup', outputName: 'Rate <lookup> & factor', outputExplanation: '', outputValueType: 'number', outputOptions: [], text: '', inputs: [] }];
  const leaf = { ...createBlankKpi(), id: 'leaf', name: 'Leaf', sources: sources(1) };
  const nested = { ...createBlankKpi(), id: 'nested', name: 'Nested KPI', sources: [prerequisite('leaf')] };
  const cyclic = { ...createBlankKpi(), id: 'cycle', name: 'Cyclic KPI', sources: [prerequisite('cycle')] };
  const kpi = { ...createBlankKpi(), sources: [
    ...sources(3, 2),
    { id: 'lookup-source', type: 'lookup' as const, lookupId: 'lookup', latex: '' },
    prerequisite('nested'), prerequisite('cycle'), prerequisite('missing'),
    { id: 'custom-source', type: 'custom' as const, name: 'Literal **text** & input', latex: '' }
  ] };
  config.kpis = [leaf, nested, cyclic, kpi];
  const rows = buildKpiExcelRows(config, [kpi], { userGroups: [], useCases: [], performanceAreas: [] });
  assert.equal(rows[0].source, 'Traffic · Field 3\nTraffic · Field 2\nLookup: Rate <lookup> & factor\nKPI: Nested KPI\nKPI: Cyclic KPI\nKPI: Missing KPI\nLiteral **text** & input');
  const zip = await JSZip.loadAsync(await createKpiExcelWorkbook('Test', rows, ['source']));
  const xml = await zip.file('xl/worksheets/sheet1.xml')!.async('string');
  const cell = xml.match(/<c r="A4"[^>]*>(.*?)<\/c>/s)?.[1] ?? '';
  assert.deepEqual([...cell.matchAll(/<color rgb="(.*?)"/g)].map((match) => match[1]),
    ['FF16A34A', 'FF86CC74', 'FFEAB308', 'FF6B7280', 'FF6B7280']);
  assert.equal([...cell.matchAll(/>●<\/t>/g)].length, 5);
  assert.ok(cell.includes('Lookup: Rate &lt;lookup&gt; &amp; factor'));
  assert.ok(cell.includes('Literal **text** &amp; input'));
  assert.equal([...cell.matchAll(/<t xml:space="preserve">\n<\/t>/g)].length, 6);
  assert.ok(Number(xml.match(/<row r="4" ht="(\d+)"/)?.[1]) >= 111);

  config.dataSources[0].fields[1].status = 'Ready';
  const updated = buildKpiExcelRows(config, [kpi], { userGroups: [], useCases: [], performanceAreas: [] });
  assert.equal(updated[0].sourceItems?.find(({ label }) => label === 'KPI: Nested KPI')?.status, 'Ready');
});

test('schema 57 migrates legacy Sample and With Sample values without losing readiness', () => {
  const legacy = JSON.parse(JSON.stringify(fixture()));
  legacy.schemaVersion = 57;
  const template = legacy.dataSources[0].fields[0];
  legacy.dataSources[0].fields = ['Not Ready', 'Sample', 'With Sample', 'Ready', 'Partial', 'Stand-In', 'Unavailable']
    .map((status, index) => ({ ...template, id: 'legacy-' + index, status }));
  const migrated = repairConfig(legacy).config;
  assert.deepEqual(migrated.dataSources[0].fields.map((field) => field.status),
    ['Unavailable', 'Stand-In', 'Stand-In', 'Ready', 'Partial', 'Stand-In', 'Unavailable']);
  assert.ok(kpiPoolConfigSchema.safeParse(migrated).success);
  assert.equal(repairConfig(migrated).config, migrated);
  assert.deepEqual(repairConfig(JSON.parse(JSON.stringify(prepareForExport(migrated)))).config.dataSources[0].fields, migrated.dataSources[0].fields);
});
