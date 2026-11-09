# KPI 44: Miles of High Risk Network (HRN)
# ID: kpi-1433616f-971c-48c6-b41b-b1737e55ac26
# Group: Scenario
# Unit: miles
# Required sources:
#   scenario_links: ScenarioUpstream.ScenarioLinks.Is HRN (IsHRN_{Link})
#   scenario_links: ScenarioUpstream.ScenarioLinks.Distance Miles (DistanceMiles_{Link})
#   Output geography: PreprocessedConstants.BaseHighwayLinks; use table-schema joins for aggregation
#   Output geography: ScenarioUpstream.Projects; use table-schema joins for aggregation
#   Output geography: PreprocessedConstants.TAZs; use table-schema joins for aggregation
#   Output geography: PreprocessedConstants.Corridors; use table-schema joins for aggregation
#   Output geography: PreprocessedConstants.SubRegions; use table-schema joins for aggregation
# Expected output files:
#   data/kpis/<scenario>/Links/44_miles_of_high_risk_network_hrn.parquet
#   data/kpis/<scenario>/Projects/44_miles_of_high_risk_network_hrn.parquet
#   data/kpis/<scenario>/TAZs/44_miles_of_high_risk_network_hrn.parquet
#   data/kpis/<scenario>/Corridors/44_miles_of_high_risk_network_hrn.parquet
#   data/kpis/<scenario>/SubRegions/44_miles_of_high_risk_network_hrn.parquet
#   data/kpis/<scenario>/Region/44_miles_of_high_risk_network_hrn.parquet

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

KPI_NAME = '44_miles_of_high_risk_network_hrn'
KPI_ID = 'kpi-1433616f-971c-48c6-b41b-b1737e55ac26'
SCENARIO_TYPE = 'Scenario'


def validate(context: RunContext) -> dict[str, object]:
    # scenario_links = validate_table(context, 'ScenarioUpstream', 'ScenarioLinks')
    # base_highway_links = validate_table(context, 'PreprocessedConstants', 'BaseHighwayLinks')
    # projects = validate_table(context, 'ScenarioUpstream', 'Projects')
    # ta_zs = validate_table(context, 'PreprocessedConstants', 'TAZs')
    # corridors = validate_table(context, 'PreprocessedConstants', 'Corridors')
    # sub_regions = validate_table(context, 'PreprocessedConstants', 'SubRegions')
    # return {
    #     'scenario_links': scenario_links,
    #     'base_highway_links': base_highway_links,
    #     'projects': projects,
    #     'ta_zs': ta_zs,
    #     'corridors': corridors,
    #     'sub_regions': sub_regions,
    # }
    raise NotImplementedError(f'{KPI_NAME}: implement validate')


def process(
    scenario_links: pd.DataFrame,
    base_highway_links: pd.DataFrame,
    projects: pd.DataFrame,
    ta_zs: pd.DataFrame,
    corridors: pd.DataFrame,
    sub_regions: pd.DataFrame,
) -> dict[str, pd.DataFrame]:
    # Formula reference (processing is intentionally left blank):
    # HRNMiles_{Link} = DistanceMiles_{Link}\times[IsHRN_{Link}]
    # TODO: Implement processing from the inputs above.
    # Suggested output structure: one geography row, one column per option combination.
    # output_columns = ['miles_of_high_risk_network_hrn']
    # link: basic unit;
    # link_index = base_highway_links.index.rename('link_id')
    # link_output = pd.DataFrame(index=link_index, columns=output_columns)
    # project: aggregation;
    # \sum_{SubRegion \in Project}HRNMiles_{Link}
    # project_index = projects.index.rename('project_id')
    # project_output = pd.DataFrame(index=project_index, columns=output_columns)
    # taz: aggregation;
    # \sum_{Link \in TAZ}HRNMiles_{Link}
    # taz_index = ta_zs.index.rename('taz_id')
    # taz_output = pd.DataFrame(index=taz_index, columns=output_columns)
    # corridor: aggregation;
    # \sum_{Project \in Corridor}HRNMiles_{Link}
    # corridor_index = corridors.index.rename('corridor_id')
    # corridor_output = pd.DataFrame(index=corridor_index, columns=output_columns)
    # subRegion: aggregation;
    # \sum_{Link \in SubRegion}HRNMiles_{Link}
    # sub_region_index = sub_regions.index.rename('subregion_id')
    # sub_region_output = pd.DataFrame(index=sub_region_index, columns=output_columns)
    # region: aggregation;
    # \sum_{Project \in Region}HRNMiles_{Link}
    # region_index = pd.Index(['Region'], name='region_id')
    # region_output = pd.DataFrame(index=region_index, columns=output_columns)
    # return {
    #     'link': link_output,
    #     'project': project_output,
    #     'taz': taz_output,
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
