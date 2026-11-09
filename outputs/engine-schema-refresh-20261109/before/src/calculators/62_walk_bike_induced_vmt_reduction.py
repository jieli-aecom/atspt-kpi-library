# KPI 62: Walk/Bike-Induced VMT Reduction
# ID: kpi-28e99d44-b219-4503-8663-b9f99abe4a1f
# Group: Scenario
# Unit:
# Required sources:
#   kpi_99_project: 99_induced_walk_bike_trips.parquet at project, current scenario (\Delta BikePedTrips_{Year,Project})
#   Constant Bike Ped Removal Rate: BikePedRemovalRate
#   Output geography: ScenarioUpstream.Projects; use table-schema joins for aggregation
#   Output geography: PreprocessedConstants.Corridors; use table-schema joins for aggregation
#   Output geography: PreprocessedConstants.SubRegions; use table-schema joins for aggregation
# Expected output files:
#   data/kpis/<scenario>/Projects/62_walk_bike_induced_vmt_reduction.parquet
#   data/kpis/<scenario>/Corridors/62_walk_bike_induced_vmt_reduction.parquet
#   data/kpis/<scenario>/SubRegions/62_walk_bike_induced_vmt_reduction.parquet
#   data/kpis/<scenario>/Region/62_walk_bike_induced_vmt_reduction.parquet

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

KPI_NAME = '62_walk_bike_induced_vmt_reduction'
KPI_ID = 'kpi-28e99d44-b219-4503-8663-b9f99abe4a1f'
SCENARIO_TYPE = 'Scenario'

# Local variables and non-global dimension options:
# YEAR_OPTIONS = []  # TODO: Define options for Year


def validate(context: RunContext) -> dict[str, object]:
    # kpi_99_project = loader.load(context, '99_induced_walk_bike_trips', path='kpis', scale='project')
    # bike_ped_removal_rate = get_constant('Bike Ped Removal Rate')
    # year_options = YEAR_OPTIONS
    # projects = validate_table(context, 'ScenarioUpstream', 'Projects')
    # corridors = validate_table(context, 'PreprocessedConstants', 'Corridors')
    # sub_regions = validate_table(context, 'PreprocessedConstants', 'SubRegions')
    # return {
    #     'kpi_99_project': kpi_99_project,
    #     'bike_ped_removal_rate': bike_ped_removal_rate,
    #     'year_options': year_options,
    #     'projects': projects,
    #     'corridors': corridors,
    #     'sub_regions': sub_regions,
    # }
    raise NotImplementedError(f'{KPI_NAME}: implement validate')


def process(
    kpi_99_project: pd.DataFrame,
    bike_ped_removal_rate: object,
    year_options: list[object],
    projects: pd.DataFrame,
    corridors: pd.DataFrame,
    sub_regions: pd.DataFrame,
) -> dict[str, pd.DataFrame]:
    # Formula reference (processing is intentionally left blank):
    # VMT_{Year,Project} = \Delta BikePedTrips_{Year,Project} \times BikePedRemovalRate
    # TODO: Implement processing from the inputs above.
    # Suggested output structure: one geography row, one column per option combination.
    # output_columns = [
    #     'walk_bike_induced_vmt_reduction' + '_' + '_'.join(snake_case(str(v)) for v in options)
    #     for options in product(year_options)
    # ]
    # project: basic unit;
    # project_index = projects.index.rename('project_id')
    # project_output = pd.DataFrame(index=project_index, columns=output_columns)
    # corridor: aggregation;
    # \sum_{Project \in Corridor}VMT_{Year,Project}
    # corridor_index = corridors.index.rename('corridor_id')
    # corridor_output = pd.DataFrame(index=corridor_index, columns=output_columns)
    # subRegion: aggregation;
    # \sum_{Project \in SubRegion}VMT_{Year,Project}
    # sub_region_index = sub_regions.index.rename('subregion_id')
    # sub_region_output = pd.DataFrame(index=sub_region_index, columns=output_columns)
    # region: aggregation;
    # \sum_{Project \in Region}VMT_{Year,Project}
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
