# KPI 82: Land Use eVTOL Compatibility
# ID: kpi-edc7b6bb-5ac6-4abe-aed5-2e1157abf371
# Group: Scenario
# Unit: boolean
# Required sources:
#   cell_land_use: ScenarioUpstream.CellLandUse.eVTOL Compatability (eVTOLCompatability_{Cell})
#   Output geography: PreprocessedConstants.Cells; use table-schema joins for aggregation
# Expected output files:
#   data/kpis/<scenario>/Cells/82_land_use_e_vtol_compatibility.parquet

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

KPI_NAME = '82_land_use_e_vtol_compatibility'
KPI_ID = 'kpi-edc7b6bb-5ac6-4abe-aed5-2e1157abf371'
SCENARIO_TYPE = 'Scenario'


def validate(context: RunContext) -> dict[str, object]:
    # cell_land_use = validate_table(context, 'ScenarioUpstream', 'CellLandUse')
    # cells = validate_table(context, 'PreprocessedConstants', 'Cells')
    # return {
    #     'cell_land_use': cell_land_use,
    #     'cells': cells,
    # }
    raise NotImplementedError(f'{KPI_NAME}: implement validate')


def process(
    cell_land_use: pd.DataFrame,
    cells: pd.DataFrame,
) -> dict[str, pd.DataFrame]:
    # Formula reference (processing is intentionally left blank):
    # Compatability_{Cell} = eVTOLCompatability_{Cell}
    # TODO: Implement processing from the inputs above.
    # Suggested output structure: one geography row, one column per option combination.
    # output_columns = ['land_use_e_vtol_compatibility']
    # cell: basic unit;
    # cell_index = cells.index.rename('cell_id')
    # cell_output = pd.DataFrame(index=cell_index, columns=output_columns)
    # return {
    #     'cell': cell_output,
    # }
    raise NotImplementedError(f'{KPI_NAME}: implement process')


def calculate(context: RunContext) -> None:
    # outputs = process(**validate(context))
    # for scale, output in outputs.items():
    #     writer.write_table(context, KPI_NAME, output, path='kpis', scale=scale)
    raise NotImplementedError(f'{KPI_NAME}: implement calculate')
