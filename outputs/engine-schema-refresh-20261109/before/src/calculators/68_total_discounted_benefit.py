# KPI 68: Total Discounted Benefit
# ID: kpi-82e0b1bf-ba07-452a-a8bf-25d0313a3243
# Group: Scenario
# Unit:
# Required sources:
#   kpi_57_project: 57_monetized_crash_reduction_benefit.parquet at project, current scenario (CrashReductionBenefit_{Project})
#   kpi_59_project: 59_monetized_travel_time_savings_benefit.parquet at project, current scenario (TravelTimeBenefit_{Project})
#   kpi_60_project: 60_monetized_emission_reduction_benefits.parquet at project, current scenario (EmissionBenefit_{Project})
#   kpi_61_project: 61_monetized_vehicle_operating_cost_savings_benefit.parquet at project, current scenario (VehOperBenefit_{Project})
#   kpi_63_project: 63_monetized_project_health_benefits.parquet at project, current scenario (HealthBenefit_{Project})
#   kpi_64_project: 64_monetized_bike_ped_amenity_benefits.parquet at project, current scenario (BikePedAmenityBenefit_{Project})
#   kpi_65_project: 65_monetized_reduced_other_highway_externalities_benefits.parquet at project, current scenario (HighwayExternalityBenefit_{Project})
#   kpi_67_project: 67_monetized_avoided_flood_damages_benefit.parquet at project, current scenario (FloodAvoidanceBenefit_{Project})
#   kpi_71_project: 71_residual_value.parquet at project, current scenario (ResidualValue_{Project})
#   Output geography: ScenarioUpstream.Projects; use table-schema joins for aggregation
#   Output geography: PreprocessedConstants.Corridors; use table-schema joins for aggregation
#   Output geography: PreprocessedConstants.SubRegions; use table-schema joins for aggregation
# Expected output files:
#   data/kpis/<scenario>/Projects/68_total_discounted_benefit.parquet
#   data/kpis/<scenario>/Corridors/68_total_discounted_benefit.parquet
#   data/kpis/<scenario>/SubRegions/68_total_discounted_benefit.parquet
#   data/kpis/<scenario>/Region/68_total_discounted_benefit.parquet

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

KPI_NAME = '68_total_discounted_benefit'
KPI_ID = 'kpi-82e0b1bf-ba07-452a-a8bf-25d0313a3243'
SCENARIO_TYPE = 'Scenario'


def validate(context: RunContext) -> dict[str, object]:
    # kpi_57_project = loader.load(context, '57_monetized_crash_reduction_benefit', path='kpis', scale='project')
    # kpi_59_project = loader.load(context, '59_monetized_travel_time_savings_benefit', path='kpis', scale='project')
    # kpi_60_project = loader.load(context, '60_monetized_emission_reduction_benefits', path='kpis', scale='project')
    # kpi_61_project = loader.load(context, '61_monetized_vehicle_operating_cost_savings_benefit', path='kpis', scale='project')
    # kpi_63_project = loader.load(context, '63_monetized_project_health_benefits', path='kpis', scale='project')
    # kpi_64_project = loader.load(context, '64_monetized_bike_ped_amenity_benefits', path='kpis', scale='project')
    # kpi_65_project = loader.load(context, '65_monetized_reduced_other_highway_externalities_benefits', path='kpis', scale='project')
    # kpi_67_project = loader.load(context, '67_monetized_avoided_flood_damages_benefit', path='kpis', scale='project')
    # kpi_71_project = loader.load(context, '71_residual_value', path='kpis', scale='project')
    # projects = validate_table(context, 'ScenarioUpstream', 'Projects')
    # corridors = validate_table(context, 'PreprocessedConstants', 'Corridors')
    # sub_regions = validate_table(context, 'PreprocessedConstants', 'SubRegions')
    # return {
    #     'kpi_57_project': kpi_57_project,
    #     'kpi_59_project': kpi_59_project,
    #     'kpi_60_project': kpi_60_project,
    #     'kpi_61_project': kpi_61_project,
    #     'kpi_63_project': kpi_63_project,
    #     'kpi_64_project': kpi_64_project,
    #     'kpi_65_project': kpi_65_project,
    #     'kpi_67_project': kpi_67_project,
    #     'kpi_71_project': kpi_71_project,
    #     'projects': projects,
    #     'corridors': corridors,
    #     'sub_regions': sub_regions,
    # }
    raise NotImplementedError(f'{KPI_NAME}: implement validate')


def process(
    kpi_57_project: pd.DataFrame,
    kpi_59_project: pd.DataFrame,
    kpi_60_project: pd.DataFrame,
    kpi_61_project: pd.DataFrame,
    kpi_63_project: pd.DataFrame,
    kpi_64_project: pd.DataFrame,
    kpi_65_project: pd.DataFrame,
    kpi_67_project: pd.DataFrame,
    kpi_71_project: pd.DataFrame,
    projects: pd.DataFrame,
    corridors: pd.DataFrame,
    sub_regions: pd.DataFrame,
) -> dict[str, pd.DataFrame]:
    # Formula reference (processing is intentionally left blank):
    # Benefit_{Project} = CrashReductionBenefit_{Project}+TravelTimeBenefit_{Project}+
    # EmissionBenefit_{Project}+
    # VehOperBenefit_{Project}+HealthBenefit_{Project}+BikePedAmenityBenefit_{Project}+HighwayExternalityBenefit_{Project}+FloodAvoidanceBenefit_{Project}+ResidualValue_{Project}
    # TODO: Implement processing from the inputs above.
    # Suggested output structure: one geography row, one column per option combination.
    # output_columns = ['total_discounted_benefit']
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
