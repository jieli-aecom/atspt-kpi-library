# KPI 86: Total Commute Trips
# ID: kpi-38dbf59d-2451-4203-a6cc-70bb160a487b
# Group: Scenario
# Unit:
# Required sources:
#   skimmed_zones: ScenarioUpstream.SkimmedZones.Period HBW Trip Count (PeriodHBWTripCount_{SkimRow})
#   skimmed_zones: ScenarioUpstream.SkimmedZones.Origin TAZ ID (OriginTAZID_{SkimRow})
#   Output geography: PreprocessedConstants.TAZs; use table-schema joins for aggregation
#   Output geography: PreprocessedConstants.Corridors; use table-schema joins for aggregation
#   Output geography: PreprocessedConstants.SubRegions; use table-schema joins for aggregation
# Expected output files:
#   data/kpis/<scenario>/TAZs/86_total_commute_trips.parquet
#   data/kpis/<scenario>/Corridors/86_total_commute_trips.parquet
#   data/kpis/<scenario>/SubRegions/86_total_commute_trips.parquet
#   data/kpis/<scenario>/Region/86_total_commute_trips.parquet

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

KPI_NAME = '86_total_commute_trips'
KPI_ID = 'kpi-38dbf59d-2451-4203-a6cc-70bb160a487b'
SCENARIO_TYPE = 'Scenario'


def validate(context: RunContext) -> dict[str, object]:
    # skimmed_zones = validate_table(context, 'ScenarioUpstream', 'SkimmedZones')
    # ta_zs = validate_table(context, 'PreprocessedConstants', 'TAZs')
    # corridors = validate_table(context, 'PreprocessedConstants', 'Corridors')
    # sub_regions = validate_table(context, 'PreprocessedConstants', 'SubRegions')
    # return {
    #     'skimmed_zones': skimmed_zones,
    #     'ta_zs': ta_zs,
    #     'corridors': corridors,
    #     'sub_regions': sub_regions,
    # }
    raise NotImplementedError(f'{KPI_NAME}: implement validate')


def process(
    skimmed_zones: pd.DataFrame,
    ta_zs: pd.DataFrame,
    corridors: pd.DataFrame,
    sub_regions: pd.DataFrame,
) -> dict[str, pd.DataFrame]:
    # Formula reference (processing is intentionally left blank):
    # CommuteTrips_{TAZ} = \sum_{SkimRow|OriginTAZID_{SkimRow}=idOf(TAZ)}PeriodHBWTripCount_{SkimRow}
    # TODO: Implement processing from the inputs above.
    # Suggested output structure: one geography row, one column per option combination.
    # output_columns = ['total_commute_trips']
    # taz: basic unit;
    # taz_index = ta_zs.index.rename('taz_id')
    # taz_output = pd.DataFrame(index=taz_index, columns=output_columns)
    # corridor: aggregation;
    # \sum_{TAZ \in Corridor}CommuteTrips_{TAZ}
    # corridor_index = corridors.index.rename('corridor_id')
    # corridor_output = pd.DataFrame(index=corridor_index, columns=output_columns)
    # subRegion: aggregation;
    # \sum_{TAZ \in SubRegion}CommuteTrips_{TAZ}
    # sub_region_index = sub_regions.index.rename('subregion_id')
    # sub_region_output = pd.DataFrame(index=sub_region_index, columns=output_columns)
    # region: aggregation;
    # \sum_{TAZ \in Region}CommuteTrips_{TAZ}
    # region_index = pd.Index(['Region'], name='region_id')
    # region_output = pd.DataFrame(index=region_index, columns=output_columns)
    # return {
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
