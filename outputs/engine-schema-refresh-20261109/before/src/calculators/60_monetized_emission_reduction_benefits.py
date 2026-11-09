# KPI 60: Monetized Emission Reduction Benefits
# ID: kpi-cbb9b9b8-9eeb-47b0-95db-5cc340a01b32
# Group: Scenario
# Unit: base year dollars
# Required sources:
#   kpi_14_project: 14_emission_reduction_project_based.parquet at project, current scenario (\Delta EmissionTons_{Project,EmissionType})
#   Lookup EmissionDamageDollarsLookup (EmissionDamageDollarsLookup(,))
#   Constant Discount Rate: DiscountRate
#   Constant Base Year: BaseYear
#   projects: ScenarioUpstream.Projects.End Year (EndYear_{Project})
#   projects: ScenarioUpstream.Projects.Open Year (OpenYear_{Project})
#   Output geography: ScenarioUpstream.Projects; use table-schema joins for aggregation
#   Output geography: PreprocessedConstants.Corridors; use table-schema joins for aggregation
#   Output geography: PreprocessedConstants.SubRegions; use table-schema joins for aggregation
# Expected output files:
#   data/kpis/<scenario>/Projects/60_monetized_emission_reduction_benefits.parquet
#   data/kpis/<scenario>/Corridors/60_monetized_emission_reduction_benefits.parquet
#   data/kpis/<scenario>/SubRegions/60_monetized_emission_reduction_benefits.parquet
#   data/kpis/<scenario>/Region/60_monetized_emission_reduction_benefits.parquet

from __future__ import annotations

from collections.abc import Callable

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

KPI_NAME = '60_monetized_emission_reduction_benefits'
KPI_ID = 'kpi-cbb9b9b8-9eeb-47b0-95db-5cc340a01b32'
SCENARIO_TYPE = 'Scenario'

# Local variables and non-global dimension options:
# YEAR_OPTIONS = []  # TODO: Define years, e.g. from project OpenYear/EndYear


def validate(context: RunContext) -> dict[str, object]:
    # kpi_14_project = loader.load(context, '14_emission_reduction_project_based', path='kpis', scale='project')
    # emission_damage_dollars_lookup = get_lookup('EmissionDamageDollarsLookup')
    # discount_rate = get_constant('Discount Rate')
    # base_year = get_constant('Base Year')
    # projects = validate_table(context, 'ScenarioUpstream', 'Projects')
    # emission_type = get_domain('Emission Type')
    # year_options = YEAR_OPTIONS
    # corridors = validate_table(context, 'PreprocessedConstants', 'Corridors')
    # sub_regions = validate_table(context, 'PreprocessedConstants', 'SubRegions')
    # return {
    #     'kpi_14_project': kpi_14_project,
    #     'emission_damage_dollars_lookup': emission_damage_dollars_lookup,
    #     'discount_rate': discount_rate,
    #     'base_year': base_year,
    #     'projects': projects,
    #     'emission_type': emission_type,
    #     'year_options': year_options,
    #     'corridors': corridors,
    #     'sub_regions': sub_regions,
    # }
    raise NotImplementedError(f'{KPI_NAME}: implement validate')


def process(
    kpi_14_project: pd.DataFrame,
    emission_damage_dollars_lookup: Callable[..., object],
    discount_rate: object,
    base_year: object,
    projects: pd.DataFrame,
    emission_type: list[str],
    year_options: list[object],
    corridors: pd.DataFrame,
    sub_regions: pd.DataFrame,
) -> dict[str, pd.DataFrame]:
    # Formula reference (processing is intentionally left blank):
    # Benefit_{Year,Project} = \sum_{EmissionType}\Delta EmissionTons_{Project,EmissionType}\times EmissionDamageDollarsLookup(EmissionType,Year)
    # Benefit_{Project} = \sum_{Year=OpenYear_{Project}}^{EndYear_{Project}}\frac{Benefit_{Year,Project}}{(1 + DiscountRate)^{Year - BaseYear}}
    # TODO: Implement processing from the inputs above.
    # Suggested output structure: one geography row, one column per option combination.
    # output_columns = ['monetized_emission_reduction_benefits']
    # project: basic unit;
    # project_index = projects.index.rename('project_id')
    # project_output = pd.DataFrame(index=project_index, columns=output_columns)
    # corridor: aggregation;
    # \sum_{Project \in Corridor}Benefit_{Project}
    # corridor_index = corridors.index.rename('corridor_id')
    # corridor_output = pd.DataFrame(index=corridor_index, columns=output_columns)
    # subRegion: aggregation;
    # \sum_{Project \in SubRegion}Benefit_{Project}
    # sub_region_index = sub_regions.index.rename('subregion_id')
    # sub_region_output = pd.DataFrame(index=sub_region_index, columns=output_columns)
    # region: aggregation;
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
