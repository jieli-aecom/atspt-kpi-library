import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import React from 'react';
import ts from 'typescript';
import { createBlankConfig, createBlankKpi } from '../src/configSchema.ts';
import { genericSpatialUnits, spatialScaleDefinitionKeys, spatialScaleKeys } from '../src/types.ts';
import { scenarioFormulaTokens } from '../src/scenarios.ts';

// Exercise the actual editor's rendered controls and measurement callback without
// requiring a browser or relying on wall-clock performance assertions.
const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const editor = app.slice(app.indexOf('function FormulaExpressionEditor('), app.indexOf('\ntype FormulaSemanticToken ='))
  .replace('[paletteExpanded, setPaletteExpanded] = useState(false)', '[paletteExpanded, setPaletteExpanded] = useState(testExpanded)')
  .replace('[paletteFocused, setPaletteFocused] = useState(false)', '[paletteFocused, setPaletteFocused] = useState(testFocused)')
  .replace('[paletteOptionLimit, setPaletteOptionLimit] = useState(8)', '[paletteOptionLimit, setPaletteOptionLimit] = useState(testLimit)');
const compiled = ts.transpileModule(`${editor}\nFormulaExpressionEditor;`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React }
}).outputText;
const item = (tag = 'Result', leftExpression = 'y') => ({ tag, leftExpression, rightExpression: 'x+1', formula: `${leftExpression} = x+1`, generalExplanation: '', terms: [] });
const config = createBlankConfig();
config.logic = [{ id: 'max', latex: '\\max', explanation: 'Maximum' }];
const kpi = { ...createBlankKpi(), scenarioType: 'Inter-Scenario' as const, scenarioNames: ['Before', 'After'] as [string, string],
  sources: [
    ...Array.from({ length: 43 }, (_, i) => ({ id: `source-${i}`, type: 'custom' as const, name: `Input ${i}`, latex: `x_{${i}}` })),
    { id: 'blank', type: 'custom' as const, name: 'Empty', latex: '' },
    { id: 'lookup', type: 'lookup' as const, lookupId: 'lookup', latex: 'Lookup()' },
    { id: 'constant', type: 'variable' as const, variableId: 'constant', latex: 'Constant' }
  ] };

function mount({ expanded = false, focused = false, limit = 8, width = 300, scrollWidth = 900, spatialScale, priorItems = [] }: {
  expanded?: boolean; focused?: boolean; limit?: number; width?: number; scrollWidth?: number; spatialScale?: 'region'; priorItems?: ReturnType<typeof item>[];
} = {}) {
  const refs: any[] = [];
  const states: any[] = [];
  const effects: Array<() => unknown> = [];
  const commits: unknown[] = [];
  let pendingCommit: (() => void) | undefined;
  const render = runInNewContext(compiled, {
    React, testExpanded: expanded, testFocused: focused, testLimit: limit, spatialScaleKeys, spatialScaleDefinitionKeys, genericSpatialUnits,
    scenarioFormulaTokens, textInputDebounceMs: 250,
    formulaFieldDomains: () => [{ key: 'mode', name: 'Mode', options: ['Walk', 'Car'] }],
    formulaDimensions: () => [{ name: 'Year', options: ['2026'] }],
    latexIdentifier: (value: string) => value.replace(/\s+/g, ''),
    sourceItemLabel: (_config: unknown, source: { id: string }) => source.id,
    InlineMath: 'math', ChevronDown: 'svg',
    useMemo: (fn: () => unknown) => fn(),
    useRef: (current: unknown) => { const ref = { current }; refs.push(ref); return ref; },
    useState: (initial: unknown) => {
      const index = states.push(initial) - 1;
      return [initial, (value: any) => { states[index] = typeof value === 'function' ? value(states[index]) : value; }];
    },
    useEffect: () => {}, useLayoutEffect: (effect: () => unknown) => effects.push(effect),
    useCloseOnOutsideClick: () => ({ current: null }),
    window: { addEventListener() {}, removeEventListener() {}, clearTimeout() {}, setTimeout(fn: () => void) { pendingCommit = fn; return 1; } },
    requestAnimationFrame: () => 1
  });
  const tree = render({ config, kpi, item: item(), priorItems, spatialScale, onChange: (value: unknown) => commits.push(value) });
  const elements: any[] = [];
  const visit = (node: any) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(visit); return; }
    elements.push(node);
    visit(node.props?.children);
  };
  visit(tree);
  const buttons = elements.filter((node) => node.type === 'button' && node.props.className !== 'formula-palette-toggle');
  refs[2].current = { clientWidth: width, scrollWidth };
  const palette = elements.find((node) => node.props?.className?.startsWith('formula-source-options '));
  return { buttons, palette, states, commits, measure: effects[0], commit: () => pendingCommit?.() };
}

