import assert from 'node:assert/strict';
import test from 'node:test';
import katex from 'katex';
import { createBlankConfig, createBlankKpi, repairConfig, prepareForExport } from '../src/configSchema.ts';
import { scenarioFormulaTokens, scenarioLatex, scenarioNameLatex, stripLegacyScenarioColor, scenarioBaseFromLatex } from '../src/scenarios.ts';

const oldSuffix = String.raw`\textcolor{#67b7e1}{\mathrm{NoBuild}}`;
const oldLatex = `Flow_{Link, ${oldSuffix}}`;

test('scenario decorations are separate semantic tokens, not stored color commands', () => {
  const kpi = { ...createBlankKpi(), scenarioNames: ['Build', 'No Build'] as [string, string] };
  const tokens = scenarioFormulaTokens(kpi);
  assert.deepEqual(tokens[1], { latex: 'NoBuild', kind: 'scenario', label: 'Scenario: No Build' });
  const plain = scenarioLatex('Flow_{Link}', 'No Build');
  const decorated = plain.replace(tokens[1].latex, `\\htmlClass{formula-semantic-token formula-scenario-token}{${tokens[1].latex}}`);
  const html = katex.renderToString(decorated, { strict: 'ignore', trust: (context) => context.command === '\\htmlClass', throwOnError: true });
  assert.ok(html.includes('formula-scenario-token'));
  assert.equal(plain, String.raw`Flow_{Link, NoBuild}`);
  assert.equal(scenarioNameLatex('No Build'), tokens[1].latex);
});

test('v43 migration cleans active and retained scenario expressions and formula terms', () => {
  const kpi = { ...createBlankKpi(), scenarioType: 'Base Year' as const,
    sources: [{ id: 'source', type: 'custom' as const, name: 'Retained source', latex: oldLatex }],
    description: { overview: oldLatex, formulaComment: '', formulas: [{ name: '', items: [{ tag: '', formula: `y = ${oldLatex}`, leftExpression: 'y', rightExpression: oldLatex, generalExplanation: '', terms: [{ term: oldLatex, explanation: 'flow' }] }] }] }
  };
  kpi.spatialScales.link.rightExpression = oldLatex;
  const migrated = repairConfig({ ...createBlankConfig(), schemaVersion: 43, kpis: [kpi] }).config;
  const expected = String.raw`Flow_{Link, \mathrm{NoBuild}}`;
  assert.equal(migrated.kpis[0].sources[0].latex, expected);
  assert.equal(migrated.kpis[0].description.formulas[0].items[0].terms[0].term, expected);
  assert.equal(migrated.kpis[0].description.formulas[0].items[0].rightExpression, expected);
  assert.equal(migrated.kpis[0].spatialScales.link.rightExpression, expected);
  assert.equal(migrated.kpis[0].description.overview, oldLatex);
  assert.equal(prepareForExport(migrated).kpis[0].sources[0].latex, expected);
  assert.equal(repairConfig(migrated).config, migrated);
});

test('legacy wrapper removal preserves nested escaped names, other colors and malformed input', () => {
  const escaped = String.raw`\mathrm{A\_{B}}`;
  assert.equal(stripLegacyScenarioColor(`\\textcolor{#67b7e1}{${escaped}}`), escaped);
  const custom = String.raw`\textcolor{red}{x} + \textcolor{#67b7e1}{y}`;
  assert.equal(stripLegacyScenarioColor(custom), custom);
  const malformed = String.raw`\textcolor{#67b7e1}{\mathrm{NoBuild}`;
  assert.equal(stripLegacyScenarioColor(malformed), malformed);
  assert.equal(stripLegacyScenarioColor(`${oldLatex} - ${oldLatex}`), String.raw`Flow_{Link, \mathrm{NoBuild}} - Flow_{Link, \mathrm{NoBuild}}`);
});


test('full picker expressions are inserted unchanged without doubling the suffix', () => {
  for (const base of ['TravelTimeHours_{Zone}', 'x', String.raw`\{Flow\}_{Link}`, String.raw`x_{\mathrm{Link}}`]) {
    const displayed = scenarioLatex(base, 'No Corridor');
    assert.equal(scenarioLatex(scenarioBaseFromLatex(displayed, 'No Corridor'), 'No Corridor'), displayed);
    assert.equal(scenarioBaseFromLatex(displayed, 'No Corridor'), base);
    assert.ok(!displayed.includes('textcolor'));
  }
  assert.equal(scenarioLatex(scenarioBaseFromLatex('TravelTimeHours_{Zone,NoCorridor}', 'No Corridor'), 'No Corridor'), 'TravelTimeHours_{Zone, NoCorridor}');
});

test('migrated active references and their formulas share the same plain expression', () => {
  const input = { ...createBlankKpi(), id: 'input', name: 'Travel Time' };
  const comparison = { ...createBlankKpi(), id: 'comparison', scenarioType: 'Inter-Scenario' as const, scenarioNames: ['No Build', 'Build'] as [string, string],
    sources: [{ id: 'ref', type: 'kpi' as const, kpiId: input.id, scenarioSlot: 0 as const, scenarioBaseLatex: 'Flow_{Link}', latex: oldLatex }],
    description: { overview: '', formulaComment: '', formulas: [{ name: '', items: [{ tag: '', formula: `y = ${oldLatex}`, leftExpression: 'y', rightExpression: oldLatex, generalExplanation: '', terms: [] }] }] }
  };
  const config = repairConfig({ ...createBlankConfig(), schemaVersion: 43, kpis: [input, comparison] }).config;
  const migrated = config.kpis[1];
  assert.equal(migrated.sources[0].latex, 'Flow_{Link, NoBuild}');
  assert.equal(migrated.description.formulas[0].items[0].rightExpression, migrated.sources[0].latex);
  assert.ok(!JSON.stringify(prepareForExport(config)).includes('#67b7e1'));
});
