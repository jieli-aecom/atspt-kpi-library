import assert from 'node:assert/strict';
import test from 'node:test';
import katex from 'katex';
import { createBlankConfig, createBlankKpi, repairConfig, prepareForExport, kpiPoolConfigSchema } from '../src/configSchema.ts';
import { isScenarioTable, normalizeScenarioNames, scenarioLatex, reconcileKpiScenarios } from '../src/scenarios.ts';
import { CURRENT_SCHEMA_VERSION, type KpiPoolConfig } from '../src/types.ts';

const fixture = (): KpiPoolConfig => ({ ...createBlankConfig(), dataSources: [{ id: 't', name: 'Traffic', category: 'Scenario Upstream', spatialUnit: 'Link', fieldGroups: [], fields: [{ id: 'f', name: 'Flow', meaning: '', details: '', preprocessingNeeded: false, preferredLatex: '', dataType: 'number', valueUnit: '', options: [] }] }], kpis: [{ ...createBlankKpi(), id: 'k', sources: [{ id: 's', type: 'dataField', dataSourceId: 't', fieldId: 'f', latex: 'Flow_{Link}' }] }] });

test('version 41 migrates all existing KPIs to Scenario and preserves expressions', () => {
  const old = fixture();
  const { scenarioType, scenarioNames, ...kpi } = old.kpis[0];
  const result = repairConfig({ ...old, schemaVersion: 41, kpis: [kpi] });
  assert.equal(result.config.schemaVersion, CURRENT_SCHEMA_VERSION);
  assert.equal(result.config.kpis[0].scenarioType, 'Scenario');
  assert.deepEqual(result.config.kpis[0].sources, old.kpis[0].sources);
  assert.equal(repairConfig(result.config).config, result.config);
  assert.ok(kpiPoolConfigSchema.safeParse(result.config).success);
});

test('scenario suffix extends subscripts without embedding visual styling', () => {
  for (const base of ['Flow_{Link}', String.raw`\{Flow\}_{Link}`, String.raw`x_{\mathrm{Link}}`, 'x']) {
    const latex = scenarioLatex(base, 'Build Alternative');
    assert.ok(latex.includes('BuildAlternative'));
    assert.doesNotThrow(() => katex.renderToString(latex, { throwOnError: true }));
    assert.ok(!latex.includes('textcolor'));
    assert.ok(!latex.includes('#'));
    assert.ok(!latex.includes('htmlClass'));
  }
  assert.equal(scenarioLatex('Flow_{Link}', 'Build Alternative'), String.raw`Flow_{Link, BuildAlternative}`);
  for (const name of ['A&B', 'A_{B}', '50%', 'A\\B', 'A^B', 'A~B']) assert.doesNotThrow(() => katex.renderToString(scenarioLatex('x', name), { throwOnError: true }));
});

test('both scenario field identities survive export, repair, and renaming', () => {
  const config = fixture();
  let kpi = reconcileKpiScenarios(config, { ...config.kpis[0], scenarioType: 'Inter-Scenario' });
  const source = kpi.sources[0];
  assert.equal(source.type, 'dataField');
  kpi.sources = [source, { ...source, id: 's2', scenarioSlot: 1, latex: scenarioLatex('Flow_{Link}', 'Scenario 2') }];
  config.kpis = [kpi];
  const exported = prepareForExport(config);
  assert.equal(exported.kpis[0].sources.length, 2);
  assert.ok(kpiPoolConfigSchema.safeParse(exported).success);
  const renamed = reconcileKpiScenarios(config, { ...kpi, scenarioNames: ['Build', 'No Build'] });
  assert.equal(renamed.sources[0].id, 's');
  assert.equal(renamed.sources[1].id, 's2');
  assert.ok(renamed.sources[1].latex.includes('NoBuild'));
  assert.equal(reconcileKpiScenarios(config, renamed), renamed);
});

