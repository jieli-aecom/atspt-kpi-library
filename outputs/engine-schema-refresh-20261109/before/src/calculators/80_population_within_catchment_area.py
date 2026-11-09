# KPI 80: Population Within Catchment Area
# ID: kpi-56ddc7f1-0e67-4562-b01f-5a5dc0a4e582
# Group: Scenario
# Unit: persons
# Required sources:
#   zone_accessibility_matrix: ScenarioUpstream.ZoneAccessibilityMatrix.Drive 30 min TAZ IDs (\{Drive30minTAZIDs\}_{TAZ})
#   zone_accessibility_matrix: ScenarioUpstream.ZoneAccessibilityMatrix.TAZ ID (TAZID_{TAZ})
#   taz_demographics: ScenarioUpstream.TAZDemographics.Population (Population_{TAZ})
#   taz_demographics: ScenarioUpstream.TAZDemographics.TAZ ID (TAZID_{TAZ})
#   Output geography: PreprocessedConstants.TAZs; use table-schema joins for aggregation
# Expected output files:
#   data/kpis/<scenario>/TAZs/80_population_within_catchment_area.parquet
# Definition of catchment

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

KPI_NAME = '80_population_within_catchment_area'
KPI_ID = 'kpi-56ddc7f1-0e67-4562-b01f-5a5dc0a4e582'
SCENARIO_TYPE = 'Scenario'


def validate(context: RunContext) -> dict[str, object]:
    # zone_accessibility_matrix = validate_table(context, 'ScenarioUpstream', 'ZoneAccessibilityMatrix')
    # taz_demographics = validate_table(context, 'ScenarioUpstream', 'TAZDemographics')
    # ta_zs = validate_table(context, 'PreprocessedConstants', 'TAZs')
    # return {
    #     'zone_accessibility_matrix': zone_accessibility_matrix,
    #     'taz_demographics': taz_demographics,
    #     'ta_zs': ta_zs,
    # }
    raise NotImplementedError(f'{KPI_NAME}: implement validate')


def process(
    zone_accessibility_matrix: pd.DataFrame,
    taz_demographics: pd.DataFrame,
    ta_zs: pd.DataFrame,
) -> dict[str, pd.DataFrame]:
    # Formula reference (processing is intentionally left blank):
    # CatchmentPopulation_{TAZ} = \sum_{TAZID_{TAZ_i}\in \{Drive30minTAZIDs\}_{TAZ}} Population_{TAZ_i}
    # TODO: Implement processing from the inputs above.
    # Suggested output structure: one geography row, one column per option combination.
    # output_columns = ['population_within_catchment_area']
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
