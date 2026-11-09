# KPI 47: Roadway Capacity Per 1,000 Capita
# ID: kpi-9207fd17-8f4e-4d03-a60a-088a2a272ebd
# Group: Scenario
# Unit: volume per 1,000 residents
# Required sources:
#   scenario_links: ScenarioUpstream.ScenarioLinks.Capacity (Capacity_{Link})
#   cell_land_use: ScenarioUpstream.CellLandUse.Population (Population_{Cell})
#   Output geography: PreprocessedConstants.SubRegions; use table-schema joins for aggregation
# Expected output files:
#   data/kpis/<scenario>/SubRegions/47_roadway_capacity_per_1_000_capita.parquet
#   data/kpis/<scenario>/Region/47_roadway_capacity_per_1_000_capita.parquet

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

KPI_NAME = '47_roadway_capacity_per_1_000_capita'
KPI_ID = 'kpi-9207fd17-8f4e-4d03-a60a-088a2a272ebd'
SCENARIO_TYPE = 'Scenario'


def validate(context: RunContext) -> dict[str, object]:
    # scenario_links = validate_table(context, 'ScenarioUpstream', 'ScenarioLinks')
    # cell_land_use = validate_table(context, 'ScenarioUpstream', 'CellLandUse')
    # sub_regions = validate_table(context, 'PreprocessedConstants', 'SubRegions')
    # return {
    #     'scenario_links': scenario_links,
    #     'cell_land_use': cell_land_use,
    #     'sub_regions': sub_regions,
    # }
    raise NotImplementedError(f'{KPI_NAME}: implement validate')


def process(
    scenario_links: pd.DataFrame,
    cell_land_use: pd.DataFrame,
    sub_regions: pd.DataFrame,
) -> dict[str, pd.DataFrame]:
    # Formula reference (processing is intentionally left blank):
    # CapacityPerCapita_{Zone} = \frac{\sum_{Link \in Zone}Capacity_{Link}}{1000\times \sum_{Cell \in Zone} Population_{Cell}}
    # TODO: Implement processing from the inputs above.
    # Suggested output structure: one geography row, one column per option combination.
    # output_columns = ['roadway_capacity_per_1_000_capita']
    # subRegion: basic unit;
    # sub_region_index = sub_regions.index.rename('subregion_id')
    # sub_region_output = pd.DataFrame(index=sub_region_index, columns=output_columns)
    # region: basic unit;
    # region_index = pd.Index(['Region'], name='region_id')
    # region_output = pd.DataFrame(index=region_index, columns=output_columns)
    # return {
    #     'subRegion': sub_region_output,
    #     'region': region_output,
    # }
    raise NotImplementedError(f'{KPI_NAME}: implement process')


def calculate(context: RunContext) -> None:
    # outputs = process(**validate(context))
    # for scale, output in outputs.items():
    #     writer.write_table(context, KPI_NAME, output, path='kpis', scale=scale)
    raise NotImplementedError(f'{KPI_NAME}: implement calculate')
