import assert from 'node:assert/strict';
import test from 'node:test';
import { readConfigImport } from '../src/configImport.ts';
import { createBlankConfig, createBlankKpi, repairConfig } from '../src/configSchema.ts';

const noHtml = () => { throw new Error('Unexpected HTML parser call'); };

test('imports full JSON without losing KPI contents', () => {
  const config = { ...createBlankConfig(), kpis: [{ ...createBlankKpi(), name: 'Imported KPI' }] };
  const result = readConfigImport('\uFEFF\n' + JSON.stringify(config), 'library.JSON', noHtml);
  assert.deepEqual(result, config);
  assert.deepEqual(repairConfig(result).config.kpis, config.kpis);
});

test('recognizes JSON content and permits older configuration migration', () => {
  const config = { schemaVersion: 28, title: 'Legacy library', kpis: [] };
  assert.deepEqual(readConfigImport(JSON.stringify(config), 'library.txt', noHtml), config);
  assert.equal(repairConfig(readConfigImport(JSON.stringify(config), 'library.json', noHtml)).config.title, config.title);
});

test('retains the HTML snapshot parsing path', () => {
  const html = '<html><script id="kpi-pool-config">{}</script></html>';
  const config = { kpis: [] };
  assert.equal(readConfigImport(html, 'library.html', text => {
    assert.equal(text, html);
    return config;
  }), config);
});

test('rejects malformed JSON and incompatible reporting exports before merging', () => {
  assert.throws(() => readConfigImport('{', 'library.json', noHtml), /could not be parsed/);
  for (const value of [{ KPIs: [] }, { tables: [] }, { kpis: {} }, [], null, 'text']) {
    assert.throws(() => readConfigImport(JSON.stringify(value), 'library.json', noHtml), /full KPI library configuration/);
  }
});

test('does not bypass future-schema protection', () => {
  const config = { ...createBlankConfig(), schemaVersion: 9999 };
  assert.throws(() => repairConfig(readConfigImport(JSON.stringify(config), 'future.json', noHtml)), /version|schema/i);
});
