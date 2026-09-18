import assert from 'node:assert/strict';
import test from 'node:test';
import { createBlankConfig, createBlankKpi, repairConfig, prepareForExport } from '../src/configSchema.ts';
import { indexedScaleLatex, latexReplacer, rewriteGlobalNotation, alignGlobalDefinitions, scaleReplacements } from '../src/globalDefinitions.ts';
import { sourceTableUnitLatex } from '../src/types.ts';
import { mergeConcurrentConfig, mergeImportedConfig } from '../src/configMerge.ts';

const fixture = () => {
  const config = createBlankConfig();
  const kpi = createBlankKpi();
  const expression = String.raw`\max(x_{Cell_i}, x_{Cell}, Cell_{j,k})`;
  kpi.description.formulas = [{ name: '', items: [{ tag: '', formula: `y=${expression}`, leftExpression: 'y', rightExpression: expression, generalExplanation: 'Cell prose with $Cell_i$', terms: [{ term: 'Cell_i', explanation: '' }] }] }];
  kpi.sources = [{ type: 'custom', id: 'source', name: 'Cell name', latex: 'x_{Cell}' }];
  kpi.spatialScales.cell = { ...kpi.spatialScales.cell, applicable: true, formula: expression, rightExpression: expression };
  config.kpis = [kpi];
  config.logic = [{ id: 'max', latex: '\\max', explanation: 'Maximum' }];
  config.dataSources = [{ id: 'table', name: 'Cell records', spatialUnit: 'Cell', fields: [], fieldGroups: [] }];
  return config;
};

test('v46 migrates Parcel settings and notation everywhere, retaining IDs and prose', () => {
  const original = fixture();
  const raw = JSON.parse(JSON.stringify(original).replaceAll('Cell', 'Parcel'));
  raw.schemaVersion = 46;
  delete raw.spatialScaleDefinitions;
  delete raw.logic;
  raw.kpis[0].spatialScales.parcel = raw.kpis[0].spatialScales.cell;
  delete raw.kpis[0].spatialScales.cell;
  const config = repairConfig(raw).config;
  assert.equal(config.spatialScaleDefinitions.cell.name, 'Cell');
  assert.equal(config.kpis[0].spatialScales.cell.applicable, true);
  assert.equal(config.kpis[0].sources[0].latex, 'x_{Cell}');
  assert.equal(config.kpis[0].sources[0].name, 'Parcel name');
  assert.equal(config.kpis[0].description.formulas[0].items[0].rightExpression, original.kpis[0].description.formulas[0].items[0].rightExpression);
  assert.equal(config.dataSources[0].spatialUnit, 'Cell');
  assert.deepEqual(config.logic, []);
  assert.equal(repairConfig(config).config, config);
});

test('global renames update nested math, table units and terms, without cascading or changing prose', async () => {
  const config = fixture();
  const next = await rewriteGlobalNotation(config, new Map([['Cell', '\\mathrm{Zone}'], ['\\max', '\\operatorname{greatest}']]), new Map([['Cell', 'Zone']]));
  const item = next.kpis[0].description.formulas[0].items[0];
  assert.equal(item.rightExpression, String.raw`\operatorname{greatest}(x_{\mathrm{Zone}_i}, x_{\mathrm{Zone}}, \mathrm{Zone}_{j,k})`);
  assert.equal(item.generalExplanation, String.raw`Cell prose with $\mathrm{Zone}_i$`);
  assert.equal(item.terms[0].term, String.raw`\mathrm{Zone}_i`);
  assert.equal(next.dataSources[0].spatialUnit, 'Zone');
  assert.equal(config.kpis[0].sources[0].latex, 'x_{Cell}');
  const swap = latexReplacer(new Map([['Cell', 'Link'], ['Link', 'Cell']]));
  assert.equal(swap(String.raw`Cell_i+Link+CellCount+\Cell`), String.raw`Link_i+Cell+CellCount+\Cell`);
  assert.equal(latexReplacer(new Map([['\\max', '\\min']]))(String.raw`\max(x)+\maximum+maxCount`), String.raw`\min(x)+\maximum+maxCount`);
});

