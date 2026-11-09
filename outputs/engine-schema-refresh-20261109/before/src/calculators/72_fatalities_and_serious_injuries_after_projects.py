# KPI 72: Fatalities and Serious Injuries After Projects
# ID: kpi-0d441f74-9ad2-4cff-9542-fe58f2394332
# Group: Scenario
# Unit: count
# Required sources:
#   kpi_96_link: 96_historical_crashes.parquet at link, current scenario (HistoricCrashCount_{CrashType,CrashSeverity,Link})
#   Constant Base Year: BaseYear
#   Local variable VMT Growth Rate (VMTGR)
#   kpi_5_project: 5_preventable_crash_reduction_count.parquet at project, current scenario (\Delta Crash_{Year,CrashType, Severity,Project})
#   Output geography: ScenarioUpstream.Projects; use table-schema joins for aggregation
#   Output geography: PreprocessedConstants.TAZs; use table-schema joins for aggregation
#   Output geography: PreprocessedConstants.Corridors; use table-schema joins for aggregation
#   Output geography: PreprocessedConstants.SubRegions; use table-schema joins for aggregation
# Expected output files:
#   data/kpis/<scenario>/Projects/72_fatalities_and_serious_injuries_after_projects.parquet
#   data/kpis/<scenario>/TAZs/72_fatalities_and_serious_injuries_after_projects.parquet
#   data/kpis/<scenario>/Corridors/72_fatalities_and_serious_injuries_after_projects.parquet
#   data/kpis/<scenario>/SubRegions/72_fatalities_and_serious_injuries_after_projects.parquet
#   data/kpis/<scenario>/Region/72_fatalities_and_serious_injuries_after_projects.parquet

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

KPI_NAME = '72_fatalities_and_serious_injuries_after_projects'
KPI_ID = 'kpi-0d441f74-9ad2-4cff-9542-fe58f2394332'
SCENARIO_TYPE = 'Scenario'

# Local variables and non-global dimension options:
# VMT_GROWTH_RATE = None  # TODO: Define VMT Growth Rate (VMTGR)
# YEAR_OPTIONS = []  # TODO: Define options for Year


def validate(context: RunContext) -> dict[str, object]:
    # kpi_96_link = loader.load(context, '96_historical_crashes', path='kpis', scale='link')
    # base_year = get_constant('Base Year')
    # vmt_growth_rate = VMT_GROWTH_RATE
    # kpi_5_project = loader.load(context, '5_preventable_crash_reduction_count', path='kpis', scale='project')
    # crash_type = get_domain('Crash Type')
    # crash_severity = get_domain('Crash Severity')
    # year_options = YEAR_OPTIONS
    # projects = validate_table(context, 'ScenarioUpstream', 'Projects')
    # ta_zs = validate_table(context, 'PreprocessedConstants', 'TAZs')
    # corridors = validate_table(context, 'PreprocessedConstants', 'Corridors')
    # sub_regions = validate_table(context, 'PreprocessedConstants', 'SubRegions')
    # return {
    #     'kpi_96_link': kpi_96_link,
    #     'base_year': base_year,
    #     'vmt_growth_rate': vmt_growth_rate,
    #     'kpi_5_project': kpi_5_project,
    #     'crash_type': crash_type,
    #     'crash_severity': crash_severity,
    #     'year_options': year_options,
    #     'projects': projects,
    #     'ta_zs': ta_zs,
    #     'corridors': corridors,
    #     'sub_regions': sub_regions,
    # }
    raise NotImplementedError(f'{KPI_NAME}: implement validate')


def process(
    kpi_96_link: pd.DataFrame,
    base_year: object,
    vmt_growth_rate: object,
    kpi_5_project: pd.DataFrame,
    crash_type: list[str],
    crash_severity: list[str],
    year_options: list[object],
    projects: pd.DataFrame,
    ta_zs: pd.DataFrame,
    corridors: pd.DataFrame,
    sub_regions: pd.DataFrame,
) -> dict[str, pd.DataFrame]:
    # Formula reference (processing is intentionally left blank):
    # NBFatalitiesInjuries_{Year, Link} = \sum_{CrashType}\sum_{CrashSeverity\in\{K, A\}}HistoricCrashCount_{CrashType,CrashSeverity,Link}\times (1+VMTGR)^{Year - BaseYear}
    # FatalitiesInjuries_{Year,Zone} = NBFatalitiesInjuries_{Year, Link}-\sum_{Project\in Zone}\sum_{CrashType} \sum_{CrashSeverity\in\{K, A\}}\Delta Crash_{Year,CrashType, Severity,Project}
    # TODO: Implement processing from the inputs above.
    # Suggested output structure: one geography row, one column per option combination.
    # output_columns = [
    #     'fatalities_and_serious_injuries_after_projects' + '_' + '_'.join(snake_case(str(v)) for v in options)
    #     for options in product(year_options)
    # ]
    # project: basic unit; Avg, weighted by existing VMT around project area
    # project_index = projects.index.rename('project_id')
    # project_output = pd.DataFrame(index=project_index, columns=output_columns)
    # taz: basic unit;
    # taz_index = ta_zs.index.rename('taz_id')
    # taz_output = pd.DataFrame(index=taz_index, columns=output_columns)
    # corridor: basic unit; Avg, weighted by existing VMT
    # corridor_index = corridors.index.rename('corridor_id')
    # corridor_output = pd.DataFrame(index=corridor_index, columns=output_columns)
    # subRegion: basic unit; Avg, weighted by existing VMT
    # sub_region_index = sub_regions.index.rename('subregion_id')
    # sub_region_output = pd.DataFrame(index=sub_region_index, columns=output_columns)
    # region: aggregation; Avg, weighted by existing VMT
    # \sum_{Project \in Region}FatalitiesInjuries_{Zone}
    # region_index = pd.Index(['Region'], name='region_id')
    # region_output = pd.DataFrame(index=region_index, columns=output_columns)
    # return {
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
