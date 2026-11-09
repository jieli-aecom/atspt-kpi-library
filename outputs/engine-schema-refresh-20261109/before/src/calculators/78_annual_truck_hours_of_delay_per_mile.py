# KPI 78: Annual Truck Hours of Delay per Mile
# ID: kpi-4e196368-bd7b-4438-b085-30290eb6c280
# Group: Scenario
# Unit: hours per mile
# Required sources:
#   kpi_18_link: 18_truck_vehicle_hours_of_delay_vhd_tdm_based.parquet at link, current scenario (AnnualTruckVHD_{Link})
#   calibrated_network_output: KPIPreparation.CalibratedNetworkOutput.Total Daily Truck VMT (TotalDailyTruckVMT_{Link})
#   scenario_links: ScenarioUpstream.ScenarioLinks.Distance Miles (DistanceMiles_{Link})
#   Output geography: PreprocessedConstants.BaseHighwayLinks; use table-schema joins for aggregation
#   Output geography: PreprocessedConstants.Corridors; use table-schema joins for aggregation
#   Output geography: PreprocessedConstants.SubRegions; use table-schema joins for aggregation
# Expected output files:
#   data/kpis/<scenario>/Links/78_annual_truck_hours_of_delay_per_mile.parquet
#   data/kpis/<scenario>/Corridors/78_annual_truck_hours_of_delay_per_mile.parquet
#   data/kpis/<scenario>/SubRegions/78_annual_truck_hours_of_delay_per_mile.parquet
#   data/kpis/<scenario>/Region/78_annual_truck_hours_of_delay_per_mile.parquet

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

KPI_NAME = '78_annual_truck_hours_of_delay_per_mile'
KPI_ID = 'kpi-4e196368-bd7b-4438-b085-30290eb6c280'
SCENARIO_TYPE = 'Scenario'


def validate(context: RunContext) -> dict[str, object]:
    # kpi_18_link = loader.load(context, '18_truck_vehicle_hours_of_delay_vhd_tdm_based', path='kpis', scale='link')
    # calibrated_network_output = validate_table(context, 'KPIPreparation', 'CalibratedNetworkOutput')
    # scenario_links = validate_table(context, 'ScenarioUpstream', 'ScenarioLinks')
    # base_highway_links = validate_table(context, 'PreprocessedConstants', 'BaseHighwayLinks')
    # corridors = validate_table(context, 'PreprocessedConstants', 'Corridors')
    # sub_regions = validate_table(context, 'PreprocessedConstants', 'SubRegions')
    # return {
    #     'kpi_18_link': kpi_18_link,
    #     'calibrated_network_output': calibrated_network_output,
    #     'scenario_links': scenario_links,
    #     'base_highway_links': base_highway_links,
    #     'corridors': corridors,
    #     'sub_regions': sub_regions,
    # }
    raise NotImplementedError(f'{KPI_NAME}: implement validate')


def process(
    kpi_18_link: pd.DataFrame,
    calibrated_network_output: pd.DataFrame,
    scenario_links: pd.DataFrame,
    base_highway_links: pd.DataFrame,
    corridors: pd.DataFrame,
    sub_regions: pd.DataFrame,
) -> dict[str, pd.DataFrame]:
    # Formula reference (processing is intentionally left blank):
    # TruckVHDPerMile_{link} = \frac{AnnualTruckVHD_{Link}}{365 \times TotalDailyTruckVMT_{Link}}
    # TODO: Implement processing from the inputs above.
    # Suggested output structure: one geography row, one column per option combination.
    # output_columns = ['annual_truck_hours_of_delay_per_mile']
    # link: basic unit;
    # link_index = base_highway_links.index.rename('link_id')
    # link_output = pd.DataFrame(index=link_index, columns=output_columns)
    # corridor: aggregation; Average, weighted by volume
    # \frac{\sum_{Link \in Corridor}TruckVHDPerMile_{link}\times DistanceMiles_{Link}}{\sum_{Link \in Corridor}DistanceMiles_{Link}}
    # corridor_index = corridors.index.rename('corridor_id')
    # corridor_output = pd.DataFrame(index=corridor_index, columns=output_columns)
    # subRegion: aggregation; Average, weighted by volume
    # \frac{\sum_{Link \in SubRegion}TruckVHDPerMile_{link}\times DistanceMiles_{Link}}{\sum_{Link \in SubRegion}DistanceMiles_{Link}}
    # sub_region_index = sub_regions.index.rename('subregion_id')
    # sub_region_output = pd.DataFrame(index=sub_region_index, columns=output_columns)
    # region: aggregation; Average, weighted by volume
    # \frac{\sum_{Link \in Region}TruckVHDPerMile_{link}\times DistanceMiles_{Link}}{\sum_{Link \in Region}DistanceMiles_{Link}}
    # region_index = pd.Index(['Region'], name='region_id')
    # region_output = pd.DataFrame(index=region_index, columns=output_columns)
    # return {
    #     'link': link_output,
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
