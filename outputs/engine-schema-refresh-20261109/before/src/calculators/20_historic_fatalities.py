# KPI 20: Historic Fatalities
# ID: kpi-c5f2774f-2c58-4f0d-a740-7166407386b5
# Group: Base Year
# Unit: count
# Required sources:
#   kpi_96_link: 96_historical_crashes.parquet at link, current scenario (CrashCount_{CrashType,CrashSeverity,Link})
#   Output geography: PreprocessedConstants.BaseHighwayLinks; use table-schema joins for aggregation
#   Output geography: PreprocessedConstants.Cells; use table-schema joins for aggregation
#   Output geography: ScenarioUpstream.Projects; use table-schema joins for aggregation
#   Output geography: PreprocessedConstants.TAZs; use table-schema joins for aggregation
#   Output geography: PreprocessedConstants.Corridors; use table-schema joins for aggregation
#   Output geography: PreprocessedConstants.SubRegions; use table-schema joins for aggregation
# Expected output files:
#   data/kpis/<scenario>/Links/20_historic_fatalities.parquet
#   data/kpis/<scenario>/Cells/20_historic_fatalities.parquet
#   data/kpis/<scenario>/Projects/20_historic_fatalities.parquet
#   data/kpis/<scenario>/TAZs/20_historic_fatalities.parquet
#   data/kpis/<scenario>/Corridors/20_historic_fatalities.parquet
#   data/kpis/<scenario>/SubRegions/20_historic_fatalities.parquet
#   data/kpis/<scenario>/Region/20_historic_fatalities.parquet

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

KPI_NAME = '20_historic_fatalities'
KPI_ID = 'kpi-c5f2774f-2c58-4f0d-a740-7166407386b5'
SCENARIO_TYPE = 'Base Year'


def validate(context: RunContext) -> dict[str, object]:
    # kpi_96_link = loader.load(context, '96_historical_crashes', path='kpis', scale='link')
    # crash_type = get_domain('Crash Type')
    # crash_severity = get_domain('Crash Severity')
    # base_highway_links = validate_table(context, 'PreprocessedConstants', 'BaseHighwayLinks')
    # cells = validate_table(context, 'PreprocessedConstants', 'Cells')
    # projects = validate_table(context, 'ScenarioUpstream', 'Projects')
    # ta_zs = validate_table(context, 'PreprocessedConstants', 'TAZs')
    # corridors = validate_table(context, 'PreprocessedConstants', 'Corridors')
    # sub_regions = validate_table(context, 'PreprocessedConstants', 'SubRegions')
    # return {
    #     'kpi_96_link': kpi_96_link,
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
    kpi_96_link: pd.DataFrame,
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
    # FatalityCount_{Link} = \sum_{CrashType}\sum_{CrashSeverity=K}CrashCount_{CrashType,CrashSeverity,Link}
    # TODO: Implement processing from the inputs above.
    # Suggested output structure: one geography row, one column per option combination.
    # output_columns = ['historic_fatalities']
    # link: basic unit;
    # link_index = base_highway_links.index.rename('link_id')
    # link_output = pd.DataFrame(index=link_index, columns=output_columns)
    # cell: aggregation;
    # \sum_{Link \in Cell}FatalityCount_{Link}
    # cell_index = cells.index.rename('cell_id')
    # cell_output = pd.DataFrame(index=cell_index, columns=output_columns)
    # project: aggregation;
    # \sum_{Link \in Project}FatalityCount_{Link}
    # project_index = projects.index.rename('project_id')
    # project_output = pd.DataFrame(index=project_index, columns=output_columns)
    # taz: aggregation;
    # \sum_{Link \in TAZ}FatalityCount_{Link}
    # taz_index = ta_zs.index.rename('taz_id')
    # taz_output = pd.DataFrame(index=taz_index, columns=output_columns)
    # corridor: aggregation;
    # \sum_{Link \in Corridor}FatalityCount_{Link}
    # corridor_index = corridors.index.rename('corridor_id')
    # corridor_output = pd.DataFrame(index=corridor_index, columns=output_columns)
    # subRegion: aggregation;
    # \sum_{Link \in SubRegion}FatalityCount_{Link}
    # sub_region_index = sub_regions.index.rename('subregion_id')
    # sub_region_output = pd.DataFrame(index=sub_region_index, columns=output_columns)
    # region: aggregation;
    # \sum_{Link \in Region}FatalityCount_{Link}
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
