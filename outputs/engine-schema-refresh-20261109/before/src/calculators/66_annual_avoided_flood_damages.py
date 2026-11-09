# KPI 66: Annual Avoided Flood Damages
# ID: kpi-7f37ab17-a43e-4ad7-9ef9-747e2572be90
# Group: Scenario
# Unit:
# Required sources:
#   base_year_tdm: PreprocessedConstants.BaseYearTDM.Base Year Total Daily Volume (BaseYearTotalDailyVolume_{Link})
#   Constant Cost Per Vehicle Mile: CostPerVehicleMile
#   Constant Cost Per Vehicle Hour: CostPerVehicleHour
#   projects: ScenarioUpstream.Projects.Saved Minutes (SavedMinutes_{Project})
#   projects: ScenarioUpstream.Projects.Saved Miles (SavedMiles_{Project})
#   projects: ScenarioUpstream.Projects.Volunteer Count (VolunteerCount_{FloodInterval,Scenario,Project})
#     Field dimension Flood Interval: ['1', '5', '10', '25', '50', '100', '500', '1000']
#     Field dimension Scenario: ['With Project', 'No Project']
#   projects: ScenarioUpstream.Projects.Volunteer Hours (VolunteerHours_{FloodInterval,Scenario,Project})
#     Field dimension Flood Interval: ['1', '5', '10', '25', '50', '100', '500', '1000']
#     Field dimension Scenario: ['With Project', 'No Project']
#   projects: ScenarioUpstream.Projects.Lodging Days (LodgingDays_{FloodInterval,Scenario,Project})
#     Field dimension Flood Interval: ['1', '5', '10', '25', '50', '100', '500', '1000']
#     Field dimension Scenario: ['With Project', 'No Project']
#   projects: ScenarioUpstream.Projects.Direct Physical Damage (DirectPhysicalDamage_{FloodInterval,Scenario,Project})
#     Field dimension Flood Interval: ['1', '5', '10', '25', '50', '100', '500', '1000']
#     Field dimension Scenario: ['With Project', 'No Project']
#   projects: ScenarioUpstream.Projects.Days Disrupted (DaysDisrupted_{FloodInterval,Scenario,Project})
#     Field dimension Flood Interval: ['1', '5', '10', '25', '50', '100', '500', '1000']
#     Field dimension Scenario: ['With Project', 'No Project']
#   Constant Cost Per Lodging Day: CostPerLodgingDay
#   Constant Cost Per Volunteer Hour: CostPerVolunteerHour
#   projects: ScenarioUpstream.Projects.Link IDs (\{LinkIDs\}_{Project})
#   Output geography: ScenarioUpstream.Projects; use table-schema joins for aggregation
#   Output geography: PreprocessedConstants.Corridors; use table-schema joins for aggregation
#   Output geography: PreprocessedConstants.SubRegions; use table-schema joins for aggregation
# Expected output files:
#   data/kpis/<scenario>/Projects/66_annual_avoided_flood_damages.parquet
#   data/kpis/<scenario>/Corridors/66_annual_avoided_flood_damages.parquet
#   data/kpis/<scenario>/SubRegions/66_annual_avoided_flood_damages.parquet
#   data/kpis/<scenario>/Region/66_annual_avoided_flood_damages.parquet

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

KPI_NAME = '66_annual_avoided_flood_damages'
KPI_ID = 'kpi-7f37ab17-a43e-4ad7-9ef9-747e2572be90'
SCENARIO_TYPE = 'Scenario'

# Local variables and non-global dimension options:
# SCENARIO_OPTIONS = ['With Project', 'No Project']


