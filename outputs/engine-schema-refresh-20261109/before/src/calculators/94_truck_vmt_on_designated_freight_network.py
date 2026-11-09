# KPI 94: Truck VMT on Designated Freight Network
# ID: kpi-1c17b37e-0539-4279-94bf-3b5216fc82e7
# Group: Scenario
# Unit: vehicle miles
# Required sources:
#   calibrated_network_output: KPIPreparation.CalibratedNetworkOutput.Total Daily Truck VMT (TruckVMT_{Link})
#   base_highway_links: PreprocessedConstants.BaseHighwayLinks.Is Designated Freight Network (IsDesignatedFreightNetwork_{Link})
#   Output geography: PreprocessedConstants.BaseHighwayLinks; use table-schema joins for aggregation
#   Output geography: PreprocessedConstants.Corridors; use table-schema joins for aggregation
#   Output geography: PreprocessedConstants.SubRegions; use table-schema joins for aggregation
# Expected output files:
#   data/kpis/<scenario>/Links/94_truck_vmt_on_designated_freight_network.parquet
#   data/kpis/<scenario>/Corridors/94_truck_vmt_on_designated_freight_network.parquet
#   data/kpis/<scenario>/SubRegions/94_truck_vmt_on_designated_freight_network.parquet
#   data/kpis/<scenario>/Region/94_truck_vmt_on_designated_freight_network.parquet

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

KPI_NAME = '94_truck_vmt_on_designated_freight_network'
KPI_ID = 'kpi-1c17b37e-0539-4279-94bf-3b5216fc82e7'
SCENARIO_TYPE = 'Scenario'


def validate(context: RunContext) -> dict[str, object]:
    # calibrated_network_output = validate_table(context, 'KPIPreparation', 'CalibratedNetworkOutput')
    # base_highway_links = validate_table(context, 'PreprocessedConstants', 'BaseHighwayLinks')
    # corridors = validate_table(context, 'PreprocessedConstants', 'Corridors')
    # sub_regions = validate_table(context, 'PreprocessedConstants', 'SubRegions')
    # return {
    #     'calibrated_network_output': calibrated_network_output,
    #     'base_highway_links': base_highway_links,
    #     'corridors': corridors,
    #     'sub_regions': sub_regions,
    # }
    raise NotImplementedError(f'{KPI_NAME}: implement validate')


def process(
    calibrated_network_output: pd.DataFrame,
    base_highway_links: pd.DataFrame,
    corridors: pd.DataFrame,
    sub_regions: pd.DataFrame,
) -> dict[str, pd.DataFrame]:
    # Formula reference (processing is intentionally left blank):
    # TruckVMTDesignated_{Link} = [IsDesignatedFreightNetwork_{Link}]\times TruckVMT_{Link}
    # TODO: Implement processing from the inputs above.
    # Suggested output structure: one geography row, one column per option combination.
    # output_columns = ['truck_vmt_on_designated_freight_network']
    # link: basic unit;
    # link_index = base_highway_links.index.rename('link_id')
    # link_output = pd.DataFrame(index=link_index, columns=output_columns)
    # corridor: basic unit;
    # corridor_index = corridors.index.rename('corridor_id')
    # corridor_output = pd.DataFrame(index=corridor_index, columns=output_columns)
    # subRegion: aggregation; Sum
    # \sum_{Link\in SubRegion}TruckVMTDesignated_{link}
    # sub_region_index = sub_regions.index.rename('subregion_id')
    # sub_region_output = pd.DataFrame(index=sub_region_index, columns=output_columns)
    # region: aggregation; Sum
    # \sum_{Link\in Region}TruckVMTDesignated_{link}
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
