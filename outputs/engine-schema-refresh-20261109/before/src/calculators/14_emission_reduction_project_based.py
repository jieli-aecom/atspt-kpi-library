# KPI 14: Emission Reduction [Project-Based]
# ID: kpi-202c2dac-fa27-4201-94bc-7d053fc3e10c
# Group: Scenario
# Unit: annual tons
# Required sources:
#   scenario_links: ScenarioUpstream.ScenarioLinks.Free Flow Speed MPH (FreeFlowSpeedMPH_{Link})
#   Constant NB Congested Share: NBCongestedShare
#   Lookup DelayReductionFactorLookup (DelayReductionFactorLookup(,))
#   projects: ScenarioUpstream.Projects.Delay Reduction Projects (\{Improvements\}_{Project})
#   base_year_tdm: PreprocessedConstants.BaseYearTDM.Base Year Travel Time Minutes (BaseYearTravelTimeMinutes_{Period,Link})
#     Field dimension Period: ['AM', 'PM', 'MD', 'OV']
#   base_highway_links: PreprocessedConstants.BaseHighwayLinks.Base Year Distance Miles (BaseYearDistanceMiles_{Link})
#   scenario_links: ScenarioUpstream.ScenarioLinks.Area Access Type (AreaAccessType_{Link})
#   Lookup RunningEmissionFactor (RunningEmissionFactor(,,))
#   base_year_tdm: PreprocessedConstants.BaseYearTDM.Base Year Total Daily VMT (BaseYearTotalDailyVMT_{Link})
#   base_year_tdm: PreprocessedConstants.BaseYearTDM.Base Year Total Daily Truck VMT (BaseYearTotalDailyTruckVMT_{Link})
#   Constant Heavy-Diesel Truck Share: HeavyDieselTruckShare
#   Lookup HDTExtraIdlingEmissionFactor (HDTExtraIdlingEmissionFactor())
#   Lookup VehicleStartEmissionFactor (VehicleStartEmissionFactor())
#   kpi_99_project: 99_induced_walk_bike_trips.parquet at project, current scenario (\Delta BikePedTrips_{Year,Project})
#   Constant Base Year: BaseYear
#   Constant Bike Ped Growth Rate: BikePedGR
#   Constant VMT Growth Rate: VMTGR
#   Lookup IdlingEmissionFactorLookup (IdlingEmissionFactorLookup(,))
#   projects: ScenarioUpstream.Projects.Link IDs (\{LinkIDs\}_{Project})
#   Output geography: ScenarioUpstream.Projects; use table-schema joins for aggregation
#   Output geography: PreprocessedConstants.Corridors; use table-schema joins for aggregation
#   Output geography: PreprocessedConstants.SubRegions; use table-schema joins for aggregation
# Expected output files:
#   data/kpis/<scenario>/Projects/14_emission_reduction_project_based.parquet
#   data/kpis/<scenario>/Corridors/14_emission_reduction_project_based.parquet
#   data/kpis/<scenario>/SubRegions/14_emission_reduction_project_based.parquet
#   data/kpis/<scenario>/Region/14_emission_reduction_project_based.parquet
# There are two different ways of emission estimation: \(1\) Emission reduction calculation based on base\-year VMT plus project\-based reduction assumptions; \(2\) Direct emission calculation based on TDM results

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

KPI_NAME = '14_emission_reduction_project_based'
KPI_ID = 'kpi-202c2dac-fa27-4201-94bc-7d053fc3e10c'
SCENARIO_TYPE = 'Scenario'

# Local variables and non-global dimension options:
# YEAR_OPTIONS = []  # TODO: Define options for Year


