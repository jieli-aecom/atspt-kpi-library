# KPI 10: Access to Retail
# ID: kpi-e5a3a84a-df33-477b-b16f-2e2ea5da7dcb
# Group: Scenario
# Unit: %
# Required sources:
#   cells: PreprocessedConstants.Cells.Cell ID (CellID_{Cell})
#   bike_ped_accessibility_matrix: PreprocessedConstants.BikePedAccessibilityMatrix.Buffer 1 Mile Cell IDs (\{Buffer1MileCellIDs\}_{Cell})
#   cell_land_use: ScenarioUpstream.CellLandUse.Population (Population_{Cell})
#   cell_land_use: ScenarioUpstream.CellLandUse.Contains Retail (ContainsRetail_{Cell})
#   Output geography: PreprocessedConstants.Cells; use table-schema joins for aggregation
#   Output geography: PreprocessedConstants.TAZs; use table-schema joins for aggregation
#   Output geography: PreprocessedConstants.SubRegions; use table-schema joins for aggregation
# Expected output files:
#   data/kpis/<scenario>/Cells/10_access_to_retail.parquet
#   data/kpis/<scenario>/TAZs/10_access_to_retail.parquet
#   data/kpis/<scenario>/SubRegions/10_access_to_retail.parquet
#   data/kpis/<scenario>/Region/10_access_to_retail.parquet

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

KPI_NAME = '10_access_to_retail'
KPI_ID = 'kpi-e5a3a84a-df33-477b-b16f-2e2ea5da7dcb'
SCENARIO_TYPE = 'Scenario'


def validate(context: RunContext) -> dict[str, object]:
    # cells = validate_table(context, 'PreprocessedConstants', 'Cells')
    # bike_ped_accessibility_matrix = validate_table(context, 'PreprocessedConstants', 'BikePedAccessibilityMatrix')
    # cell_land_use = validate_table(context, 'ScenarioUpstream', 'CellLandUse')
    # ta_zs = validate_table(context, 'PreprocessedConstants', 'TAZs')
    # sub_regions = validate_table(context, 'PreprocessedConstants', 'SubRegions')
    # return {
    #     'cells': cells,
    #     'bike_ped_accessibility_matrix': bike_ped_accessibility_matrix,
    #     'cell_land_use': cell_land_use,
    #     'ta_zs': ta_zs,
    #     'sub_regions': sub_regions,
    # }
    raise NotImplementedError(f'{KPI_NAME}: implement validate')


def process(
    cells: pd.DataFrame,
    bike_ped_accessibility_matrix: pd.DataFrame,
    cell_land_use: pd.DataFrame,
    ta_zs: pd.DataFrame,
    sub_regions: pd.DataFrame,
) -> dict[str, pd.DataFrame]:
    # Formula reference (processing is intentionally left blank):
    # HasAccess_{Cell} = [\sum_{CellID_{Cell_i} \in\{Buffer1MileCellIDs\}_{Cell}}ContainsRetail_{Cell_i} > 0]
    # TODO: Implement processing from the inputs above.
    # Suggested output structure: one geography row, one column per option combination.
    # output_columns = ['access_to_retail']
    # cell: basic unit;
    # cell_index = cells.index.rename('cell_id')
    # cell_output = pd.DataFrame(index=cell_index, columns=output_columns)
    # taz: aggregation; Average, weighted by population
    # \frac{\sum_{Cell\in TAZ} (HasAccess_{Cell}\times Population_{Cell})}{\sum_{Cell\in TAZ}Population_{Cell}}
    # taz_index = ta_zs.index.rename('taz_id')
    # taz_output = pd.DataFrame(index=taz_index, columns=output_columns)
    # subRegion: aggregation; Average, weighted by population
    # \frac{\sum_{Cell\in SubRegion} (HasAccess_{Cell}\times Population_{Cell})}{\sum_{Cell\in SubRegion}Population_{Cell}}
    # sub_region_index = sub_regions.index.rename('subregion_id')
    # sub_region_output = pd.DataFrame(index=sub_region_index, columns=output_columns)
    # region: aggregation; Average, weighted by population
    # \frac{\sum_{Cell\in Region} (HasAccess_{Cell}\times Population_{Cell})}{\sum_{Cell\in Region}Population_{Cell}}
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
