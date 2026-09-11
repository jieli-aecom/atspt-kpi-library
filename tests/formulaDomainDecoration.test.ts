import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import katex from 'katex';

// Exercise the actual renderer without mounting the application's browser UI.
const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const renderer = app.slice(app.indexOf('const formulaDecorationCache ='), app.indexOf('const renderFormulaHtml ='));
const domainTokens = app.slice(app.indexOf('  const fieldDomainTokens = useMemo('), app.indexOf('  const referencedKpiNames = JSON.stringify'));
const compiled = ts.transpileModule(`${renderer}
function getDomainTokens(config, kpi) { ${domainTokens} return fieldDomainTokens; }
({ decorateFormulaTokens, getDomainTokens });`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const { decorateFormulaTokens, getDomainTokens } = runInNewContext(compiled, {
  katex, spatialScaleKeys: [], spatialScaleLabels: {}, genericSpatialUnits: [],
  useMemo: (fn: () => unknown) => fn(),
  formulaFieldDomains: (config: { domains: unknown[] }) => config.domains,
  latexIdentifier: (value: string) => value.replace(/\s+/g, ''),
  sourceItemLabel: (_config: unknown, source: { id: string }) => source.id
});
const tokens = () => getDomainTokens({ domains: [{ name: 'Travel mode', options: ['Car', 'Public Transport'], sourceIds: ['before', 'after'] }] }, {
  sources: [{ id: 'before' }, { id: 'after' }]
});
const render = (formula: string, semanticTokens: unknown[]) => {
  const result = decorateFormulaTokens(formula, semanticTokens);
  return katex.renderToString(result.decorated, { output: 'html', throwOnError: true, strict: 'ignore', trust: (context) => context.command === '\\htmlClass' });
};

test('shared domain values retain a source target and list all citations', () => {
  for (const token of tokens()) {
    assert.equal(token.target.kind, 'source');
    assert.equal(token.target.sourceId, 'before');
    assert.match(token.label, /before; after/);
  }
});

test('domain values inside filtered source expressions render nested decorations', () => {
  const html = render('Mode_{Link|Car}', [{ latex: 'Mode_{Link}', kind: 'source', label: 'Mode', target: { kind: 'source', sourceId: 'after' } }, ...tokens()]);
  assert.match(html, /formula-source-token/);
  assert.match(html, /formula-dimension-token/);
});

test('multiword domain values render in compact math and spaced text forms', () => {
  for (const formula of [String.raw`x=PublicTransport`, String.raw`x=\text{Public Transport}`, String.raw`x=\mathrm{PublicTransport}`]) {
    assert.match(render(formula, tokens()), /formula-dimension-token/);
  }
});

test('domain keywords do not decorate longer identifiers or LaTeX command names', () => {
  const html = render(String.raw`Carpet+\max(x)`, [...tokens(), { latex: 'max', kind: 'dimension', label: 'max' }]);
  assert.doesNotMatch(html, /formula-dimension-token/);
});

test('generic scale keywords cannot erase a domain source link', () => {
  const result = decorateFormulaTokens('Car', [...tokens(), { latex: 'Car', kind: 'scale', label: 'Table unit' }]);
  assert.equal(result.tokens[0].kind, 'dimension');
  assert.equal(result.tokens[0].target.sourceId, 'before');
});
