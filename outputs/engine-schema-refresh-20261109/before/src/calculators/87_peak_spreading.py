# KPI 87: Peak Spreading
# ID: kpi-62669771-49ff-4794-ba08-5bfd9d2ec1a4
# Group: Scenario
# Unit: %
# Required sources:
#   skimmed_zones: ScenarioUpstream.SkimmedZones.Period (Period_{SkimRow})
#   skimmed_zones: ScenarioUpstream.SkimmedZones.Period Trip Count (PeriodTripCount_{SkimRow})
#   skimmed_zones: ScenarioUpstream.SkimmedZones.Origin TAZ ID (OriginTAZID_{SkimRow})
#   Output geography: PreprocessedConstants.TAZs; use table-schema joins for aggregation
#   Output geography: PreprocessedConstants.SubRegions; use table-schema joins for aggregation
# Expected output files:
#   data/kpis/<scenario>/TAZs/87_peak_spreading.parquet
#   data/kpis/<scenario>/SubRegions/87_peak_spreading.parquet
#   data/kpis/<scenario>/Region/87_peak_spreading.parquet

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

KPI_NAME = '87_peak_spreading'
KPI_ID = 'kpi-62669771-49ff-4794-ba08-5bfd9d2ec1a4'
SCENARIO_TYPE = 'Scenario'


def validate(context: RunContext) -> dict[str, object]:
    # skimmed_zones = validate_table(context, 'ScenarioUpstream', 'SkimmedZones')
    # period = get_domain('Period')
    # ta_zs = validate_table(context, 'PreprocessedConstants', 'TAZs')
    # sub_regions = validate_table(context, 'PreprocessedConstants', 'SubRegions')
    # return {
    #     'skimmed_zones': skimmed_zones,
    #     'period': period,
    #     'ta_zs': ta_zs,
    #     'sub_regions': sub_regions,
    # }
    raise NotImplementedError(f'{KPI_NAME}: implement validate')


def process(
    skimmed_zones: pd.DataFrame,
    period: list[str],
    ta_zs: pd.DataFrame,
    sub_regions: pd.DataFrame,
) -> dict[str, pd.DataFrame]:
    # Formula reference (processing is intentionally left blank):
    # PeakTripsShare_{TAZ} = \frac{\sum_{SkimRow| OriginTAZID_{SkimRow}=idOf(TAZ)\bigcap Period_{SkimRow}\in \{AM, PM\}}PeriodTripCount_{SkimRow}}{\sum_{SkimRow| OriginTAZID_{SkimRow}=idOf(TAZ)}PeriodTripCount_{SkimRow}}
    # TODO: Implement processing from the inputs above.
    # Suggested output structure: one geography row, one column per option combination.
    # output_columns = ['peak_spreading']
    # taz: basic unit;
    # taz_index = ta_zs.index.rename('taz_id')
    # taz_output = pd.DataFrame(index=taz_index, columns=output_columns)
    # subRegion: aggregation;
    # \frac{\sum_{SkimRow| OriginTAZID_{SkimRow}\in \{TAZIDs\}_{SubRegion}\bigcap Period_{SkimRow}\in \{AM, PM\}}PeriodTripCount_{SkimRow}}{\sum_{SkimRow| OriginTAZID_{SkimRow}\in \{TAZIDs\}_{SubRegion}}PeriodTripCount_{SkimRow}}
    # sub_region_index = sub_regions.index.rename('subregion_id')
    # sub_region_output = pd.DataFrame(index=sub_region_index, columns=output_columns)
    # region: aggregation;
    # \frac{\sum_{SkimRow|Period_{SkimRow}\in \{AM, PM\}}PeriodTripCount_{SkimRow}}{\sum_{SkimRow}PeriodTripCount_{SkimRow}}
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
