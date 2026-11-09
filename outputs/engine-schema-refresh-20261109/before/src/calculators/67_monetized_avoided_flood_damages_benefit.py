# KPI 67: Monetized Avoided Flood Damages Benefit
# ID: kpi-cf91b40a-686d-44bf-8df7-d5eae60a6ba1
# Group: Scenario
# Unit:
# Required sources:
#   kpi_66_project: 66_annual_avoided_flood_damages.parquet at project, current scenario (CostAvoided_{Project})
#   Constant Base Year: BaseYear
#   Constant Discount Rate: DiscountRate
#   projects: ScenarioUpstream.Projects.End Year (EndYear_{Project})
#   projects: ScenarioUpstream.Projects.Open Year (OpenYear_{Project})
#   Output geography: ScenarioUpstream.Projects; use table-schema joins for aggregation
#   Output geography: PreprocessedConstants.Corridors; use table-schema joins for aggregation
#   Output geography: PreprocessedConstants.SubRegions; use table-schema joins for aggregation
# Expected output files:
#   data/kpis/<scenario>/Projects/67_monetized_avoided_flood_damages_benefit.parquet
#   data/kpis/<scenario>/Corridors/67_monetized_avoided_flood_damages_benefit.parquet
#   data/kpis/<scenario>/SubRegions/67_monetized_avoided_flood_damages_benefit.parquet
#   data/kpis/<scenario>/Region/67_monetized_avoided_flood_damages_benefit.parquet

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

KPI_NAME = '67_monetized_avoided_flood_damages_benefit'
KPI_ID = 'kpi-cf91b40a-686d-44bf-8df7-d5eae60a6ba1'
SCENARIO_TYPE = 'Scenario'

# Local variables and non-global dimension options:
# YEAR_OPTIONS = []  # TODO: Define years, e.g. from project OpenYear/EndYear


def validate(context: RunContext) -> dict[str, object]:
    # kpi_66_project = loader.load(context, '66_annual_avoided_flood_damages', path='kpis', scale='project')
    # base_year = get_constant('Base Year')
    # discount_rate = get_constant('Discount Rate')
    # projects = validate_table(context, 'ScenarioUpstream', 'Projects')
    # year_options = YEAR_OPTIONS
    # corridors = validate_table(context, 'PreprocessedConstants', 'Corridors')
    # sub_regions = validate_table(context, 'PreprocessedConstants', 'SubRegions')
    # return {
    #     'kpi_66_project': kpi_66_project,
    #     'base_year': base_year,
    #     'discount_rate': discount_rate,
    #     'projects': projects,
    #     'year_options': year_options,
    #     'corridors': corridors,
    #     'sub_regions': sub_regions,
    # }
    raise NotImplementedError(f'{KPI_NAME}: implement validate')


def process(
    kpi_66_project: pd.DataFrame,
    base_year: object,
    discount_rate: object,
    projects: pd.DataFrame,
    year_options: list[object],
    corridors: pd.DataFrame,
    sub_regions: pd.DataFrame,
) -> dict[str, pd.DataFrame]:
    # Formula reference (processing is intentionally left blank):
    # Benefit_{Project} = \sum_{Year=OpenYear_{Project}}^{EndYear_{Project}}\frac{CostAvoided_{Project}}{(1+DiscountRate)^{Year-BaseYear}}
    # TODO: Implement processing from the inputs above.
    # Suggested output structure: one geography row, one column per option combination.
    # output_columns = ['monetized_avoided_flood_damages_benefit']
    # project: basic unit;
    # project_index = projects.index.rename('project_id')
    # project_output = pd.DataFrame(index=project_index, columns=output_columns)
    # corridor: aggregation;
    # \sum_{Project \in Corridor}Benefit_{Project}
    # corridor_index = corridors.index.rename('corridor_id')
    # corridor_output = pd.DataFrame(index=corridor_index, columns=output_columns)
    # subRegion: aggregation;
    # \sum_{Project \in SubRegion}Benefit_{Project}
    # sub_region_index = sub_regions.index.rename('subregion_id')
    # sub_region_output = pd.DataFrame(index=sub_region_index, columns=output_columns)
    # region: aggregation;
    # \sum_{Project \in Region}Benefit_{Project}
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
