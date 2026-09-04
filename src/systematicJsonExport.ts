import {
  spatialScaleKeys,
  spatialScaleLabels,
  type KpiMetric,
  type KpiPoolConfig
} from './types';

const unique = (values: string[]) => [...new Set(values)];

export const buildSystematicJsonExport = (config: KpiPoolConfig, kpis: readonly KpiMetric[]) => {
  const dataSourceGroupBySourceId = new Map(config.dataSourceGroups.flatMap((group) =>
    group.itemIds.map((sourceId) => [sourceId, group] as const)
  ));
  return {
    'Domain Definitions': {
      'Global Domains': config.valueEnums,
      'Spatial Scales': spatialScaleKeys.map((id) => ({ id, label: spatialScaleLabels[id] })),
      'Performance Areas': config.enums.performanceArea,
      'User Group': config.enums.userGroup,
      'Use Case': config.enums.useCase
    },
    'Data Sources': config.dataSources,
    'Data Source Groups': config.dataSourceGroups,
    KPIs: kpis.map((kpi) => ({
      Name: kpi.name,
      Note: kpi.note,
      Source: kpi.sources.map((source) => {
        if (source.type !== 'dataField') return source;
        const group = dataSourceGroupBySourceId.get(source.dataSourceId);
        return group ? { ...source, dataSourceGroupId: group.id, dataSourceGroupName: group.name } : source;
      }),
      Formula: {
        Comment: kpi.description.formulaComment,
        Groups: kpi.description.formulas
      },
      'Spatial Scales': kpi.spatialScales,
      'Performance Areas': unique([
        ...kpi.performanceArea,
        ...kpi.performanceAreasByUseCase.flatMap((assignment) => assignment.performanceAreas)
      ]),
      'User Group': unique(kpi.userGroupUseCases.map((assignment) => assignment.userGroup)),
      'Use Case': unique(kpi.userGroupUseCases.flatMap((assignment) => assignment.useCases))
    }))
  };
};
