# KPI 17: Annual Energy Consumption
# ID: kpi-896562c8-3491-488b-9db8-ab3acf207ca4
# Group: Scenario
# Unit: annual BTU
# Required sources:
#   Lookup MilesperGallonLookup (MilesperGallonLookup(,))
#   Lookup kWhper100MileLookup (kWhper100MileLookup())
#   Lookup FuelBTUPerGallonLookup (FuelBTUPerGallonLookup())
#   Constant BTU Per KWH: BTUPerKWH
#   Local variable Is Current (IsCurrent)
#   calibrated_network_output: KPIPreparation.CalibratedNetworkOutput.Total Calibrated Daily Volume (TotalCalibratedDailyVolume_{Link})
#   calibrated_network_output: KPIPreparation.CalibratedNetworkOutput.Total Calibrated Daily Truck Volume (TotalCalibratedDailyTruckVolume_{Link})
#   Constant Heavy-Diesel Truck Share: HeavyDieselTruckShare
#   scenario_links: ScenarioUpstream.ScenarioLinks.Distance Miles (DistanceMiles_{Link})
#   scenario_info: ScenarioUpstream.ScenarioInfo.Electric Vehicle Rate (ElectricVehicleRate)
#   Output geography: PreprocessedConstants.BaseHighwayLinks; use table-schema joins for aggregation
#   Output geography: PreprocessedConstants.TAZs; use table-schema joins for aggregation
#   Output geography: PreprocessedConstants.Corridors; use table-schema joins for aggregation
#   Output geography: PreprocessedConstants.SubRegions; use table-schema joins for aggregation
# Expected output files:
#   data/kpis/<scenario>/Links/17_annual_energy_consumption.parquet
#   data/kpis/<scenario>/TAZs/17_annual_energy_consumption.parquet
#   data/kpis/<scenario>/Corridors/17_annual_energy_consumption.parquet
#   data/kpis/<scenario>/SubRegions/17_annual_energy_consumption.parquet
#   data/kpis/<scenario>/Region/17_annual_energy_consumption.parquet

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

KPI_NAME = '17_annual_energy_consumption'
KPI_ID = 'kpi-896562c8-3491-488b-9db8-ab3acf207ca4'
SCENARIO_TYPE = 'Scenario'

# Local variables and non-global dimension options:
# IS_CURRENT = None  # TODO: Define Is Current (IsCurrent)


def validate(context: RunContext) -> dict[str, object]:
    # milesper_gallon_lookup = get_lookup('MilesperGallonLookup')
    # k_whper100_mile_lookup = get_lookup('kWhper100MileLookup')
    # fuel_btu_per_gallon_lookup = get_lookup('FuelBTUPerGallonLookup')
    # btu_per_kwh = get_constant('BTU Per KWH')
    # is_current = IS_CURRENT
    # calibrated_network_output = validate_table(context, 'KPIPreparation', 'CalibratedNetworkOutput')
    # heavy_diesel_truck_share = get_constant('Heavy-Diesel Truck Share')
    # scenario_links = validate_table(context, 'ScenarioUpstream', 'ScenarioLinks')
    # scenario_info = validate_table(context, 'ScenarioUpstream', 'ScenarioInfo')
    # base_highway_links = validate_table(context, 'PreprocessedConstants', 'BaseHighwayLinks')
    # ta_zs = validate_table(context, 'PreprocessedConstants', 'TAZs')
    # corridors = validate_table(context, 'PreprocessedConstants', 'Corridors')
    # sub_regions = validate_table(context, 'PreprocessedConstants', 'SubRegions')
    # return {
    #     'milesper_gallon_lookup': milesper_gallon_lookup,
    #     'k_whper100_mile_lookup': k_whper100_mile_lookup,
    #     'fuel_btu_per_gallon_lookup': fuel_btu_per_gallon_lookup,
    #     'btu_per_kwh': btu_per_kwh,
    #     'is_current': is_current,
    #     'calibrated_network_output': calibrated_network_output,
    #     'heavy_diesel_truck_share': heavy_diesel_truck_share,
    #     'scenario_links': scenario_links,
    #     'scenario_info': scenario_info,
    #     'base_highway_links': base_highway_links,
    #     'ta_zs': ta_zs,
    #     'corridors': corridors,
    #     'sub_regions': sub_regions,
    # }
    raise NotImplementedError(f'{KPI_NAME}: implement validate')


