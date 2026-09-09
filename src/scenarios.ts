import type { DataSource, KpiMetric, KpiPoolConfig, KpiSourceItem } from './types.js';

/** Remove only the generated v42/v43 wrapper, preserving the mathematical content. */
export const stripLegacyScenarioColor = (latex: string): string => {
  const prefix = '\\textcolor{#67b7e1}{';
  let result = '';
  let cursor = 0;
  while (cursor < latex.length) {
    const start = latex.indexOf(prefix, cursor);
    if (start < 0) return result + latex.slice(cursor);
    const contentStart = start + prefix.length;
    let depth = 1;
    let end = contentStart;
    for (; end < latex.length; end++) {
      if (latex[end] === '\\') { end++; continue; }
      if (latex[end] === '{') depth++;
      if (latex[end] === '}' && --depth === 0) break;
    }
    if (depth !== 0) return result + latex.slice(cursor);
    const content = latex.slice(contentStart, end);
    result += latex.slice(cursor, start) + (content.startsWith('\\mathrm{')
      ? stripLegacyScenarioColor(content) : latex.slice(start, end + 1));
    cursor = end + 1;
  }
  return result;
};

export const migrateScenarioDecoration = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(migrateScenarioDecoration);
  if (!value || typeof value !== 'object') return value;
  const latexKeys = new Set(['latex', 'scenarioBaseLatex', 'preferredLatex', 'formula', 'leftExpression', 'rightExpression', 'term']);
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key,
    typeof entry === 'string' && latexKeys.has(key) ? stripLegacyScenarioColor(entry) : migrateScenarioDecoration(entry)
  ]));
};

export const isScenarioTable = (config: Pick<KpiPoolConfig, 'dataSourceGroups'>, table: DataSource) =>
  ['Scenario Upstream', 'KPI Preparation'].includes(config.dataSourceGroups.find((group) => group.itemIds.includes(table.id))?.category ?? table.category ?? 'Preprocessed Constants');

export const normalizeScenarioNames = (value: unknown): [string, string] => {
  const names = Array.isArray(value) ? value : [];
  const first = typeof names[0] === 'string' && names[0].trim() ? names[0].trim() : 'Scenario';
  let second = typeof names[1] === 'string' && names[1].trim() ? names[1].trim() : 'Scenario 2';
  if (first.replace(/\s/g, '').toLowerCase() === second.replace(/\s/g, '').toLowerCase()) second = `${first} 2`;
  return [first, second];
};

