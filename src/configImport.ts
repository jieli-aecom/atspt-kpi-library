/** Route full configuration JSON and HTML snapshots through the same import flow. */
export const readConfigImport = (
  text: string,
  fileName: string,
  readHtml: (html: string) => unknown
): unknown => {
  const trimmed = text.trim();
  const isJson = /\.json$/i.test(fileName) || /^[{[]/.test(trimmed);
  if (!isJson) return readHtml(text);

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new Error('The JSON file could not be parsed. Check its JSON syntax and try again.');
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) ||
    !('kpis' in parsed) || !Array.isArray(parsed.kpis)) {
    throw new Error('Expected a full KPI library configuration with a "kpis" array. Reporting exports from Export JSON and table-schema exports cannot be imported as library configurations.');
  }

  // Leave schema migration and unsupported-version checks to repairConfig.
  return parsed;
};
