# KPI 37: Emission Regional Conformity Contribution
# ID: kpi-dca27f81-572b-42f6-9a5e-b8dabf195ff4
# Group: Scenario
# Unit:
# Required sources:
#   kpi_14_project: 14_emission_reduction_project_based.parquet at project, current scenario (\Delta Emission_{EmissionType,Project})
#   Output geography: ScenarioUpstream.Projects; use table-schema joins for aggregation
# Expected output files:
#   data/kpis/<scenario>/Projects/37_emission_regional_conformity_contribution.parquet

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

KPI_NAME = '37_emission_regional_conformity_contribution'
KPI_ID = 'kpi-dca27f81-572b-42f6-9a5e-b8dabf195ff4'
SCENARIO_TYPE = 'Scenario'


def validate(context: RunContext) -> dict[str, object]:
    # kpi_14_project = loader.load(context, '14_emission_reduction_project_based', path='kpis', scale='project')
    # emission_type = get_domain('Emission Type')
    # projects = validate_table(context, 'ScenarioUpstream', 'Projects')
    # return {
    #     'kpi_14_project': kpi_14_project,
    #     'emission_type': emission_type,
    #     'projects': projects,
    # }
    raise NotImplementedError(f'{KPI_NAME}: implement validate')


def process(
    kpi_14_project: pd.DataFrame,
    emission_type: list[str],
    projects: pd.DataFrame,
) -> dict[str, pd.DataFrame]:
    # Formula reference (processing is intentionally left blank):
    # Share_{Project,EmissionType} = \frac{\Delta Emission_{EmissionType,Project}}{\sum_{Project\in Zone}\Delta Emission_{EmissionType,Project}}
    # TODO: Implement processing from the inputs above.
    # Suggested output structure: one geography row, one column per option combination.
    # output_columns = [
    #     'emission_regional_conformity_contribution' + '_' + '_'.join(snake_case(str(v)) for v in options)
    #     for options in product(emission_type)
    # ]
    # project: basic unit;
    # project_index = projects.index.rename('project_id')
    # project_output = pd.DataFrame(index=project_index, columns=output_columns)
    # return {
    #     'project': project_output,
    # }
    raise NotImplementedError(f'{KPI_NAME}: implement process')


def calculate(context: RunContext) -> None:
    # outputs = process(**validate(context))
    # for scale, output in outputs.items():
    #     writer.write_table(context, KPI_NAME, output, path='kpis', scale=scale)
    raise NotImplementedError(f'{KPI_NAME}: implement calculate')
