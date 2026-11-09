# KPI 71: Residual Value
# ID: kpi-13a14cff-0158-487f-8819-bedaa35305dd
# Group: Scenario
# Unit:
# Required sources:
#   projects: ScenarioUpstream.Projects.Open Year (OpenYear_{Project})
#   projects: ScenarioUpstream.Projects.End Year (EndYear_{Project})
#   projects: ScenarioUpstream.Projects.Useful Life (UsefulLife_{Project})
#   kpi_101_project: 101_total_discounted_cost.parquet at project, current scenario (Cost_{Project})
#   Constant Discount Rate: DiscountRate
#   Constant Base Year: BaseYear
#   Output geography: ScenarioUpstream.Projects; use table-schema joins for aggregation
#   Output geography: PreprocessedConstants.Corridors; use table-schema joins for aggregation
#   Output geography: PreprocessedConstants.SubRegions; use table-schema joins for aggregation
# Expected output files:
#   data/kpis/<scenario>/Projects/71_residual_value.parquet
#   data/kpis/<scenario>/Corridors/71_residual_value.parquet
#   data/kpis/<scenario>/SubRegions/71_residual_value.parquet
#   data/kpis/<scenario>/Region/71_residual_value.parquet

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

KPI_NAME = '71_residual_value'
KPI_ID = 'kpi-13a14cff-0158-487f-8819-bedaa35305dd'
SCENARIO_TYPE = 'Scenario'


def validate(context: RunContext) -> dict[str, object]:
    # projects = validate_table(context, 'ScenarioUpstream', 'Projects')
    # kpi_101_project = loader.load(context, '101_total_discounted_cost', path='kpis', scale='project')
    # discount_rate = get_constant('Discount Rate')
    # base_year = get_constant('Base Year')
    # corridors = validate_table(context, 'PreprocessedConstants', 'Corridors')
    # sub_regions = validate_table(context, 'PreprocessedConstants', 'SubRegions')
    # return {
    #     'projects': projects,
    #     'kpi_101_project': kpi_101_project,
    #     'discount_rate': discount_rate,
    #     'base_year': base_year,
    #     'corridors': corridors,
    #     'sub_regions': sub_regions,
    # }
    raise NotImplementedError(f'{KPI_NAME}: implement validate')


def process(
    projects: pd.DataFrame,
    kpi_101_project: pd.DataFrame,
    discount_rate: object,
    base_year: object,
    corridors: pd.DataFrame,
    sub_regions: pd.DataFrame,
) -> dict[str, pd.DataFrame]:
    # Formula reference (processing is intentionally left blank):
    # OperationalPeriod_{Project} = EndYear_{Project}-OpenYear_{Project}+1
    # UnusedLife_{Project} = \max(UsefulLife_{Project} - OperationalPeriod_{Project}, 0)
    # ResidualValue_{Project} = \frac{Cost_{Project}\times \frac{UnusedLife_{Project}}{UsefulLife_{Project}}}{(1+DiscountRate)^{EndYear_{Project}-BaseYear}}
    # TODO: Implement processing from the inputs above.
    # Suggested output structure: one geography row, one column per option combination.
    # output_columns = ['residual_value']
    # project: basic unit;
    # project_index = projects.index.rename('project_id')
    # project_output = pd.DataFrame(index=project_index, columns=output_columns)
    # corridor: aggregation; Average by cost
    # corridor_index = corridors.index.rename('corridor_id')
    # corridor_output = pd.DataFrame(index=corridor_index, columns=output_columns)
    # subRegion: aggregation; Average by cost
    # sub_region_index = sub_regions.index.rename('subregion_id')
    # sub_region_output = pd.DataFrame(index=sub_region_index, columns=output_columns)
    # region: aggregation; Average by cost
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
