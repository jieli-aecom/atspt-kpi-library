# KPI 50: Total Investment Cost per VMT
# ID: kpi-2a12a75c-b02f-4265-9f87-b03d16592a08
# Group: Scenario
# Unit: dollars per VMT
# Required sources:
#   projects: ScenarioUpstream.Projects.Discounted Investment Cost (DiscountedInvestmentCost_{Project})
#   calibrated_network_output: KPIPreparation.CalibratedNetworkOutput.Total Calibrated Daily VMT (TotalCalibratedDailyVMT_{Link})
#   projects: ScenarioUpstream.Projects.Link IDs (\{LinkIDs\}_{Project})
#   Output geography: PreprocessedConstants.SubRegions; use table-schema joins for aggregation
# Expected output files:
#   data/kpis/<scenario>/SubRegions/50_total_investment_cost_per_vmt.parquet
#   data/kpis/<scenario>/Region/50_total_investment_cost_per_vmt.parquet

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

KPI_NAME = '50_total_investment_cost_per_vmt'
KPI_ID = 'kpi-2a12a75c-b02f-4265-9f87-b03d16592a08'
SCENARIO_TYPE = 'Scenario'


def validate(context: RunContext) -> dict[str, object]:
    # projects = validate_table(context, 'ScenarioUpstream', 'Projects')
    # calibrated_network_output = validate_table(context, 'KPIPreparation', 'CalibratedNetworkOutput')
    # sub_regions = validate_table(context, 'PreprocessedConstants', 'SubRegions')
    # return {
    #     'projects': projects,
    #     'calibrated_network_output': calibrated_network_output,
    #     'sub_regions': sub_regions,
    # }
    raise NotImplementedError(f'{KPI_NAME}: implement validate')


def process(
    projects: pd.DataFrame,
    calibrated_network_output: pd.DataFrame,
    sub_regions: pd.DataFrame,
) -> dict[str, pd.DataFrame]:
    # Formula reference (processing is intentionally left blank):
    # \{ProjectLinks\} = \bigcup_{Project \in Zone}\{LinkIDs\}_{Project}
    # ProjectCost_{Zone} = \sum_{Project \in Zone} DiscountedInvestmentCost_{Project}
    # ProjectVMT_{Zone} = \sum_{Link \in \{ProjectLinks\}}TotalCalibratedDailyVMT_{Link}
    # CostPerVMT_{Zone} = \frac{ProjectCost_{Zone}}{ProjectVMT_{Zone}}
    # TODO: Implement processing from the inputs above.
    # Suggested output structure: one geography row, one column per option combination.
    # output_columns = ['total_investment_cost_per_vmt']
    # subRegion: basic unit; Sum
    # sub_region_index = sub_regions.index.rename('subregion_id')
    # sub_region_output = pd.DataFrame(index=sub_region_index, columns=output_columns)
    # region: basic unit; Sum
    # region_index = pd.Index(['Region'], name='region_id')
    # region_output = pd.DataFrame(index=region_index, columns=output_columns)
    # return {
    #     'subRegion': sub_region_output,
    #     'region': region_output,
    # }
    raise NotImplementedError(f'{KPI_NAME}: implement process')


def calculate(context: RunContext) -> None:
    # outputs = process(**validate(context))
    # for scale, output in outputs.items():
    #     writer.write_table(context, KPI_NAME, output, path='kpis', scale=scale)
    raise NotImplementedError(f'{KPI_NAME}: implement calculate')
