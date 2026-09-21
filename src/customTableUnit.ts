import { latexReplacer, rewriteGlobalNotation } from './globalDefinitions.js';
import { sourceTableUnitLatex, type KpiPoolConfig } from './types.js';

/** Only rewrite subscript arguments; field symbols and ordinary prose keep their names. */
export const unitSubscriptReplacer = (from: string, to: string) => {
  const replace = latexReplacer(new Map([[from, to]]));
  return (value: string) => {
    let result = '';
    let start = 0;
    for (let i = 0; i < value.length; i++) {
      if (value[i] === '\\') { i++; continue; }
      if (value[i] !== '_') continue;
      let end = i + 1;
      while (/\s/.test(value[end] ?? '') && end < value.length) end++;
      const argumentStart = end;
      if (value[end] === '{') {
        let depth = 1;
        for (end++; end < value.length && depth; end++) {
          if (value[end] === '\\') { end++; continue; }
          if (value[end] === '{') depth++;
          if (value[end] === '}') depth--;
        }
        if (depth) continue;
      } else if (value[end] === '\\') {
        end++;
        while (/[a-zA-Z]/.test(value[end] ?? '') && end < value.length) end++;
      } else if (end < value.length) end++;
      const argument = value.slice(argumentStart, end);
      const updated = replace(argument);
      result += value.slice(start, argumentStart) + (argument[0] !== '{' && updated !== argument ? `{${updated}}` : updated);
      start = end;
      i = end - 1;
    }
    return result + value.slice(start);
  };
};

export const renameCustomTableUnit = async (
  config: KpiPoolConfig,
  sourceId: string,
  name: string,
  yieldTask?: () => Promise<void>
): Promise<KpiPoolConfig> => {
  const source = config.dataSources.find((entry) => entry.id === sourceId);
  if (!source || source.spatialUnit || source.customUnit === name) return config;
  const from = sourceTableUnitLatex(config.spatialScaleDefinitions, source);
  const to = sourceTableUnitLatex(config.spatialScaleDefinitions, { ...source, customUnit: name });
  const next = from && to && from !== to
    ? await rewriteGlobalNotation(config, new Map(), new Map(), yieldTask, unitSubscriptReplacer(from, to))
    : config;
  return { ...next, dataSources: next.dataSources.map((entry) => entry.id === sourceId ? { ...entry, customUnit: name } : entry) };
};
