# KPI 32: CMAQ Measure (PHED per Capita)
# ID: kpi-de464013-6bee-455b-9446-49358f5f646a
# Group: Scenario
# Unit: annual hours
# Required sources:
#   kpi_77_link: 77_peak_hour_excessive_delay_phed.parquet at link, current scenario (PHED_{Link})
#   cell_land_use: ScenarioUpstream.CellLandUse.Population (Population_{Cell})
#   Output geography: PreprocessedConstants.Cells; use table-schema joins for aggregation
#   Output geography: PreprocessedConstants.TAZs; use table-schema joins for aggregation
#   Output geography: PreprocessedConstants.SubRegions; use table-schema joins for aggregation
# Expected output files:
#   data/kpis/<scenario>/Cells/32_cmaq_measure_phed_per_capita.parquet
#   data/kpis/<scenario>/TAZs/32_cmaq_measure_phed_per_capita.parquet
#   data/kpis/<scenario>/SubRegions/32_cmaq_measure_phed_per_capita.parquet
#   data/kpis/<scenario>/Region/32_cmaq_measure_phed_per_capita.parquet

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

KPI_NAME = '32_cmaq_measure_phed_per_capita'
KPI_ID = 'kpi-de464013-6bee-455b-9446-49358f5f646a'
SCENARIO_TYPE = 'Scenario'


def validate(context: RunContext) -> dict[str, object]:
    # kpi_77_link = loader.load(context, '77_peak_hour_excessive_delay_phed', path='kpis', scale='link')
    # cell_land_use = validate_table(context, 'ScenarioUpstream', 'CellLandUse')
    # cells = validate_table(context, 'PreprocessedConstants', 'Cells')
    # ta_zs = validate_table(context, 'PreprocessedConstants', 'TAZs')
    # sub_regions = validate_table(context, 'PreprocessedConstants', 'SubRegions')
    # return {
    #     'kpi_77_link': kpi_77_link,
    #     'cell_land_use': cell_land_use,
    #     'cells': cells,
    #     'ta_zs': ta_zs,
    #     'sub_regions': sub_regions,
    # }
    raise NotImplementedError(f'{KPI_NAME}: implement validate')


def process(
    kpi_77_link: pd.DataFrame,
    cell_land_use: pd.DataFrame,
    cells: pd.DataFrame,
    ta_zs: pd.DataFrame,
    sub_regions: pd.DataFrame,
) -> dict[str, pd.DataFrame]:
    # Formula reference (processing is intentionally left blank):
    # PHEDPerCapita_{Zone} = \frac{\sum_{Link\in Zone}PHED_{Link}}{\sum_{Cell\in Zone}Population_{Cell}}
    # TODO: Implement processing from the inputs above.
    # Suggested output structure: one geography row, one column per option combination.
    # output_columns = ['cmaq_measure_phed_per_capita']
    # cell: basic unit;
    # cell_index = cells.index.rename('cell_id')
    # cell_output = pd.DataFrame(index=cell_index, columns=output_columns)
    # taz: basic unit;
    # taz_index = ta_zs.index.rename('taz_id')
    # taz_output = pd.DataFrame(index=taz_index, columns=output_columns)
    # subRegion: basic unit;
    # sub_region_index = sub_regions.index.rename('subregion_id')
    # sub_region_output = pd.DataFrame(index=sub_region_index, columns=output_columns)
    # region: basic unit;
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
