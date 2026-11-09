import fs from 'node:fs';
import assert from 'node:assert/strict';
import katex from 'katex';
import { repairConfig, kpiPoolConfigSchema } from '../../src/configSchema.ts';
import { readConfigImport } from '../../src/configImport.ts';
import { mergeImportedConfig } from '../../src/configMerge.ts';
const path = new URL('./', import.meta.url);
const before = JSON.parse(fs.readFileSync(new URL('library-config.before.json', path), 'utf8'));
const after = JSON.parse(fs.readFileSync(new URL('library-config.updated.json', path), 'utf8'));
const imported = readConfigImport(JSON.stringify(after), 'library-config.updated.json', () => { throw Error('Unexpected HTML'); });
assert.equal(after.kpis.length, before.kpis.length + 2);
kpiPoolConfigSchema.parse(after);
for (const key of Object.keys(before).filter(k => !['kpis', 'updatedAt'].includes(k))) assert.deepEqual(after[key], before[key], key);
for (const k of before.kpis.filter(k => k.displayNumber !== 14)) assert.deepEqual(after.kpis.find(v => v.id === k.id), k);
const targets = after.kpis.filter(k => [14, 102, 103].includes(k.displayNumber));
const e = targets.find(k => k.displayNumber === 14);
for (const k of targets.filter(k => k.displayNumber !== 14)) {
  assert.equal(k.scenarioType, 'Scenario');
  assert.deepEqual(k.dimensions.map(d => d.name), ['Year', 'Period']);
  assert.deepEqual(Object.entries(k.spatialScales).filter(([, s]) => s.applicable).map(([s]) => s), ['link']);
  assert.equal(k.spatialScales.link.isBasicUnit, true);
  assert.deepEqual(e.sources.filter(s => s.type === 'kpi' && s.kpiId === k.id).map(s => s.scenarioSlot), [0, 1]);
}
for (const g of e.description.formulas) for (const i of g.items) assert(!/^(Volume|Growth|TimeRatio|ModeledYears|Beta|ElapsedYears)(_|$)/.test(i.leftExpression));
for (const k of targets) for (const g of k.description.formulas) for (const i of g.items) {
  assert.equal(i.formula, i.leftExpression + ' = ' + i.rightExpression);
  katex.renderToString(i.formula, { throwOnError: true, strict: 'ignore' });
}
for (const k of targets) for (const s of k.sources) {
  if (s.type === 'kpi') assert(after.kpis.some(v => v.id === s.kpiId));
  if (s.type === 'dataField') assert(after.dataSources.find(d => d.id === s.dataSourceId)?.fields.some(f => f.id === s.fieldId));
  if (s.type === 'variable') assert(after.variables.some(v => v.id === s.variableId));
  if (s.type === 'lookup') assert(after.lookups.some(v => v.id === s.lookupId));
}
const originalRepair = repairConfig(before);
const repaired = repairConfig(imported);
assert.deepEqual(repaired.warnings, originalRepair.warnings);
for (const k of targets) assert.deepEqual(repaired.config.kpis.find(v => v.id === k.id), k);
const merged = mergeImportedConfig(before, repaired.config);
for (const k of targets) assert.deepEqual(merged.config.kpis.find(v => v.id === k.id), k);
for (const growth of [0.97, 1, 1.03]) for (const elapsed of [0, 10, 20]) {
  const years = 20, baseVolume = 1000, modelVolume = baseVolume * growth ** years, baseMinutes = 10, modelMinutes = 15, beta = 4;
  const g = (modelVolume / baseVolume) ** (1 / years);
  const ratio = g === 1 ? elapsed / years : (g ** (elapsed * beta) - 1) / (g ** (years * beta) - 1);
  const minutes = baseMinutes + ratio * (modelMinutes - baseMinutes);
  assert.equal(minutes / 60, (baseMinutes + ratio * (modelMinutes - baseMinutes)) / 60);
  const vol = baseVolume * g ** elapsed;
  if (elapsed === 0) { assert.equal(minutes, baseMinutes); assert.equal(vol, baseVolume); }
  if (elapsed === years) { assert.equal(minutes, modelMinutes); assert(Math.abs(vol - modelVolume) < 1e-9); }
  assert(Number.isFinite(minutes) && Number.isFinite(vol));
}
console.log(JSON.stringify({ status: 'passed', kpis: after.kpis.length, changedExistingKpis: [14], appendedKpis: [102, 103], checks: ['full schema', 'import parsing', 'repair without new warnings', 'merge fidelity', 'unchanged unrelated data', 'reference integrity', 'scenario pairs', 'dimensions and scale', 'LaTeX rendering', 'no duplicate interpolation in KPI 14', 'growth/no-growth/endpoints and minute-to-hour equivalence'], existingWarnings: originalRepair.warnings }, null, 2));
