# KPI 2: Level of Mobility
# ID: kpi-b7bf354f-02ba-4f25-a4ad-2eadedba2a96
# Group: Scenario
# Unit: level
# Required sources:
#   calibrated_network_output: KPIPreparation.CalibratedNetworkOutput.Calibrated V/C (V/C_{Period, Link})
#     Field dimension Period: ['AM', 'PM', 'MD', 'OV']
#   Lookup LevelOfMobilityLookup (LevelOfMobilityLookup())
#   calibrated_network_output: KPIPreparation.CalibratedNetworkOutput.Calibrated Volume (CalibratedVolume_{Period,Link})
#     Field dimension Period: ['AM', 'PM', 'MD', 'OV']
#   scenario_links: ScenarioUpstream.ScenarioLinks.Distance Miles (DistanceMiles_{Link})
#   Output geography: PreprocessedConstants.BaseHighwayLinks; use table-schema joins for aggregation
#   Output geography: PreprocessedConstants.Corridors; use table-schema joins for aggregation
#   Output geography: PreprocessedConstants.SubRegions; use table-schema joins for aggregation
# Expected output files:
#   data/kpis/<scenario>/Links/2_level_of_mobility.parquet
#   data/kpis/<scenario>/Corridors/2_level_of_mobility.parquet
#   data/kpis/<scenario>/SubRegions/2_level_of_mobility.parquet
#   data/kpis/<scenario>/Region/2_level_of_mobility.parquet

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

KPI_NAME = '2_level_of_mobility'
KPI_ID = 'kpi-b7bf354f-02ba-4f25-a4ad-2eadedba2a96'
SCENARIO_TYPE = 'Scenario'


def validate(context: RunContext) -> dict[str, object]:
    # calibrated_network_output = validate_table(context, 'KPIPreparation', 'CalibratedNetworkOutput')
    # level_of_mobility_lookup = get_lookup('LevelOfMobilityLookup')
    # scenario_links = validate_table(context, 'ScenarioUpstream', 'ScenarioLinks')
    # period = get_domain('Period')
    # base_highway_links = validate_table(context, 'PreprocessedConstants', 'BaseHighwayLinks')
    # corridors = validate_table(context, 'PreprocessedConstants', 'Corridors')
    # sub_regions = validate_table(context, 'PreprocessedConstants', 'SubRegions')
    # return {
    #     'calibrated_network_output': calibrated_network_output,
    #     'level_of_mobility_lookup': level_of_mobility_lookup,
    #     'scenario_links': scenario_links,
    #     'period': period,
    #     'base_highway_links': base_highway_links,
    #     'corridors': corridors,
    #     'sub_regions': sub_regions,
    # }
    raise NotImplementedError(f'{KPI_NAME}: implement validate')


def process(
    calibrated_network_output: pd.DataFrame,
    level_of_mobility_lookup: Callable[..., object],
    scenario_links: pd.DataFrame,
    period: list[str],
    base_highway_links: pd.DataFrame,
    corridors: pd.DataFrame,
    sub_regions: pd.DataFrame,
) -> dict[str, pd.DataFrame]:
    # Formula reference (processing is intentionally left blank):
    # Level_{Link,Period} = LevelOfMobilityLookup(V/C_{Period, Link})
    # TODO: Implement processing from the inputs above.
    # Suggested output structure: one geography row, one column per option combination.
    # output_columns = [
    #     'level_of_mobility' + '_' + '_'.join(snake_case(str(v)) for v in options)
    #     for options in product(period)
    # ]
    # link: basic unit;
    # link_index = base_highway_links.index.rename('link_id')
    # link_output = pd.DataFrame(index=link_index, columns=output_columns)
    # corridor: aggregation; Avg, weighted by length
    # LevelOfMobilityLookup(\frac{\sum_{Link \in Corridor}V/C_{Period, Link}\times DistanceMiles_{Link}}{\sum_{Link \in Corridor}DistanceMiles_{Link}})
    # corridor_index = corridors.index.rename('corridor_id')
    # corridor_output = pd.DataFrame(index=corridor_index, columns=output_columns)
    # subRegion: aggregation; Avg, weighted by length
    # LevelOfMobilityLookup(\frac{\sum_{Link \in SubRegion}V/C_{Period, Link}\times DistanceMiles_{Link}}{\sum_{Link \in SubRegion}DistanceMiles_{Link}})
    # sub_region_index = sub_regions.index.rename('subregion_id')
    # sub_region_output = pd.DataFrame(index=sub_region_index, columns=output_columns)
    # region: aggregation; Avg, weighted by length
    # LevelOfMobilityLookup(\frac{\sum_{Link \in Region}V/C_{Period, Link}\times DistanceMiles_{Link}}{\sum_{Link \in Region}DistanceMiles_{Link}})
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
