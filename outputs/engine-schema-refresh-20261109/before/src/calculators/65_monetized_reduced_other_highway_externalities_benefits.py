# KPI 65: Monetized Reduced Other Highway Externalities Benefits
# ID: kpi-50cd8d75-fd86-444c-aa2b-4b4d3b6f8887
# Group: Scenario
# Unit:
# Required sources:
#   kpi_62_project: 62_walk_bike_induced_vmt_reduction.parquet at project, current scenario (VMT_{Year,Project})
#   Constant Noise Externality Per VMT: NoiseExternalityPerVMT
#   Constant Safety Externality Per VMT: SafetyExternalityPerVMT
#   Constant Congestion Externality Per VMT: CongestionExternalityPerVMT
#   Constant Discount Rate: DiscountRate
#   Constant Base Year: BaseYear
#   projects: ScenarioUpstream.Projects.Open Year (OpenYear_{Project})
#   projects: ScenarioUpstream.Projects.End Year (EndYear_{Project})
#   Output geography: ScenarioUpstream.Projects; use table-schema joins for aggregation
#   Output geography: PreprocessedConstants.Corridors; use table-schema joins for aggregation
#   Output geography: PreprocessedConstants.SubRegions; use table-schema joins for aggregation
# Expected output files:
#   data/kpis/<scenario>/Projects/65_monetized_reduced_other_highway_externalities_benefits.parquet
#   data/kpis/<scenario>/Corridors/65_monetized_reduced_other_highway_externalities_benefits.parquet
#   data/kpis/<scenario>/SubRegions/65_monetized_reduced_other_highway_externalities_benefits.parquet
#   data/kpis/<scenario>/Region/65_monetized_reduced_other_highway_externalities_benefits.parquet

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

KPI_NAME = '65_monetized_reduced_other_highway_externalities_benefits'
KPI_ID = 'kpi-50cd8d75-fd86-444c-aa2b-4b4d3b6f8887'
SCENARIO_TYPE = 'Scenario'

# Local variables and non-global dimension options:
# YEAR_OPTIONS = []  # TODO: Define years, e.g. from project OpenYear/EndYear


def validate(context: RunContext) -> dict[str, object]:
    # kpi_62_project = loader.load(context, '62_walk_bike_induced_vmt_reduction', path='kpis', scale='project')
    # noise_externality_per_vmt = get_constant('Noise Externality Per VMT')
    # safety_externality_per_vmt = get_constant('Safety Externality Per VMT')
    # congestion_externality_per_vmt = get_constant('Congestion Externality Per VMT')
    # discount_rate = get_constant('Discount Rate')
    # base_year = get_constant('Base Year')
    # projects = validate_table(context, 'ScenarioUpstream', 'Projects')
    # year_options = YEAR_OPTIONS
    # corridors = validate_table(context, 'PreprocessedConstants', 'Corridors')
    # sub_regions = validate_table(context, 'PreprocessedConstants', 'SubRegions')
    # return {
    #     'kpi_62_project': kpi_62_project,
    #     'noise_externality_per_vmt': noise_externality_per_vmt,
    #     'safety_externality_per_vmt': safety_externality_per_vmt,
    #     'congestion_externality_per_vmt': congestion_externality_per_vmt,
    #     'discount_rate': discount_rate,
    #     'base_year': base_year,
    #     'projects': projects,
    #     'year_options': year_options,
    #     'corridors': corridors,
    #     'sub_regions': sub_regions,
    # }
    raise NotImplementedError(f'{KPI_NAME}: implement validate')


def process(
    kpi_62_project: pd.DataFrame,
    noise_externality_per_vmt: object,
    safety_externality_per_vmt: object,
    congestion_externality_per_vmt: object,
    discount_rate: object,
    base_year: object,
    projects: pd.DataFrame,
    year_options: list[object],
    corridors: pd.DataFrame,
    sub_regions: pd.DataFrame,
) -> dict[str, pd.DataFrame]:
    # Formula reference (processing is intentionally left blank):
    # \Delta NoiseExternality_{Year,Project} = VMT_{Year,Project} \times NoiseExternalityPerVMT
    # \Delta CongestionExternality_{Year,Project} = VMT_{Year,Project} \times CongestionExternalityPerVMT
    # \Delta SafetyExternality_{YearProject} = VMT_{Year,Project} \times SafetyExternalityPerVMT
    # Benefit_{Year,Project} = \Delta NoiseExternality_{Year,Project}+\Delta CongestionExternality_{Year,Project}+\Delta SafetyExternality_{YearProject}
    # Benefit_{Project} = \sum_{Year=OpenYear_{Project}}^{EndYear_{Project}}\frac{Benefit_{Year,Project}}{(1+DiscountRate)^{Year-BaseYear}}
    # TODO: Implement processing from the inputs above.
    # Suggested output structure: one geography row, one column per option combination.
    # output_columns = ['monetized_reduced_other_highway_externalities_benefits']
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
