# KPI 101: Total Discounted Cost
# ID: kpi-db1da3cc-8b16-4bf3-a8aa-1acada7786b4
# Group: Scenario
# Unit:
# Required sources:
#   projects: ScenarioUpstream.Projects.Discounted Investment Cost (DiscountedInvestmentCost_{Project})
#   Output geography: ScenarioUpstream.Projects; use table-schema joins for aggregation
#   Output geography: PreprocessedConstants.Corridors; use table-schema joins for aggregation
#   Output geography: PreprocessedConstants.SubRegions; use table-schema joins for aggregation
# Expected output files:
#   data/kpis/<scenario>/Projects/101_total_discounted_cost.parquet
#   data/kpis/<scenario>/Corridors/101_total_discounted_cost.parquet
#   data/kpis/<scenario>/SubRegions/101_total_discounted_cost.parquet
#   data/kpis/<scenario>/Region/101_total_discounted_cost.parquet

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

KPI_NAME = '101_total_discounted_cost'
KPI_ID = 'kpi-db1da3cc-8b16-4bf3-a8aa-1acada7786b4'
SCENARIO_TYPE = 'Scenario'


def validate(context: RunContext) -> dict[str, object]:
    # projects = validate_table(context, 'ScenarioUpstream', 'Projects')
    # corridors = validate_table(context, 'PreprocessedConstants', 'Corridors')
    # sub_regions = validate_table(context, 'PreprocessedConstants', 'SubRegions')
    # return {
    #     'projects': projects,
    #     'corridors': corridors,
    #     'sub_regions': sub_regions,
    # }
    raise NotImplementedError(f'{KPI_NAME}: implement validate')


def process(
    projects: pd.DataFrame,
    corridors: pd.DataFrame,
    sub_regions: pd.DataFrame,
) -> dict[str, pd.DataFrame]:
    # Formula reference (processing is intentionally left blank):
    # Direct from source; ensure to discount it to 2022 dollars
    # Cost_{Project} = DiscountedInvestmentCost_{Project}
    # TODO: Implement processing from the inputs above.
    # Suggested output structure: one geography row, one column per option combination.
    # output_columns = ['total_discounted_cost']
    # project: basic unit;
    # project_index = projects.index.rename('project_id')
    # project_output = pd.DataFrame(index=project_index, columns=output_columns)
    # corridor: aggregation; Sum
    # \sum_{Project \in Corridor}Cost_{Project}
    # corridor_index = corridors.index.rename('corridor_id')
    # corridor_output = pd.DataFrame(index=corridor_index, columns=output_columns)
    # subRegion: aggregation; Sum
    # \sum_{Project \in SubRegion}Cost_{Project}
    # sub_region_index = sub_regions.index.rename('subregion_id')
    # sub_region_output = pd.DataFrame(index=sub_region_index, columns=output_columns)
    # region: aggregation; Sum
    # \sum_{Project \in Region}Cost_{Project}
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
