# KPI 100: New Roadway Detour Reduction Vehicle Hours
# ID: kpi-2103073c-6a32-45dc-8be5-65842d6c000e
# Group: Scenario
# Unit: annual vehicle hours
# Required sources:
#   base_year_tdm: PreprocessedConstants.BaseYearTDM.Base Year Total Daily Volume (BaseYearTotalDailyVolume_{Link})
#   projects: ScenarioUpstream.Projects.Saved Minutes (SavedMinutes_{Project})
#   Constant Bike Ped Removal Rate: BikePedRemovalRate
#   kpi_99_project: 99_induced_walk_bike_trips.parquet at project, current scenario (\Delta BikePedTrips_{Year,Project})
#   Constant Base Year: BaseYear
#   Constant Bike Ped Growth Rate: BikePedGR
#   Constant VMT Growth Rate: VMTGR
#   Output geography: ScenarioUpstream.Projects; use table-schema joins for aggregation
#   Output geography: PreprocessedConstants.Corridors; use table-schema joins for aggregation
#   Output geography: PreprocessedConstants.SubRegions; use table-schema joins for aggregation
# Expected output files:
#   data/kpis/<scenario>/Projects/100_new_roadway_detour_reduction_vehicle_hours.parquet
#   data/kpis/<scenario>/Corridors/100_new_roadway_detour_reduction_vehicle_hours.parquet
#   data/kpis/<scenario>/SubRegions/100_new_roadway_detour_reduction_vehicle_hours.parquet
#   data/kpis/<scenario>/Region/100_new_roadway_detour_reduction_vehicle_hours.parquet

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

KPI_NAME = '100_new_roadway_detour_reduction_vehicle_hours'
KPI_ID = 'kpi-2103073c-6a32-45dc-8be5-65842d6c000e'
SCENARIO_TYPE = 'Scenario'

# Local variables and non-global dimension options:
# YEAR_OPTIONS = []  # TODO: Define years, e.g. from project OpenYear/EndYear


def validate(context: RunContext) -> dict[str, object]:
    # base_year_tdm = validate_table(context, 'PreprocessedConstants', 'BaseYearTDM')
    # projects = validate_table(context, 'ScenarioUpstream', 'Projects')
    # bike_ped_removal_rate = get_constant('Bike Ped Removal Rate')
    # kpi_99_project = loader.load(context, '99_induced_walk_bike_trips', path='kpis', scale='project')
    # base_year = get_constant('Base Year')
    # bike_ped_growth_rate = get_constant('Bike Ped Growth Rate')
    # vmt_growth_rate = get_constant('VMT Growth Rate')
    # year_options = YEAR_OPTIONS
    # corridors = validate_table(context, 'PreprocessedConstants', 'Corridors')
    # sub_regions = validate_table(context, 'PreprocessedConstants', 'SubRegions')
    # return {
    #     'base_year_tdm': base_year_tdm,
    #     'projects': projects,
    #     'bike_ped_removal_rate': bike_ped_removal_rate,
    #     'kpi_99_project': kpi_99_project,
    #     'base_year': base_year,
    #     'bike_ped_growth_rate': bike_ped_growth_rate,
    #     'vmt_growth_rate': vmt_growth_rate,
    #     'year_options': year_options,
    #     'corridors': corridors,
    #     'sub_regions': sub_regions,
    # }
    raise NotImplementedError(f'{KPI_NAME}: implement validate')


def process(
    base_year_tdm: pd.DataFrame,
    projects: pd.DataFrame,
    bike_ped_removal_rate: object,
    kpi_99_project: pd.DataFrame,
    base_year: object,
    bike_ped_growth_rate: object,
    vmt_growth_rate: object,
    year_options: list[object],
    corridors: pd.DataFrame,
    sub_regions: pd.DataFrame,
) -> dict[str, pd.DataFrame]:
    # Formula reference (processing is intentionally left blank):
    # \Delta Volume_{Year,Project} = BikePedRemovalRate\times\Delta BikePedTrips_{Year,Project}
    # Volume_{Year,Project} = 365\times BaseYearTotalDailyVolume_{Link}\times(1+VMTGR)^{Year - BaseYear} - \Delta Volume_{Year,Project}
    # \Delta DetourVehHours_{Zone} = \sum_{Project\in Zone} (Volume_{Year,Project} \times \frac{SavedMinutes_{Project}}{60})
    # TODO: Implement processing from the inputs above.
    # Suggested output structure: one geography row, one column per option combination.
    # output_columns = ['new_roadway_detour_reduction_vehicle_hours']
    # project: basic unit;
    # project_index = projects.index.rename('project_id')
    # project_output = pd.DataFrame(index=project_index, columns=output_columns)
    # corridor: aggregation;
    # \sum_{Project \in Corridor}\Delta DetourVehHours_{Zone}
    # corridor_index = corridors.index.rename('corridor_id')
    # corridor_output = pd.DataFrame(index=corridor_index, columns=output_columns)
    # subRegion: aggregation; Sum
    # \sum_{Project \in SubRegion}\Delta DetourVehHours_{Zone}
    # sub_region_index = sub_regions.index.rename('subregion_id')
    # sub_region_output = pd.DataFrame(index=sub_region_index, columns=output_columns)
    # region: aggregation; Sum
    # \sum_{Project \in Region}\Delta DetourVehHours_{Zone}
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
