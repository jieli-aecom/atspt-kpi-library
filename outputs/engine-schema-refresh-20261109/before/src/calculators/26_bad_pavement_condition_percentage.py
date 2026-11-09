# KPI 26: Bad Pavement Condition Percentage
# ID: kpi-74032d9e-1cec-4c13-a45b-7f78b9451c1c
# Group: Base Year
# Unit: %
# Required sources:
#   base_highway_links: PreprocessedConstants.BaseHighwayLinks.Base Year Distance Miles (BaseYearDistanceMiles_{Link})
#   base_highway_links: PreprocessedConstants.BaseHighwayLinks.Base Year Lanes Count (LanesCount_{Link})
#   base_highway_links: PreprocessedConstants.BaseHighwayLinks.Base Year Pavement Score (PavementScore_{Link})
#   Constant Bad Pavement Threshold: BadPavementThreshold
#   Output geography: PreprocessedConstants.BaseHighwayLinks; use table-schema joins for aggregation
#   Output geography: PreprocessedConstants.TAZs; use table-schema joins for aggregation
#   Output geography: PreprocessedConstants.Corridors; use table-schema joins for aggregation
#   Output geography: PreprocessedConstants.SubRegions; use table-schema joins for aggregation
# Expected output files:
#   data/kpis/<scenario>/Links/26_bad_pavement_condition_percentage.parquet
#   data/kpis/<scenario>/TAZs/26_bad_pavement_condition_percentage.parquet
#   data/kpis/<scenario>/Corridors/26_bad_pavement_condition_percentage.parquet
#   data/kpis/<scenario>/SubRegions/26_bad_pavement_condition_percentage.parquet
#   data/kpis/<scenario>/Region/26_bad_pavement_condition_percentage.parquet

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

KPI_NAME = '26_bad_pavement_condition_percentage'
KPI_ID = 'kpi-74032d9e-1cec-4c13-a45b-7f78b9451c1c'
SCENARIO_TYPE = 'Base Year'


def validate(context: RunContext) -> dict[str, object]:
    # base_highway_links = validate_table(context, 'PreprocessedConstants', 'BaseHighwayLinks')
    # bad_pavement_threshold = get_constant('Bad Pavement Threshold')
    # ta_zs = validate_table(context, 'PreprocessedConstants', 'TAZs')
    # corridors = validate_table(context, 'PreprocessedConstants', 'Corridors')
    # sub_regions = validate_table(context, 'PreprocessedConstants', 'SubRegions')
    # return {
    #     'base_highway_links': base_highway_links,
    #     'bad_pavement_threshold': bad_pavement_threshold,
    #     'ta_zs': ta_zs,
    #     'corridors': corridors,
    #     'sub_regions': sub_regions,
    # }
    raise NotImplementedError(f'{KPI_NAME}: implement validate')


def process(
    base_highway_links: pd.DataFrame,
    bad_pavement_threshold: object,
    ta_zs: pd.DataFrame,
    corridors: pd.DataFrame,
    sub_regions: pd.DataFrame,
) -> dict[str, pd.DataFrame]:
    # Formula reference (processing is intentionally left blank):
    # PavementLM_{Link} = BaseYearDistanceMiles_{Link}\times LanesCount_{Link}
    # Condition_{Link} = PavementScore_{Link}<BadPavementThreshold
    # Percentage_{Zone} = \frac{\sum_{Link \in Zone \bigcap Condition_{Link}} PavementLM_{Link}}{\sum_{Link\in Zone} PavementLM_{Link}}
    # TODO: Implement processing from the inputs above.
    # Suggested output structure: one geography row, one column per option combination.
    # output_columns = ['bad_pavement_condition_percentage']
    # link: basic unit;
    # link_index = base_highway_links.index.rename('link_id')
    # link_output = pd.DataFrame(index=link_index, columns=output_columns)
    # taz: basic unit;
    # taz_index = ta_zs.index.rename('taz_id')
    # taz_output = pd.DataFrame(index=taz_index, columns=output_columns)
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