test('long formula editors keep closed shortcut palettes bounded and retain insertion order', () => {
  const closed = mount({ priorItems: Array.from({ length: 52 }, (_, i) => item(`Step ${i}`, `Result_${i}`)) });
  assert.equal(closed.buttons.length, 8);
  assert.deepEqual(closed.buttons.map((button) => button.props.title), Array.from({ length: 8 }, (_, i) => `source-${i}`));
  closed.measure();
  assert.equal(closed.states[4], true, 'More remains available for hidden options');
  assert.equal(closed.states[5], 8, 'an overflowing strip does not mount the rest of the palette');
});

test('a wide strip grows until filled; hidden strips do not eagerly render every option', () => {
  const wide = mount({ width: 1600, scrollWidth: 800 });
  wide.measure();
  assert.equal(wide.states[5], 16);
  const hidden = mount({ width: 0, scrollWidth: 0 });
  hidden.measure();
  assert.equal(hidden.states[5], 8);
  const complete = mount({ limit: 256, width: 1600, scrollWidth: 800 });
  complete.measure();
  assert.equal(complete.states[4], false, 'More is hidden when all shortcuts fit');
});

test('More restores sources, scenarios, domains, lookups, constants, logic, results and scales', () => {
  const opened = mount({ expanded: true, priorItems: [item('Earlier', 'EarlierResult')] });
  const titles = opened.buttons.map((button) => button.props.title);
  for (const title of ['source-42', 'blank', 'Scenario: Before', 'Scenario: After', 'Dimension: Year', 'Mode option: Walk',
    'lookup', 'constant', 'Maximum', 'Formula result: Earlier', 'Spatial scale: Region', 'Generic spatial unit: Point']) {
    assert.ok(titles.includes(title), title);
  }
  assert.equal(opened.buttons.find((button) => button.props.title === 'blank').props.disabled, true);
  opened.buttons.find((button) => button.props.title === 'source-42').props.onClick();
  opened.commit();
  assert.deepEqual(JSON.parse(JSON.stringify(opened.commits)), [{ leftExpression: 'y', rightExpression: 'x+1x_{42}', formula: 'y = x+1x_{42}' }]);
});

test('scale palettes retain priority shortcuts and include the final result only once', () => {
  const priorItems = [item('Earlier', 'EarlierResult'), item('Final', 'FinalResult')];
  const closed = mount({ spatialScale: 'region', priorItems });
  assert.equal(closed.buttons.length, 8);
  assert.equal(closed.buttons[1].props.title, 'Last formula result: Final');
  const opened = mount({ expanded: true, spatialScale: 'region', priorItems });
  assert.equal(opened.buttons.filter((button) => button.props.title === 'Last formula result: Final').length, 1);
  assert.ok(opened.buttons.some((button) => button.props.title === 'Formula result: Earlier'));
  assert.ok(!opened.buttons.some((button) => button.props.title === 'Formula result: Final'));
  assert.equal(opened.buttons.filter((button) => button.props.title === 'Spatial scale: Region').length, 1);
});

test('keyboard focus retains the full shortcut tab order until focus leaves the strip', () => {
  const closed = mount();
  closed.palette.props.onFocusCapture();
  assert.equal(closed.states[6], true);
  assert.deepEqual(mount({ focused: true }).buttons.map((button) => button.props.title), mount({ expanded: true }).buttons.map((button) => button.props.title));
  closed.palette.props.onBlurCapture({ currentTarget: { contains: () => true }, relatedTarget: {} });
  assert.equal(closed.states[6], true);
  closed.palette.props.onBlurCapture({ currentTarget: { contains: () => false }, relatedTarget: null });
  assert.equal(closed.states[6], false);
});
