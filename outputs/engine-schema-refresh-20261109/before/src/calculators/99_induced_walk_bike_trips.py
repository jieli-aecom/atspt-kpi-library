# KPI 99: Induced Walk-Bike Trips
# ID: kpi-7c2bc33b-8321-4a4a-8708-00afaeac38dc
# Group: Scenario
# Unit: trips
# Required sources:
#   kpi_97_project: 97_induced_walk_trips.parquet at project, current scenario (\Delta WalkTrips_{Year,Project})
#   kpi_98_project: 98_induced_bike_trips.parquet at project, current scenario (\Delta BikeTrips_{Year,Project})
#   Output geography: ScenarioUpstream.Projects; use table-schema joins for aggregation
#   Output geography: PreprocessedConstants.SubRegions; use table-schema joins for aggregation
# Expected output files:
#   data/kpis/<scenario>/Projects/99_induced_walk_bike_trips.parquet
#   data/kpis/<scenario>/SubRegions/99_induced_walk_bike_trips.parquet
#   data/kpis/<scenario>/Region/99_induced_walk_bike_trips.parquet

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

KPI_NAME = '99_induced_walk_bike_trips'
KPI_ID = 'kpi-7c2bc33b-8321-4a4a-8708-00afaeac38dc'
SCENARIO_TYPE = 'Scenario'

# Local variables and non-global dimension options:
# YEAR_OPTIONS = []  # TODO: Define options for Year


def validate(context: RunContext) -> dict[str, object]:
    # kpi_97_project = loader.load(context, '97_induced_walk_trips', path='kpis', scale='project')
    # kpi_98_project = loader.load(context, '98_induced_bike_trips', path='kpis', scale='project')
    # year_options = YEAR_OPTIONS
    # projects = validate_table(context, 'ScenarioUpstream', 'Projects')
    # sub_regions = validate_table(context, 'PreprocessedConstants', 'SubRegions')
    # return {
    #     'kpi_97_project': kpi_97_project,
    #     'kpi_98_project': kpi_98_project,
    #     'year_options': year_options,
    #     'projects': projects,
    #     'sub_regions': sub_regions,
    # }
    raise NotImplementedError(f'{KPI_NAME}: implement validate')


def process(
    kpi_97_project: pd.DataFrame,
    kpi_98_project: pd.DataFrame,
    year_options: list[object],
    projects: pd.DataFrame,
    sub_regions: pd.DataFrame,
) -> dict[str, pd.DataFrame]:
    # Formula reference (processing is intentionally left blank):
    # \Delta BikePedTrips_{Year,Project} = \Delta BikeTrips_{Year,Project}+\Delta WalkTrips_{Year,Project}
    # TODO: Implement processing from the inputs above.
    # Suggested output structure: one geography row, one column per option combination.
    # output_columns = [
    #     'induced_walk_bike_trips' + '_' + '_'.join(snake_case(str(v)) for v in options)
    #     for options in product(year_options)
    # ]
    # project: basic unit;
    # project_index = projects.index.rename('project_id')
    # project_output = pd.DataFrame(index=project_index, columns=output_columns)
    # subRegion: aggregation; Sum
    # \sum_{Project \in SubRegion}\Delta BikePedTrips_{Year,Project}
    # sub_region_index = sub_regions.index.rename('subregion_id')
    # sub_region_output = pd.DataFrame(index=sub_region_index, columns=output_columns)
    # region: aggregation; Sum
    # \sum_{Project \in Region}\Delta BikePedTrips_{Year,Project}
    # region_index = pd.Index(['Region'], name='region_id')
    # region_output = pd.DataFrame(index=region_index, columns=output_columns)
    # return {
    #     'project': project_output,
    #     'subRegion': sub_region_output,
    #     'region': region_output,
    # }
    raise NotImplementedError(f'{KPI_NAME}: implement process')


def calculate(context: RunContext) -> None:
    # outputs = process(**validate(context))
    # for scale, output in outputs.items():
    #     writer.write_table(context, KPI_NAME, output, path='kpis', scale=scale)
    raise NotImplementedError(f'{KPI_NAME}: implement calculate')
