# KPI 16: Planning Time Index (Base Year)
# ID: kpi-124df446-7595-42ed-8c6e-77e25edb42e5
# Group: Base Year
# Unit: index
# Required sources:
#   base_highway_links: PreprocessedConstants.BaseHighwayLinks.Base Year HIN Percent (IsHighInjuryNetwork_{Link})
#   inrix: PreprocessedConstants.INRIX.Base Year Planning Time Index (BaseYearPlanningTimeIndex_{Link})
#   base_year_tdm: PreprocessedConstants.BaseYearTDM.Base Year Total Daily VMT (BaseYearTotalDailyVMT_{Link})
#   Output geography: PreprocessedConstants.BaseHighwayLinks; use table-schema joins for aggregation
#   Output geography: PreprocessedConstants.Corridors; use table-schema joins for aggregation
#   Output geography: PreprocessedConstants.SubRegions; use table-schema joins for aggregation
# Expected output files:
#   data/kpis/<scenario>/Links/16_planning_time_index_base_year.parquet
#   data/kpis/<scenario>/Corridors/16_planning_time_index_base_year.parquet
#   data/kpis/<scenario>/SubRegions/16_planning_time_index_base_year.parquet
#   data/kpis/<scenario>/Region/16_planning_time_index_base_year.parquet

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

KPI_NAME = '16_planning_time_index_base_year'
KPI_ID = 'kpi-124df446-7595-42ed-8c6e-77e25edb42e5'
SCENARIO_TYPE = 'Base Year'


def validate(context: RunContext) -> dict[str, object]:
    # base_highway_links = validate_table(context, 'PreprocessedConstants', 'BaseHighwayLinks')
    # inrix = validate_table(context, 'PreprocessedConstants', 'INRIX')
    # base_year_tdm = validate_table(context, 'PreprocessedConstants', 'BaseYearTDM')
    # corridors = validate_table(context, 'PreprocessedConstants', 'Corridors')
    # sub_regions = validate_table(context, 'PreprocessedConstants', 'SubRegions')
    # return {
    #     'base_highway_links': base_highway_links,
    #     'inrix': inrix,
    #     'base_year_tdm': base_year_tdm,
    #     'corridors': corridors,
    #     'sub_regions': sub_regions,
    # }
    raise NotImplementedError(f'{KPI_NAME}: implement validate')


def process(
    base_highway_links: pd.DataFrame,
    inrix: pd.DataFrame,
    base_year_tdm: pd.DataFrame,
    corridors: pd.DataFrame,
    sub_regions: pd.DataFrame,
) -> dict[str, pd.DataFrame]:
    # Formula reference (processing is intentionally left blank):
    # Direct from source
    # BaseYearPTI_{Link} = BaseYearPlanningTimeIndex_{Link}
    # TODO: Implement processing from the inputs above.
    # Suggested output structure: one geography row, one column per option combination.
    # output_columns = ['planning_time_index_base_year']
    # link: basic unit;
    # link_index = base_highway_links.index.rename('link_id')
    # link_output = pd.DataFrame(index=link_index, columns=output_columns)
    # corridor: aggregation; Avg, weighted by VMT
    # \frac{\sum_{Link \in Corridor}(BaseYearPTI_{Link} \times BaseYearTotalDailyVMT_{Link})}{\sum_{Link \in Corridor}BaseYearTotalDailyVMT_{Link}}
    # corridor_index = corridors.index.rename('corridor_id')
    # corridor_output = pd.DataFrame(index=corridor_index, columns=output_columns)
    # subRegion: aggregation; Avg, weighted by VMT
    # \frac{\sum_{Link \in SubRegion} (BaseYearPTI_{Link} \times BaseYearTotalDailyVMT_{Link})}{\sum_{Link \in SubRegion} BaseYearTotalDailyVMT_{Link}}
    # sub_region_index = sub_regions.index.rename('subregion_id')
    # sub_region_output = pd.DataFrame(index=sub_region_index, columns=output_columns)
    # region: aggregation; Avg, weighted by VMT
    # \frac{\sum_{Link \in Region} (BaseYearPTI_{Link} \times BaseYearTotalDailyVMT_{Link})}{\sum_{Link \in Region} BaseYearTotalDailyVMT_{Link}}
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
