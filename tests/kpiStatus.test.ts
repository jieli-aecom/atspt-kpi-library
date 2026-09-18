import assert from 'node:assert/strict';
import test from 'node:test';
import { createBlankConfig, createBlankKpi, repairConfig, prepareForExport, kpiPoolConfigSchema } from '../src/configSchema.ts';
import { CURRENT_SCHEMA_VERSION, kpiStatuses } from '../src/types.ts';
import { buildSystematicJsonExport } from '../src/systematicJsonExport.ts';
import { buildKpiExcelRows } from '../src/excelExport.ts';
import { mergeConcurrentConfig } from '../src/configMerge.ts';

const legacyKpi = (id: string, note = '', noteLabels: string[] = []) => {
  const { status, unit, ...kpi } = createBlankKpi();
  return { ...kpi, id, note, noteLabels };
};

test('schema 48 migrates existing notes and labels to Question and other KPIs to Drafted', () => {
  const { config } = repairConfig({ ...createBlankConfig(), schemaVersion: 48,
    noteLabels: [{ id: 'review', name: 'Review needed' }],
    kpis: [legacyKpi('empty'), legacyKpi('whitespace', ' \n '), legacyKpi('note', '**Confirm units**'), legacyKpi('label', '', ['review'])]
  });
  assert.equal(config.schemaVersion, CURRENT_SCHEMA_VERSION);
  assert.deepEqual(config.kpis.map(kpi => kpi.status), ['Drafted', 'Drafted', 'Question', 'Question']);
  assert.ok(config.kpis.every(kpi => kpi.unit === ''));
  assert.equal(config.kpis[2].note, '**Confirm units**');
  assert.deepEqual(config.kpis[3].noteLabels, ['review']);
  assert.ok(kpiPoolConfigSchema.safeParse(config).success);
  assert.equal(repairConfig(config).config, config);
});

test('statuses and wrapped units survive export, repair and status changes without losing notes', () => {
  for (const status of kpiStatuses) {
    const original = { ...createBlankConfig(), noteLabels: [{ id: 'review', name: 'Review needed' }], kpis: [{
      ...createBlankKpi(), status, unit: 'passenger trips /\nservice hour', note: '**Keep this note**', noteLabels: ['review']
    }] };
    const reloaded = repairConfig(JSON.parse(JSON.stringify(prepareForExport(original)))).config;
    assert.deepEqual(reloaded.kpis, original.kpis);
    const exported = buildSystematicJsonExport(reloaded, reloaded.kpis).KPIs[0];
    assert.equal(exported.Status, status);
    assert.equal(exported.Unit, original.kpis[0].unit);
    assert.deepEqual(exported.Labels, ['Review needed']);
  }
});

test('new KPIs are Drafted with empty units and current schema rejects invalid status/unit', () => {
  const kpi = createBlankKpi();
  assert.equal(kpi.status, 'Drafted');
  assert.equal(kpi.unit, '');
  for (const partial of [{ status: 'Unknown' }, { unit: 123 }]) {
    assert.equal(kpiPoolConfigSchema.safeParse({ ...createBlankConfig(), kpis: [{ ...kpi, ...partial }] }).success, false);
  }
  const repaired = repairConfig({ ...createBlankConfig(), kpis: [{ ...kpi, status: 'Unknown', unit: null, note: 'Question' }] }).config;
  assert.equal(repaired.kpis[0].status, 'Question');
  assert.equal(repaired.kpis[0].unit, '');
});


test('hosted merges and Excel rows preserve status and unit edits', () => {
  const base = { ...createBlankConfig(), kpis: [createBlankKpi()] };
  const incoming = { ...base, kpis: [{ ...base.kpis[0], status: 'Reviewed' as const, unit: 'km / hour' }] };
  const merged = mergeConcurrentConfig(base, base, incoming);
  assert.equal(merged.kpis[0].status, 'Reviewed');
  assert.equal(merged.kpis[0].unit, 'km / hour');
  const rows = buildKpiExcelRows(merged, merged.kpis, { userGroups: [], useCases: [], performanceAreas: [] });
  assert.equal(rows[0].status, 'Reviewed');
  assert.equal(rows[0].unit, 'km / hour');
});
