const latexKeys = new Set([
  'latex', 'LaTeX', 'scenarioBaseLatex', 'preferredLatex', 'formula', 'aggregationFormula',
  'leftExpression', 'rightExpression', 'term', 'Term', 'representation'
]);

/** Change spatial tokens inside balanced LaTeX subscripts, retaining other notation. */
export const migrateParcelSubscripts = (latex: string): string => {
  let result = '';
  let cursor = 0;
  for (let index = 0; index < latex.length; index++) {
    if (latex[index] === '\\') { index++; continue; }
    if (latex[index] !== '_' || latex[index + 1] !== '{') continue;
    const start = index + 2;
    let depth = 1;
    let end = start;
    for (; end < latex.length; end++) {
      if (latex[end] === '\\') { end++; continue; }
      if (latex[end] === '{') depth++;
      if (latex[end] === '}' && --depth === 0) break;
    }
    if (depth !== 0) break;
    const subscript = latex.slice(start, end).replace(/(?<![\w\\])cells?\b/gi, (match) => {
      const replacement = match.toLowerCase() === 'cells' ? 'parcels' : 'parcel';
      if (match === match.toUpperCase()) return replacement.toUpperCase();
      return match[0] === match[0].toUpperCase()
        ? replacement[0].toUpperCase() + replacement.slice(1) : replacement;
    });
    result += latex.slice(cursor, start) + subscript;
    cursor = end;
    index = end;
  }
  return result + latex.slice(cursor);
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

/** v46: preserve identifiers and prose while migrating scale settings and expressions. */
export const migrateParcelTerminology = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(migrateParcelTerminology);
  if (!isRecord(value)) return value;
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => {
    if ((key === 'spatialScales' || key === 'Spatial scales') && isRecord(entry)) {
      const { cell, ...scales } = entry;
      if (scales.parcel === undefined && cell !== undefined) scales.parcel = cell;
      return [key, migrateParcelTerminology(scales)];
    }
    if (['spatialUnit', 'spatialScale', 'Spatial Unit'].includes(key)
      && typeof entry === 'string' && /^cells?$/i.test(entry.trim())) {
      return [key, 'Parcel'];
    }
    return [key, typeof entry === 'string' && latexKeys.has(key)
      ? migrateParcelSubscripts(entry) : migrateParcelTerminology(entry)];
  }));
};
