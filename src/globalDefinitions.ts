import { spatialScaleDefinitionKeys, type KpiPoolConfig, type SpatialScaleDefinitions } from './types.js';

const latexKeys = new Set(['latex', 'LaTeX', 'scenarioBaseLatex', 'preferredLatex', 'formula', 'aggregationFormula',
  'leftExpression', 'rightExpression', 'term', 'Term', 'representation']);
const proseKeys = new Set(['overview', 'formulaComment', 'generalExplanation', 'explanation', 'meaning', 'details', 'note', 'text', 'description', 'aggregationMethod']);
const escapePattern = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const identifier = (value: string | undefined) => Boolean(value && /[\p{L}\p{N}]/u.test(value));

/** One pass prevents cascading renames, including swaps; literal matching never treats user LaTeX as regex. */
export const latexReplacer = (replacements: ReadonlyMap<string, string>) => {
  const entries = [...replacements].filter(([from]) => from).sort((a, b) => b[0].length - a[0].length);
  if (!entries.some(([from, to]) => from !== to)) return (value: string) => value;
  const pattern = new RegExp(entries.map(([from]) => escapePattern(from)).join('|'), 'gu');
  return (value: string) => value.replace(pattern, (match: string, offset: number) => {
    const before = value[offset - 1];
    const after = value[offset + match.length];
    if ((identifier(match[0]) && (identifier(before) || before === '\\')) ||
        (identifier(match[match.length - 1]) && identifier(after))) return match;
    return replacements.get(match)!;
  });
};

const replaceValue = (key: string, value: string, replace: (text: string) => string, units: ReadonlyMap<string, string>) => {
  if (['spatialUnit', 'spatialScale', 'Spatial Unit'].includes(key)) return units.get(value) ?? value;
  if (latexKeys.has(key)) return replace(value);
  // Preserve prose, identifiers and user-authored names. Only math spans in prose are notation.
  if (proseKeys.has(key)) return value.replace(/\$\$[\s\S]*?\$\$|(?<!\\)\$[^$\n]*?\$|\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\]/g, replace);
  return value;
};

/** v47 reverses v46's Parcel terminology without replaying it on current/custom definitions. */
export const migrateCellTerminology = (value: unknown): unknown => {
  const replacements = new Map<string, string>();
  for (const [from, to] of [['Parcel', 'Cell'], ['Parcels', 'Cells'], ['parcel', 'cell'], ['parcels', 'cells'], ['PARCEL', 'CELL'], ['PARCELS', 'CELLS']]) replacements.set(from, to);
  const replace = latexReplacer(replacements);
  const visit = (entry: unknown, key = ''): unknown => {
    if (typeof entry === 'string') return replaceValue(key, entry, replace, replacements);
    if (Array.isArray(entry)) return entry.map((child) => visit(child, key));
    if (!entry || typeof entry !== 'object') return entry;
    const record = { ...entry } as Record<string, unknown>;
    if (key === 'spatialScales' || key === 'Spatial scales') {
      if (record.cell === undefined && record.parcel !== undefined) record.cell = record.parcel;
      delete record.parcel;
    }
    return Object.fromEntries(Object.entries(record).map(([name, child]) => [name, visit(child, name)]));
  };
  return visit(value);
};

export const scaleReplacements = (before: SpatialScaleDefinitions, after: SpatialScaleDefinitions) => new Map(
  spatialScaleDefinitionKeys.map((key) => [before[key].latex, after[key].latex])
);

/** Normalize each participant to the winning definitions before import/three-way merge. */
export const alignGlobalDefinitions = (config: KpiPoolConfig, definitions: SpatialScaleDefinitions, logic: KpiPoolConfig['logic']): KpiPoolConfig => {
  const replacements = scaleReplacements(config.spatialScaleDefinitions, definitions);
  const targetLogic = new Map(logic.map((item) => [item.id, item.latex]));
  for (const item of config.logic) replacements.set(item.latex, targetLogic.get(item.id) ?? item.latex);
  const units = new Map(spatialScaleDefinitionKeys.map((key) => [config.spatialScaleDefinitions[key].name, definitions[key].name]));
  const replace = latexReplacer(replacements);
  const visit = (value: unknown, key = ''): unknown => {
    if (typeof value === 'string') return replaceValue(key, value, replace, units);
    if (!value || typeof value !== 'object' || key === 'spatialScaleDefinitions' || key === 'logic') return value;
    let changed = false;
    const entries = Object.entries(value).map(([name, child]) => {
      const next = visit(child, Array.isArray(value) ? key : name);
      changed ||= next !== child;
      return [name, next] as const;
    });
    return changed ? Array.isArray(value) ? entries.map(([, child]) => child) : Object.fromEntries(entries) : value;
  };
  return { ...visit(config) as KpiPoolConfig, spatialScaleDefinitions: definitions, logic };
};

/** Yield throughout the tree (including large tables), then commit once. Unchanged branches retain identity. */
export const rewriteGlobalNotation = async (
  config: KpiPoolConfig,
  replacements: ReadonlyMap<string, string>,
  units: ReadonlyMap<string, string> = new Map(),
  yieldTask: () => Promise<void> = () => new Promise((resolve) => setTimeout(resolve, 0)),
  replace: (value: string) => string = latexReplacer(replacements)
): Promise<KpiPoolConfig> => {
  let visited = 0;
  let deadline = Date.now() + 8;
  const visit = async (value: unknown, key = ''): Promise<unknown> => {
    if (++visited % 100 === 0 && Date.now() >= deadline) { await yieldTask(); deadline = Date.now() + 8; }
    if (typeof value === 'string') return replaceValue(key, value, replace, units);
    if (!value || typeof value !== 'object') return value;
    if (key === 'spatialScaleDefinitions' || key === 'logic') return value;
    let changed = false;
    const result: Record<string, unknown> | unknown[] = Array.isArray(value) ? [] : {};
    for (const [name, child] of Object.entries(value)) {
      const next = await visit(child, Array.isArray(value) ? key : name);
      (result as Record<string, unknown>)[name] = next;
      changed ||= next !== child;
    }
    return changed ? result : value;
  };
  await yieldTask();
  const next = await visit(config) as KpiPoolConfig;
  const timestamp = new Date().toISOString();
  return { ...next, kpis: next.kpis.map((kpi, index) => kpi === config.kpis[index] ? kpi : { ...kpi, lastModified: timestamp }) };
};

/** Capture balanced indexed units, including nested/command subscripts, without parsing or evaluating LaTeX. */
export const indexedScaleLatex = (formula: string, base: string): string[] => {
  if (!base) return [];
  const result = new Set<string>();
  let cursor = 0;
  while ((cursor = formula.indexOf(base, cursor)) >= 0) {
    const start = cursor;
    cursor += base.length;
    if (formula[cursor] !== '_') continue;
    let end = cursor + 1;
    if (formula[end] === '{') {
      let depth = 1;
      for (end++; end < formula.length && depth; end++) {
        if (formula[end] === '\\') { end++; continue; }
        if (formula[end] === '{') depth++;
        if (formula[end] === '}') depth--;
      }
      if (depth) continue;
    } else if (formula[end] === '\\') {
      end++;
      while (/[a-zA-Z]/.test(formula[end] ?? '') && end < formula.length) end++;
    } else if (end < formula.length) end++;
    else continue;
    result.add(formula.slice(start, end));
  }
  return [...result];
};
