# KPI 45: Imperviousness
# ID: kpi-930fa57b-a79a-49ca-8bf5-56412cd384c2
# Group: Scenario
# Unit: %
# Required sources:
#   cells: PreprocessedConstants.Cells.Area Sqft (AreaSqft_{Cell})
#   cell_land_use: ScenarioUpstream.CellLandUse.Imperviousness (Imperviousness_{Cell})
#   Output geography: PreprocessedConstants.Cells; use table-schema joins for aggregation
#   Output geography: PreprocessedConstants.TAZs; use table-schema joins for aggregation
#   Output geography: PreprocessedConstants.SubRegions; use table-schema joins for aggregation
# Expected output files:
#   data/kpis/<scenario>/Cells/45_imperviousness.parquet
#   data/kpis/<scenario>/TAZs/45_imperviousness.parquet
#   data/kpis/<scenario>/SubRegions/45_imperviousness.parquet
#   data/kpis/<scenario>/Region/45_imperviousness.parquet
# Methodology to be created

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

KPI_NAME = '45_imperviousness'
KPI_ID = 'kpi-930fa57b-a79a-49ca-8bf5-56412cd384c2'
SCENARIO_TYPE = 'Scenario'


def validate(context: RunContext) -> dict[str, object]:
    # cells = validate_table(context, 'PreprocessedConstants', 'Cells')
    # cell_land_use = validate_table(context, 'ScenarioUpstream', 'CellLandUse')
    # ta_zs = validate_table(context, 'PreprocessedConstants', 'TAZs')
    # sub_regions = validate_table(context, 'PreprocessedConstants', 'SubRegions')
    # return {
    #     'cells': cells,
    #     'cell_land_use': cell_land_use,
    #     'ta_zs': ta_zs,
    #     'sub_regions': sub_regions,
    # }
    raise NotImplementedError(f'{KPI_NAME}: implement validate')


def process(
    cells: pd.DataFrame,
    cell_land_use: pd.DataFrame,
    ta_zs: pd.DataFrame,
    sub_regions: pd.DataFrame,
) -> dict[str, pd.DataFrame]:
    # Formula reference (processing is intentionally left blank):
    # PctImp_{Cell} = Imperviousness_{Cell}
    # TODO: Implement processing from the inputs above.
    # Suggested output structure: one geography row, one column per option combination.
    # output_columns = ['imperviousness']
    # cell: basic unit;
    # cell_index = cells.index.rename('cell_id')
    # cell_output = pd.DataFrame(index=cell_index, columns=output_columns)
    # taz: aggregation;
    # \frac{\sum_{Cell \in TAZ}(PctImp_{Cell}\times AreaSqft_{Cell})}{\sum_{Cell \in TAZ}AreaSqft_{Cell}}
    # taz_index = ta_zs.index.rename('taz_id')
    # taz_output = pd.DataFrame(index=taz_index, columns=output_columns)
    # subRegion: aggregation; Sum
    # \frac{\sum_{Cell \in SubRegion}(PctImp_{Cell}\times AreaSqft_{Cell})}{\sum_{Cell \in SubRegion}AreaSqft_{Cell}}
    # sub_region_index = sub_regions.index.rename('subregion_id')
    # sub_region_output = pd.DataFrame(index=sub_region_index, columns=output_columns)
    # region: aggregation; Sum
    # \frac{\sum_{Cell \in Region}(PctImp_{Cell}\times AreaSqft_{Cell})}{\sum_{Cell \in Region}AreaSqft_{Cell}}
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
