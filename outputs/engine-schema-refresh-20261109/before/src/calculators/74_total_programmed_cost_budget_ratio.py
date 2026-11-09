# KPI 74: Total Programmed Cost-Budget Ratio
# ID: kpi-177ba17a-2124-41e9-b7c6-61d96147c683
# Group: Scenario
# Unit: %
# Required sources:
#   kpi_101_project: 101_total_discounted_cost.parquet at project, current scenario (Cost_{Project})
#   scenario_info: ScenarioUpstream.ScenarioInfo.Scenario Budget (ScenarioBudget)
# Expected output files:
#   data/kpis/<scenario>/Region/74_total_programmed_cost_budget_ratio.parquet

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

KPI_NAME = '74_total_programmed_cost_budget_ratio'
KPI_ID = 'kpi-177ba17a-2124-41e9-b7c6-61d96147c683'
SCENARIO_TYPE = 'Scenario'


def validate(context: RunContext) -> dict[str, object]:
    # kpi_101_project = loader.load(context, '101_total_discounted_cost', path='kpis', scale='project')
    # scenario_info = validate_table(context, 'ScenarioUpstream', 'ScenarioInfo')
    # return {
    #     'kpi_101_project': kpi_101_project,
    #     'scenario_info': scenario_info,
    # }
    raise NotImplementedError(f'{KPI_NAME}: implement validate')


def process(
    kpi_101_project: pd.DataFrame,
    scenario_info: pd.DataFrame,
) -> dict[str, pd.DataFrame]:
    # Formula reference (processing is intentionally left blank):
    # CostByBudget_{Region} = \frac{\sum_{Project\in Region}Cost_{Project}}{ScenarioBudget}
    # TODO: Implement processing from the inputs above.
    # Suggested output structure: one geography row, one column per option combination.
    # output_columns = ['total_programmed_cost_budget_ratio']
    # region: basic unit;
    # region_index = pd.Index(['Region'], name='region_id')
    # region_output = pd.DataFrame(index=region_index, columns=output_columns)
    # return {
    #     'region': region_output,
    # }
    raise NotImplementedError(f'{KPI_NAME}: implement process')


def calculate(context: RunContext) -> None:
    # outputs = process(**validate(context))
    # for scale, output in outputs.items():
    #     writer.write_table(context, KPI_NAME, output, path='kpis', scale=scale)
    raise NotImplementedError(f'{KPI_NAME}: implement calculate')
