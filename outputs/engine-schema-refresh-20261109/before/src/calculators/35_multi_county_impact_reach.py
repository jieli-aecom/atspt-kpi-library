# KPI 35: Multi-County Impact Reach
# ID: kpi-fdcdb133-7666-44e6-a689-5ff042f3d472
# Group: Inter-Scenario
# Unit: count
# Required sources:
#   kpi_38_link: 38_annual_vehicle_miles_traveled_vmt.parquet at link, current scenario (VMT_{Link, WithProject})
#   kpi_38_link_reference: 38_annual_vehicle_miles_traveled_vmt.parquet at link, reference scenario (VMT_{Link, NoBuild})
#   kpi_3_link: 3_daily_vehicle_hours_of_delay.parquet at link, current scenario (VHD_{Link, WithProject})
#   kpi_3_link_reference: 3_daily_vehicle_hours_of_delay.parquet at link, reference scenario (VHD_{Link, NoBuild})
#   kpi_8_cell: 8_access_to_jobs.parquet at cell, current scenario (JobAccessPct_{Cell, WithProject})
#   kpi_8_cell_reference: 8_access_to_jobs.parquet at cell, reference scenario (JobAccessPct_{Cell, NoBuild})
#   cell_land_use: ScenarioUpstream.CellLandUse.Workers (Workers_{Cell, WithProject})
#   cell_land_use_reference: ScenarioUpstream.CellLandUse.Workers (Workers_{Cell, NoBuild})
#   Output geography: ScenarioUpstream.Projects; use table-schema joins for aggregation
# Expected output files:
#   data/kpis/<scenario>/Projects/35_multi_county_impact_reach.parquet
# How to conduct scenarios

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

KPI_NAME = '35_multi_county_impact_reach'
KPI_ID = 'kpi-fdcdb133-7666-44e6-a689-5ff042f3d472'
SCENARIO_TYPE = 'Inter-Scenario'


def validate(context: RunContext) -> dict[str, object]:
    # if not context.reference_scenario:
    #     raise ValueError('This KPI requires a reference scenario')
    # kpi_38_link = loader.load(context, '38_annual_vehicle_miles_traveled_vmt', path='kpis', scale='link')
    # kpi_38_link_reference = loader.load(context, '38_annual_vehicle_miles_traveled_vmt', path='kpis', scale='link', reference=True)
    # kpi_3_link = loader.load(context, '3_daily_vehicle_hours_of_delay', path='kpis', scale='link')
    # kpi_3_link_reference = loader.load(context, '3_daily_vehicle_hours_of_delay', path='kpis', scale='link', reference=True)
    # kpi_8_cell = loader.load(context, '8_access_to_jobs', path='kpis', scale='cell')
    # kpi_8_cell_reference = loader.load(context, '8_access_to_jobs', path='kpis', scale='cell', reference=True)
    # cell_land_use = validate_table(context, 'ScenarioUpstream', 'CellLandUse')
    # cell_land_use_reference = validate_table(context, 'ScenarioUpstream', 'CellLandUse', reference=True)
    # projects = validate_table(context, 'ScenarioUpstream', 'Projects')
    # return {
    #     'kpi_38_link': kpi_38_link,
    #     'kpi_38_link_reference': kpi_38_link_reference,
    #     'kpi_3_link': kpi_3_link,
    #     'kpi_3_link_reference': kpi_3_link_reference,
    #     'kpi_8_cell': kpi_8_cell,
    #     'kpi_8_cell_reference': kpi_8_cell_reference,
    #     'cell_land_use': cell_land_use,
    #     'cell_land_use_reference': cell_land_use_reference,
    #     'projects': projects,
    # }
    raise NotImplementedError(f'{KPI_NAME}: implement validate')


def process(
    kpi_38_link: pd.DataFrame,
    kpi_38_link_reference: pd.DataFrame,
    kpi_3_link: pd.DataFrame,
    kpi_3_link_reference: pd.DataFrame,
    kpi_8_cell: pd.DataFrame,
    kpi_8_cell_reference: pd.DataFrame,
    cell_land_use: pd.DataFrame,
    cell_land_use_reference: pd.DataFrame,
    projects: pd.DataFrame,
) -> dict[str, pd.DataFrame]:
    # Formula reference (processing is intentionally left blank):
    # VMTSignificant_{Project,SubRegion} = [1-\frac{\sum_{Link\in SubRegion}VMT_{Link, WithProject}}{\sum_{Link\in SubRegion}VMT_{Link, NoBuild}} > 1\%]
    # DelaySignificant_{Project,SubRegion} = [1-\frac{\sum_{Link\in SubRegion}VHD_{Link, WithProject}}{\sum_{Link\in SubRegion}VHD_{Link, NoBuild}} > 1\%]
    # AccessSignificant_{Project,SubRegion} = [\frac{\sum_{Link\in SubRegion}JobAccessPct_{Cell, WithProject}\times Workers_{Cell, WithProject}}{\sum_{Link\in SubRegion}JobAccessPct_{Cell, NoBuild}\times Workers_{Cell, NoBuild}} - 1 > 1\%]
    # Significant_{Project,SubRegion} = [VMTSignificant_{Project,SubRegion}\bigcup DelaySignificant_{Project,SubRegion} \bigcup AccessSignificant_{Project,SubRegion}]
    # Reach_{Project,Region} = \sum_{SubRegion \in Region}Significant_{Project,SubRegion}
    # TODO: Implement processing from the inputs above.
    # Suggested output structure: one geography row, one column per option combination.
    # output_columns = ['multi_county_impact_reach']
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
