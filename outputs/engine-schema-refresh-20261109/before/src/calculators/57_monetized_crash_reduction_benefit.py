# KPI 57: Monetized Crash Reduction Benefit
# ID: kpi-8271a915-f786-44c5-9cb1-29aa80dba939
# Group: Scenario
# Unit: base year dollars
# Required sources:
#   kpi_5_project: 5_preventable_crash_reduction_count.parquet at project, current scenario (\Delta Crashes_{CrashType,CrashSeverity,Project})
#   Lookup CrashMonetizationLookup (CrashMonetizationLookup())
#   Constant Discount Rate: DiscountRate
#   Constant Base Year: BaseYear
#   projects: ScenarioUpstream.Projects.Open Year (OpenYear_{Project})
#   projects: ScenarioUpstream.Projects.End Year (EndYear_{Project})
#   Output geography: ScenarioUpstream.Projects; use table-schema joins for aggregation
#   Output geography: PreprocessedConstants.Corridors; use table-schema joins for aggregation
#   Output geography: PreprocessedConstants.SubRegions; use table-schema joins for aggregation
# Expected output files:
#   data/kpis/<scenario>/Projects/57_monetized_crash_reduction_benefit.parquet
#   data/kpis/<scenario>/Corridors/57_monetized_crash_reduction_benefit.parquet
#   data/kpis/<scenario>/SubRegions/57_monetized_crash_reduction_benefit.parquet
#   data/kpis/<scenario>/Region/57_monetized_crash_reduction_benefit.parquet

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

KPI_NAME = '57_monetized_crash_reduction_benefit'
KPI_ID = 'kpi-8271a915-f786-44c5-9cb1-29aa80dba939'
SCENARIO_TYPE = 'Scenario'

# Local variables and non-global dimension options:
# YEAR_OPTIONS = []  # TODO: Define years, e.g. from project OpenYear/EndYear


def validate(context: RunContext) -> dict[str, object]:
    # kpi_5_project = loader.load(context, '5_preventable_crash_reduction_count', path='kpis', scale='project')
    # crash_monetization_lookup = get_lookup('CrashMonetizationLookup')
    # discount_rate = get_constant('Discount Rate')
    # base_year = get_constant('Base Year')
    # projects = validate_table(context, 'ScenarioUpstream', 'Projects')
    # crash_type = get_domain('Crash Type')
    # crash_severity = get_domain('Crash Severity')
    # year_options = YEAR_OPTIONS
    # corridors = validate_table(context, 'PreprocessedConstants', 'Corridors')
    # sub_regions = validate_table(context, 'PreprocessedConstants', 'SubRegions')
    # return {
    #     'kpi_5_project': kpi_5_project,
    #     'crash_monetization_lookup': crash_monetization_lookup,
    #     'discount_rate': discount_rate,
    #     'base_year': base_year,
    #     'projects': projects,
    #     'crash_type': crash_type,
    #     'crash_severity': crash_severity,
    #     'year_options': year_options,
    #     'corridors': corridors,
    #     'sub_regions': sub_regions,
    # }
    raise NotImplementedError(f'{KPI_NAME}: implement validate')


def process(
    kpi_5_project: pd.DataFrame,
    crash_monetization_lookup: Callable[..., object],
    discount_rate: object,
    base_year: object,
    projects: pd.DataFrame,
    crash_type: list[str],
    crash_severity: list[str],
    year_options: list[object],
    corridors: pd.DataFrame,
    sub_regions: pd.DataFrame,
) -> dict[str, pd.DataFrame]:
    # Formula reference (processing is intentionally left blank):
    # Benefit_{Year,Project} = \sum_{CrashType} \sum_{CrashSeverity}(CrashMonetizationLookup(CrashSeverity) \times \Delta Crashes_{CrashType,CrashSeverity,Project})
    # Benefit_{Project} = \sum_{Year=OpenYear_{Project}}^{EndYear_{Project}}\frac{Benefit_{Year,Project}}{{(1 + DiscountRate)^{Year - BaseYear}}}
    # TODO: Implement processing from the inputs above.
    # Suggested output structure: one geography row, one column per option combination.
    # output_columns = ['monetized_crash_reduction_benefit']
    # project: basic unit;
    # project_index = projects.index.rename('project_id')
    # project_output = pd.DataFrame(index=project_index, columns=output_columns)
    # corridor: aggregation; Sum
    # \sum_{Project \in Corridor}Benefit_{Project}
    # corridor_index = corridors.index.rename('corridor_id')
    # corridor_output = pd.DataFrame(index=corridor_index, columns=output_columns)
    # subRegion: aggregation; Sum
    # \sum_{Project \in SubRegion}Benefit_{Project}
    # sub_region_index = sub_regions.index.rename('subregion_id')
    # sub_region_output = pd.DataFrame(index=sub_region_index, columns=output_columns)
    # region: aggregation; Sum
    # \sum_{Project \in Region}Benefit_{Project}
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
