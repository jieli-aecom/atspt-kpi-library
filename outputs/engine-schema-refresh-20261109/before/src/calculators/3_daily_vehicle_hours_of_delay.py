# KPI 3: Daily Vehicle Hours of Delay
# ID: kpi-71ef3b7c-cd93-43b8-8ffa-95245c975e71
# Group: Scenario
# Unit: vehicle hours
# Required sources:
#   calibrated_network_output: KPIPreparation.CalibratedNetworkOutput.Total Calibrated Daily Volume (TotalCalibratedDailyVolume_{Link})
#   calibrated_network_output: KPIPreparation.CalibratedNetworkOutput.Calibrated Volume (CalibratedVolume_{Period,Link})
#     Field dimension Period: ['AM', 'PM', 'MD', 'OV']
#   calibrated_network_output: KPIPreparation.CalibratedNetworkOutput.Calibrated Travel Minutes (CalibratedTravelMinutes_{Period,Link})
#     Field dimension Period: ['AM', 'PM', 'MD', 'OV']
#   scenario_links: ScenarioUpstream.ScenarioLinks.Free Flow Speed MPH (FreeFlowSpeedMPH_{Link})
#   scenario_links: ScenarioUpstream.ScenarioLinks.Distance Miles (DistanceMiles_{Link})
#   Output geography: PreprocessedConstants.BaseHighwayLinks; use table-schema joins for aggregation
#   Output geography: PreprocessedConstants.Corridors; use table-schema joins for aggregation
#   Output geography: PreprocessedConstants.SubRegions; use table-schema joins for aggregation
# Expected output files:
#   data/kpis/<scenario>/Links/3_daily_vehicle_hours_of_delay.parquet
#   data/kpis/<scenario>/Corridors/3_daily_vehicle_hours_of_delay.parquet
#   data/kpis/<scenario>/SubRegions/3_daily_vehicle_hours_of_delay.parquet
#   data/kpis/<scenario>/Region/3_daily_vehicle_hours_of_delay.parquet

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

KPI_NAME = '3_daily_vehicle_hours_of_delay'
KPI_ID = 'kpi-71ef3b7c-cd93-43b8-8ffa-95245c975e71'
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
    # VHT_{Link} = \frac{1}{60}\times \sum_{Period}(CalibratedVolume_{Period,Link}\times CalibratedTravelMinutes_{Period,Link})
    # FreeFlowVHT_{Link} = \frac{ DistanceMiles_{Link}}{ FreeFlowSpeedMPH_{Link}}\times TotalCalibratedDailyVolume_{Link}
    # VHD_{Link} = VHT_{Link}-FreeFlowVHT_{Link}
    # TODO: Implement processing from the inputs above.
    # Suggested output structure: one geography row, one column per option combination.
    # output_columns = ['daily_vehicle_hours_of_delay']
    # link: basic unit;
    # link_index = base_highway_links.index.rename('link_id')
    # link_output = pd.DataFrame(index=link_index, columns=output_columns)
    # corridor: aggregation; Average, weighted by volume
    # \sum_{Link\in Corridor}VHD_{Link}
    # corridor_index = corridors.index.rename('corridor_id')
    # corridor_output = pd.DataFrame(index=corridor_index, columns=output_columns)
    # subRegion: aggregation; Average, weighted by volume
    # \sum_{Link\in SubRegion}VHD_{Link}
    # sub_region_index = sub_regions.index.rename('subregion_id')
    # sub_region_output = pd.DataFrame(index=sub_region_index, columns=output_columns)
    # region: aggregation; Average, weighted by volume
    # \sum_{Link\in Region}VHD_{Link}
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
