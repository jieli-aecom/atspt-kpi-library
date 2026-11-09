# KPI 8: Access to Jobs
# ID: kpi-eb841da3-8b25-4607-9e6a-0b71633cd197
# Group: Scenario
# Unit: %
# Required sources:
#   cell_land_use: ScenarioUpstream.CellLandUse.Jobs (Jobs_{Cell})
#   zone_accessibility_matrix: ScenarioUpstream.ZoneAccessibilityMatrix.Transit 45 min TAZ IDs (\{Transit45minTAZIDs\}_{TAZ})
#   zone_accessibility_matrix: ScenarioUpstream.ZoneAccessibilityMatrix.Drive 30 min TAZ IDs (\{Drive30minTAZIDs\}_{TAZ})
#   ta_zs: PreprocessedConstants.TAZs.TAZ ID (TAZID_{TAZ})
#   taz_demographics: ScenarioUpstream.TAZDemographics.TAZ ID (TAZID_{TAZ})
#   taz_demographics: ScenarioUpstream.TAZDemographics.Jobs (Jobs_{TAZ})
#   taz_demographics: ScenarioUpstream.TAZDemographics.Workers (Workers_{TAZ})
#   Output geography: PreprocessedConstants.Cells; use table-schema joins for aggregation
#   Output geography: PreprocessedConstants.TAZs; use table-schema joins for aggregation
#   Output geography: PreprocessedConstants.SubRegions; use table-schema joins for aggregation
# Expected output files:
#   data/kpis/<scenario>/Cells/8_access_to_jobs.parquet
#   data/kpis/<scenario>/TAZs/8_access_to_jobs.parquet
#   data/kpis/<scenario>/SubRegions/8_access_to_jobs.parquet
#   data/kpis/<scenario>/Region/8_access_to_jobs.parquet

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

KPI_NAME = '8_access_to_jobs'
KPI_ID = 'kpi-eb841da3-8b25-4607-9e6a-0b71633cd197'
SCENARIO_TYPE = 'Scenario'


def validate(context: RunContext) -> dict[str, object]:
    # cell_land_use = validate_table(context, 'ScenarioUpstream', 'CellLandUse')
    # zone_accessibility_matrix = validate_table(context, 'ScenarioUpstream', 'ZoneAccessibilityMatrix')
    # ta_zs = validate_table(context, 'PreprocessedConstants', 'TAZs')
    # taz_demographics = validate_table(context, 'ScenarioUpstream', 'TAZDemographics')
    # cells = validate_table(context, 'PreprocessedConstants', 'Cells')
    # sub_regions = validate_table(context, 'PreprocessedConstants', 'SubRegions')
    # return {
    #     'cell_land_use': cell_land_use,
    #     'zone_accessibility_matrix': zone_accessibility_matrix,
    #     'ta_zs': ta_zs,
    #     'taz_demographics': taz_demographics,
    #     'cells': cells,
    #     'sub_regions': sub_regions,
    # }
    raise NotImplementedError(f'{KPI_NAME}: implement validate')


def process(
    cell_land_use: pd.DataFrame,
    zone_accessibility_matrix: pd.DataFrame,
    ta_zs: pd.DataFrame,
    taz_demographics: pd.DataFrame,
    cells: pd.DataFrame,
    sub_regions: pd.DataFrame,
) -> dict[str, pd.DataFrame]:
    # Formula reference (processing is intentionally left blank):
    # RegionJobCount = \sum_{Cell \in Region} Jobs_{Cell}
    # \{ReachableTAZIDs\}_{TAZ} = \{Transit45minTAZIDs\}_{TAZ}\bigcup\{Drive30minTAZIDs\}_{TAZ}
    # ReachableJobCount_{TAZ} = \sum_{TAZID_{TAZ_i}\in\{ReachableTAZIDs\}_{TAZ}}Jobs_{TAZ_i}
    # JobAccessPct_{TAZ} = \frac{ReachableJobCount_{TAZ}}{RegionJobCount}
    # TODO: Implement processing from the inputs above.
    # Suggested output structure: one geography row, one column per option combination.
    # output_columns = ['access_to_jobs']
    # cell: basic unit;
    # cell_index = cells.index.rename('cell_id')
    # cell_output = pd.DataFrame(index=cell_index, columns=output_columns)
    # taz: basic unit;
    # taz_index = ta_zs.index.rename('taz_id')
    # taz_output = pd.DataFrame(index=taz_index, columns=output_columns)
    # subRegion: aggregation; Average, weighted by number of workers
    # \frac{\sum_{TAZ\in SubRegion} (JobAccessPct_{TAZ}\times Workers_{TAZ})}{\sum_{TAZ\in SubRegion}Workers_{TAZ}}
    # sub_region_index = sub_regions.index.rename('subregion_id')
    # sub_region_output = pd.DataFrame(index=sub_region_index, columns=output_columns)
    # region: aggregation; Average, weighted by number of workers
    # \frac{\sum_{TAZ} (JobAccessPct_{TAZ}\times Workers_{TAZ})}{\sum_{TAZ\in Region}Workers_{TAZ}}
    # region_index = pd.Index(['Region'], name='region_id')
    # region_output = pd.DataFrame(index=region_index, columns=output_columns)
    # return {
    #     'cell': cell_output,
    #     'taz': taz_output,
    #     'subRegion': sub_region_output,
    #     'region': region_output,
    # }
    raise NotImplementedError(f'{KPI_NAME}: implement process')


def calculate(context: RunContext) -> None:
    # outputs = process(**validate(context))
    # for scale, output in outputs.items():
    #     writer.write_table(context, KPI_NAME, output, path='kpis', scale=scale)
    raise NotImplementedError(f'{KPI_NAME}: implement calculate')
