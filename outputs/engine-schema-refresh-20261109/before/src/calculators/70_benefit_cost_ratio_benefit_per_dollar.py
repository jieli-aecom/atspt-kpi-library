# KPI 70: Benefit-Cost Ratio (Benefit per Dollar)
# ID: kpi-6490a095-d6d3-4dcc-a8b1-864171251800
# Group: Scenario
# Unit: %
# Required sources:
#   kpi_68_project: 68_total_discounted_benefit.parquet at project, current scenario (Benefit_{Project})
#   kpi_101_project: 101_total_discounted_cost.parquet at project, current scenario (Cost_{Project})
#   Output geography: ScenarioUpstream.Projects; use table-schema joins for aggregation
#   Output geography: PreprocessedConstants.Corridors; use table-schema joins for aggregation
#   Output geography: PreprocessedConstants.SubRegions; use table-schema joins for aggregation
# Expected output files:
#   data/kpis/<scenario>/Projects/70_benefit_cost_ratio_benefit_per_dollar.parquet
#   data/kpis/<scenario>/Corridors/70_benefit_cost_ratio_benefit_per_dollar.parquet
#   data/kpis/<scenario>/SubRegions/70_benefit_cost_ratio_benefit_per_dollar.parquet
#   data/kpis/<scenario>/Region/70_benefit_cost_ratio_benefit_per_dollar.parquet

from __future__ import annotations

import pandas as pd

from ..pipeline.context import RunContext

# Suggested imports for the bodies below:
# from itertools import product
# from ..data_interface import loader, writer
# from ..utilities.constants import get_constant
# from ..utilities.domains import get_domain
# from ..utilities.lookups import get_lookup
# from ..utilities.naming import snake_case
# from ..data_interface.validation import validate_table

KPI_NAME = '70_benefit_cost_ratio_benefit_per_dollar'
KPI_ID = 'kpi-6490a095-d6d3-4dcc-a8b1-864171251800'
SCENARIO_TYPE = 'Scenario'


def validate(context: RunContext) -> dict[str, object]:
    # kpi_68_project = loader.load(context, '68_total_discounted_benefit', path='kpis', scale='project')
    # kpi_101_project = loader.load(context, '101_total_discounted_cost', path='kpis', scale='project')
    # projects = validate_table(context, 'ScenarioUpstream', 'Projects')
    # corridors = validate_table(context, 'PreprocessedConstants', 'Corridors')
    # sub_regions = validate_table(context, 'PreprocessedConstants', 'SubRegions')
    # return {
    #     'kpi_68_project': kpi_68_project,
    #     'kpi_101_project': kpi_101_project,
    #     'projects': projects,
    #     'corridors': corridors,
    #     'sub_regions': sub_regions,
    # }
    raise NotImplementedError(f'{KPI_NAME}: implement validate')


def process(
    kpi_68_project: pd.DataFrame,
    kpi_101_project: pd.DataFrame,
    projects: pd.DataFrame,
    corridors: pd.DataFrame,
    sub_regions: pd.DataFrame,
) -> dict[str, pd.DataFrame]:
    # Formula reference (processing is intentionally left blank):
    # BCR_{Zone} = \frac{\sum_{Project\in Zone}Benefit_{Project}}{\sum_{Project\in Zone}Cost_{Project}}
    # TODO: Implement processing from the inputs above.
    # Suggested output structure: one geography row, one column per option combination.
    # output_columns = ['benefit_cost_ratio_benefit_per_dollar']
    # project: basic unit;
    # project_index = projects.index.rename('project_id')
    # project_output = pd.DataFrame(index=project_index, columns=output_columns)
    # corridor: basic unit; Average by cost
    # corridor_index = corridors.index.rename('corridor_id')
    # corridor_output = pd.DataFrame(index=corridor_index, columns=output_columns)
    # subRegion: basic unit; Average by cost
    # sub_region_index = sub_regions.index.rename('subregion_id')
    # sub_region_output = pd.DataFrame(index=sub_region_index, columns=output_columns)
    # region: basic unit; Average by cost
    # region_index = pd.Index(['Region'], name='region_id')
    # region_output = pd.DataFrame(index=region_index, columns=output_columns)
    # return {
    #     'project': project_output,
    #     'corridor': corridor_output,
    #     'subRegion': sub_region_output,
    #     'region': region_output,
    # }
    raise NotImplementedError(f'{KPI_NAME}: implement process')


def calculate(context: RunContext) -> None:
    # outputs = process(**validate(context))
    # for scale, output in outputs.items():
    #     writer.write_table(context, KPI_NAME, output, path='kpis', scale=scale)
    raise NotImplementedError(f'{KPI_NAME}: implement calculate')
