# KPI 56: Peak Period Delay Reduction Vehicle Hours (Project-Based)
# ID: kpi-daa44dfd-9143-4c78-b07e-b8595987a858
# Group: Scenario
# Unit: annual vehicle hours
# Required sources:
#   projects: ScenarioUpstream.Projects.Delay Reduction Projects (\{Improvements\}_{Project})
#   Lookup DelayReductionFactorLookup (DelayReductionFactorLookup())
#   base_year_tdm: PreprocessedConstants.BaseYearTDM.Base Year Volume (BaseYearVolume_{Period,Link})
#     Field dimension Period: ['AM', 'PM', 'MD', 'OV']
#   base_highway_links: PreprocessedConstants.BaseHighwayLinks.Base Year Distance Miles (BaseYearDistanceMiles_{Link})
#   scenario_links: ScenarioUpstream.ScenarioLinks.Free Flow Speed MPH (FreeFlowSpeedMPH_{Link})
#   base_year_tdm: PreprocessedConstants.BaseYearTDM.Base Year Travel Time Minutes (BaseYearTravelTimeMinutes_{Period,Link})
#     Field dimension Period: ['AM', 'PM', 'MD', 'OV']
#   Constant Base Year: BaseYear
#   Constant VMT Growth Rate: VMTGR
#   projects: ScenarioUpstream.Projects.Link IDs (\{LinkIDs\}_{Project})
#   Output geography: ScenarioUpstream.Projects; use table-schema joins for aggregation
#   Output geography: PreprocessedConstants.Corridors; use table-schema joins for aggregation
#   Output geography: PreprocessedConstants.SubRegions; use table-schema joins for aggregation
# Expected output files:
#   data/kpis/<scenario>/Projects/56_peak_period_delay_reduction_vehicle_hours_project_based.parquet
#   data/kpis/<scenario>/Corridors/56_peak_period_delay_reduction_vehicle_hours_project_based.parquet
#   data/kpis/<scenario>/SubRegions/56_peak_period_delay_reduction_vehicle_hours_project_based.parquet
#   data/kpis/<scenario>/Region/56_peak_period_delay_reduction_vehicle_hours_project_based.parquet

from __future__ import annotations

from collections.abc import Callable

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

KPI_NAME = '56_peak_period_delay_reduction_vehicle_hours_project_based'
KPI_ID = 'kpi-daa44dfd-9143-4c78-b07e-b8595987a858'
SCENARIO_TYPE = 'Scenario'

# Local variables and non-global dimension options:
# YEAR_OPTIONS = []  # TODO: Define options for Year


def validate(context: RunContext) -> dict[str, object]:
    # projects = validate_table(context, 'ScenarioUpstream', 'Projects')
    # delay_reduction_factor_lookup = get_lookup('DelayReductionFactorLookup')
    # base_year_tdm = validate_table(context, 'PreprocessedConstants', 'BaseYearTDM')
    # base_highway_links = validate_table(context, 'PreprocessedConstants', 'BaseHighwayLinks')
    # scenario_links = validate_table(context, 'ScenarioUpstream', 'ScenarioLinks')
    # base_year = get_constant('Base Year')
    # vmt_growth_rate = get_constant('VMT Growth Rate')
    # delay_reduction_project_type = get_domain('Delay Reduction Project Type')
    # period = get_domain('Period')
    # year_options = YEAR_OPTIONS
    # corridors = validate_table(context, 'PreprocessedConstants', 'Corridors')
    # sub_regions = validate_table(context, 'PreprocessedConstants', 'SubRegions')
    # return {
    #     'projects': projects,
    #     'delay_reduction_factor_lookup': delay_reduction_factor_lookup,
    #     'base_year_tdm': base_year_tdm,
    #     'base_highway_links': base_highway_links,
    #     'scenario_links': scenario_links,
    #     'base_year': base_year,
    #     'vmt_growth_rate': vmt_growth_rate,
    #     'delay_reduction_project_type': delay_reduction_project_type,
    #     'period': period,
    #     'year_options': year_options,
    #     'corridors': corridors,
    #     'sub_regions': sub_regions,
    # }
    raise NotImplementedError(f'{KPI_NAME}: implement validate')


