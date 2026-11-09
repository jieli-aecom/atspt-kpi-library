# KPI 21: Historic Fatality Rate
# ID: kpi-2c49ec02-3e52-44c6-9906-727ecadc7acc
# Group: Base Year
# Unit: count per 100 million vehicle miles
# Required sources:
#   kpi_4_link: 4_historical_crashes_rate.parquet at link, current scenario (CrashRate_{CrashType,CrashSeverity,Link})
#   base_year_tdm: PreprocessedConstants.BaseYearTDM.Base Year Total Daily VMT (BaseYearTotalDailyVMT_{Link})
#   Output geography: PreprocessedConstants.BaseHighwayLinks; use table-schema joins for aggregation
#   Output geography: PreprocessedConstants.Cells; use table-schema joins for aggregation
#   Output geography: ScenarioUpstream.Projects; use table-schema joins for aggregation
#   Output geography: PreprocessedConstants.TAZs; use table-schema joins for aggregation
#   Output geography: PreprocessedConstants.Corridors; use table-schema joins for aggregation
#   Output geography: PreprocessedConstants.SubRegions; use table-schema joins for aggregation
# Expected output files:
#   data/kpis/<scenario>/Links/21_historic_fatality_rate.parquet
#   data/kpis/<scenario>/Cells/21_historic_fatality_rate.parquet
#   data/kpis/<scenario>/Projects/21_historic_fatality_rate.parquet
#   data/kpis/<scenario>/TAZs/21_historic_fatality_rate.parquet
#   data/kpis/<scenario>/Corridors/21_historic_fatality_rate.parquet
#   data/kpis/<scenario>/SubRegions/21_historic_fatality_rate.parquet
#   data/kpis/<scenario>/Region/21_historic_fatality_rate.parquet

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

KPI_NAME = '21_historic_fatality_rate'
KPI_ID = 'kpi-2c49ec02-3e52-44c6-9906-727ecadc7acc'
SCENARIO_TYPE = 'Base Year'


def validate(context: RunContext) -> dict[str, object]:
    # kpi_4_link = loader.load(context, '4_historical_crashes_rate', path='kpis', scale='link')
    # base_year_tdm = validate_table(context, 'PreprocessedConstants', 'BaseYearTDM')
    # crash_type = get_domain('Crash Type')
    # crash_severity = get_domain('Crash Severity')
    # base_highway_links = validate_table(context, 'PreprocessedConstants', 'BaseHighwayLinks')
    # cells = validate_table(context, 'PreprocessedConstants', 'Cells')
    # projects = validate_table(context, 'ScenarioUpstream', 'Projects')
    # ta_zs = validate_table(context, 'PreprocessedConstants', 'TAZs')
    # corridors = validate_table(context, 'PreprocessedConstants', 'Corridors')
    # sub_regions = validate_table(context, 'PreprocessedConstants', 'SubRegions')
    # return {
    #     'kpi_4_link': kpi_4_link,
    #     'base_year_tdm': base_year_tdm,
    #     'crash_type': crash_type,
    #     'crash_severity': crash_severity,
    #     'base_highway_links': base_highway_links,
    #     'cells': cells,
    #     'projects': projects,
    #     'ta_zs': ta_zs,
    #     'corridors': corridors,
    #     'sub_regions': sub_regions,
    # }
    raise NotImplementedError(f'{KPI_NAME}: implement validate')


def process(
    kpi_4_link: pd.DataFrame,
    base_year_tdm: pd.DataFrame,
    crash_type: list[str],
    crash_severity: list[str],
    base_highway_links: pd.DataFrame,
    cells: pd.DataFrame,
    projects: pd.DataFrame,
    ta_zs: pd.DataFrame,
    corridors: pd.DataFrame,
    sub_regions: pd.DataFrame,
) -> dict[str, pd.DataFrame]:
    # Formula reference (processing is intentionally left blank):
    # FatalityRate_{Link} = \sum_{CrashType}\sum_{CrashSeverity=K}CrashRate_{CrashType,CrashSeverity,Link}
    # TODO: Implement processing from the inputs above.
    # Suggested output structure: one geography row, one column per option combination.
    # output_columns = ['historic_fatality_rate']
    # link: basic unit;
    # link_index = base_highway_links.index.rename('link_id')
    # link_output = pd.DataFrame(index=link_index, columns=output_columns)
    # cell: aggregation;
    # \frac{\sum_{Link \in Cell}FatalityRate_{Link}\times BaseYearTotalDailyVMT_{Link}}{\sum_{Link \in Cell}BaseYearTotalDailyVMT_{Link}}
    # cell_index = cells.index.rename('cell_id')
    # cell_output = pd.DataFrame(index=cell_index, columns=output_columns)
    # project: aggregation;
    # \frac{\sum_{Link \in Project}FatalityRate_{Link}\times BaseYearTotalDailyVMT_{Link}}{\sum_{Link \in Project}BaseYearTotalDailyVMT_{Link}}
    # project_index = projects.index.rename('project_id')
    # project_output = pd.DataFrame(index=project_index, columns=output_columns)
    # taz: aggregation;
    # \frac{\sum_{Link \in TAZ}FatalityRate_{Link}\times BaseYearTotalDailyVMT_{Link}}{\sum_{Link \in TAZ}BaseYearTotalDailyVMT_{Link}}
    # taz_index = ta_zs.index.rename('taz_id')
    # taz_output = pd.DataFrame(index=taz_index, columns=output_columns)
    # corridor: aggregation;
    # \frac{\sum_{Link \in Corridor}FatalityRate_{Link}\times BaseYearTotalDailyVMT_{Link}}{\sum_{Link \in Corridor}BaseYearTotalDailyVMT_{Link}}
    # corridor_index = corridors.index.rename('corridor_id')
    # corridor_output = pd.DataFrame(index=corridor_index, columns=output_columns)
    # subRegion: aggregation;
    # \frac{\sum_{Link \in SubRegion}FatalityRate_{Link}\times BaseYearTotalDailyVMT_{Link}}{\sum_{Link \in SubRegion}BaseYearTotalDailyVMT_{Link}}
    # sub_region_index = sub_regions.index.rename('subregion_id')
    # sub_region_output = pd.DataFrame(index=sub_region_index, columns=output_columns)
    # region: aggregation;
    # \frac{\sum_{Link \in Region}FatalityRate_{Link}\times BaseYearTotalDailyVMT_{Link}}{\sum_{Link \in Region}BaseYearTotalDailyVMT_{Link}}
    # region_index = pd.Index(['Region'], name='region_id')
    # region_output = pd.DataFrame(index=region_index, columns=output_columns)
    # return {
    #     'link': link_output,
    #     'cell': cell_output,
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
