# KPI 63: Monetized Project Health Benefits
# ID: kpi-f80f7946-b981-4d87-a252-5e74f82f5a25
# Group: Scenario
# Unit:
# Required sources:
#   Constant Walk Health Benefit Per Trip: WalkHealthBenefitPerTrip
#   Constant Bike Health Benefit Per Trip: BikeHealthBenefitPerTrip
#   Constant Walk Health Benefit Eligible Rate: WalkHealthBenefitEligibleRate
#   Constant Bike Health Benefit Eligible Rate: BikeHealthBenefitEligibleRate
#   kpi_97_project: 97_induced_walk_trips.parquet at project, current scenario (\Delta WalkTrips_{Year,Project})
#   kpi_98_project: 98_induced_bike_trips.parquet at project, current scenario (\Delta BikeTrips_{Year,Project})
#   Constant Discount Rate: DiscountRate
#   Constant Base Year: BaseYear
#   projects: ScenarioUpstream.Projects.Open Year (OpenYear_{Project})
#   projects: ScenarioUpstream.Projects.End Year (EndYear_{Project})
#   Output geography: ScenarioUpstream.Projects; use table-schema joins for aggregation
#   Output geography: PreprocessedConstants.Corridors; use table-schema joins for aggregation
#   Output geography: PreprocessedConstants.SubRegions; use table-schema joins for aggregation
# Expected output files:
#   data/kpis/<scenario>/Projects/63_monetized_project_health_benefits.parquet
#   data/kpis/<scenario>/Corridors/63_monetized_project_health_benefits.parquet
#   data/kpis/<scenario>/SubRegions/63_monetized_project_health_benefits.parquet
#   data/kpis/<scenario>/Region/63_monetized_project_health_benefits.parquet

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

KPI_NAME = '63_monetized_project_health_benefits'
KPI_ID = 'kpi-f80f7946-b981-4d87-a252-5e74f82f5a25'
SCENARIO_TYPE = 'Scenario'

# Local variables and non-global dimension options:
# YEAR_OPTIONS = []  # TODO: Define years, e.g. from project OpenYear/EndYear


def validate(context: RunContext) -> dict[str, object]:
    # walk_health_benefit_per_trip = get_constant('Walk Health Benefit Per Trip')
    # bike_health_benefit_per_trip = get_constant('Bike Health Benefit Per Trip')
    # walk_health_benefit_eligible_rate = get_constant('Walk Health Benefit Eligible Rate')
    # bike_health_benefit_eligible_rate = get_constant('Bike Health Benefit Eligible Rate')
    # kpi_97_project = loader.load(context, '97_induced_walk_trips', path='kpis', scale='project')
    # kpi_98_project = loader.load(context, '98_induced_bike_trips', path='kpis', scale='project')
    # discount_rate = get_constant('Discount Rate')
    # base_year = get_constant('Base Year')
    # projects = validate_table(context, 'ScenarioUpstream', 'Projects')
    # year_options = YEAR_OPTIONS
    # corridors = validate_table(context, 'PreprocessedConstants', 'Corridors')
    # sub_regions = validate_table(context, 'PreprocessedConstants', 'SubRegions')
    # return {
    #     'walk_health_benefit_per_trip': walk_health_benefit_per_trip,
    #     'bike_health_benefit_per_trip': bike_health_benefit_per_trip,
    #     'walk_health_benefit_eligible_rate': walk_health_benefit_eligible_rate,
    #     'bike_health_benefit_eligible_rate': bike_health_benefit_eligible_rate,
    #     'kpi_97_project': kpi_97_project,
    #     'kpi_98_project': kpi_98_project,
    #     'discount_rate': discount_rate,
    #     'base_year': base_year,
    #     'projects': projects,
    #     'year_options': year_options,
    #     'corridors': corridors,
    #     'sub_regions': sub_regions,
    # }
    raise NotImplementedError(f'{KPI_NAME}: implement validate')


def process(
    walk_health_benefit_per_trip: object,
    bike_health_benefit_per_trip: object,
    walk_health_benefit_eligible_rate: object,
    bike_health_benefit_eligible_rate: object,
    kpi_97_project: pd.DataFrame,
    kpi_98_project: pd.DataFrame,
    discount_rate: object,
    base_year: object,
    projects: pd.DataFrame,
    year_options: list[object],
    corridors: pd.DataFrame,
    sub_regions: pd.DataFrame,
) -> dict[str, pd.DataFrame]:
    # Formula reference (processing is intentionally left blank):
    # WalkBenefit_{Year,Project} = \Delta WalkTrips_{Year,Project} \times WalkHealthBenefitEligibleRate \times WalkHealthBenefitPerTrip
    # BikeBenefit_{Year,Project} = \Delta BikeTrips_{Year,Project} \times BikeHealthBenefitEligibleRate \times BikeHealthBenefitPerTrip
    # Benefit_{Project} = \sum_{Year=OpenYear_{Project}}^{EndYear_{Project}}\frac{WalkBenefit_{Year,Project}+BikeBenefit_{Year,Project}}{(1+DiscountRate)^{Year-BaseYear}}
    # TODO: Implement processing from the inputs above.
    # Suggested output structure: one geography row, one column per option combination.
    # output_columns = ['monetized_project_health_benefits']
    # project: basic unit;
    # project_index = projects.index.rename('project_id')
    # project_output = pd.DataFrame(index=project_index, columns=output_columns)
    # corridor: aggregation; Sum
    # \sum_{Project \in Corridor}Benefit_{Project}
    # corridor_index = corridors.index.rename('corridor_id')
    # corridor_output = pd.DataFrame(index=corridor_index, columns=output_columns)
    # subRegion: aggregation; Sum
    # \sum_{Project \in SubRegion}Benefit_{Project}
    # sub_region_index = sub_regions.index.rename('subregion_id')
    # sub_region_output = pd.DataFrame(index=sub_region_index, columns=output_columns)
    # region: aggregation; Sum
    # \sum_{Project \in Region}Benefit_{Project}
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
