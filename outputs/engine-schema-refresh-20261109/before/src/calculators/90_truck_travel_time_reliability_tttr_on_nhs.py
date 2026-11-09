# KPI 90: Truck Travel Time Reliability (TTTR) on NHS
# ID: kpi-67afe44f-e180-4199-9ef0-a3cb0be4dccb
# Group: Scenario
# Unit: %
# Required sources:
#   calibrated_network_output: KPIPreparation.CalibratedNetworkOutput.Calibrated V/C (V/C_{Period,Link})
#     Field dimension Period: ['AM', 'PM', 'MD', 'OV']
#   Constant Reliable Threshold: ReliableThreshold
#   calibrated_network_output: KPIPreparation.CalibratedNetworkOutput.Calibrated Truck VMT (CalibratedTruckVMT_{Period,Link})
#     Field dimension Period: ['AM', 'PM', 'MD', 'OV']
#   scenario_links: ScenarioUpstream.ScenarioLinks.Facility Type (FacilityType_{Link})
#   Output geography: PreprocessedConstants.BaseHighwayLinks; use table-schema joins for aggregation
#   Output geography: PreprocessedConstants.Corridors; use table-schema joins for aggregation
#   Output geography: PreprocessedConstants.SubRegions; use table-schema joins for aggregation
# Expected output files:
#   data/kpis/<scenario>/Links/90_truck_travel_time_reliability_tttr_on_nhs.parquet
#   data/kpis/<scenario>/Corridors/90_truck_travel_time_reliability_tttr_on_nhs.parquet
#   data/kpis/<scenario>/SubRegions/90_truck_travel_time_reliability_tttr_on_nhs.parquet
#   data/kpis/<scenario>/Region/90_truck_travel_time_reliability_tttr_on_nhs.parquet

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

KPI_NAME = '90_truck_travel_time_reliability_tttr_on_nhs'
KPI_ID = 'kpi-67afe44f-e180-4199-9ef0-a3cb0be4dccb'
SCENARIO_TYPE = 'Scenario'


def validate(context: RunContext) -> dict[str, object]:
    # calibrated_network_output = validate_table(context, 'KPIPreparation', 'CalibratedNetworkOutput')
    # reliable_threshold = get_constant('Reliable Threshold')
    # scenario_links = validate_table(context, 'ScenarioUpstream', 'ScenarioLinks')
    # period = get_domain('Period')
    # facility_type = get_domain('Facility Type')
    # base_highway_links = validate_table(context, 'PreprocessedConstants', 'BaseHighwayLinks')
    # corridors = validate_table(context, 'PreprocessedConstants', 'Corridors')
    # sub_regions = validate_table(context, 'PreprocessedConstants', 'SubRegions')
    # return {
    #     'calibrated_network_output': calibrated_network_output,
    #     'reliable_threshold': reliable_threshold,
    #     'scenario_links': scenario_links,
    #     'period': period,
    #     'facility_type': facility_type,
    #     'base_highway_links': base_highway_links,
    #     'corridors': corridors,
    #     'sub_regions': sub_regions,
    # }
    raise NotImplementedError(f'{KPI_NAME}: implement validate')


def process(
    calibrated_network_output: pd.DataFrame,
    reliable_threshold: object,
    scenario_links: pd.DataFrame,
    period: list[str],
    facility_type: list[str],
    base_highway_links: pd.DataFrame,
    corridors: pd.DataFrame,
    sub_regions: pd.DataFrame,
) -> dict[str, pd.DataFrame]:
    # Formula reference (processing is intentionally left blank):
    # TruckVMTWeight_{Period,Link} = \begin{cases}
    #     CalibratedTruckVMT_{Period,Link}, & \text{if }FacilityType_{Link}\in\{Interstate, NonInterstateNHS\}\\
    #     0, & \text{otherwise}
    #   \end{cases}
    # IsReliable_{Period,Link} = [V/C_{Period,Link} < ReliableThreshold]
    # TODO: Implement processing from the inputs above.
    # Suggested output structure: one geography row, one column per option combination.
    # output_columns = [
    #     'truck_travel_time_reliability_tttr_on_nhs' + '_' + '_'.join(snake_case(str(v)) for v in options)
    #     for options in product(period)
    # ]
    # link: basic unit;
    # link_index = base_highway_links.index.rename('link_id')
    # link_output = pd.DataFrame(index=link_index, columns=output_columns)
    # corridor: aggregation; Weighted average by VMT
    # \frac{\sum_{Link \in Corridor}IsReliable_{Period,Link}\times TruckVMTWeight_{Period,Link}}{\sum_{Link \in Corridor}TruckVMTWeight_{Period,Link}}
    # corridor_index = corridors.index.rename('corridor_id')
    # corridor_output = pd.DataFrame(index=corridor_index, columns=output_columns)
    # subRegion: aggregation; % length reliable
    # \frac{\sum_{Link \in SubRegion}IsReliable_{Period,Link}\times TruckVMTWeight_{Period,Link}}{\sum_{Link \in SubRegion}TruckVMTWeight_{Period,Link}}
    # sub_region_index = sub_regions.index.rename('subregion_id')
    # sub_region_output = pd.DataFrame(index=sub_region_index, columns=output_columns)
    # region: aggregation; % length reliable
    # \frac{\sum_{Link \in Region}IsReliable_{Period,Link}\times TruckVMTWeight_{Period,Link}}{\sum_{Link \in Region}TruckVMTWeight_{Period,Link}}
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
