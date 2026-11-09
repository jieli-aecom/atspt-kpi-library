# KPI 61: Monetized Vehicle Operating Cost Savings Benefit
# ID: kpi-37ca0171-98d1-4f26-b190-6aa3c9a2cbf9
# Group: Scenario
# Unit: base year dollars
# Required sources:
#   Constant Discount Rate: DiscountRate
#   kpi_99_project: 99_induced_walk_bike_trips.parquet at project, current scenario (\Delta BikePedTrips_{Year,Project})
#   Constant Bike Ped Removal Rate: BikePedRemovalRate
#   Constant Light-Duty Vehicle Operating Cost Per VMT: LightVehicleOperatingCostPerVMT
#   Constant Commercial Truck Operating Cost Per VMT: TruckOperatingCostPerVMT
#   base_year_tdm: PreprocessedConstants.BaseYearTDM.Base Year Total Daily Volume (BaseYearTotalDailyVolume_{Link})
#   base_year_tdm: PreprocessedConstants.BaseYearTDM.Base Year Total Daily Truck Volume (BaseYearTotalDailyTruckVolume_{Link})
#   projects: ScenarioUpstream.Projects.Open Year (OpenYear_{Project})
#   projects: ScenarioUpstream.Projects.End Year (EndYear_{Project})
#   Output geography: ScenarioUpstream.Projects; use table-schema joins for aggregation
#   Output geography: PreprocessedConstants.Corridors; use table-schema joins for aggregation
#   Output geography: PreprocessedConstants.SubRegions; use table-schema joins for aggregation
# Expected output files:
#   data/kpis/<scenario>/Projects/61_monetized_vehicle_operating_cost_savings_benefit.parquet
#   data/kpis/<scenario>/Corridors/61_monetized_vehicle_operating_cost_savings_benefit.parquet
#   data/kpis/<scenario>/SubRegions/61_monetized_vehicle_operating_cost_savings_benefit.parquet
#   data/kpis/<scenario>/Region/61_monetized_vehicle_operating_cost_savings_benefit.parquet

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

KPI_NAME = '61_monetized_vehicle_operating_cost_savings_benefit'
KPI_ID = 'kpi-37ca0171-98d1-4f26-b190-6aa3c9a2cbf9'
SCENARIO_TYPE = 'Scenario'

# Local variables and non-global dimension options:
# YEAR_OPTIONS = []  # TODO: Define years, e.g. from project OpenYear/EndYear


def validate(context: RunContext) -> dict[str, object]:
    # discount_rate = get_constant('Discount Rate')
    # kpi_99_project = loader.load(context, '99_induced_walk_bike_trips', path='kpis', scale='project')
    # bike_ped_removal_rate = get_constant('Bike Ped Removal Rate')
    # light_duty_vehicle_operating_cost_per_vmt = get_constant('Light-Duty Vehicle Operating Cost Per VMT')
    # commercial_truck_operating_cost_per_vmt = get_constant('Commercial Truck Operating Cost Per VMT')
    # base_year_tdm = validate_table(context, 'PreprocessedConstants', 'BaseYearTDM')
    # projects = validate_table(context, 'ScenarioUpstream', 'Projects')
    # year_options = YEAR_OPTIONS
    # corridors = validate_table(context, 'PreprocessedConstants', 'Corridors')
    # sub_regions = validate_table(context, 'PreprocessedConstants', 'SubRegions')
    # return {
    #     'discount_rate': discount_rate,
    #     'kpi_99_project': kpi_99_project,
    #     'bike_ped_removal_rate': bike_ped_removal_rate,
    #     'light_duty_vehicle_operating_cost_per_vmt': light_duty_vehicle_operating_cost_per_vmt,
    #     'commercial_truck_operating_cost_per_vmt': commercial_truck_operating_cost_per_vmt,
    #     'base_year_tdm': base_year_tdm,
    #     'projects': projects,
    #     'year_options': year_options,
    #     'corridors': corridors,
    #     'sub_regions': sub_regions,
    # }
    raise NotImplementedError(f'{KPI_NAME}: implement validate')


def process(
    discount_rate: object,
    kpi_99_project: pd.DataFrame,
    bike_ped_removal_rate: object,
    light_duty_vehicle_operating_cost_per_vmt: object,
    commercial_truck_operating_cost_per_vmt: object,
    base_year_tdm: pd.DataFrame,
    projects: pd.DataFrame,
    year_options: list[object],
    corridors: pd.DataFrame,
    sub_regions: pd.DataFrame,
) -> dict[str, pd.DataFrame]:
    # Formula reference (processing is intentionally left blank):
    # TruckShare_{Project} = \frac{\sum_{Link\in \{LinkIDs\}_{Project}}BaseYearTotalDailyTruckVolume_{Link}}{\sum_{Link \in \{LinkIDs\}_{Project}}BaseYearTotalDailyVolume_{Link}}
    # Benefit_{Year,Project} = \Delta BikePedTrips_{Year,Project}\times BikePedRemovalRate \times [TruckShare_{Project} \times TruckOperatingCostPerVMT + (1-TruckShare_{Project}) \times LightVehicleOperatingCostPerVMT]
    # Benefit_{Project} = \sum_{Year=OpenYear_{Project}}^{EndYear_{Project}}\frac{Benefit_{Year,Project}}{(1 + DiscountRate)^{Year-BaseYear}}
    # TODO: Implement processing from the inputs above.
    # Suggested output structure: one geography row, one column per option combination.
    # output_columns = ['monetized_vehicle_operating_cost_savings_benefit']
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