export const scenarioNameLatex = (name: string) => {
  const escapes: Record<string, string> = { '\\': '\\backslash{}', '^': '\\text{\\^{}}', '~': '\\text{\\~{}}' };
  const token = name.replace(/\s/g, '').replace(/[\\{}_$%&#^~]/g, (char) => escapes[char] ?? `\\${char}`);
  return token;
};

export const scenarioFormulaTokens = (kpi: Pick<KpiMetric, 'scenarioNames'>) => kpi.scenarioNames.map((name) => ({
  latex: scenarioNameLatex(name),
  kind: 'scenario' as const,
  label: `Scenario: ${name}`
}));

// Add to the first subscript, respecting nested braces and collection expressions.
export const scenarioLatex = (base: string, name: string) => {
  const suffix = scenarioNameLatex(name);
  const start = base.indexOf('_{');
  if (start >= 0) {
    let depth = 1;
    for (let i = start + 2; i < base.length; i++) {
      if (base[i - 1] === '\\') continue;
      if (base[i] === '{') depth++;
      if (base[i] === '}' && --depth === 0) return `${base.slice(0, i)}, ${suffix}${base.slice(i)}`;
    }
  }
  return `{${base}}_{${suffix}}`;
};

/** Accept the full visible expression without appending the same scenario twice. */
export const scenarioBaseFromLatex = (expression: string, name: string) => {
  const suffix = scenarioNameLatex(name);
  const start = expression.indexOf('_{');
  if (start < 0) return expression;
  let depth = 1;
  for (let end = start + 2; end < expression.length; end++) {
    if (expression[end] === '\\') { end++; continue; }
    if (expression[end] === '{') depth++;
    if (expression[end] !== '}' || --depth !== 0) continue;
    const subscript = expression.slice(start + 2, end);
    const tail = new RegExp(`,\\s*${suffix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`);
    if (tail.test(subscript)) return expression.slice(0, start + 2) + subscript.replace(tail, '') + expression.slice(end);
    if (subscript.trim() === suffix) {
      const head = expression.slice(0, start);
      return (head.startsWith('{') && head.endsWith('}') ? head.slice(1, -1) : head) + expression.slice(end + 1);
    }
    return expression;
  }
  return expression;
};

export const reconcileKpiScenarios = (config: Pick<KpiPoolConfig, 'dataSourceGroups' | 'dataSources' | 'kpis'>, kpi: KpiMetric): KpiMetric => {
  const scenarioNames = normalizeScenarioNames(kpi.scenarioNames);
  const seen = new Set<string>();
  const sources = kpi.sources.flatMap((source): KpiSourceItem[] => {
    if (source.type !== 'dataField' && source.type !== 'kpi') return [source];
    const table = source.type === 'dataField' ? config.dataSources.find((table) => table.id === source.dataSourceId) : undefined;
    const referencedKpi = source.type === 'kpi' ? config.kpis.find((entry) => entry.id === source.kpiId) : undefined;
    const dependent = kpi.scenarioType === 'Inter-Scenario' && (source.type === 'kpi'
      ? referencedKpi?.scenarioType === 'Scenario'
      : table && isScenarioTable(config, table));
    const slot = dependent ? source.scenarioSlot ?? 0 : undefined;
    const key = JSON.stringify(source.type === 'kpi' ? ['kpi', source.kpiId, slot] : ['dataField', source.dataSourceId, source.fieldId, slot]);
    if (seen.has(key)) return [];
    seen.add(key);
    if (!dependent) {
      const { scenarioSlot, ...retained } = source;
      return [retained];
    }
    const base = source.scenarioBaseLatex ?? (source.latex || (referencedKpi?.name.replace(/\s/g, '') ?? ''));
    const latex = scenarioLatex(base, scenarioNames[slot!]);
    return [{ ...source, scenarioSlot: slot, scenarioBaseLatex: base, latex }];
  });
  if (JSON.stringify(sources) === JSON.stringify(kpi.sources) && JSON.stringify(scenarioNames) === JSON.stringify(kpi.scenarioNames)) return kpi;
  const replacements = new Map<string, string>();
  for (const source of kpi.sources) {
    const next = sources.find((entry) => entry.id === source.id);
    if (next && source.latex && next.latex !== source.latex) replacements.set(source.latex, next.latex);
  }
  // Replace simultaneously, so one scenario's new expression cannot be replaced again.
  const tokens = [...replacements.keys()].sort((a, b) => b.length - a.length);
  const pattern = tokens.length ? new RegExp(tokens.map((token) => token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g') : undefined;
  const replace = (text: string) => pattern ? text.replace(pattern, (token, offset: number) => {
    if (/[\p{L}\p{N}]/u.test(token[0]) && /[\p{L}\p{N}]/u.test(text[offset - 1] ?? '')) return token;
    if (/[\p{L}\p{N}]/u.test(token[token.length - 1]) && /[\p{L}\p{N}]/u.test(text[offset + token.length] ?? '')) return token;
    return replacements.get(token)!;
  }) : text;
  return { ...kpi, scenarioNames, sources,
    description: { ...kpi.description, formulas: kpi.description.formulas.map((group) => ({ ...group, items: group.items.map((item) => ({ ...item, formula: replace(item.formula), leftExpression: replace(item.leftExpression), rightExpression: replace(item.rightExpression), terms: item.terms.map((term) => ({ ...term, term: replace(term.term) })) })) })) },
    spatialScales: Object.fromEntries(Object.entries(kpi.spatialScales).map(([key, scale]) => [key, { ...scale, formula: replace(scale.formula), leftExpression: replace(scale.leftExpression), rightExpression: replace(scale.rightExpression) }])) as KpiMetric['spatialScales']
  };
};
