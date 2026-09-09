import type { KpiPoolConfig } from './types.js';

export type SupportTarget = { dataSourceId: string; fieldId?: string };
export type SupportNode = { key: string; label: string; kind: 'field' | 'kpi'; tableName?: string };
export type KpiSupport = { kpiId: string; name: string; direct?: SupportNode[]; indirect?: SupportNode[] };
const fieldKey = (tableId: string, fieldId: string) => JSON.stringify(['field', tableId, fieldId]);
const kpiKey = (id: string) => JSON.stringify(['kpi', id]);

/** Follow declared dependencies downstream; table relationships alone do not imply KPI support. */
export function traceKpiSupport(config: KpiPoolConfig, target: SupportTarget): KpiSupport[] {
  const nodes = new Map<string, SupportNode>();
  const edges = new Map<string, Set<string>>();
  config.dataSources.forEach((table) => table.fields.forEach((field) => {
    const key = fieldKey(table.id, field.id);
    nodes.set(key, { key, kind: 'field', tableName: table.name || 'Untitled table', label: field.name || 'Untitled field' });
  }));
  config.kpis.forEach((kpi) => {
    const key = kpiKey(kpi.id);
    nodes.set(key, { key, kind: 'kpi', label: kpi.name || 'Untitled KPI' });
  });
  const connect = (from: string, to: string) => {
    if (!nodes.has(from) || !nodes.has(to)) return;
    if (!edges.has(from)) edges.set(from, new Set());
    edges.get(from)!.add(to);
  };
  config.dataSources.forEach((table) => table.fields.forEach((field) => {
    field.sources?.forEach((source) => {
      if (source.type === 'dataField') connect(fieldKey(source.dataSourceId, source.fieldId), fieldKey(table.id, field.id));
    });
  }));
  config.kpis.forEach((kpi) => {
    kpi.sources.forEach((source) => {
      if (source.type === 'dataField') connect(fieldKey(source.dataSourceId, source.fieldId), kpiKey(kpi.id));
      if (source.type === 'kpi') connect(kpiKey(source.kpiId), kpiKey(kpi.id));
    });
    kpi.prerequisite.kpis.forEach((id) => connect(kpiKey(id), kpiKey(kpi.id)));
  });
  const results = new Map<string, KpiSupport>();
  const table = config.dataSources.find((entry) => entry.id === target.dataSourceId);
  for (const field of table?.fields ?? []) {
    if (target.fieldId !== undefined && field.id !== target.fieldId) continue;
    const start = fieldKey(table!.id, field.id);
    const queue = [[start]];
    const visited = new Set([start]);
    for (let index = 0; index < queue.length; index += 1) {
      const path = queue[index];
      for (const next of edges.get(path[path.length - 1]) ?? []) {
        if (path.includes(next)) continue;
        const nextPath = [...path, next];
        const node = nodes.get(next)!;
        if (node.kind === 'kpi') {
          const id = JSON.parse(next)[1] as string;
          const result = results.get(id) ?? { kpiId: id, name: node.label };
          const kind = nextPath.length === 2 ? 'direct' : 'indirect';
          if (!result[kind] || nextPath.length < result[kind]!.length) result[kind] = nextPath.map((key) => nodes.get(key)!);
          results.set(id, result);
        }
        if (!visited.has(next)) {
          visited.add(next);
          queue.push(nextPath);
        }
      }
    }
  }
  return config.kpis.flatMap((kpi) => results.get(kpi.id) ?? []);
}
