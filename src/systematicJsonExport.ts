import {
  spatialScaleKeys,
  spatialScaleLabels,
  type KpiMetric,
  type KpiPoolConfig
} from './types';

const unique = (values: string[]) => [...new Set(values)];

export const buildSystematicJsonExport = (config: KpiPoolConfig, kpis: readonly KpiMetric[]) => ({
  'Enum Definitions': {
    'Spatial Scales': spatialScaleKeys.map((id) => ({ id, label: spatialScaleLabels[id] })),
    'Performance Areas': config.enums.performanceArea,
    'User Group': config.enums.userGroup,
    'Use Case': config.enums.useCase
  },
  'Data Sources': config.dataSources,
  KPIs: kpis.map((kpi) => ({
    Name: kpi.name,
    Source: kpi.sources,
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
});
