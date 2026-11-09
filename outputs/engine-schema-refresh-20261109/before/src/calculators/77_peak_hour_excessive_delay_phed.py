# KPI 77: Peak-Hour Excessive Delay (PHED)
# ID: kpi-f1c8605e-837e-4535-8ea3-edb6b268a9a3
# Group: Scenario
# Unit: annual person hours
# Required sources:
#   calibrated_network_output: KPIPreparation.CalibratedNetworkOutput.Total Calibrated Daily VMT (TotalCalibratedDailyVMT_{Link})
#   calibrated_network_output: KPIPreparation.CalibratedNetworkOutput.Total Daily Truck VMT (TruckVMT_{Link})
#   calibrated_network_output: KPIPreparation.CalibratedNetworkOutput.Calibrated Travel Minutes (CalibratedTravelMinutes_{Period,Link})
#     Field dimension Period: ['AM', 'PM', 'MD', 'OV']
#   calibrated_network_output: KPIPreparation.CalibratedNetworkOutput.Calibrated Volume (CalibratedVolume_{Period,Link})
#     Field dimension Period: ['AM', 'PM', 'MD', 'OV']
#   scenario_links: ScenarioUpstream.ScenarioLinks.Free Flow Speed MPH (FreeFlowSpeedMPH_{Link})
#   network_output: ScenarioUpstream.NetworkOutput.Occupancy (Occupancy_{Period,Link})
#     Field dimension Period: ['AM', 'PM', 'MD', 'OV']
#   scenario_links: ScenarioUpstream.ScenarioLinks.Distance Miles (DistanceMiles_{Link})
#   Output geography: PreprocessedConstants.BaseHighwayLinks; use table-schema joins for aggregation
#   Output geography: PreprocessedConstants.Corridors; use table-schema joins for aggregation
#   Output geography: PreprocessedConstants.SubRegions; use table-schema joins for aggregation
# Expected output files:
#   data/kpis/<scenario>/Links/77_peak_hour_excessive_delay_phed.parquet
#   data/kpis/<scenario>/Corridors/77_peak_hour_excessive_delay_phed.parquet
#   data/kpis/<scenario>/SubRegions/77_peak_hour_excessive_delay_phed.parquet
#   data/kpis/<scenario>/Region/77_peak_hour_excessive_delay_phed.parquet

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

KPI_NAME = '77_peak_hour_excessive_delay_phed'
KPI_ID = 'kpi-f1c8605e-837e-4535-8ea3-edb6b268a9a3'
SCENARIO_TYPE = 'Scenario'


def validate(context: RunContext) -> dict[str, object]:
    # calibrated_network_output = validate_table(context, 'KPIPreparation', 'CalibratedNetworkOutput')
    # scenario_links = validate_table(context, 'ScenarioUpstream', 'ScenarioLinks')
    # network_output = validate_table(context, 'ScenarioUpstream', 'NetworkOutput')
    # period = get_domain('Period')
    # base_highway_links = validate_table(context, 'PreprocessedConstants', 'BaseHighwayLinks')
    # corridors = validate_table(context, 'PreprocessedConstants', 'Corridors')
    # sub_regions = validate_table(context, 'PreprocessedConstants', 'SubRegions')
    # return {
    #     'calibrated_network_output': calibrated_network_output,
    #     'scenario_links': scenario_links,
    #     'network_output': network_output,
    #     'period': period,
    #     'base_highway_links': base_highway_links,
    #     'corridors': corridors,
    #     'sub_regions': sub_regions,
    # }
    raise NotImplementedError(f'{KPI_NAME}: implement validate')


def process(
    calibrated_network_output: pd.DataFrame,
    scenario_links: pd.DataFrame,
    network_output: pd.DataFrame,
    period: list[str],
    base_highway_links: pd.DataFrame,
    corridors: pd.DataFrame,
    sub_regions: pd.DataFrame,
) -> dict[str, pd.DataFrame]:
    # Formula reference (processing is intentionally left blank):
    # ThresholdSpeedMPH_{Link} = \max(FreeFlowSpeedMPH_{Link}\times 60\%, 20)
    # ThresholdHours_{Period,Link} = \frac{DistanceMiles_{Link}}{ ThresholdSpeedMPH_{Link}}
    # EDHours_{Period,Link} = \max(\frac{CalibratedTravelMinutes_{Period,Link}}{60} - ThresholdHours_{Period,Link},0)
    # PHED_{Link} = 365 \times \sum_{Period \in \{AM,PM\}} (CalibratedVolume_{Period,Link}\times Occupancy_{Period,Link} \times EDHours_{Period,Link})
    # TODO: Implement processing from the inputs above.
    # Suggested output structure: one geography row, one column per option combination.
    # output_columns = ['peak_hour_excessive_delay_phed']
    # link: basic unit;
    # link_index = base_highway_links.index.rename('link_id')
    # link_output = pd.DataFrame(index=link_index, columns=output_columns)
    # corridor: aggregation; Sum
    # \sum_{Link \in Corridor}PHED_{Link}
    # corridor_index = corridors.index.rename('corridor_id')
    # corridor_output = pd.DataFrame(index=corridor_index, columns=output_columns)
    # subRegion: aggregation; Sum
    # \sum_{Link\in SubRegion}PHED_{Link}
    # sub_region_index = sub_regions.index.rename('subregion_id')
    # sub_region_output = pd.DataFrame(index=sub_region_index, columns=output_columns)
    # region: aggregation; Sum
    # \sum_{Link\in Region}PHED_{Link}
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
