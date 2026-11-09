# KPI 81: Employment Within Catchment Area
# ID: kpi-73dbcf72-3b83-4c73-a0dd-b029793df48e
# Group: Scenario
# Unit: count
# Required sources:
#   ta_zs: PreprocessedConstants.TAZs.TAZ ID (TAZID_{TAZ})
#   zone_accessibility_matrix: ScenarioUpstream.ZoneAccessibilityMatrix.Drive 30 min TAZ IDs (\{Drive30minTAZIDs\}_{TAZ})
#   zone_accessibility_matrix: ScenarioUpstream.ZoneAccessibilityMatrix.TAZ ID (TAZID_{TAZ})
#   taz_demographics: ScenarioUpstream.TAZDemographics.TAZ ID (TAZID_{TAZ})
#   taz_demographics: ScenarioUpstream.TAZDemographics.Jobs (Jobs_{TAZ})
#   Output geography: PreprocessedConstants.TAZs; use table-schema joins for aggregation
# Expected output files:
#   data/kpis/<scenario>/TAZs/81_employment_within_catchment_area.parquet
# Catchment definition

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

KPI_NAME = '81_employment_within_catchment_area'
KPI_ID = 'kpi-73dbcf72-3b83-4c73-a0dd-b029793df48e'
SCENARIO_TYPE = 'Scenario'


def validate(context: RunContext) -> dict[str, object]:
    # ta_zs = validate_table(context, 'PreprocessedConstants', 'TAZs')
    # zone_accessibility_matrix = validate_table(context, 'ScenarioUpstream', 'ZoneAccessibilityMatrix')
    # taz_demographics = validate_table(context, 'ScenarioUpstream', 'TAZDemographics')
    # return {
    #     'ta_zs': ta_zs,
    #     'zone_accessibility_matrix': zone_accessibility_matrix,
    #     'taz_demographics': taz_demographics,
    # }
    raise NotImplementedError(f'{KPI_NAME}: implement validate')


def process(
    ta_zs: pd.DataFrame,
    zone_accessibility_matrix: pd.DataFrame,
    taz_demographics: pd.DataFrame,
) -> dict[str, pd.DataFrame]:
    # Formula reference (processing is intentionally left blank):
    # CatchmentJobs_{TAZ} = \sum_{TAZID_{TAZ_i}\in \{Drive30minTAZIDs\}_{TAZ}} Jobs_{TAZ_i}
    # TODO: Implement processing from the inputs above.
    # Suggested output structure: one geography row, one column per option combination.
    # output_columns = ['employment_within_catchment_area']
    # taz: basic unit;
    # taz_index = ta_zs.index.rename('taz_id')
    # taz_output = pd.DataFrame(index=taz_index, columns=output_columns)
    # return {
    #     'taz': taz_output,
    # }
    raise NotImplementedError(f'{KPI_NAME}: implement process')


def calculate(context: RunContext) -> None:
    # outputs = process(**validate(context))
    # for scale, output in outputs.items():
    #     writer.write_table(context, KPI_NAME, output, path='kpis', scale=scale)
    raise NotImplementedError(f'{KPI_NAME}: implement calculate')
