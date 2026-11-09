# KPI 49: Connectivity Index
# ID: kpi-88b8dc1a-6bd8-4dea-b22f-7eb22a13a344
# Group: Scenario
# Unit: index
# Required sources:
#   scenario_links: ScenarioUpstream.ScenarioLinks.Node 1 ID (Node1_{Link})
#   scenario_links: ScenarioUpstream.ScenarioLinks.Node 2 ID (Node2_{Link})
#   scenario_links: ScenarioUpstream.ScenarioLinks.Link ID (LinkID_{Link})
#   Output geography: PreprocessedConstants.SubRegions; use table-schema joins for aggregation
# Expected output files:
#   data/kpis/<scenario>/SubRegions/49_connectivity_index.parquet
#   data/kpis/<scenario>/Region/49_connectivity_index.parquet

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

KPI_NAME = '49_connectivity_index'
KPI_ID = 'kpi-88b8dc1a-6bd8-4dea-b22f-7eb22a13a344'
SCENARIO_TYPE = 'Scenario'


def validate(context: RunContext) -> dict[str, object]:
    # scenario_links = validate_table(context, 'ScenarioUpstream', 'ScenarioLinks')
    # sub_regions = validate_table(context, 'PreprocessedConstants', 'SubRegions')
    # return {
    #     'scenario_links': scenario_links,
    #     'sub_regions': sub_regions,
    # }
    raise NotImplementedError(f'{KPI_NAME}: implement validate')


def process(
    scenario_links: pd.DataFrame,
    sub_regions: pd.DataFrame,
) -> dict[str, pd.DataFrame]:
    # Formula reference (processing is intentionally left blank):
    # LinkCount_{Zone} = \Vert \{LinkID_{Link} \mid Link \in Zone\} \Vert
    # NodeCount_{Zone} = \Vert \{Node1_{Link} \mid Link \in Zone\} \bigcup \{Node2_{Link} \mid Link \in Zone\}  \Vert
    # ConnectivityIndex = \frac{LinkCount_{Zone}}{NodeCount_{Zone}}
    # TODO: Implement processing from the inputs above.
    # Suggested output structure: one geography row, one column per option combination.
    # output_columns = ['connectivity_index']
    # subRegion: basic unit; Average, weighted by area
    # sub_region_index = sub_regions.index.rename('subregion_id')
    # sub_region_output = pd.DataFrame(index=sub_region_index, columns=output_columns)
    # region: basic unit; Average, weighted by area
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