def validate(context: RunContext) -> dict[str, object]:
    # base_year_tdm = validate_table(context, 'PreprocessedConstants', 'BaseYearTDM')
    # cost_per_vehicle_mile = get_constant('Cost Per Vehicle Mile')
    # cost_per_vehicle_hour = get_constant('Cost Per Vehicle Hour')
    # projects = validate_table(context, 'ScenarioUpstream', 'Projects')
    # scenario_options = SCENARIO_OPTIONS
    # cost_per_lodging_day = get_constant('Cost Per Lodging Day')
    # cost_per_volunteer_hour = get_constant('Cost Per Volunteer Hour')
    # flood_interval = get_domain('Flood Interval')
    # corridors = validate_table(context, 'PreprocessedConstants', 'Corridors')
    # sub_regions = validate_table(context, 'PreprocessedConstants', 'SubRegions')
    # return {
    #     'base_year_tdm': base_year_tdm,
    #     'cost_per_vehicle_mile': cost_per_vehicle_mile,
    #     'cost_per_vehicle_hour': cost_per_vehicle_hour,
    #     'projects': projects,
    #     'scenario_options': scenario_options,
    #     'cost_per_lodging_day': cost_per_lodging_day,
    #     'cost_per_volunteer_hour': cost_per_volunteer_hour,
    #     'flood_interval': flood_interval,
    #     'corridors': corridors,
    #     'sub_regions': sub_regions,
    # }
    raise NotImplementedError(f'{KPI_NAME}: implement validate')


def process(
    base_year_tdm: pd.DataFrame,
    cost_per_vehicle_mile: object,
    cost_per_vehicle_hour: object,
    projects: pd.DataFrame,
    scenario_options: list[str],
    cost_per_lodging_day: object,
    cost_per_volunteer_hour: object,
    flood_interval: list[str],
    corridors: pd.DataFrame,
    sub_regions: pd.DataFrame,
) -> dict[str, pd.DataFrame]:
    # Formula reference (processing is intentionally left blank):
    # DailyTrips_{Project} = \sum_{idOf(Link) \in \{LinkIDs\}_{Project}}BaseYearTotalDailyVolume_{Link}
    # DailyRoadBridgeLoss_{Project} = DailyTrips_{Project}
    # × \frac{SavedMinutes_{Project}}{60} × CostPerVehicleHour
    #   + SavedMiles_{Project} × CostPerVehicleMile
    # VolunteerCost_{Scenario,FloodInterval,Project} = VolunteerCount_{FloodInterval,Scenario,Project}\times (VolunteerHours_{FloodInterval,Scenario,Project}\times CostPerVolunteerHour + LodgingDays_{FloodInterval,Scenario,Project} \times CostPerLodgingDay)
    # Cost_{Scenario,FloodInterval,Project} = DirectPhysicalDamage_{FloodInterval,Scenario,Project} + DaysDisrupted_{FloodInterval,Scenario,Project} \times DailyRoadBridgeLoss_{Project} + VolunteerCost_{Scenario,FloodInterval,Project}
    # ExpectedCost_{Scenario,Project} = \sum_{FloodInterval}Cost_{Scenario,FloodInterval,Project}\times \frac{1}{FloodInterval}
    # CostAvoided_{Project} = ExpectedCost_{Scenario,Project}_{Scenario=NoProject} - ExpectedCost_{Scenario,Project}_{Scenario=WithProject}
    # TODO: Implement processing from the inputs above.
    # Suggested output structure: one geography row, one column per option combination.
    # output_columns = ['annual_avoided_flood_damages']
    # project: basic unit;
    # project_index = projects.index.rename('project_id')
    # project_output = pd.DataFrame(index=project_index, columns=output_columns)
    # corridor: aggregation; Sum
    # \sum_{Project \in Corridor}CostAvoided_{Project}
    # corridor_index = corridors.index.rename('corridor_id')
    # corridor_output = pd.DataFrame(index=corridor_index, columns=output_columns)
    # subRegion: aggregation; Sum
    # \sum_{Project \in SubRegion}CostAvoided_{Project}
    # sub_region_index = sub_regions.index.rename('subregion_id')
    # sub_region_output = pd.DataFrame(index=sub_region_index, columns=output_columns)
    # region: aggregation; Sum
    # \sum_{Project \in Region}CostAvoided_{Project}
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
