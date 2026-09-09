import type { DataSource, KpiMetric, KpiPoolConfig, KpiSourceItem } from './types.js';

export const isScenarioTable = (config: Pick<KpiPoolConfig, 'dataSourceGroups'>, table: DataSource) =>
  ['Scenario Upstream', 'KPI Preparation'].includes(config.dataSourceGroups.find((group) => group.itemIds.includes(table.id))?.category ?? table.category ?? 'Preprocessed Constants');

export const normalizeScenarioNames = (value: unknown): [string, string] => {
  const names = Array.isArray(value) ? value : [];
  const first = typeof names[0] === 'string' && names[0].trim() ? names[0].trim() : 'Scenario';
  let second = typeof names[1] === 'string' && names[1].trim() ? names[1].trim() : 'Scenario 2';
  if (first.replace(/\s/g, '').toLowerCase() === second.replace(/\s/g, '').toLowerCase()) second = `${first} 2`;
  return [first, second];
};

// Add to the first subscript, respecting nested braces and collection expressions.
export const scenarioLatex = (base: string, name: string) => {
  const escapes: Record<string, string> = { '\\': '\\backslash{}', '^': '\\text{\\^{}}', '~': '\\text{\\~{}}' };
  const token = name.replace(/\s/g, '').replace(/[\\{}_$%&#^~]/g, (char) => escapes[char] ?? `\\${char}`);
  const suffix = `\\textcolor{#67b7e1}{\\mathrm{${token}}}`;
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
