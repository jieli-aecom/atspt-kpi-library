# KPI 5: Preventable Crash Reduction Count
# ID: kpi-e1cfbba6-37ea-4635-9abb-7c3611153e91
# Group: Scenario
# Unit: count
# Required sources:
#   kpi_96_project: 96_historical_crashes.parquet at project, current scenario (CrashCount_{CrashType,CrashSeverity,Project})
#   projects: ScenarioUpstream.Projects.Crash Improvement Projects (\{Improvements\}_{Project})
#   Lookup CRFFactor (CRFFactor(,))
#   Constant VMT Growth Rate: VMTGR
#   Constant Base Year: BaseYear
#   Output geography: ScenarioUpstream.Projects; use table-schema joins for aggregation
#   Output geography: PreprocessedConstants.Corridors; use table-schema joins for aggregation
#   Output geography: PreprocessedConstants.SubRegions; use table-schema joins for aggregation
# Expected output files:
#   data/kpis/<scenario>/Projects/5_preventable_crash_reduction_count.parquet
#   data/kpis/<scenario>/Corridors/5_preventable_crash_reduction_count.parquet
#   data/kpis/<scenario>/SubRegions/5_preventable_crash_reduction_count.parquet
#   data/kpis/<scenario>/Region/5_preventable_crash_reduction_count.parquet

from __future__ import annotations

from collections.abc import Callable

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

KPI_NAME = '5_preventable_crash_reduction_count'
KPI_ID = 'kpi-e1cfbba6-37ea-4635-9abb-7c3611153e91'
SCENARIO_TYPE = 'Scenario'

# Local variables and non-global dimension options:
# YEAR_OPTIONS = []  # TODO: Define options for Year
# SEVERITY_OPTIONS = []  # TODO: Define options for Severity


def validate(context: RunContext) -> dict[str, object]:
    # kpi_96_project = loader.load(context, '96_historical_crashes', path='kpis', scale='project')
    # projects = validate_table(context, 'ScenarioUpstream', 'Projects')
    # crf_factor = get_lookup('CRFFactor')
    # vmt_growth_rate = get_constant('VMT Growth Rate')
    # base_year = get_constant('Base Year')
    # crash_improvement_project_type = get_domain('Crash Improvement Project Type')
    # crash_type = get_domain('Crash Type')
    # crash_severity = get_domain('Crash Severity')
    # year_options = YEAR_OPTIONS
    # severity_options = SEVERITY_OPTIONS
    # corridors = validate_table(context, 'PreprocessedConstants', 'Corridors')
    # sub_regions = validate_table(context, 'PreprocessedConstants', 'SubRegions')
    # return {
    #     'kpi_96_project': kpi_96_project,
    #     'projects': projects,
    #     'crf_factor': crf_factor,
    #     'vmt_growth_rate': vmt_growth_rate,
    #     'base_year': base_year,
    #     'crash_improvement_project_type': crash_improvement_project_type,
    #     'crash_type': crash_type,
    #     'crash_severity': crash_severity,
    #     'year_options': year_options,
    #     'severity_options': severity_options,
    #     'corridors': corridors,
    #     'sub_regions': sub_regions,
    # }
    raise NotImplementedError(f'{KPI_NAME}: implement validate')


def process(
    kpi_96_project: pd.DataFrame,
    projects: pd.DataFrame,
    crf_factor: Callable[..., object],
    vmt_growth_rate: object,
    base_year: object,
    crash_improvement_project_type: list[str],
    crash_type: list[str],
    crash_severity: list[str],
    year_options: list[object],
    severity_options: list[object],
    corridors: pd.DataFrame,
    sub_regions: pd.DataFrame,
) -> dict[str, pd.DataFrame]:
    # Formula reference (processing is intentionally left blank):
    # NBCrashes_{Year,CrashType,Severity,Project} = CrashCount_{CrashType,CrashSeverity,Project}\times (1+VMTGR)^{Year - BaseYear}
    # CRF_{Project,CrashType} = \prod_{i\in\{Improvements\}_{Project}}CRFFactor(CrashType,i)
    # Crashes_{Year,CrashType,Severity,Project} = NBCrashes_{Year,CrashType,Severity,Project}\times CRF_{Project,CrashType}
    # \Delta Crash_{Year,CrashType, Severity,Project} = \max(NBCrashes_{Year,CrashType,Severity,Project}-Crashes_{Year,CrashType,Severity,Project},0)
    # TODO: Implement processing from the inputs above.
    # Suggested output structure: one geography row, one column per option combination.
    # output_columns = [
    #     'preventable_crash_reduction_count' + '_' + '_'.join(snake_case(str(v)) for v in options)
    #     for options in product(year_options, crash_type, severity_options)
    # ]
    # project: basic unit; Avg, weighted by existing VMT around project area
    # project_index = projects.index.rename('project_id')
    # project_output = pd.DataFrame(index=project_index, columns=output_columns)
    # corridor: aggregation; Avg, weighted by existing VMT
    # \sum_{Project \in Corridor}\Delta Crash_{Year,CrashType, Severity,Project}
    # corridor_index = corridors.index.rename('corridor_id')
    # corridor_output = pd.DataFrame(index=corridor_index, columns=output_columns)
    # subRegion: aggregation; Avg, weighted by existing VMT
    # \sum_{Project \in SubRegion}\Delta Crash_{Year,CrashType, Severity,Project}
    # sub_region_index = sub_regions.index.rename('subregion_id')
    # sub_region_output = pd.DataFrame(index=sub_region_index, columns=output_columns)
    # region: aggregation; Avg, weighted by existing VMT
    # \sum_{Project \in Region}\Delta Crash_{Year,CrashType, Severity,Project}
    # region_index = pd.Index(['Region'], name='region_id')
    # region_output = pd.DataFrame(index=region_index, columns=output_columns)
    # return {
    #     'project': project_output,
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
