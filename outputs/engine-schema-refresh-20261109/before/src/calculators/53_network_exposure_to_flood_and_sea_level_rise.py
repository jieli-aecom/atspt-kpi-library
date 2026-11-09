# KPI 53: Network Exposure to Flood and Sea Level Rise
# ID: kpi-337fe42d-c9d4-45a7-9ed2-6dcc641d6e9a
# Group: Scenario
# Unit:
# Required sources:
#   scenario_links: ScenarioUpstream.ScenarioLinks.Is In 100 Year Flood Plain (IsIn100YearFloodPlain_{Link})
#   scenario_links: ScenarioUpstream.ScenarioLinks.Distance Miles (DistanceMiles_{Link})
#   scenario_links: ScenarioUpstream.ScenarioLinks.Lanes Count (LanesCount_{Link})
#   Output geography: PreprocessedConstants.BaseHighwayLinks; use table-schema joins for aggregation
#   Output geography: PreprocessedConstants.Corridors; use table-schema joins for aggregation
#   Output geography: PreprocessedConstants.SubRegions; use table-schema joins for aggregation
# Expected output files:
#   data/kpis/<scenario>/Links/53_network_exposure_to_flood_and_sea_level_rise.parquet
#   data/kpis/<scenario>/Corridors/53_network_exposure_to_flood_and_sea_level_rise.parquet
#   data/kpis/<scenario>/SubRegions/53_network_exposure_to_flood_and_sea_level_rise.parquet
#   data/kpis/<scenario>/Region/53_network_exposure_to_flood_and_sea_level_rise.parquet
# Flood and sea level rise risk definition

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

KPI_NAME = '53_network_exposure_to_flood_and_sea_level_rise'
KPI_ID = 'kpi-337fe42d-c9d4-45a7-9ed2-6dcc641d6e9a'
SCENARIO_TYPE = 'Scenario'


def validate(context: RunContext) -> dict[str, object]:
    # scenario_links = validate_table(context, 'ScenarioUpstream', 'ScenarioLinks')
    # base_highway_links = validate_table(context, 'PreprocessedConstants', 'BaseHighwayLinks')
    # corridors = validate_table(context, 'PreprocessedConstants', 'Corridors')
    # sub_regions = validate_table(context, 'PreprocessedConstants', 'SubRegions')
    # return {
    #     'scenario_links': scenario_links,
    #     'base_highway_links': base_highway_links,
    #     'corridors': corridors,
    #     'sub_regions': sub_regions,
    # }
    raise NotImplementedError(f'{KPI_NAME}: implement validate')


def process(
    scenario_links: pd.DataFrame,
    base_highway_links: pd.DataFrame,
    corridors: pd.DataFrame,
    sub_regions: pd.DataFrame,
) -> dict[str, pd.DataFrame]:
    # Formula reference (processing is intentionally left blank):
    # ExposureLaneMiles_{Zone} = \sum_{Link\in Zone}(DistanceMiles_{Link}\times LanesCount_{Link}\times IsIn100YearFloodPlain_{Link})
    # TODO: Implement processing from the inputs above.
    # Suggested output structure: one geography row, one column per option combination.
    # output_columns = ['network_exposure_to_flood_and_sea_level_rise']
    # link: basic unit;
    # link_index = base_highway_links.index.rename('link_id')
    # link_output = pd.DataFrame(index=link_index, columns=output_columns)
    # corridor: basic unit;
    # corridor_index = corridors.index.rename('corridor_id')
    # corridor_output = pd.DataFrame(index=corridor_index, columns=output_columns)
    # subRegion: basic unit;
    # sub_region_index = sub_regions.index.rename('subregion_id')
    # sub_region_output = pd.DataFrame(index=sub_region_index, columns=output_columns)
    # region: basic unit;
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