def validate(context: RunContext) -> dict[str, object]:
    # scenario_links = validate_table(context, 'ScenarioUpstream', 'ScenarioLinks')
    # nb_congested_share = get_constant('NB Congested Share')
    # delay_reduction_factor_lookup = get_lookup('DelayReductionFactorLookup')
    # projects = validate_table(context, 'ScenarioUpstream', 'Projects')
    # base_year_tdm = validate_table(context, 'PreprocessedConstants', 'BaseYearTDM')
    # base_highway_links = validate_table(context, 'PreprocessedConstants', 'BaseHighwayLinks')
    # running_emission_factor = get_lookup('RunningEmissionFactor')
    # heavy_diesel_truck_share = get_constant('Heavy-Diesel Truck Share')
    # hdt_extra_idling_emission_factor = get_lookup('HDTExtraIdlingEmissionFactor')
    # vehicle_start_emission_factor = get_lookup('VehicleStartEmissionFactor')
    # kpi_99_project = loader.load(context, '99_induced_walk_bike_trips', path='kpis', scale='project')
    # base_year = get_constant('Base Year')
    # bike_ped_growth_rate = get_constant('Bike Ped Growth Rate')
    # vmt_growth_rate = get_constant('VMT Growth Rate')
    # idling_emission_factor_lookup = get_lookup('IdlingEmissionFactorLookup')
    # delay_reduction_project_type = get_domain('Delay Reduction Project Type')
    # period = get_domain('Period')
    # area_access_type = get_domain('Area Access Type')
    # emission_type = get_domain('Emission Type')
    # year_options = YEAR_OPTIONS
    # corridors = validate_table(context, 'PreprocessedConstants', 'Corridors')
    # sub_regions = validate_table(context, 'PreprocessedConstants', 'SubRegions')
    # return {
    #     'scenario_links': scenario_links,
    #     'nb_congested_share': nb_congested_share,
    #     'delay_reduction_factor_lookup': delay_reduction_factor_lookup,
    #     'projects': projects,
    #     'base_year_tdm': base_year_tdm,
    #     'base_highway_links': base_highway_links,
    #     'running_emission_factor': running_emission_factor,
    #     'heavy_diesel_truck_share': heavy_diesel_truck_share,
    #     'hdt_extra_idling_emission_factor': hdt_extra_idling_emission_factor,
    #     'vehicle_start_emission_factor': vehicle_start_emission_factor,
    #     'kpi_99_project': kpi_99_project,
    #     'base_year': base_year,
    #     'bike_ped_growth_rate': bike_ped_growth_rate,
    #     'vmt_growth_rate': vmt_growth_rate,
    #     'idling_emission_factor_lookup': idling_emission_factor_lookup,
    #     'delay_reduction_project_type': delay_reduction_project_type,
    #     'period': period,
    #     'area_access_type': area_access_type,
    #     'emission_type': emission_type,
    #     'year_options': year_options,
    #     'corridors': corridors,
    #     'sub_regions': sub_regions,
    # }
    raise NotImplementedError(f'{KPI_NAME}: implement validate')


