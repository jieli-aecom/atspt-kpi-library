# KPI 92: Cost per Ton of Emission Reduced
# ID: kpi-ef988767-63b8-451a-af9f-b313be60ab8f
# Group: Scenario
# Unit:
# Required sources:
#   projects: ScenarioUpstream.Projects.Discounted Investment Cost (DiscountedInvestmentCost_{Project})
#   kpi_14_project: 14_emission_reduction_project_based.parquet at project, current scenario (\Delta EmissionTons_{Year,EmissionType,Project})
#   Output geography: ScenarioUpstream.Projects; use table-schema joins for aggregation
#   Output geography: PreprocessedConstants.Corridors; use table-schema joins for aggregation
#   Output geography: PreprocessedConstants.SubRegions; use table-schema joins for aggregation
# Expected output files:
#   data/kpis/<scenario>/Projects/92_cost_per_ton_of_emission_reduced.parquet
#   data/kpis/<scenario>/Corridors/92_cost_per_ton_of_emission_reduced.parquet
#   data/kpis/<scenario>/SubRegions/92_cost_per_ton_of_emission_reduced.parquet
#   data/kpis/<scenario>/Region/92_cost_per_ton_of_emission_reduced.parquet

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

KPI_NAME = '92_cost_per_ton_of_emission_reduced'
KPI_ID = 'kpi-ef988767-63b8-451a-af9f-b313be60ab8f'
SCENARIO_TYPE = 'Scenario'

# Local variables and non-global dimension options:
# YEAR_OPTIONS = []  # TODO: Define years, e.g. from project OpenYear/EndYear


def validate(context: RunContext) -> dict[str, object]:
    # projects = validate_table(context, 'ScenarioUpstream', 'Projects')
    # kpi_14_project = loader.load(context, '14_emission_reduction_project_based', path='kpis', scale='project')
    # emission_type = get_domain('Emission Type')
    # year_options = YEAR_OPTIONS
    # corridors = validate_table(context, 'PreprocessedConstants', 'Corridors')
    # sub_regions = validate_table(context, 'PreprocessedConstants', 'SubRegions')
    # return {
    #     'projects': projects,
    #     'kpi_14_project': kpi_14_project,
    #     'emission_type': emission_type,
    #     'year_options': year_options,
    #     'corridors': corridors,
    #     'sub_regions': sub_regions,
    # }
    raise NotImplementedError(f'{KPI_NAME}: implement validate')


def process(
    projects: pd.DataFrame,
    kpi_14_project: pd.DataFrame,
    emission_type: list[str],
    year_options: list[object],
    corridors: pd.DataFrame,
    sub_regions: pd.DataFrame,
) -> dict[str, pd.DataFrame]:
    # Formula reference (processing is intentionally left blank):
    # \Delta EmissionTonsPerDollar_{Project} = \frac{DiscountedInvestmentCost_{Project}}{\Delta EmissionTons_{Year,EmissionType,Project}}
    # TODO: Implement processing from the inputs above.
    # Suggested output structure: one geography row, one column per option combination.
    # output_columns = ['cost_per_ton_of_emission_reduced']
    # project: basic unit;
    # project_index = projects.index.rename('project_id')
    # project_output = pd.DataFrame(index=project_index, columns=output_columns)
    # corridor: aggregation;
    # \frac{\sum_{Project \in Corridor}(\Delta EmissionTonsPerDollar_{Project}\times DiscountedInvestmentCost_{Project})}{\sum_{Project \in Corridor}\Delta EmissionTons_{Year,EmissionType,Project}}
    # corridor_index = corridors.index.rename('corridor_id')
    # corridor_output = pd.DataFrame(index=corridor_index, columns=output_columns)
    # subRegion: aggregation;
    # \frac{\sum_{Project \in SubRegion}(\Delta EmissionTonsPerDollar_{Project}\times DiscountedInvestmentCost_{Project})}{\sum_{Project \in SubRegion}\Delta EmissionTons_{Year,EmissionType,Project}}
    # sub_region_index = sub_regions.index.rename('subregion_id')
    # sub_region_output = pd.DataFrame(index=sub_region_index, columns=output_columns)
    # region: aggregation;
    # \frac{\sum_{Project \in Region}(\Delta EmissionTonsPerDollar_{Project}\times DiscountedInvestmentCost_{Project})}{\sum_{Project \in Region}\Delta EmissionTons_{Year,EmissionType,Project}}
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
