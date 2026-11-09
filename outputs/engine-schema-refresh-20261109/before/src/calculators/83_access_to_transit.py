# KPI 83: Access to Transit
# ID: kpi-50e09b4f-dd50-4a59-ab63-cfa135baafff
# Group: Scenario
# Unit: %
# Required sources:
#   cells: PreprocessedConstants.Cells.Cell ID (CellID_{Cell})
#   cell_land_use: ScenarioUpstream.CellLandUse.Contains Transit (ContainsTransit_{Cell})
#   cell_land_use: ScenarioUpstream.CellLandUse.Jobs (Jobs_{Cell})
#   cell_land_use: ScenarioUpstream.CellLandUse.Population (Population_{Cell})
#   bike_ped_accessibility_matrix: PreprocessedConstants.BikePedAccessibilityMatrix.Walk 15 min Cell IDs (\{Walk15minCellIDs\}_{Cell})
#   Output geography: PreprocessedConstants.TAZs; use table-schema joins for aggregation
#   Output geography: PreprocessedConstants.SubRegions; use table-schema joins for aggregation
# Expected output files:
#   data/kpis/<scenario>/TAZs/83_access_to_transit.parquet
#   data/kpis/<scenario>/SubRegions/83_access_to_transit.parquet
#   data/kpis/<scenario>/Region/83_access_to_transit.parquet

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

KPI_NAME = '83_access_to_transit'
KPI_ID = 'kpi-50e09b4f-dd50-4a59-ab63-cfa135baafff'
SCENARIO_TYPE = 'Scenario'


def validate(context: RunContext) -> dict[str, object]:
    # cells = validate_table(context, 'PreprocessedConstants', 'Cells')
    # cell_land_use = validate_table(context, 'ScenarioUpstream', 'CellLandUse')
    # bike_ped_accessibility_matrix = validate_table(context, 'PreprocessedConstants', 'BikePedAccessibilityMatrix')
    # ta_zs = validate_table(context, 'PreprocessedConstants', 'TAZs')
    # sub_regions = validate_table(context, 'PreprocessedConstants', 'SubRegions')
    # return {
    #     'cells': cells,
    #     'cell_land_use': cell_land_use,
    #     'bike_ped_accessibility_matrix': bike_ped_accessibility_matrix,
    #     'ta_zs': ta_zs,
    #     'sub_regions': sub_regions,
    # }
    raise NotImplementedError(f'{KPI_NAME}: implement validate')


def process(
    cells: pd.DataFrame,
    cell_land_use: pd.DataFrame,
    bike_ped_accessibility_matrix: pd.DataFrame,
    ta_zs: pd.DataFrame,
    sub_regions: pd.DataFrame,
) -> dict[str, pd.DataFrame]:
    # Formula reference (processing is intentionally left blank):
    # HasAccess_{Cell} = [\sum_{CellID_{Cell_i} \in\{Walk15minCellIDs\}_{Cell}}ContainsTransit_{Cell_i} > 0]
    # TODO: Implement processing from the inputs above.
    # Suggested output structure: one geography row, one column per option combination.
    # output_columns = ['access_to_transit']
    # taz: basic unit;
    # taz_index = ta_zs.index.rename('taz_id')
    # taz_output = pd.DataFrame(index=taz_index, columns=output_columns)
    # subRegion: aggregation; Sum
    # \frac{\sum_{TAZ \in SubRegion}HasAccess_{Cell}\times (Population_{Cell}+Jobs_{Cell})}{\sum_{TAZ \in SubRegion}(Population_{Cell}+Jobs_{Cell})}
    # sub_region_index = sub_regions.index.rename('subregion_id')
    # sub_region_output = pd.DataFrame(index=sub_region_index, columns=output_columns)
    # region: aggregation; Sum
    # \frac{\sum_{TAZ \in Region}HasAccess_{Cell}\times (Population_{Cell}+Jobs_{Cell})}{\sum_{TAZ \in Region}(Population_{Cell}+Jobs_{Cell})}
    # region_index = pd.Index(['Region'], name='region_id')
    # region_output = pd.DataFrame(index=region_index, columns=output_columns)
    # return {
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
