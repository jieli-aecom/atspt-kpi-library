# KPI 96: Historical Crashes
# ID: kpi-85f41d79-fc35-413c-9912-c8c383cae61f
# Group: Base Year
# Unit: count
# Required sources:
#   Local variable Window Years (\{WindowYears\})
#   historic_crashes: PreprocessedConstants.HistoricCrashes.Type (Type_{Point})
#   historic_crashes: PreprocessedConstants.HistoricCrashes.Severity (Severity_{Point})
#   historic_crashes: PreprocessedConstants.HistoricCrashes.Commercial Vehicle (CommercialVehicle_{Point})
#   historic_crashes: PreprocessedConstants.HistoricCrashes.Link ID (LinkID_{Point})
#   base_highway_links: PreprocessedConstants.BaseHighwayLinks.Link ID (LinkID_{Link})
#   historic_crashes: PreprocessedConstants.HistoricCrashes.Crash Point ID (CrashPointID_{Point})
#   historic_crashes: PreprocessedConstants.HistoricCrashes.Year (Year_{Point})
#   Output geography: PreprocessedConstants.BaseHighwayLinks; use table-schema joins for aggregation
#   Output geography: PreprocessedConstants.Cells; use table-schema joins for aggregation
#   Output geography: ScenarioUpstream.Projects; use table-schema joins for aggregation
#   Output geography: PreprocessedConstants.TAZs; use table-schema joins for aggregation
#   Output geography: PreprocessedConstants.Corridors; use table-schema joins for aggregation
#   Output geography: PreprocessedConstants.SubRegions; use table-schema joins for aggregation
# Expected output files:
#   data/kpis/<scenario>/Links/96_historical_crashes.parquet
#   data/kpis/<scenario>/Cells/96_historical_crashes.parquet
#   data/kpis/<scenario>/Projects/96_historical_crashes.parquet
#   data/kpis/<scenario>/TAZs/96_historical_crashes.parquet
#   data/kpis/<scenario>/Corridors/96_historical_crashes.parquet
#   data/kpis/<scenario>/SubRegions/96_historical_crashes.parquet
#   data/kpis/<scenario>/Region/96_historical_crashes.parquet

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

KPI_NAME = '96_historical_crashes'
KPI_ID = 'kpi-85f41d79-fc35-413c-9912-c8c383cae61f'
SCENARIO_TYPE = 'Base Year'

# Local variables and non-global dimension options:
# WINDOW_YEARS = None  # TODO: Define Window Years (\{WindowYears\})
# YEAR_OPTIONS = []  # TODO: Define years, e.g. from project OpenYear/EndYear


def validate(context: RunContext) -> dict[str, object]:
    # window_years = WINDOW_YEARS
    # historic_crashes = validate_table(context, 'PreprocessedConstants', 'HistoricCrashes')
    # base_highway_links = validate_table(context, 'PreprocessedConstants', 'BaseHighwayLinks')
    # crash_type = get_domain('Crash Type')
    # crash_severity = get_domain('Crash Severity')
    # year_options = YEAR_OPTIONS
    # cells = validate_table(context, 'PreprocessedConstants', 'Cells')
    # projects = validate_table(context, 'ScenarioUpstream', 'Projects')
    # ta_zs = validate_table(context, 'PreprocessedConstants', 'TAZs')
    # corridors = validate_table(context, 'PreprocessedConstants', 'Corridors')
    # sub_regions = validate_table(context, 'PreprocessedConstants', 'SubRegions')
    # return {
    #     'window_years': window_years,
    #     'historic_crashes': historic_crashes,
    #     'base_highway_links': base_highway_links,
    #     'crash_type': crash_type,
    #     'crash_severity': crash_severity,
    #     'year_options': year_options,
    #     'cells': cells,
    #     'projects': projects,
    #     'ta_zs': ta_zs,
    #     'corridors': corridors,
    #     'sub_regions': sub_regions,
    # }
    raise NotImplementedError(f'{KPI_NAME}: implement validate')


def process(
    window_years: object,
    historic_crashes: pd.DataFrame,
    base_highway_links: pd.DataFrame,
    crash_type: list[str],
    crash_severity: list[str],
    year_options: list[object],
    cells: pd.DataFrame,
    projects: pd.DataFrame,
    ta_zs: pd.DataFrame,
    corridors: pd.DataFrame,
    sub_regions: pd.DataFrame,
) -> dict[str, pd.DataFrame]:
    # Formula reference (processing is intentionally left blank):
    # Filter_{CrashType, CrashSeverity, Link} = (LinkID_{Point}=LinkID_{Link})\bigcap(Type_{Point} = CrashType)\bigcap(Severity_{Point}=CrashSeverity)\bigcap (Year_{Point}\in\{WindowYears\})
    # CrashCount_{CrashType, CrashSeverity, Link} = \frac{1}{\Vert\{WindowYears\}\Vert}\times \Vert\{CrashPointID_{Point}|_{Filter_{CrashType, CrashSeverity, Link}}\}\Vert
    # TODO: Implement processing from the inputs above.
    # Suggested output structure: one geography row, one column per option combination.
    # output_columns = [
    #     'historical_crashes' + '_' + '_'.join(snake_case(str(v)) for v in options)
    #     for options in product(crash_type, crash_severity)
    # ]
    # link: basic unit;
    # link_index = base_highway_links.index.rename('link_id')
    # link_output = pd.DataFrame(index=link_index, columns=output_columns)
    # cell: aggregation;
    # \sum_{Link \in Cell}CrashCount_{CrashType, CrashSeverity, Link}
    # cell_index = cells.index.rename('cell_id')
    # cell_output = pd.DataFrame(index=cell_index, columns=output_columns)
    # project: aggregation; Avg, weighted by existing VMT around project area
    # \sum_{Link \in Project}CrashCount_{CrashType, CrashSeverity, Link}
    # project_index = projects.index.rename('project_id')
    # project_output = pd.DataFrame(index=project_index, columns=output_columns)
    # taz: aggregation;
    # \sum_{Link \in TAZ}CrashCount_{CrashType, CrashSeverity, Link}
    # taz_index = ta_zs.index.rename('taz_id')
    # taz_output = pd.DataFrame(index=taz_index, columns=output_columns)
    # corridor: aggregation; Avg, weighted by existing VMT
    # \sum_{Link \in Corridor}CrashCount_{CrashType, CrashSeverity, Link}
    # corridor_index = corridors.index.rename('corridor_id')
    # corridor_output = pd.DataFrame(index=corridor_index, columns=output_columns)
    # subRegion: aggregation; Avg, weighted by existing VMT
    # \sum_{Link \in SubRegion}CrashCount_{CrashType, CrashSeverity, Link}
    # sub_region_index = sub_regions.index.rename('subregion_id')
    # sub_region_output = pd.DataFrame(index=sub_region_index, columns=output_columns)
    # region: aggregation; Avg, weighted by existing VMT
    # \sum_{Link \in Region}CrashCount_{CrashType, CrashSeverity, Link}
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