def process(
    projects: pd.DataFrame,
    delay_reduction_factor_lookup: Callable[..., object],
    base_year_tdm: pd.DataFrame,
    base_highway_links: pd.DataFrame,
    scenario_links: pd.DataFrame,
    base_year: object,
    vmt_growth_rate: object,
    delay_reduction_project_type: list[str],
    period: list[str],
    year_options: list[object],
    corridors: pd.DataFrame,
    sub_regions: pd.DataFrame,
) -> dict[str, pd.DataFrame]:
    # Formula reference (processing is intentionally left blank):
    # DelayRectionFactor_{Project} = 1-\prod_{i\in \{Improvements\}_{Project}}(1-DelayReductionFactorLookup(i ))
    # FreeFlowHours_{Link|idOf(Link)\in\{LinkIDs\}_{Project}} = \frac{BaseYearDistanceMiles_{Link}|_{idOf(Link)\in\{LinkIDs\}_{Project}}}{FreeFlowSpeedMPH_{Link}|_{idOf(Link)\in\{LinkIDs\}_{Project}}}
    # BYDelayHours_{Period,Link|idOf(Link)\in\{LinkIDs\}_{Project}} = \frac{BaseYearTravelTimeMinutes_{Period,Link}}{60} - FreeFlowHours_{Link|idOf(Link)\in\{LinkIDs\}_{Project}}
    # BYDelayVehHours_{Period,Link|idOf(Link)\in\{LinkIDs\}_{Project}} = BYDelayHours_{Period,Link|idOf(Link)\in\{LinkIDs\}_{Project}}\times BaseYearVolume_{Period,Link|Link\in\{LinkIDs\}_{Project}}
    # NBDelayVehHours_{Year,Link|idOf(Link)\in\{LinkIDs\}_{Project}} = 365\times \sum_{Period\in\{AM, PM\}} (BYDelayVehHours_{Period,Link|idOf(Link)\in\{LinkIDs\}_{Project}})\times (1 + VMTGR)^{Year - BaseYear}
    # \Delta DelayVehHours_{Year,Link|idOf(Link)\in\{LinkIDs\}_{Project}} = NBDelayVehHours_{Year,Link|idOf(Link)\in\{LinkIDs\}_{Project}}\times DelayRectionFactor_{Project}
    # \Delta DelayVehHours_{Year,Project} = \sum_{idOf(Link)\in\{LinkIDs\}_{Project}}\Delta DelayVehHours_{Year,Link|idOf(Link)\in\{LinkIDs\}_{Project}}
    # TODO: Implement processing from the inputs above.
    # Suggested output structure: one geography row, one column per option combination.
    # output_columns = [
    #     'peak_period_delay_reduction_vehicle_hours_project_based' + '_' + '_'.join(snake_case(str(v)) for v in options)
    #     for options in product(year_options)
    # ]
    # project: basic unit;
    # project_index = projects.index.rename('project_id')
    # project_output = pd.DataFrame(index=project_index, columns=output_columns)
    # corridor: aggregation;
    # \sum_{Project \in Corridor}\Delta DelayVehHours_{Year,Project}
    # corridor_index = corridors.index.rename('corridor_id')
    # corridor_output = pd.DataFrame(index=corridor_index, columns=output_columns)
    # subRegion: aggregation; Sum
    # \sum_{Project \in SubRegion}\Delta DelayVehHours_{Year,Project}
    # sub_region_index = sub_regions.index.rename('subregion_id')
    # sub_region_output = pd.DataFrame(index=sub_region_index, columns=output_columns)
    # region: aggregation; Sum
    # \sum_{Project \in Region}\Delta DelayVehHours_{Year,Project}
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
