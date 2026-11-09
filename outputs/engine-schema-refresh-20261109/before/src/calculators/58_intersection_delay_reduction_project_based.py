# KPI 58: Intersection Delay Reduction (Project-Based)
# ID: kpi-a7f936ba-d593-4c03-b4b4-62d08d7f7b57
# Group: Scenario
# Unit: annual vehicle hours
# Required sources:
#   projects: ScenarioUpstream.Projects.Delay Reduction Per Vehicle (DelayReductionPerVehicle_{Project})
#   base_year_tdm: PreprocessedConstants.BaseYearTDM.Base Year Total Daily Volume (BaseYearTotalDailyVolume_{Link})
#   Constant Base Year: BaseYear
#   Constant VMT Growth Rate: VMTGR
#   projects: ScenarioUpstream.Projects.Link IDs (\{LinkIDs\}_{Project})
#   Output geography: ScenarioUpstream.Projects; use table-schema joins for aggregation
#   Output geography: PreprocessedConstants.Corridors; use table-schema joins for aggregation
#   Output geography: PreprocessedConstants.SubRegions; use table-schema joins for aggregation
# Expected output files:
#   data/kpis/<scenario>/Projects/58_intersection_delay_reduction_project_based.parquet
#   data/kpis/<scenario>/Corridors/58_intersection_delay_reduction_project_based.parquet
#   data/kpis/<scenario>/SubRegions/58_intersection_delay_reduction_project_based.parquet
#   data/kpis/<scenario>/Region/58_intersection_delay_reduction_project_based.parquet

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

KPI_NAME = '58_intersection_delay_reduction_project_based'
KPI_ID = 'kpi-a7f936ba-d593-4c03-b4b4-62d08d7f7b57'
SCENARIO_TYPE = 'Scenario'

# Local variables and non-global dimension options:
# YEAR_OPTIONS = []  # TODO: Define years, e.g. from project OpenYear/EndYear


def validate(context: RunContext) -> dict[str, object]:
    # projects = validate_table(context, 'ScenarioUpstream', 'Projects')
    # base_year_tdm = validate_table(context, 'PreprocessedConstants', 'BaseYearTDM')
    # base_year = get_constant('Base Year')
    # vmt_growth_rate = get_constant('VMT Growth Rate')
    # year_options = YEAR_OPTIONS
    # corridors = validate_table(context, 'PreprocessedConstants', 'Corridors')
    # sub_regions = validate_table(context, 'PreprocessedConstants', 'SubRegions')
    # return {
    #     'projects': projects,
    #     'base_year_tdm': base_year_tdm,
    #     'base_year': base_year,
    #     'vmt_growth_rate': vmt_growth_rate,
    #     'year_options': year_options,
    #     'corridors': corridors,
    #     'sub_regions': sub_regions,
    # }
    raise NotImplementedError(f'{KPI_NAME}: implement validate')


def process(
    projects: pd.DataFrame,
    base_year_tdm: pd.DataFrame,
    base_year: object,
    vmt_growth_rate: object,
    year_options: list[object],
    corridors: pd.DataFrame,
    sub_regions: pd.DataFrame,
) -> dict[str, pd.DataFrame]:
    # Formula reference (processing is intentionally left blank):
    # BYDailyReductionVehHours_{Link|Link\in\{LinkIDs\}_{Project}} = DelayReductionPerVehicle_{Project} \times BaseYearTotalDailyVolume_{Link|Link\in\{LinkIDs\}_{Project}}
    # AnnualReductionVehHours_{Link|Link\in\{LinkIDs\}_{Project}} = 365\times BYDailyReductionVehHours_{Link|Link\in\{LinkIDs\}_{Project}} \times (1 + VMTGR)^{Year - BaseYear}
    # AnnualReductionVehHours_{Project} = \sum_{Link\in\{LinkIDs\}_{Project}}AnnualReductionVehHours_{Link|Link\in\{LinkIDs\}_{Project}}
    # TODO: Implement processing from the inputs above.
    # Suggested output structure: one geography row, one column per option combination.
    # output_columns = ['intersection_delay_reduction_project_based']
    # project: basic unit;
    # project_index = projects.index.rename('project_id')
    # project_output = pd.DataFrame(index=project_index, columns=output_columns)
    # corridor: aggregation;
    # \sum_{Project \in Corridor}AnnualReductionVehHours_{Project}
    # corridor_index = corridors.index.rename('corridor_id')
    # corridor_output = pd.DataFrame(index=corridor_index, columns=output_columns)
    # subRegion: aggregation;
    # \sum_{Project \in SubRegion}AnnualReductionVehHours_{Project}
    # sub_region_index = sub_regions.index.rename('subregion_id')
    # sub_region_output = pd.DataFrame(index=sub_region_index, columns=output_columns)
    # region: aggregation;
    # \sum_{Project \in Region}AnnualReductionVehHours_{Project}
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