test('custom definitions survive schema repair and export, even when named Parcel again', async () => {
  const config = fixture();
  const definitions = { ...config.spatialScaleDefinitions, cell: { name: 'Parcel', latex: 'P' } };
  const custom = alignGlobalDefinitions(config, definitions, config.logic);
  for (const input of [custom, { ...custom, noteLabels: undefined }]) {
    const restored = repairConfig(JSON.parse(JSON.stringify(prepareForExport(input)))).config;
    assert.equal(restored.spatialScaleDefinitions.cell.name, 'Parcel');
    assert.equal(restored.dataSources[0].spatialUnit, 'Parcel');
    assert.equal(restored.kpis[0].sources[0].latex, 'x_{P}');
    assert.deepEqual(restored.logic, config.logic);
  }
});

test('indexed spatial units include balanced arbitrary subscripts and wrappers', () => {
  assert.deepEqual(indexedScaleLatex(String.raw`Cell_i+Cell_{j,\mathrm{other}_{k}}+Cell+Cell_{broken`, 'Cell'), ['Cell_i', String.raw`Cell_{j,\mathrm{other}_{k}}`]);
  assert.deepEqual(indexedScaleLatex(String.raw`\mathrm{Cell}_{any subscript}`, '\\mathrm{Cell}'), [String.raw`\mathrm{Cell}_{any subscript}`]);
});

test('large updates yield and preserve unaffected branches', async () => {
  const config = fixture();
  config.kpis = Array.from({ length: 3000 }, (_, i) => ({ ...createBlankKpi(), id: String(i) }));
  let yields = 0;
  const result = await rewriteGlobalNotation(config, new Map([['\\max', '\\min']]), new Map(), async () => { yields++; });
  assert.ok(yields > 1, 'tree walk should relinquish the main thread');
  assert.equal(result.kpis[0], config.kpis[0]);
  assert.equal(result.dataSources, config.dataSources);
});

test('concurrent and imported formulas use the winning global definitions', () => {
  const base = fixture();
  const definitions = { ...base.spatialScaleDefinitions, cell: { name: 'Zone', latex: 'Z' } };
  const current = alignGlobalDefinitions(base, definitions, [{ ...base.logic[0], latex: '\\min' }]);
  const incoming = structuredClone(base);
  incoming.kpis[0].name = 'Local edit';
  const merged = mergeConcurrentConfig(current, base, incoming);
  assert.equal(merged.kpis[0].name, 'Local edit');
  assert.equal(merged.kpis[0].sources[0].latex, 'x_{Z}');
  assert.match(merged.kpis[0].description.formulas[0].items[0].formula, /\\min/);
  incoming.kpis[0].id = 'imported';
  const imported = mergeImportedConfig(current, incoming).config;
  assert.equal(imported.kpis[1].sources[0].latex, 'x_{Z}');
  assert.equal(imported.logic[0].latex, '\\min');
});

test('renaming Region does not rename the separate Sub-Region scale', () => {
  const config = createBlankConfig();
  const next = { ...config.spatialScaleDefinitions, region: { name: 'Metro', latex: 'Metro' } };
  assert.equal(latexReplacer(scaleReplacements(config.spatialScaleDefinitions, next))('x_{Sub-Region}+Region_i'), 'x_{Sub-Region}+Metro_i');
});

test('new table sources use configured notation rather than the display name', () => {
  const config = fixture();
  config.spatialScaleDefinitions.cell.latex = '\\mathrm{C}';
  assert.equal(sourceTableUnitLatex(config.spatialScaleDefinitions, config.dataSources[0]), '\\mathrm{C}');
  assert.equal(sourceTableUnitLatex(config.spatialScaleDefinitions, { spatialUnit: '', customUnit: 'Service Area' }), 'ServiceArea');
});
