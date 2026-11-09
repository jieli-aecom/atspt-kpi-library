# KPI 9: Access to Healthcare
# ID: kpi-fe34a3a1-12d3-427e-891a-b8b0cb3f7703
# Group: Scenario
# Unit: %
# Required sources:
#   cells: PreprocessedConstants.Cells.Cell ID (CellID_{Cell})
#   bike_ped_accessibility_matrix: PreprocessedConstants.BikePedAccessibilityMatrix.Bike 30 min Cell IDs (\{Bike30minCellIDs\}_{Cell})
#   cells: PreprocessedConstants.Cells.Base Year Contains Healthcare (BaseYearContainsHealthcare_{Cell})
#   cells: PreprocessedConstants.Cells.TAZ IDs (TAZID_{Cell})
#   zone_accessibility_matrix: ScenarioUpstream.ZoneAccessibilityMatrix.Drive 15 min TAZ IDs (\{Drive15minTAZIDs\}_{TAZ})
#   ta_zs: PreprocessedConstants.TAZs.TAZ ID (TAZID_{TAZ})
#   taz_demographics: ScenarioUpstream.TAZDemographics.TAZ ID (TAZID_{TAZ})
#   taz_demographics: ScenarioUpstream.TAZDemographics.Population (Population_{TAZ})
#   Output geography: PreprocessedConstants.Cells; use table-schema joins for aggregation
#   Output geography: PreprocessedConstants.TAZs; use table-schema joins for aggregation
#   Output geography: PreprocessedConstants.SubRegions; use table-schema joins for aggregation
# Expected output files:
#   data/kpis/<scenario>/Cells/9_access_to_healthcare.parquet
#   data/kpis/<scenario>/TAZs/9_access_to_healthcare.parquet
#   data/kpis/<scenario>/SubRegions/9_access_to_healthcare.parquet
#   data/kpis/<scenario>/Region/9_access_to_healthcare.parquet

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

KPI_NAME = '9_access_to_healthcare'
KPI_ID = 'kpi-fe34a3a1-12d3-427e-891a-b8b0cb3f7703'
SCENARIO_TYPE = 'Scenario'


def validate(context: RunContext) -> dict[str, object]:
    # cells = validate_table(context, 'PreprocessedConstants', 'Cells')
    # bike_ped_accessibility_matrix = validate_table(context, 'PreprocessedConstants', 'BikePedAccessibilityMatrix')
    # zone_accessibility_matrix = validate_table(context, 'ScenarioUpstream', 'ZoneAccessibilityMatrix')
    # ta_zs = validate_table(context, 'PreprocessedConstants', 'TAZs')
    # taz_demographics = validate_table(context, 'ScenarioUpstream', 'TAZDemographics')
    # sub_regions = validate_table(context, 'PreprocessedConstants', 'SubRegions')
    # return {
    #     'cells': cells,
    #     'bike_ped_accessibility_matrix': bike_ped_accessibility_matrix,
    #     'zone_accessibility_matrix': zone_accessibility_matrix,
    #     'ta_zs': ta_zs,
    #     'taz_demographics': taz_demographics,
    #     'sub_regions': sub_regions,
    # }
    raise NotImplementedError(f'{KPI_NAME}: implement validate')


def process(
    cells: pd.DataFrame,
    bike_ped_accessibility_matrix: pd.DataFrame,
    zone_accessibility_matrix: pd.DataFrame,
    ta_zs: pd.DataFrame,
    taz_demographics: pd.DataFrame,
    sub_regions: pd.DataFrame,
) -> dict[str, pd.DataFrame]:
    # Formula reference (processing is intentionally left blank):
    # HasBikeAccess_{Cell} = [\sum_{CellID_{Cell_i} \in\{Bike30minCellIDs\}_{Cell}}BaseYearContainsHealthcare_{Cell_i} > 0]
    # HasBikeAccess_{TAZ} = [\sum_{Cell_i|TAZID_{Cell_i}=idOf(TAZ)}HasBikeAccess_{Cell} > 0]
    # BaseYearContainsHealthcare_{TAZ_i} = [\sum_{Cell_i|TAZID_{Cell_i}=idOf(TAZ_i)}BaseYearContainsHealthcare_{Cell_i} > 0]
    # HasDriveAccess_{TAZ} = [\sum_{TAZID_{TAZ_i} \in\{Drive15minTAZIDs\}_{TAZ}}BaseYearContainsHealthcare_{TAZ_i} > 0]
    # HasAccess_{TAZ} = HasBikeAccess_{TAZ} \bigcup HasDriveAccess_{TAZ}
    # TODO: Implement processing from the inputs above.
    # Suggested output structure: one geography row, one column per option combination.
    # output_columns = ['access_to_healthcare']
    # cell: basic unit;
    # cell_index = cells.index.rename('cell_id')
    # cell_output = pd.DataFrame(index=cell_index, columns=output_columns)
    # taz: basic unit; Average, weighted by population
    # taz_index = ta_zs.index.rename('taz_id')
    # taz_output = pd.DataFrame(index=taz_index, columns=output_columns)
    # subRegion: aggregation; Average, weighted by population
    # \frac{\sum_{TAZ\in SubRegion} (HasAccess_{TAZ}\times Population_{TAZ})}{\sum_{TAZ\in SubRegion}Population_{TAZ}}
    # sub_region_index = sub_regions.index.rename('subregion_id')
    # sub_region_output = pd.DataFrame(index=sub_region_index, columns=output_columns)
    # region: aggregation; Average, weighted by population
    # \frac{\sum_{TAZ\in Region} (HasAccess_{TAZ}\times Population_{TAZ})}{\sum_{TAZ\in Region}Population_{TAZ}}
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