def process(
    milesper_gallon_lookup: Callable[..., object],
    k_whper100_mile_lookup: Callable[..., object],
    fuel_btu_per_gallon_lookup: Callable[..., object],
    btu_per_kwh: object,
    is_current: object,
    calibrated_network_output: pd.DataFrame,
    heavy_diesel_truck_share: object,
    scenario_links: pd.DataFrame,
    scenario_info: pd.DataFrame,
    base_highway_links: pd.DataFrame,
    ta_zs: pd.DataFrame,
    corridors: pd.DataFrame,
    sub_regions: pd.DataFrame,
) -> dict[str, pd.DataFrame]:
    # Formula reference (processing is intentionally left blank):
    # ElectricVolume_{Link} = TotalCalibratedDailyTruckVolume_{Link} \times ElectricVehicleRate
    # DieselVolume_{Link} = TotalCalibratedDailyTruckVolume_{Link} \times HeavyDieselTruckShare
    # RegularVolume_{Link} = TotalCalibratedDailyVolume_{Link}-ElectricVolume_{Link}-DieselVolume_{Link}
    # NonDieselFuelGallons_{Link} = 365\times \frac{ DistanceMiles_{Link}\times  RegularVolume_{Link}}{MilesperGallonLookup(No,IsCurrent)}
    # DieselFuelGallons_{Link} = 365\times\frac{DistanceMiles_{Link}\times DieselVolume_{Link}}{MilesperGallonLookup(Yes, IsCurrent)}
    # FuelBTU_{Link} = FuelBTUPerGallonLookup(No)\times NonDieselFuelGallons_{Link} + FuelBTUPerGallonLookup(Yes)\times DieselFuelGallons_{Link}
    # ElectrictyKWH_{Link} = 365\times ElectricVolume_{Link}\times \frac{kWhper100MileLookup(IsCurrent)}{100}
    # ElectrucityBTU_{Link} = ElectrictyKWH_{Link}\times BTUPerKWH
    # BTU_{Link} = FuelBTU_{Link}+ElectrucityBTU_{Link}
    # TODO: Implement processing from the inputs above.
    # Suggested output structure: one geography row, one column per option combination.
    # output_columns = ['annual_energy_consumption']
    # link: basic unit;
    # link_index = base_highway_links.index.rename('link_id')
    # link_output = pd.DataFrame(index=link_index, columns=output_columns)
    # taz: aggregation;
    # \sum_{Link \in TAZ}BTU_{Link}
    # taz_index = ta_zs.index.rename('taz_id')
    # taz_output = pd.DataFrame(index=taz_index, columns=output_columns)
    # corridor: aggregation;
    # \sum_{Link \in Corridor}BTU_{Link}
    # corridor_index = corridors.index.rename('corridor_id')
    # corridor_output = pd.DataFrame(index=corridor_index, columns=output_columns)
    # subRegion: aggregation;
    # \sum_{Link \in SubRegion}BTU_{Link}
    # sub_region_index = sub_regions.index.rename('subregion_id')
    # sub_region_output = pd.DataFrame(index=sub_region_index, columns=output_columns)
    # region: aggregation;
    # \sum_{Link \in Region}BTU_{Link}
    # region_index = pd.Index(['Region'], name='region_id')
    # region_output = pd.DataFrame(index=region_index, columns=output_columns)
    # return {
    #     'link': link_output,
    #     'taz': taz_output,
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
