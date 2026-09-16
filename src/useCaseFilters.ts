import type { EnumOption, KpiMetric } from './types.js';

export const filteredUseCaseIds = (options: EnumOption[], userGroups: string[], useCases: string[]) =>
  options.filter((option) =>
    (!userGroups.length && !useCases.length) || useCases.includes(option.id) ||
    Boolean(option.userGroup && userGroups.includes(option.userGroup))
  ).map((option) => option.id);

export const matchesUseCaseSelection = (
  kpi: Pick<KpiMetric, 'userGroupUseCases'>, userGroups: Set<string>, useCases: Set<string>
) => (!userGroups.size && !useCases.size) || kpi.userGroupUseCases.some((entry) =>
  userGroups.has(entry.userGroup) || entry.useCases.some((id) => useCases.has(id))
);

export const moveEnumOption = (options: EnumOption[], id: string, direction: -1 | 1, siblingIds = options.map((option) => option.id)) => {
  const siblings = new Set(siblingIds);
  const positions = options.flatMap((option, index) => siblings.has(option.id) ? [index] : []);
  const position = positions.findIndex((index) => options[index].id === id);
  const destination = positions[position + direction];
  if (position < 0 || destination === undefined) return options;
  const next = [...options];
  const source = positions[position];
  [next[source], next[destination]] = [next[destination], next[source]];
  return next;
};

export const movePerformanceArea = (options: EnumOption[], id: string, useCase: string, direction: -1 | 1) =>
  moveEnumOption(options, id, direction, options.filter((option) => option.useCase === useCase).map((option) => option.id));

export const compareUseCaseAssignments = (
  userGroups: EnumOption[], useCases: EnumOption[],
  left: Pick<KpiMetric, 'userGroupUseCases'>, right: Pick<KpiMetric, 'userGroupUseCases'>,
  order: 'asc' | 'desc'
) => {
  const keys = userGroups.flatMap((group) => [
    ...useCases.filter((option) => option.userGroup === group.id).map((option) => `${group.id}\u0000${option.id}`),
    `${group.id}\u0000`
  ]);
  const ranks = new Map(keys.map((key, index) => [key, index]));
  const rank = (kpi: Pick<KpiMetric, 'userGroupUseCases'>) => {
    const values = kpi.userGroupUseCases.flatMap((entry) =>
      (entry.useCases.length ? entry.useCases : ['']).flatMap((id) => {
        const value = ranks.get(`${entry.userGroup}\u0000${id}`);
        return value === undefined ? [] : [value];
      })
    );
    return values.length ? (order === 'asc' ? Math.min(...values) : Math.max(...values)) : undefined;
  };
  const a = rank(left);
  const b = rank(right);
  if (a === undefined) return b === undefined ? 0 : 1;
  if (b === undefined) return -1;
  return order === 'asc' ? a - b : b - a;
};

export const compareFocusedPerformanceAreas = (
  options: EnumOption[], left: Pick<KpiMetric, 'performanceAreasByUseCase'>,
  right: Pick<KpiMetric, 'performanceAreasByUseCase'>, useCase: string, order: 'asc' | 'desc'
) => {
  const ranks = new Map(options.filter((option) => option.useCase === useCase).map((option, index) => [option.id, index]));
  const rank = (kpi: Pick<KpiMetric, 'performanceAreasByUseCase'>) => {
    const values = kpi.performanceAreasByUseCase.filter((entry) => entry.useCase === useCase)
      .flatMap((entry) => entry.performanceAreas.flatMap((id) => ranks.has(id) ? [ranks.get(id)!] : []));
    return values.length ? (order === 'asc' ? Math.min(...values) : Math.max(...values)) : undefined;
  };
  const a = rank(left);
  const b = rank(right);
  // Keep unassigned KPIs at the end in either direction; ties retain their existing order.
  if (a === undefined) return b === undefined ? 0 : 1;
  if (b === undefined) return -1;
  return order === 'asc' ? a - b : b - a;
};
