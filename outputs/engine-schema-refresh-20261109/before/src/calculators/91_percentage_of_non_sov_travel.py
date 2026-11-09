# KPI 91: Percentage of Non-SOV Travel
# ID: kpi-697d828e-2bcb-43a5-8c73-da7d35c560f8
# Group: Scenario
# Unit: %
# Required sources:
#   skimmed_zones: ScenarioUpstream.SkimmedZones.Origin TAZ ID (OriginTAZID_{SkimRow})
#   skimmed_zones: ScenarioUpstream.SkimmedZones.Occupancy Mode (OccupancyMode_{SkimRow})
#   skimmed_zones: ScenarioUpstream.SkimmedZones.Period Trip Count (PeriodTripCount_{SkimRow})
#   Output geography: PreprocessedConstants.TAZs; use table-schema joins for aggregation
#   Output geography: PreprocessedConstants.SubRegions; use table-schema joins for aggregation
# Expected output files:
#   data/kpis/<scenario>/TAZs/91_percentage_of_non_sov_travel.parquet
#   data/kpis/<scenario>/SubRegions/91_percentage_of_non_sov_travel.parquet
#   data/kpis/<scenario>/Region/91_percentage_of_non_sov_travel.parquet

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

KPI_NAME = '91_percentage_of_non_sov_travel'
KPI_ID = 'kpi-697d828e-2bcb-43a5-8c73-da7d35c560f8'
SCENARIO_TYPE = 'Scenario'


def validate(context: RunContext) -> dict[str, object]:
    # skimmed_zones = validate_table(context, 'ScenarioUpstream', 'SkimmedZones')
    # occupancy_mode = get_domain('Occupancy Mode')
    # ta_zs = validate_table(context, 'PreprocessedConstants', 'TAZs')
    # sub_regions = validate_table(context, 'PreprocessedConstants', 'SubRegions')
    # return {
    #     'skimmed_zones': skimmed_zones,
    #     'occupancy_mode': occupancy_mode,
    #     'ta_zs': ta_zs,
    #     'sub_regions': sub_regions,
    # }
    raise NotImplementedError(f'{KPI_NAME}: implement validate')


def process(
    skimmed_zones: pd.DataFrame,
    occupancy_mode: list[str],
    ta_zs: pd.DataFrame,
    sub_regions: pd.DataFrame,
) -> dict[str, pd.DataFrame]:
    # Formula reference (processing is intentionally left blank):
    # Filter_{TAZ} = (OriginTAZID_{SkimRow}=idOf(TAZ))\bigcap (OccupancyMode_{SkimRow}\neq SOV)
    # NonSOVTrips_{TAZ} = \frac{\sum_{SkimRow|Filter_{TAZ}}PeriodTripCount_{SkimRow}}{\sum_{SkimRow|OriginTAZID_{SkimRow}=idOf(TAZ)}PeriodTripCount_{SkimRow}}
    # TODO: Implement processing from the inputs above.
    # Suggested output structure: one geography row, one column per option combination.
    # output_columns = ['percentage_of_non_sov_travel']
    # taz: basic unit;
    # taz_index = ta_zs.index.rename('taz_id')
    # taz_output = pd.DataFrame(index=taz_index, columns=output_columns)
    # subRegion: aggregation; Sum, weighted by VMT or PMT
    # \frac{\sum_{SkimRow|OccupancyMode_{SkimRow}\neq SOV}PeriodTripCount_{SkimRow}|_{(OriginTAZID_{SkimRow}\in \{TAZIDs\}_{SubRegion})}}{\sum_{SkimRow}PeriodTripCount_{SkimRow}|_{OriginTAZID_{SkimRow}\in \{TAZIDs\}_{SubRegion}}}
    # sub_region_index = sub_regions.index.rename('subregion_id')
    # sub_region_output = pd.DataFrame(index=sub_region_index, columns=output_columns)
    # region: aggregation; Sum, weighted by VMT or PMT
    # \frac{\sum_{SkimRow|OccupancyMode_{SkimRow}\neq SOV}PeriodTripCount_{SkimRow}}{\sum_{SkimRow}PeriodTripCount_{SkimRow}}
    # region_index = pd.Index(['Region'], name='region_id')
    # region_output = pd.DataFrame(index=region_index, columns=output_columns)
    # return {
    #     'taz': taz_output,
    #     'subRegion': sub_region_output,
    #     'region': region_output,
    # }
    raise NotImplementedError(f'{KPI_NAME}: implement process')


def calculate(context: RunContext) -> None:
    # outputs = process(**validate(context))
    # for scale, output in outputs.items():
    #     writer.write_table(context, KPI_NAME, output, path='kpis', scale=scale)
    raise NotImplementedError(f'{KPI_NAME}: implement calculate')
