# KPI 59: Monetized Travel Time Savings Benefit
# ID: kpi-d5aa57e9-0542-4695-86eb-20fa29fb062b
# Group: Scenario
# Unit: base year dollars
# Required sources:
#   kpi_56_project: 56_peak_period_delay_reduction_vehicle_hours_project_based.parquet at project, current scenario (\Delta DelayVehHours_{Project})
#   kpi_100_project: 100_new_roadway_detour_reduction_vehicle_hours.parquet at project, current scenario (\Delta DetourVehHours_{Project})
#   base_year_tdm: PreprocessedConstants.BaseYearTDM.Base Year Volume (BaseYearVolume_{Period,Link})
#     Field dimension Period: ['AM', 'PM', 'MD', 'OV']
#   base_year_tdm: PreprocessedConstants.BaseYearTDM.Base Year Truck Volume (BaseYearTruckVolume_{Period,Link})
#     Field dimension Period: ['AM', 'PM', 'MD', 'OV']
#   Constant All-Purpose VOT: All-PurposeVOT
#   Constant Truck VOT: TruckVOT
#   Constant All-Purpose Occupancy: All-PurposeOccupancy
#   Constant Discount Rate: DiscountRate
#   Constant Base Year: BaseYear
#   projects: ScenarioUpstream.Projects.End Year (EndYear_{Project})
#   projects: ScenarioUpstream.Projects.Open Year (OpenYear_{Project})
#   projects: ScenarioUpstream.Projects.Link IDs (\{LinkIDs\}_{Project})
#   Output geography: ScenarioUpstream.Projects; use table-schema joins for aggregation
#   Output geography: PreprocessedConstants.Corridors; use table-schema joins for aggregation
#   Output geography: PreprocessedConstants.SubRegions; use table-schema joins for aggregation
# Expected output files:
#   data/kpis/<scenario>/Projects/59_monetized_travel_time_savings_benefit.parquet
#   data/kpis/<scenario>/Corridors/59_monetized_travel_time_savings_benefit.parquet
#   data/kpis/<scenario>/SubRegions/59_monetized_travel_time_savings_benefit.parquet
#   data/kpis/<scenario>/Region/59_monetized_travel_time_savings_benefit.parquet

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

KPI_NAME = '59_monetized_travel_time_savings_benefit'
KPI_ID = 'kpi-d5aa57e9-0542-4695-86eb-20fa29fb062b'
SCENARIO_TYPE = 'Scenario'

# Local variables and non-global dimension options:
# YEAR_OPTIONS = []  # TODO: Define years, e.g. from project OpenYear/EndYear


def validate(context: RunContext) -> dict[str, object]:
    # kpi_56_project = loader.load(context, '56_peak_period_delay_reduction_vehicle_hours_project_based', path='kpis', scale='project')
    # kpi_100_project = loader.load(context, '100_new_roadway_detour_reduction_vehicle_hours', path='kpis', scale='project')
    # base_year_tdm = validate_table(context, 'PreprocessedConstants', 'BaseYearTDM')
    # all_purpose_vot = get_constant('All-Purpose VOT')
    # truck_vot = get_constant('Truck VOT')
    # all_purpose_occupancy = get_constant('All-Purpose Occupancy')
    # discount_rate = get_constant('Discount Rate')
    # base_year = get_constant('Base Year')
    # projects = validate_table(context, 'ScenarioUpstream', 'Projects')
    # period = get_domain('Period')
    # year_options = YEAR_OPTIONS
    # corridors = validate_table(context, 'PreprocessedConstants', 'Corridors')
    # sub_regions = validate_table(context, 'PreprocessedConstants', 'SubRegions')
    # return {
    #     'kpi_56_project': kpi_56_project,
    #     'kpi_100_project': kpi_100_project,
    #     'base_year_tdm': base_year_tdm,
    #     'all_purpose_vot': all_purpose_vot,
    #     'truck_vot': truck_vot,
    #     'all_purpose_occupancy': all_purpose_occupancy,
    #     'discount_rate': discount_rate,
    #     'base_year': base_year,
    #     'projects': projects,
    #     'period': period,
    #     'year_options': year_options,
    #     'corridors': corridors,
    #     'sub_regions': sub_regions,
    # }
    raise NotImplementedError(f'{KPI_NAME}: implement validate')


def process(
    kpi_56_project: pd.DataFrame,
    kpi_100_project: pd.DataFrame,
    base_year_tdm: pd.DataFrame,
    all_purpose_vot: object,
    truck_vot: object,
    all_purpose_occupancy: object,
    discount_rate: object,
    base_year: object,
    projects: pd.DataFrame,
    period: list[str],
    year_options: list[object],
    corridors: pd.DataFrame,
    sub_regions: pd.DataFrame,
) -> dict[str, pd.DataFrame]:
    # Formula reference (processing is intentionally left blank):
    # PeakTruckShare_{Project} = \frac{\sum_{idOf(Link)\in \{LinkIDs\}_{Project}}\sum_{Period\in\{AM, PM\}}BaseYearTruckVolume_{Period,Link}}{\sum_{idOf(Link)\in \{LinkIDs\}_{Project}}\sum_{Period\in\{AM, PM\}}BaseYearVolume_{Period,Link}}
    # TruckShare_{Project} = \frac{\sum_{idOf(Link)\in \{LinkIDs\}_{Project}}\sum_{Period}BaseYearTruckVolume_{Period,Link}}{\sum_{idOf(Link)\in \{LinkIDs\}_{Project}}\sum_{Period}BaseYearVolume_{Period,Link}}
    # DelayReductionBenefit_{Year,Project} = \Delta DelayVehHours_{Project} \times [PeakTruckShare_{Project} \times TruckVOT + (1-PeakTruckShare_{Project})\times All-PurposeOccupancy\times All-PurposeVOT]
    # DetourReductionBenefit_{Year,Project} = \Delta DetourVehHours_{Project} \times [TruckShare_{Project} \times TruckVOT + (1-TruckShare_{Project})\times All-PurposeOccupancy\times All-PurposeVOT]
    # Benefit_{Year,Project} = DelayReductionBenefit_{Year,Project} + DetourReductionBenefit_{Year,Project}
    # Benefit_{Project} = \sum_{Year=OpenYear_{Project}}^{EndYear_{Project}}\frac{Benefit_{Year,Project}}{(1 + DiscountRate)^{Year-BaseYear}}
    # TODO: Implement processing from the inputs above.
    # Suggested output structure: one geography row, one column per option combination.
    # output_columns = ['monetized_travel_time_savings_benefit']
    # project: basic unit;
    # project_index = projects.index.rename('project_id')
    # project_output = pd.DataFrame(index=project_index, columns=output_columns)
    # corridor: aggregation;
    # \sum_{Project \in Corridor}Benefit_{Project}
    # corridor_index = corridors.index.rename('corridor_id')
    # corridor_output = pd.DataFrame(index=corridor_index, columns=output_columns)
    # subRegion: aggregation; Sum
    # \sum_{Project \in SubRegion}Benefit_{Project}
    # sub_region_index = sub_regions.index.rename('subregion_id')
    # sub_region_output = pd.DataFrame(index=sub_region_index, columns=output_columns)
    # region: aggregation; Sum
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