test('single-scenario fallback retains the first available expression and written formulas', () => {
  const config = fixture();
  const kpi = reconcileKpiScenarios(config, { ...config.kpis[0], scenarioType: 'Inter-Scenario' });
  const first = kpi.sources[0];
  if (first.type !== 'dataField') throw new Error('expected field');
  kpi.sources.push({ ...first, id: 's2', scenarioSlot: 1, latex: scenarioLatex('Flow_{Link}', 'Scenario 2') });
  kpi.description.overview = 'Keep this';
  const result = reconcileKpiScenarios(config, { ...kpi, scenarioType: 'Base Year' });
  assert.equal(result.sources.length, 1);
  assert.equal(result.sources[0].latex, first.latex);
  assert.equal(result.description.overview, 'Keep this');
  assert.equal('scenarioSlot' in result.sources[0], false);
});

test('group category overrides table and category changes reconcile selections', () => {
  const config = fixture();
  config.dataSourceGroups = [{ id: 'g', name: 'G', position: 0, itemIds: ['t'], category: 'Preprocessed Constants' }];
  assert.equal(isScenarioTable(config, config.dataSources[0]), false);
  config.dataSourceGroups[0].category = 'KPI Preparation';
  assert.equal(isScenarioTable(config, config.dataSources[0]), true);
  config.kpis[0].scenarioType = 'Inter-Scenario';
  const result = repairConfig(config).config;
  assert.ok(result.kpis[0].sources[0].latex.includes('Scenario'));
});

test('empty and colliding scenario names have deterministic fallbacks', () => {
  assert.deepEqual(normalizeScenarioNames(['', '']), ['Scenario', 'Scenario 2']);
  assert.deepEqual(normalizeScenarioNames(['No Build', 'nobuild']), ['No Build', 'No Build 2']);
});

test('formula references update during renaming without replacing a longer field name', () => {
  const config = fixture();
  let kpi = config.kpis[0];
  kpi.description.formulas = [{ name: '', items: [{ tag: '', formula: 'y = Flow_{Link} + OtherFlow_{Link}', leftExpression: 'y', rightExpression: 'Flow_{Link} + OtherFlow_{Link}', generalExplanation: '', terms: [{ term: 'Flow_{Link}', explanation: 'flow' }] }] }];
  kpi = reconcileKpiScenarios(config, { ...kpi, scenarioType: 'Inter-Scenario' });
  assert.ok(kpi.description.formulas[0].items[0].rightExpression.includes('OtherFlow_{Link}'));
  const renamed = reconcileKpiScenarios(config, { ...kpi, scenarioNames: ['Build', 'Reference'] });
  assert.ok(renamed.description.formulas[0].items[0].rightExpression.includes('Build'));
  assert.ok(!renamed.description.formulas[0].items[0].rightExpression.includes('Scenario'));
});

test('repeated type changes do not stack scenario suffixes', () => {
  const config = fixture();
  let kpi = reconcileKpiScenarios(config, { ...config.kpis[0], scenarioType: 'Inter-Scenario' });
  const latex = kpi.sources[0].latex;
  kpi = reconcileKpiScenarios(config, { ...kpi, scenarioType: 'Scenario' });
  assert.equal(kpi.sources[0].latex, latex);
  kpi = reconcileKpiScenarios(config, { ...kpi, scenarioType: 'Inter-Scenario' });
  assert.equal(kpi.sources[0].latex, latex);
});

test('a global base expression change retains both scenario suffixes through subsequent renaming', () => {
  const config = fixture();
  let kpi = reconcileKpiScenarios(config, { ...config.kpis[0], scenarioType: 'Inter-Scenario' });
  const first = kpi.sources[0];
  if (first.type !== 'dataField') throw new Error('expected field');
  kpi.sources = [first, { ...first, id: 's2', scenarioSlot: 1 as const }].map((source) => ({ ...source, scenarioBaseLatex: 'q_{Link}' }));
  kpi = reconcileKpiScenarios(config, kpi);
  assert.equal(kpi.sources[0].latex, scenarioLatex('q_{Link}', 'Scenario'));
  assert.equal(kpi.sources[1].latex, scenarioLatex('q_{Link}', 'Scenario 2'));
  kpi = reconcileKpiScenarios(config, { ...kpi, scenarioNames: ['Build', 'No Build'] });
  assert.equal(kpi.sources[1].latex, scenarioLatex('q_{Link}', 'No Build'));
});

