# KPI 39: Person Hours of Delay (PHD) Per Mile
# ID: kpi-e5773a78-5c8b-43ed-b9fe-8cffd46ce924
# Group: Scenario
# Unit: annual person hours per mile
# Required sources:
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
#   data/kpis/<scenario>/Links/39_person_hours_of_delay_phd_per_mile.parquet
#   data/kpis/<scenario>/Corridors/39_person_hours_of_delay_phd_per_mile.parquet
#   data/kpis/<scenario>/SubRegions/39_person_hours_of_delay_phd_per_mile.parquet
#   data/kpis/<scenario>/Region/39_person_hours_of_delay_phd_per_mile.parquet

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

KPI_NAME = '39_person_hours_of_delay_phd_per_mile'
KPI_ID = 'kpi-e5773a78-5c8b-43ed-b9fe-8cffd46ce924'
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
    # FreeFlowHours_{Period,Link} = \frac{DistanceMiles_{Link}}{ FreeFlowSpeedMPH_{Link}}
    # DelayHours_{Period,Link} = \max(\frac{CalibratedTravelMinutes_{Period,Link}}{60} - FreeFlowHours_{Period,Link},0)
    # PHD_{Link} = 365 \times \sum_{Period} (CalibratedVolume_{Period,Link}\times Occupancy_{Period,Link} \times DelayHours_{Period,Link})
    # PHDPerMile_{Link} = \frac{PHD_{Link}}{DistanceMiles_{Link}}
    # TODO: Implement processing from the inputs above.
    # Suggested output structure: one geography row, one column per option combination.
    # output_columns = ['person_hours_of_delay_phd_per_mile']
    # link: basic unit;
    # link_index = base_highway_links.index.rename('link_id')
    # link_output = pd.DataFrame(index=link_index, columns=output_columns)
    # corridor: aggregation; Sum
    # \frac{5280 \times \sum_{Link\in Corridor}PHD_{Link}}{\sum_{Link\in Corridor} DistanceMiles_{Link}}
    # corridor_index = corridors.index.rename('corridor_id')
    # corridor_output = pd.DataFrame(index=corridor_index, columns=output_columns)
    # subRegion: aggregation; Sum
    # \frac{5280 \times \sum_{Link\in SubRegion}PHD_{Link}}{\sum_{Link\in SubRegion} DistanceMiles_{Link}}
    # sub_region_index = sub_regions.index.rename('subregion_id')
    # sub_region_output = pd.DataFrame(index=sub_region_index, columns=output_columns)
    # region: aggregation; Sum
    # \frac{5280 \times \sum_{Link\in Region}PHD_{Link}}{\sum_{Link\in Region} DistanceMiles_{Link}}
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
