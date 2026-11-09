# KPI 97: Induced Walk Trips
# ID: kpi-096033cb-21e8-4a8c-bf6d-1a19dbb12c9f
# Group: Scenario
# Unit: trips
# Required sources:
#   projects: ScenarioUpstream.Projects.Base Year Walk Trips (BaseYearWalkTrips_{Project})
#   projects: ScenarioUpstream.Projects.Saved Minutes (SavedMinutes_{Project})
#   projects: ScenarioUpstream.Projects.Added Sidewalk Length Miles (AddedSidewalkLengthMIles_{Project})
#   Constant Base Year: BaseYear
#   Constant Bike Ped Growth Rate: BikePedGrowthRate
#   Output geography: ScenarioUpstream.Projects; use table-schema joins for aggregation
#   Output geography: PreprocessedConstants.SubRegions; use table-schema joins for aggregation
# Expected output files:
#   data/kpis/<scenario>/Projects/97_induced_walk_trips.parquet
#   data/kpis/<scenario>/SubRegions/97_induced_walk_trips.parquet
#   data/kpis/<scenario>/Region/97_induced_walk_trips.parquet

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

KPI_NAME = '97_induced_walk_trips'
KPI_ID = 'kpi-096033cb-21e8-4a8c-bf6d-1a19dbb12c9f'
SCENARIO_TYPE = 'Scenario'

# Local variables and non-global dimension options:
# YEAR_OPTIONS = []  # TODO: Define options for Year


def validate(context: RunContext) -> dict[str, object]:
    # projects = validate_table(context, 'ScenarioUpstream', 'Projects')
    # base_year = get_constant('Base Year')
    # bike_ped_growth_rate = get_constant('Bike Ped Growth Rate')
    # year_options = YEAR_OPTIONS
    # sub_regions = validate_table(context, 'PreprocessedConstants', 'SubRegions')
    # return {
    #     'projects': projects,
    #     'base_year': base_year,
    #     'bike_ped_growth_rate': bike_ped_growth_rate,
    #     'year_options': year_options,
    #     'sub_regions': sub_regions,
    # }
    raise NotImplementedError(f'{KPI_NAME}: implement validate')


def process(
    projects: pd.DataFrame,
    base_year: object,
    bike_ped_growth_rate: object,
    year_options: list[object],
    sub_regions: pd.DataFrame,
) -> dict[str, pd.DataFrame]:
    # Formula reference (processing is intentionally left blank):
    # HasWalkImprvement_{Project} = [AddedSidewalkLengthMIles_{Project} > 0]
    # \Delta WalkTrips_{Year,Project} = BaseYearWalkTrips_{Project}\times (1+BikePedGrowthRate)^{Year - BaseYear} \times HasWalkImprvement_{Project} \times 30\%
    # TODO: Implement processing from the inputs above.
    # Suggested output structure: one geography row, one column per option combination.
    # output_columns = [
    #     'induced_walk_trips' + '_' + '_'.join(snake_case(str(v)) for v in options)
    #     for options in product(year_options)
    # ]
    # project: basic unit;
    # project_index = projects.index.rename('project_id')
    # project_output = pd.DataFrame(index=project_index, columns=output_columns)
    # subRegion: aggregation; Sum
    # \sum_{Project \in SubRegion}\Delta Walkrips_{Year,Project}
    # sub_region_index = sub_regions.index.rename('subregion_id')
    # sub_region_output = pd.DataFrame(index=sub_region_index, columns=output_columns)
    # region: aggregation; Sum
    # \sum_{Project \in Region}\Delta Walkrips_{Year,Project}
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
