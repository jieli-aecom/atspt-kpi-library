import type { DataSourceField, KpiPoolConfig } from './types';

// Keep table references together without the category/group nesting of the picker.
export function fieldSourceRows(config: KpiPoolConfig, field: DataSourceField) {
  const rows = new Map<string, { label: string; fields: { id: string; name: string }[] }>();
  for (const source of field.sources ?? []) {
    const key = source.type === 'dataField' ? `table:${source.dataSourceId}` : source.type;
    let label: string;
    let name: string;
    if (source.type === 'dataField') {
      const table = config.dataSources.find((entry) => entry.id === source.dataSourceId);
      const group = config.dataSourceGroups.find((entry) => entry.itemIds.includes(source.dataSourceId));
      label = [group?.name, table?.name ?? 'Missing table'].filter(Boolean).join(' · ');
      name = table?.fields.find((entry) => entry.id === source.fieldId)?.name ?? 'Missing field';
    } else if (source.type === 'lookup') {
      label = 'Lookups';
      name = config.lookups.find((entry) => entry.id === source.lookupId)?.outputName ?? 'Missing lookup';
    } else if (source.type === 'variable') {
      label = 'Constants';
      name = config.variables.find((entry) => entry.id === source.variableId)?.name ?? 'Missing constant';
    } else {
      label = 'Custom sources';
      name = source.name || 'Unnamed source';
    }
    if (!rows.has(key)) rows.set(key, { label, fields: [] });
    rows.get(key)!.fields.push({ id: source.id, name });
  }
  return [...rows.entries()].map(([key, row]) => ({ key, ...row }));
}
