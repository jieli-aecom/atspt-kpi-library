# KPI 54: Total Travel Vehicle Hours
# ID: kpi-2c84e2ce-e916-478e-89d7-44333e0bf7cf
# Group: Scenario
# Unit: annual vehicle hours
# Required sources:
#   calibrated_network_output: KPIPreparation.CalibratedNetworkOutput.Calibrated Travel Minutes (CalibratedTravelMinutes_{Period,Link})
#     Field dimension Period: ['AM', 'PM', 'MD', 'OV']
#   calibrated_network_output: KPIPreparation.CalibratedNetworkOutput.Calibrated Volume (CalibratedVolume_{Period,Link})
#     Field dimension Period: ['AM', 'PM', 'MD', 'OV']
#   Output geography: PreprocessedConstants.Corridors; use table-schema joins for aggregation
#   Output geography: PreprocessedConstants.SubRegions; use table-schema joins for aggregation
# Expected output files:
#   data/kpis/<scenario>/Corridors/54_total_travel_vehicle_hours.parquet
#   data/kpis/<scenario>/SubRegions/54_total_travel_vehicle_hours.parquet
#   data/kpis/<scenario>/Region/54_total_travel_vehicle_hours.parquet

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

KPI_NAME = '54_total_travel_vehicle_hours'
KPI_ID = 'kpi-2c84e2ce-e916-478e-89d7-44333e0bf7cf'
SCENARIO_TYPE = 'Scenario'


def validate(context: RunContext) -> dict[str, object]:
    # calibrated_network_output = validate_table(context, 'KPIPreparation', 'CalibratedNetworkOutput')
    # period = get_domain('Period')
    # corridors = validate_table(context, 'PreprocessedConstants', 'Corridors')
    # sub_regions = validate_table(context, 'PreprocessedConstants', 'SubRegions')
    # return {
    #     'calibrated_network_output': calibrated_network_output,
    #     'period': period,
    #     'corridors': corridors,
    #     'sub_regions': sub_regions,
    # }
    raise NotImplementedError(f'{KPI_NAME}: implement validate')


def process(
    calibrated_network_output: pd.DataFrame,
    period: list[str],
    corridors: pd.DataFrame,
    sub_regions: pd.DataFrame,
) -> dict[str, pd.DataFrame]:
    # Formula reference (processing is intentionally left blank):
    # TravelTimeHours_{Zone} = \frac{365}{60}\times \sum_{Link\in Zone}\sum_{Period}CalibratedTravelMinutes_{Period,Link}\times CalibratedVolume_{Period,Link}
    # TODO: Implement processing from the inputs above.
    # Suggested output structure: one geography row, one column per option combination.
    # output_columns = ['total_travel_vehicle_hours']
    # corridor: basic unit;
    # corridor_index = corridors.index.rename('corridor_id')
    # corridor_output = pd.DataFrame(index=corridor_index, columns=output_columns)
    # subRegion: basic unit;
    # sub_region_index = sub_regions.index.rename('subregion_id')
    # sub_region_output = pd.DataFrame(index=sub_region_index, columns=output_columns)
    # region: basic unit;
    # region_index = pd.Index(['Region'], name='region_id')
    # region_output = pd.DataFrame(index=region_index, columns=output_columns)
    # return {
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
