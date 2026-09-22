import { sameStructuredValue } from './kpiEquality.js';
import type { KpiPoolConfig } from './types.js';

type KpiCatalogChangeSummary = {
  affectsEveryRow: boolean;
  changedKpiIds: Set<string>;
};

const kpiCatalogChangeCache = new WeakMap<KpiPoolConfig, WeakMap<KpiPoolConfig, KpiCatalogChangeSummary>>();

const summarizeKpiCatalogChanges = (previous: KpiPoolConfig, next: KpiPoolConfig): KpiCatalogChangeSummary => {
  let summariesByNext = kpiCatalogChangeCache.get(previous);
  const cached = summariesByNext?.get(next);
  if (cached) return cached;

  const changedKpiIds = new Set<string>();
  let affectsEveryRow = previous.kpis.length !== next.kpis.length;
  if (!affectsEveryRow) {
    const previousById = new Map(previous.kpis.map((kpi) => [kpi.id, kpi]));
    for (let index = 0; index < next.kpis.length; index += 1) {
      const nextKpi = next.kpis[index];
      if (previous.kpis[index]?.id !== nextKpi.id) {
        affectsEveryRow = true;
        break;
      }

      const previousKpi = previousById.get(nextKpi.id);
      if (!previousKpi) {
        affectsEveryRow = true;
        break;
      }
      if (
        previousKpi.displayNumber !== nextKpi.displayNumber ||
        previousKpi.name !== nextKpi.name ||
        previousKpi.description.overview !== nextKpi.description.overview ||
        !sameStructuredValue(previousKpi.dimensions, nextKpi.dimensions)
      ) changedKpiIds.add(nextKpi.id);
    }
  }

  const summary = { affectsEveryRow, changedKpiIds };
  summariesByNext ??= new WeakMap<KpiPoolConfig, KpiCatalogChangeSummary>();
  summariesByNext.set(next, summary);
  kpiCatalogChangeCache.set(previous, summariesByNext);
  return summary;
};

export const kpiCatalogChangeAffectsRow = (previous: KpiPoolConfig, next: KpiPoolConfig, rowKpiId: string) => {
  if (
    previous.spatialScaleDefinitions !== next.spatialScaleDefinitions ||
    previous.logic !== next.logic ||
    previous.enums !== next.enums ||
    previous.noteLabels !== next.noteLabels ||
    previous.valueEnums !== next.valueEnums ||
    previous.valueEnumGroups !== next.valueEnumGroups ||
    previous.dataSources !== next.dataSources ||
    previous.lookups !== next.lookups ||
    previous.lookupGroups !== next.lookupGroups ||
    previous.variables !== next.variables ||
    previous.variableGroups !== next.variableGroups
  ) return true;
  if (previous.kpis === next.kpis) return false;

  const summary = summarizeKpiCatalogChanges(previous, next);
  return summary.affectsEveryRow || summary.changedKpiIds.size > (summary.changedKpiIds.has(rowKpiId) ? 1 : 0);
};
