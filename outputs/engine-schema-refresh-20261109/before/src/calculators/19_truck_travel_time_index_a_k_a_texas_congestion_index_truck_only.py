# KPI 19: Truck Travel Time Index, a.k.a. Texas Congestion Index (Truck Only)
# ID: kpi-984945a1-de02-4f99-bac3-501faaad61b8
# Group: Scenario
# Unit: index
# Required sources:
#   calibrated_network_output: KPIPreparation.CalibratedNetworkOutput.Calibrated Travel Minutes (CalibratedTravelMinutes_{Period,Link})
#     Field dimension Period: ['AM', 'PM', 'MD', 'OV']
#   calibrated_network_output: KPIPreparation.CalibratedNetworkOutput.Total Daily Truck VMT (TruckVMT_{Link})
#   scenario_links: ScenarioUpstream.ScenarioLinks.Free Flow Speed MPH (FreeFlowSpeedMPH_{Link})
#   scenario_links: ScenarioUpstream.ScenarioLinks.Distance Miles (DistanceMiles_{Link})
#   Output geography: PreprocessedConstants.BaseHighwayLinks; use table-schema joins for aggregation
#   Output geography: PreprocessedConstants.Corridors; use table-schema joins for aggregation
#   Output geography: PreprocessedConstants.SubRegions; use table-schema joins for aggregation
# Expected output files:
#   data/kpis/<scenario>/Links/19_truck_travel_time_index_a_k_a_texas_congestion_index_truck_only.parquet
#   data/kpis/<scenario>/Corridors/19_truck_travel_time_index_a_k_a_texas_congestion_index_truck_only.parquet
#   data/kpis/<scenario>/SubRegions/19_truck_travel_time_index_a_k_a_texas_congestion_index_truck_only.parquet
#   data/kpis/<scenario>/Region/19_truck_travel_time_index_a_k_a_texas_congestion_index_truck_only.parquet

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

KPI_NAME = '19_truck_travel_time_index_a_k_a_texas_congestion_index_truck_only'
KPI_ID = 'kpi-984945a1-de02-4f99-bac3-501faaad61b8'
SCENARIO_TYPE = 'Scenario'


def validate(context: RunContext) -> dict[str, object]:
    # calibrated_network_output = validate_table(context, 'KPIPreparation', 'CalibratedNetworkOutput')
    # scenario_links = validate_table(context, 'ScenarioUpstream', 'ScenarioLinks')
    # period = get_domain('Period')
    # base_highway_links = validate_table(context, 'PreprocessedConstants', 'BaseHighwayLinks')
    # corridors = validate_table(context, 'PreprocessedConstants', 'Corridors')
    # sub_regions = validate_table(context, 'PreprocessedConstants', 'SubRegions')
    # return {
    #     'calibrated_network_output': calibrated_network_output,
    #     'scenario_links': scenario_links,
    #     'period': period,
    #     'base_highway_links': base_highway_links,
    #     'corridors': corridors,
    #     'sub_regions': sub_regions,
    # }
    raise NotImplementedError(f'{KPI_NAME}: implement validate')


def process(
    calibrated_network_output: pd.DataFrame,
    scenario_links: pd.DataFrame,
    period: list[str],
    base_highway_links: pd.DataFrame,
    corridors: pd.DataFrame,
    sub_regions: pd.DataFrame,
) -> dict[str, pd.DataFrame]:
    # Formula reference (processing is intentionally left blank):
    # FreeFlowMinutes_{Link} = \frac{DistanceMiles_{Link}}{FreeFlowSpeedMPH_{Link}}\times 60
    # TTI_{Period,Link} = \frac{CalibratedTravelMinutes_{Period,Link}}{FreeFlowMinutes_{Link}}
    # TTI_{Link} = \frac{\sum_{Period\in\{AM,PM\}}TTI_{Period,Link}}{2}
    # TODO: Implement processing from the inputs above.
    # Suggested output structure: one geography row, one column per option combination.
    # output_columns = ['truck_travel_time_index_a_k_a_texas_congestion_index_truck_only']
    # link: basic unit;
    # link_index = base_highway_links.index.rename('link_id')
    # link_output = pd.DataFrame(index=link_index, columns=output_columns)
    # corridor: aggregation; Avg, weighted by VMT
    # \frac{\sum_{Link \in Corridor} (TTI_{Link} \times TruckVMT_{Link})}{\sum_{Link \in Corridor} TruckVMT_{Link}}
    # corridor_index = corridors.index.rename('corridor_id')
    # corridor_output = pd.DataFrame(index=corridor_index, columns=output_columns)
    # subRegion: aggregation; Avg, weighted by VMT
    # \frac{\sum_{link \in SubRegion} (TTI_{Link} \times TruckVMT_{Link})}{\sum_{Link \in SubRegion} TruckVMT_{Link}}
    # sub_region_index = sub_regions.index.rename('subregion_id')
    # sub_region_output = pd.DataFrame(index=sub_region_index, columns=output_columns)
    # region: aggregation; Avg, weighted by VMT
    # \frac{\sum_{Link \in Region} (TTI_{Link} \times TruckVMT_{Link})}{\sum_{Link \in Region} TruckVMT_{Link}}
    # region_index = pd.Index(['Region'], name='region_id')
    # region_output = pd.DataFrame(index=region_index, columns=output_columns)
    # return {
    #     'link': link_output,
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
