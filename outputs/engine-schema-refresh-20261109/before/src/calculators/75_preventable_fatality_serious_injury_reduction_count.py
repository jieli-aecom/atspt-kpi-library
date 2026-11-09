# KPI 75: Preventable Fatality Serious Injury Reduction Count
# ID: kpi-d96d5090-63d4-4dd3-a549-bd36d26aa07d
# Group: Scenario
# Unit: count
# Required sources:
#   kpi_5_project: 5_preventable_crash_reduction_count.parquet at project, current scenario (\Delta Crash_{Year,CrashType, CrashSeverity,Project})
#   Output geography: ScenarioUpstream.Projects; use table-schema joins for aggregation
#   Output geography: PreprocessedConstants.Corridors; use table-schema joins for aggregation
#   Output geography: PreprocessedConstants.SubRegions; use table-schema joins for aggregation
# Expected output files:
#   data/kpis/<scenario>/Projects/75_preventable_fatality_serious_injury_reduction_count.parquet
#   data/kpis/<scenario>/Corridors/75_preventable_fatality_serious_injury_reduction_count.parquet
#   data/kpis/<scenario>/SubRegions/75_preventable_fatality_serious_injury_reduction_count.parquet
#   data/kpis/<scenario>/Region/75_preventable_fatality_serious_injury_reduction_count.parquet

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

KPI_NAME = '75_preventable_fatality_serious_injury_reduction_count'
KPI_ID = 'kpi-d96d5090-63d4-4dd3-a549-bd36d26aa07d'
SCENARIO_TYPE = 'Scenario'

# Local variables and non-global dimension options:
# YEAR_OPTIONS = []  # TODO: Define options for Year


def validate(context: RunContext) -> dict[str, object]:
    # kpi_5_project = loader.load(context, '5_preventable_crash_reduction_count', path='kpis', scale='project')
    # crash_type = get_domain('Crash Type')
    # crash_severity = get_domain('Crash Severity')
    # year_options = YEAR_OPTIONS
    # projects = validate_table(context, 'ScenarioUpstream', 'Projects')
    # corridors = validate_table(context, 'PreprocessedConstants', 'Corridors')
    # sub_regions = validate_table(context, 'PreprocessedConstants', 'SubRegions')
    # return {
    #     'kpi_5_project': kpi_5_project,
    #     'crash_type': crash_type,
    #     'crash_severity': crash_severity,
    #     'year_options': year_options,
    #     'projects': projects,
    #     'corridors': corridors,
    #     'sub_regions': sub_regions,
    # }
    raise NotImplementedError(f'{KPI_NAME}: implement validate')


def process(
    kpi_5_project: pd.DataFrame,
    crash_type: list[str],
    crash_severity: list[str],
    year_options: list[object],
    projects: pd.DataFrame,
    corridors: pd.DataFrame,
    sub_regions: pd.DataFrame,
) -> dict[str, pd.DataFrame]:
    # Formula reference (processing is intentionally left blank):
    # \Delta FatalitiesSeriousInjuries_{Year,Project} = \sum_{CrashType}\sum_{CrashSeverity\in\{K, A\}}\Delta Crash_{Year,CrashType, CrashSeverity,Project}
    # TODO: Implement processing from the inputs above.
    # Suggested output structure: one geography row, one column per option combination.
    # output_columns = [
    #     'preventable_fatality_serious_injury_reduction_count' + '_' + '_'.join(snake_case(str(v)) for v in options)
    #     for options in product(year_options)
    # ]
    # project: basic unit; Avg, weighted by existing VMT around project area
    # project_index = projects.index.rename('project_id')
    # project_output = pd.DataFrame(index=project_index, columns=output_columns)
    # corridor: aggregation; Avg, weighted by existing VMT
    # \sum_{Project \in Corridor}\Delta FatalitiesSeriousInjuries_{Year,Project}
    # corridor_index = corridors.index.rename('corridor_id')
    # corridor_output = pd.DataFrame(index=corridor_index, columns=output_columns)
    # subRegion: aggregation; Avg, weighted by existing VMT
    # \sum_{Project \in SubRegion}\Delta FatalitiesSeriousInjuries_{Year,Project}
    # sub_region_index = sub_regions.index.rename('subregion_id')
    # sub_region_output = pd.DataFrame(index=sub_region_index, columns=output_columns)
    # region: aggregation; Avg, weighted by existing VMT
    # \sum_{Project \in Region}\Delta FatalitiesSeriousInjuries_{Year,Project}
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
