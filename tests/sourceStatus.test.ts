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

test('source status is the minimum over selected table fields, independent of order and duplicate scenarios', () => {
  const config = fixture();
  for (const [indices, expected] of [ [[2], 'Ready'], [[1, 2], 'With Sample'], [[2, 1], 'With Sample'], [[0, 1, 2], 'Not Ready'], [[], 'Not Ready'], [[99], 'Not Ready'] ] as const) {
    assert.equal(sourceStatus(config, sources(...indices)), expected);
  }
  assert.equal(sourceStatus(config, [...sources(2), { ...sources(2)[0], id: 'second-scenario', scenarioSlot: 1 }]), 'Ready');
  assert.equal(sourceStatus(config, [...sources(2), { id: 'custom', type: 'custom', name: 'Input', latex: '' }]), 'Ready');
  assert.equal(sourceStatus(config, [{ id: 'custom', type: 'custom', name: 'Input', latex: '' }]), 'Not Ready');
});

test('yellow includes green; green requires every field ready; none does not restrict; changes recompute', () => {
  const config = fixture();
  const kpi = { ...createBlankKpi(), sources: sources(1, 2) };
  const entry = sourceFilterEntry(config, kpi);
  assert.equal(matchesSourceFilters(entry, new Set(), [], 'With Sample'), true);
  assert.equal(matchesSourceFilters(entry, new Set(), [], 'Ready'), false);
  assert.equal(matchesSourceFilters(entry, new Set(), [], ''), true);
  assert.equal(matchesSourceFilters(entry, new Set(), ['derived'], 'With Sample'), false);
  config.dataSources[0].fields[1].status = 'Ready';
  assert.equal(matchesSourceFilters(sourceFilterEntry(config, kpi), new Set(), [], 'Ready'), true);
  assert.equal(matchesSourceFilters(sourceFilterEntry(config, createBlankKpi()), new Set(), [], 'With Sample'), false);
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
  assert.equal(repairConfig(legacy).config.dataSources[0].fields[0].status, 'Not Ready');
  const incoming = structuredClone(config);
  incoming.dataSources[0].fields[0].status = 'Ready';
  assert.equal(mergeConcurrentConfig(config, config, incoming).dataSources[0].fields[0].status, 'Ready');
  assert.deepEqual(buildTableSchemaJsonExport(config).PreprocessedConstants.Traffic.Fields.map((field) => field.Status), sourceStatuses);
});

test('Excel always accompanies selected Source with Source Status and a dot using the matching color', async () => {
  const config = fixture();
  for (const [index, color] of ['FF6B7280', 'FFEAB308', 'FF16A34A'].entries()) {
    const kpi = { ...createBlankKpi(), sources: sources(index) };
    const rows = buildKpiExcelRows(config, [kpi], { userGroups: [], useCases: [], performanceAreas: [] });
    assert.equal(rows[0].source, `Traffic · Field ${index}`);
    assert.equal(rows[0].sourceStatus, sourceStatuses[index]);
    const zip = await JSZip.loadAsync(await createKpiExcelWorkbook('Status test', rows, ['source']));
    const xml = await zip.file('xl/worksheets/sheet1.xml')!.async('string');
    assert.match(xml, /<dimension ref="A1:B4"/);
    assert.match(xml, />Source</);
    assert.match(xml, />Source Status</);
    assert.ok(xml.includes(`<color rgb="${color}"/>`));
    assert.ok(xml.includes(`<t>●</t>`));
    assert.ok(xml.includes(` ${sourceStatuses[index]}</t>`));
  }
});
