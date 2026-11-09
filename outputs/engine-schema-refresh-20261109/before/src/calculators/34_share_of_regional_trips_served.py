# KPI 34: Share of Regional Trips Served
# ID: kpi-e7293e80-1324-4ba4-a404-5fba38ebdab4
# Group: Scenario
# Unit: %
# Required sources:
#   calibrated_network_output: KPIPreparation.CalibratedNetworkOutput.Total Calibrated Daily Volume (TotalCalibratedDailyVolume_{Link})
#   skimmed_zones: ScenarioUpstream.SkimmedZones.Period Trip Count (PeriodTripCount_{SkimRow})
#   projects: ScenarioUpstream.Projects.Link IDs (\{LinkIDs\}_{Project})
#   Output geography: ScenarioUpstream.Projects; use table-schema joins for aggregation
# Expected output files:
#   data/kpis/<scenario>/Projects/34_share_of_regional_trips_served.parquet

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

KPI_NAME = '34_share_of_regional_trips_served'
KPI_ID = 'kpi-e7293e80-1324-4ba4-a404-5fba38ebdab4'
SCENARIO_TYPE = 'Scenario'


def validate(context: RunContext) -> dict[str, object]:
    # calibrated_network_output = validate_table(context, 'KPIPreparation', 'CalibratedNetworkOutput')
    # skimmed_zones = validate_table(context, 'ScenarioUpstream', 'SkimmedZones')
    # projects = validate_table(context, 'ScenarioUpstream', 'Projects')
    # return {
    #     'calibrated_network_output': calibrated_network_output,
    #     'skimmed_zones': skimmed_zones,
    #     'projects': projects,
    # }
    raise NotImplementedError(f'{KPI_NAME}: implement validate')


def process(
    calibrated_network_output: pd.DataFrame,
    skimmed_zones: pd.DataFrame,
    projects: pd.DataFrame,
) -> dict[str, pd.DataFrame]:
    # Formula reference (processing is intentionally left blank):
    # TripCount_{Project} = \sum_{Link\in \{LinkIDs\}_{Project}} TotalCalibratedDailyVolume_{Link}
    # TripCount_{Region} = \sum_{SkimRow}PeriodTripCount_{SkimRow}
    # Share_{Project} = \frac{TripCount_{Project}}{TripCount_{Region}}
    # TODO: Implement processing from the inputs above.
    # Suggested output structure: one geography row, one column per option combination.
    # output_columns = ['share_of_regional_trips_served']
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
