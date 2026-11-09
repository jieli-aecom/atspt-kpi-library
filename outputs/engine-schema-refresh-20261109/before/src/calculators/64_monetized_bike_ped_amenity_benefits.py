# KPI 64: Monetized Bike/Ped Amenity Benefits
# ID: kpi-f4de5da7-372a-4cf5-b27c-a22584b94094
# Group: Scenario
# Unit:
# Required sources:
#   kpi_97_project: 97_induced_walk_trips.parquet at project, current scenario (\Delta WalkTrips_{Year,Project})
#   kpi_98_project: 98_induced_bike_trips.parquet at project, current scenario (\Delta BikeTrips_{Year,Project})
#   projects: ScenarioUpstream.Projects.Added Sidewalk Length Miles (AddedSidewalkLengthMiles_{Project})
#   projects: ScenarioUpstream.Projects.Added Sidewalk Width Feet (AddedSidewalkWidthFeet_{Project})
#   projects: ScenarioUpstream.Projects.Added Bike Amenity Length Miles (AddedBikeFeet_{Project})
#   projects: ScenarioUpstream.Projects.Base Year Bike Trips (BaseYearBikeTrips_{Project})
#   projects: ScenarioUpstream.Projects.Base Year Walk Trips (BaseYearWalkTrips_{Project})
#   Constant Base Year: BaseYear
#   Constant Bike Ped Growth Rate: BikePedGR
#   Constant Sidewalk Benefit Per Person-Mile: SidewalkBenefitPerPersonMile
#   Constant Bike Amenity Benefit Per Person-Mile: BikeAmenityBenefitPerPersonMile
#   Constant Discount Rate: DiscountRate
#   projects: ScenarioUpstream.Projects.Open Year (OpenYear_{Project})
#   projects: ScenarioUpstream.Projects.End Year (EndYear_{Project})
#   Output geography: ScenarioUpstream.Projects; use table-schema joins for aggregation
#   Output geography: PreprocessedConstants.Corridors; use table-schema joins for aggregation
#   Output geography: PreprocessedConstants.SubRegions; use table-schema joins for aggregation
# Expected output files:
#   data/kpis/<scenario>/Projects/64_monetized_bike_ped_amenity_benefits.parquet
#   data/kpis/<scenario>/Corridors/64_monetized_bike_ped_amenity_benefits.parquet
#   data/kpis/<scenario>/SubRegions/64_monetized_bike_ped_amenity_benefits.parquet
#   data/kpis/<scenario>/Region/64_monetized_bike_ped_amenity_benefits.parquet

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

KPI_NAME = '64_monetized_bike_ped_amenity_benefits'
KPI_ID = 'kpi-f4de5da7-372a-4cf5-b27c-a22584b94094'
SCENARIO_TYPE = 'Scenario'

# Local variables and non-global dimension options:
# YEAR_OPTIONS = []  # TODO: Define years, e.g. from project OpenYear/EndYear


def validate(context: RunContext) -> dict[str, object]:
    # kpi_97_project = loader.load(context, '97_induced_walk_trips', path='kpis', scale='project')
    # kpi_98_project = loader.load(context, '98_induced_bike_trips', path='kpis', scale='project')
    # projects = validate_table(context, 'ScenarioUpstream', 'Projects')
    # base_year = get_constant('Base Year')
    # bike_ped_growth_rate = get_constant('Bike Ped Growth Rate')
    # sidewalk_benefit_per_person_mile = get_constant('Sidewalk Benefit Per Person-Mile')
    # bike_amenity_benefit_per_person_mile = get_constant('Bike Amenity Benefit Per Person-Mile')
    # discount_rate = get_constant('Discount Rate')
    # year_options = YEAR_OPTIONS
    # corridors = validate_table(context, 'PreprocessedConstants', 'Corridors')
    # sub_regions = validate_table(context, 'PreprocessedConstants', 'SubRegions')
    # return {
    #     'kpi_97_project': kpi_97_project,
    #     'kpi_98_project': kpi_98_project,
    #     'projects': projects,
    #     'base_year': base_year,
    #     'bike_ped_growth_rate': bike_ped_growth_rate,
    #     'sidewalk_benefit_per_person_mile': sidewalk_benefit_per_person_mile,
    #     'bike_amenity_benefit_per_person_mile': bike_amenity_benefit_per_person_mile,
    #     'discount_rate': discount_rate,
    #     'year_options': year_options,
    #     'corridors': corridors,
    #     'sub_regions': sub_regions,
    # }
    raise NotImplementedError(f'{KPI_NAME}: implement validate')


def process(
    kpi_97_project: pd.DataFrame,
    kpi_98_project: pd.DataFrame,
    projects: pd.DataFrame,
    base_year: object,
    bike_ped_growth_rate: object,
    sidewalk_benefit_per_person_mile: object,
    bike_amenity_benefit_per_person_mile: object,
    discount_rate: object,
    year_options: list[object],
    corridors: pd.DataFrame,
    sub_regions: pd.DataFrame,
) -> dict[str, pd.DataFrame]:
    # Formula reference (processing is intentionally left blank):
    # NBWalkTripsAdded_{Project} = BaseYearWalkTrips_{Project}\times (1+BikePedGR)^{Year-BaseYear}
    # NBBikeTripsAdded_{Project} = BaseYearBikeTrips_{Project}\times (1+BikePedGR)^{Year-BaseYear}
    # AddedSidewalkMileFeet = \max(AddedSidewalkLengthMiles_{Project},0.86)\times AddedSidewalkWidthFeet_{Project}
    # SidewalkBenefit_{Year,Project} = AddedSidewalkMileFeet\times (NBWalkTripsAdded_{Project} + 0.5\times \Delta WalkTrips_{Year,Project})\times SidewalkBenefitPerPersonMile
    # BikeAmenBenefit_{Year,Project} = (NBBikeTripsAdded_{Project} + 0.5\times \Delta BikeTrips_{Year,Project})\times max(AddedBikeFeet_{Project},2.38)\times  BikeAmenityBenefitPerPersonMile
    # Benefit_{Year,Project} = SidewalkBenefit_{Year,Project}+BikeAmenBenefit_{Year,Project}
    # Benefit_{Project} = \sum_{Year=OpenYear_{Project}}^{EndYear_{Project}}\frac{Benefit_{Year,Project}}{(1+DiscountRate)^{Year-BaseYear}}
    # TODO: Implement processing from the inputs above.
    # Suggested output structure: one geography row, one column per option combination.
    # output_columns = ['monetized_bike_ped_amenity_benefits']
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