def process(
    scenario_links: pd.DataFrame,
    nb_congested_share: object,
    delay_reduction_factor_lookup: Callable[..., object],
    projects: pd.DataFrame,
    base_year_tdm: pd.DataFrame,
    base_highway_links: pd.DataFrame,
    running_emission_factor: Callable[..., object],
    heavy_diesel_truck_share: object,
    hdt_extra_idling_emission_factor: Callable[..., object],
    vehicle_start_emission_factor: Callable[..., object],
    kpi_99_project: pd.DataFrame,
    base_year: object,
    bike_ped_growth_rate: object,
    vmt_growth_rate: object,
    idling_emission_factor_lookup: Callable[..., object],
    delay_reduction_project_type: list[str],
    period: list[str],
    area_access_type: list[str],
    emission_type: list[str],
    year_options: list[object],
    corridors: pd.DataFrame,
    sub_regions: pd.DataFrame,
) -> dict[str, pd.DataFrame]:
    # Formula reference (processing is intentionally left blank):
    # DelayRectionFactor_{Project} = 1- \prod_{Improvement\in \{Improvements\}_{Project}}(1-DelayReductionFactorLookup(Improvement))
    # BuildCongestedShare_{Project} = NBCongestedShare \times (1-DelayRectionFactor_{Project})
    # NoBuildPeakSpeed_{Link|Link\in\{LinkIDs\}_{Project}} = \frac{2\times 60\times BaseYearDistanceMiles_{Link}}{ \sum_{Period\in \{AM,PM\}}BaseYearTravelTimeMinutes_{Period,Link}}
    # NoBuildSpeed_{Link|Link\in\{LinkIDs\}_{Project}} = \frac{FreeFlowSpeedMPH_{Link}\times NoBuildPeakSpeed_{Link|Link\in\{LinkIDs\}_{Project}}}{NBCongestedShare\times FreeFlowSpeedMPH_{Link} + (1-NBCongestedShare)\times NoBuildPeakSpeed_{Link|Link\in\{LinkIDs\}_{Project}}}
    # BuildSpeed_{Link|Link\in\{LinkIDs\}_{Project}} = \frac{FreeFlowSpeedMPH_{Link}\times NoBuildPeakSpeed_{Link|Link\in\{LinkIDs\}_{Project}}}{BuildCongestedShare_{Project}\times FreeFlowSpeedMPH_{Link} + (1-BuildCongestedShare_{Project})\times NoBuildPeakSpeed_{Link|Link\in\{LinkIDs\}_{Project}}}
    # \Delta GramsPerVMT_{Link|Link\in\{LinkIDs\}_{Project},EmissionType} = RunningEmissionFactor(AreaAccessType_{Link},NoBuildSpeed_{Link|Link\in\{LinkIDs\}_{Project}},EmissionType) - RunningEmissionFactor(AreaAccessType_{Link},BuildSpeed_{Link|Link\in\{LinkIDs\}_{Project}},EmissionType)
    # \Delta RunningTons_{Year,Link|Link\in\{LinkIDs\}_{Project},EmissionType} = (365\times BaseYearTotalDailyVMT_{Link} \times(1 + VMTGR)^{Year - BaseYear} \times \Delta GramsPerVMT_{Link|Link\in\{LinkIDs\}_{Project},EmissionType}) \times \frac{1}{1,000,000}
    # \Delta RunningTons_{Year,Project,EmissionType} = \sum_{Link\in\{LinkIDs\}_{Project}}\Delta RunningTons_{Year,Link|Link\in\{LinkIDs\}_{Project},EmissionType}
    # NoBuildIdlingVehicleHours_{Year,Link|Link\in\{LinkIDs\}_{Project}} = 365\times BaseYearTotalDailyVMT_{Link}\times (\frac{1}{NoBuildPeakSpeed_{Link|Link\in\{LinkIDs\}_{Project}}} - \frac{1}{FreeFlowSpeedMPH_{Link}})\times NBCongestedShare\times (1+VMTGR)^{Year - BaseYear}
    # BuildIdlingVehicleHours_{Year,Link|Link\in\{LinkIDs\}_{Project}} = NoBuildIdlingVehicleHours_{Year,Link|Link\in\{LinkIDs\}_{Project}} \times (1-DelayRectionFactor_{Project})
    # \Delta IdlingVehileHours_{Year,Link|Link\in\{LinkIDs\}_{Project}} =  NoBuildIdlingVehicleHours_{Year,Link|Link\in\{LinkIDs\}_{Project}} - BuildIdlingVehicleHours_{Year,Link|Link\in\{LinkIDs\}_{Project}}
    # \Delta IdlingTons_{Year,Link|Link\in\{LinkIDs\}_{Project},EmissionType} = \frac{IdlingEmissionFactorLookup(AreaAccessType_{Link},EmissionType)}{100000}\times \Delta IdlingVehileHours_{Year,Link|Link\in\{LinkIDs\}_{Project}}
    # \Delta IdlingTons_{Year,Project,EmissionType} = \sum_{Link\in\{LinkIDs\}_{Project}}\Delta IdlingTons_{Year,Link|Link\in\{LinkIDs\}_{Project},EmissionType}
    # TruckShare_{Link|Link\in\{LinkIDs\}_{Project}} = \frac{BaseYearTotalDailyTruckVMT_{Link|Link\in\{LinkIDs\}_{Project}}}{BaseYearTotalDailyVMT_{Link|Link\in\{LinkIDs\}_{Project}}}\times HeavyDieselTruckShare
    # \Delta TruckIdlingVehicleHours_{Year,Link|Link\in\{LinkIDs\}_{Project}} = \Delta IdlingVehileHours_{Year,Link|Link\in\{LinkIDs\}_{Project}}\times TruckShare_{Link|Link\in\{LinkIDs\}_{Project}}
    # \Delta HDTIdlingTons_{Year,Link|Link\in\{LinkIDs\}_{Project},EmissionType} = \frac{HDTExtraIdlingEmissionFactor(EmissionType)}{1,000,000}\times \Delta TruckIdlingVehicleHours_{Year,Link|Link\in\{LinkIDs\}_{Project}}
    # \Delta HDTIdlingTons_{Year,Project,EmissionType} = \sum_{Link\in\{LinkIDs\}_{Project}}\Delta HDTIdlingTons_{Year,Link|Link\in\{LinkIDs\}_{Project},EmissionType}
    # \Delta Starts_{Year,Project} = \Delta BikePedTrips_{Year,Project}
    # \Delta StartTons_{EmissionType,Project} = \frac{VehicleStartEmissionFactor(EmissionType)}{1,000,000}\times \Delta Starts_{Year,Project}
    # \Delta EmissionTons_{Year,EmissionType,Project} = \Delta RunningTons_{Year,Project,EmissionType} + \Delta IdlingTons_{Year,Project,EmissionType} + \Delta HDTIdlingTons_{Year,Project,EmissionType} + \Delta StartTons_{EmissionType,Project}
    # TODO: Implement processing from the inputs above.
    # Suggested output structure: one geography row, one column per option combination.
    # output_columns = [
    #     'emission_reduction_project_based' + '_' + '_'.join(snake_case(str(v)) for v in options)
    #     for options in product(year_options, emission_type)
    # ]
    # project: basic unit;
    # project_index = projects.index.rename('project_id')
    # project_output = pd.DataFrame(index=project_index, columns=output_columns)
    # corridor: aggregation;
    # \sum_{(Link\in Corridor)\bigcap(Link \in \bigcup_{Project}\{LinkIDs\}_{Project})}\Delta EmissionTons_{Year,EmissionType,Project}
    # corridor_index = corridors.index.rename('corridor_id')
    # corridor_output = pd.DataFrame(index=corridor_index, columns=output_columns)
    # subRegion: aggregation;
    # \sum_{(Link\in SubRegion)\bigcap(Link \in \bigcup_{Project}\{LinkIDs\}_{Project})}\Delta EmissionTons_{Year,EmissionType,Project}
    # sub_region_index = sub_regions.index.rename('subregion_id')
    # sub_region_output = pd.DataFrame(index=sub_region_index, columns=output_columns)
    # region: aggregation;
    # \sum_{(Link\in Region)\bigcap(Link \in \bigcup_{Project}\{LinkIDs\}_{Project})}\Delta EmissionTons_{Year,EmissionType,Project}
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
