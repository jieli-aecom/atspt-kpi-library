# KPI 69: Net Present Value
# ID: kpi-f3da9502-b9f3-49bd-9375-370e3af57ca8
# Group: Scenario
# Unit: base year dollars
# Required sources:
#   kpi_101_project: 101_total_discounted_cost.parquet at project, current scenario (TotalCost_{Project})
#   kpi_68_project: 68_total_discounted_benefit.parquet at project, current scenario (Benefit_{Project})
#   Output geography: ScenarioUpstream.Projects; use table-schema joins for aggregation
#   Output geography: PreprocessedConstants.Corridors; use table-schema joins for aggregation
#   Output geography: PreprocessedConstants.SubRegions; use table-schema joins for aggregation
# Expected output files:
#   data/kpis/<scenario>/Projects/69_net_present_value.parquet
#   data/kpis/<scenario>/Corridors/69_net_present_value.parquet
#   data/kpis/<scenario>/SubRegions/69_net_present_value.parquet
#   data/kpis/<scenario>/Region/69_net_present_value.parquet

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

KPI_NAME = '69_net_present_value'
KPI_ID = 'kpi-f3da9502-b9f3-49bd-9375-370e3af57ca8'
SCENARIO_TYPE = 'Scenario'


def validate(context: RunContext) -> dict[str, object]:
    # kpi_101_project = loader.load(context, '101_total_discounted_cost', path='kpis', scale='project')
    # kpi_68_project = loader.load(context, '68_total_discounted_benefit', path='kpis', scale='project')
    # projects = validate_table(context, 'ScenarioUpstream', 'Projects')
    # corridors = validate_table(context, 'PreprocessedConstants', 'Corridors')
    # sub_regions = validate_table(context, 'PreprocessedConstants', 'SubRegions')
    # return {
    #     'kpi_101_project': kpi_101_project,
    #     'kpi_68_project': kpi_68_project,
    #     'projects': projects,
    #     'corridors': corridors,
    #     'sub_regions': sub_regions,
    # }
    raise NotImplementedError(f'{KPI_NAME}: implement validate')


def process(
    kpi_101_project: pd.DataFrame,
    kpi_68_project: pd.DataFrame,
    projects: pd.DataFrame,
    corridors: pd.DataFrame,
    sub_regions: pd.DataFrame,
) -> dict[str, pd.DataFrame]:
    # Formula reference (processing is intentionally left blank):
    # NPV_{Project} = TotalCost_{Project}-Benefit_{Project}
    # TODO: Implement processing from the inputs above.
    # Suggested output structure: one geography row, one column per option combination.
    # output_columns = ['net_present_value']
    # project: basic unit;
    # project_index = projects.index.rename('project_id')
    # project_output = pd.DataFrame(index=project_index, columns=output_columns)
    # corridor: aggregation; Sum
    # \sum_{Project \in Corridor}NPV_{Project}
    # corridor_index = corridors.index.rename('corridor_id')
    # corridor_output = pd.DataFrame(index=corridor_index, columns=output_columns)
    # subRegion: aggregation; Sum
    # \sum_{Project \in SubRegion}NPV_{Project}
    # sub_region_index = sub_regions.index.rename('subregion_id')
    # sub_region_output = pd.DataFrame(index=sub_region_index, columns=output_columns)
    # region: aggregation; Sum
    # \sum_{Project \in Region}NPV_{Project}
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
