# KPI 13: Vulnerable Population Around Projects
# ID: kpi-89efba65-67bc-4328-ac4f-37bbb339b961
# Group: Scenario
# Unit: persons
# Required sources:
#   bike_ped_accessibility_matrix: PreprocessedConstants.BikePedAccessibilityMatrix.Buffer Quarter Mile Cell IDs (\{BufferQuarterMileCellIDs\}_{Cell})
#   projects: ScenarioUpstream.Projects.Cell IDs (\{CellIDs\}_{Project})
#   cells: PreprocessedConstants.Cells.Cell ID (CellID_{Cell})
#   cell_land_use: ScenarioUpstream.CellLandUse.Vulnerable Population (VulnerablePopulation_{Cell})
#   Output geography: ScenarioUpstream.Projects; use table-schema joins for aggregation
#   Output geography: PreprocessedConstants.Corridors; use table-schema joins for aggregation
#   Output geography: PreprocessedConstants.SubRegions; use table-schema joins for aggregation
# Expected output files:
#   data/kpis/<scenario>/Projects/13_vulnerable_population_around_projects.parquet
#   data/kpis/<scenario>/Corridors/13_vulnerable_population_around_projects.parquet
#   data/kpis/<scenario>/SubRegions/13_vulnerable_population_around_projects.parquet
#   data/kpis/<scenario>/Region/13_vulnerable_population_around_projects.parquet
# Pending confirmation on criteria

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

KPI_NAME = '13_vulnerable_population_around_projects'
KPI_ID = 'kpi-89efba65-67bc-4328-ac4f-37bbb339b961'
SCENARIO_TYPE = 'Scenario'


def validate(context: RunContext) -> dict[str, object]:
    # bike_ped_accessibility_matrix = validate_table(context, 'PreprocessedConstants', 'BikePedAccessibilityMatrix')
    # projects = validate_table(context, 'ScenarioUpstream', 'Projects')
    # cells = validate_table(context, 'PreprocessedConstants', 'Cells')
    # cell_land_use = validate_table(context, 'ScenarioUpstream', 'CellLandUse')
    # corridors = validate_table(context, 'PreprocessedConstants', 'Corridors')
    # sub_regions = validate_table(context, 'PreprocessedConstants', 'SubRegions')
    # return {
    #     'bike_ped_accessibility_matrix': bike_ped_accessibility_matrix,
    #     'projects': projects,
    #     'cells': cells,
    #     'cell_land_use': cell_land_use,
    #     'corridors': corridors,
    #     'sub_regions': sub_regions,
    # }
    raise NotImplementedError(f'{KPI_NAME}: implement validate')


def process(
    bike_ped_accessibility_matrix: pd.DataFrame,
    projects: pd.DataFrame,
    cells: pd.DataFrame,
    cell_land_use: pd.DataFrame,
    corridors: pd.DataFrame,
    sub_regions: pd.DataFrame,
) -> dict[str, pd.DataFrame]:
    # Formula reference (processing is intentionally left blank):
    # \{ProjectCellIDs\}_{Zone} = \bigcup_{Project \in Zone} \{CellIDs\}_{Project}
    # \{BufferCellIDs\}_{Zone} = \bigcup_{CellID_{Cell}\in \{ProjectCellIDs\}_{Zone}}\{BufferQuarterMileCellIDs\}_{Cell}
    # ProjectEJ_{Zone} = \sum_{idOf(Cell)\in \{BufferCellIDs\}_{Zone}} VulnerablePopulation_{Cell}
    # TODO: Implement processing from the inputs above.
    # Suggested output structure: one geography row, one column per option combination.
    # output_columns = ['vulnerable_population_around_projects']
    # project: basic unit;
    # project_index = projects.index.rename('project_id')
    # project_output = pd.DataFrame(index=project_index, columns=output_columns)
    # corridor: basic unit; Sum
    # corridor_index = corridors.index.rename('corridor_id')
    # corridor_output = pd.DataFrame(index=corridor_index, columns=output_columns)
    # subRegion: basic unit; Sum
    # sub_region_index = sub_regions.index.rename('subregion_id')
    # sub_region_output = pd.DataFrame(index=sub_region_index, columns=output_columns)
    # region: basic unit; Sum
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
