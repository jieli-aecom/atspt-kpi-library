import fs from 'node:fs';
import assert from 'node:assert/strict';
import katex from 'katex';
import { kpiPoolConfigSchema, repairConfig } from '../../src/configSchema.ts';
import { readConfigImport } from '../../src/configImport.ts';
import { mergeImportedConfig } from '../../src/configMerge.ts';

const dir = new URL('./', import.meta.url);
const read = name => JSON.parse(fs.readFileSync(new URL(name, dir), 'utf8'));
const before = read('baseline.json');
const after = read('ATSPT-library.import.json');
const changed = [56, 58];
const get = n => after.kpis.find(k => k.displayNumber === n);
kpiPoolConfigSchema.parse(after);
assert.equal(after.kpis.length, 98);
assert.equal(new Set(after.kpis.map(k => k.id)).size, 98);
assert.equal(new Set(after.kpis.map(k => k.displayNumber)).size, 98);
for (const key of Object.keys(before).filter(k => !['updatedAt', 'kpis'].includes(k))) assert.deepEqual(after[key], before[key], key);
for (const k of before.kpis) if (!changed.includes(k.displayNumber)) assert.deepEqual(after.kpis.find(v => v.id === k.id), k, k.name);

const parsed = readConfigImport(JSON.stringify(after), 'ATSPT-library.import.json', () => { throw Error('Wrong import route'); });
const repaired = repairConfig(parsed);
assert.deepEqual(repaired.warnings, []);
assert.deepEqual(repaired.config, after);
const merged = mergeImportedConfig(before, repaired.config).config;
for (const n of changed) assert.deepEqual(merged.kpis.find(k => k.id === get(n).id), get(n));

for (const n of changed) {
  const k = get(n);
  assert.equal(k.scenarioType, 'Scenario');
  assert(k.dimensions.some(d => d.name === 'Year'));
  assert(!/VMTGR|variable-624f354c|BYDelay|BYDailyReduction/.test(JSON.stringify(k)));
  assert(!k.sources.some(s => s.variableId === 'variable-f674cb33-454e-4baa-878b-85276e91417d'));
  assert.deepEqual(k.sources.filter(s => s.type === 'kpi').map(s => s.kpiId), (n === 56 ? [102, 103] : [103]).map(n => get(n).id));
  for (const s of k.sources) {
    if (s.type === 'kpi') { assert(after.kpis.some(v => v.id === s.kpiId)); assert(k.prerequisite.kpis.includes(s.kpiId)); }
    if (s.type === 'dataField') assert(after.dataSources.find(d => d.id === s.dataSourceId)?.fields.some(f => f.id === s.fieldId));
    if (s.type === 'lookup') assert(after.lookups.some(v => v.id === s.lookupId));
  }
  for (const g of k.description.formulas) for (const i of g.items) {
    assert.equal(i.formula, i.leftExpression + ' = ' + i.rightExpression);
    katex.renderToString(i.formula, { throwOnError: true, strict: 'ignore' });
  }
  for (const s of Object.values(k.spatialScales)) if (s.formula) katex.renderToString(s.formula, { throwOnError: true, strict: 'ignore' });
}
const graph = new Map(after.kpis.map(k => [k.id, k.sources.filter(s => s.type === 'kpi').map(s => s.kpiId)]));
function visit(id, path = []) { assert(!path.includes(id), 'Cycle in new dependency chain'); for (const next of graph.get(id) ?? []) visit(next, [...path, id]); }
for (const n of changed) visit(get(n).id);

// Verify the edited equations' unit factors and period coverage directly.
const f56 = get(56).description.formulas[1].items;
const f58 = get(58).description.formulas[0].items;
const minutesDivisor = Number(f56[1].rightExpression.match(/\\frac\{TravelMinutes_\{Year,Period,Link\}\}\{(\d+)\}/)[1]);
const secondsDivisor = Number(f58[1].rightExpression.match(/\\frac\{DelayReductionPerVehicle_\{Project\}\}\{(\d+)\}/)[1]);
const days56 = Number(f56[3].rightExpression.match(/^(\d+)\\times/)[1]);
const days58 = Number(f58[2].rightExpression.match(/^(\d+)\\times/)[1]);
assert(f56[3].rightExpression.includes('Period\\in\\{AM, PM\\}'));
assert.equal(f58[0].rightExpression, '\\sum_{Period} Volume_{Year,Period,Link}');
assert(f56[2].rightExpression.endsWith('\\times Volume_{Year,Period,Link}'));
assert.deepEqual(get(103).dimensions.find(d => d.name === 'Period').options, ['AM', 'PM', 'MD', 'OV']);
for (const scale of ['corridor', 'subRegion', 'region']) assert(get(58).spatialScales[scale].formula.includes('AnnualReductionVehHours_{Year,Project}'));

// Hand-checkable examples: 2 miles at 60 mph, 8/14 minutes in AM/PM,
// volumes 600/300, and a 25% improvement -> 10,950 annual vehicle-hours.
const baselineHours = 2 / 60;
const delay = ((8 / minutesDivisor - baselineHours) * 600 + (14 / minutesDivisor - baselineHours) * 300) * days56 * 0.25;
assert(Math.abs(delay - 10950) < 1e-9);
// 30 seconds saved for 3,600 daily link traversals -> 30 daily hours.
const intersection = (30 / secondsDivisor) * (600 + 300 + 1500 + 1200) * days58;
assert.equal(intersection, 10950);
assert.equal((0 / secondsDivisor) * 3600 * days58, 0);
assert.equal((2 / minutesDivisor - baselineHours) * 600 * days56, 0);

const report = read('review-and-validation.json');
report.validation = { passed: true, checks: ['schema', 'import parsing', 'repair without warnings', 'merge fidelity', 'unrelated records unchanged', 'dependency integrity and cycles', 'LaTeX rendering', 'period coverage', 'Year in spatial output', 'minutes and seconds conversions', 'annualization', 'numeric examples and zero cases'] };
fs.writeFileSync(new URL('review-and-validation.json', dir), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report.validation, null, 2));
