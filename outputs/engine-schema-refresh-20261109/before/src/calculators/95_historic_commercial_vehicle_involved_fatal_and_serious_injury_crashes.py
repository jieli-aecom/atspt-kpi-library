# KPI 95: Historic Commercial Vehicle-Involved Fatal and Serious-Injury Crashes
# ID: kpi-6cf2045e-ed6f-4cb9-99f3-fdcccb8e7f2e
# Group: Base Year
# Unit: count
# Required sources:
#   kpi_96_link: 96_historical_crashes.parquet at link, current scenario (CrashCount_{CrashType, CrashSeverity, CrashCommercialVehicle, Link})
#   base_highway_links: PreprocessedConstants.BaseHighwayLinks.Link ID (LinkID_{Link})
#   historic_crashes: PreprocessedConstants.HistoricCrashes.Commercial Vehicle (CommercialVehicle_{Point})
#   historic_crashes: PreprocessedConstants.HistoricCrashes.Link ID (LinkID_{Point})
#   historic_crashes: PreprocessedConstants.HistoricCrashes.Year (Year_{Point})
#   Local variable Window Years (\{WindowYears\})
#   historic_crashes: PreprocessedConstants.HistoricCrashes.Crash Point ID (CrashPointID_{Point})
#   historic_crashes: PreprocessedConstants.HistoricCrashes.Severity (Severity_{Point})
#   Output geography: PreprocessedConstants.BaseHighwayLinks; use table-schema joins for aggregation
#   Output geography: PreprocessedConstants.Cells; use table-schema joins for aggregation
#   Output geography: ScenarioUpstream.Projects; use table-schema joins for aggregation
#   Output geography: PreprocessedConstants.TAZs; use table-schema joins for aggregation
#   Output geography: PreprocessedConstants.Corridors; use table-schema joins for aggregation
#   Output geography: PreprocessedConstants.SubRegions; use table-schema joins for aggregation
# Expected output files:
#   data/kpis/<scenario>/Links/95_historic_commercial_vehicle_involved_fatal_and_serious_injury_crashes.parquet
#   data/kpis/<scenario>/Cells/95_historic_commercial_vehicle_involved_fatal_and_serious_injury_crashes.parquet
#   data/kpis/<scenario>/Projects/95_historic_commercial_vehicle_involved_fatal_and_serious_injury_crashes.parquet
#   data/kpis/<scenario>/TAZs/95_historic_commercial_vehicle_involved_fatal_and_serious_injury_crashes.parquet
#   data/kpis/<scenario>/Corridors/95_historic_commercial_vehicle_involved_fatal_and_serious_injury_crashes.parquet
#   data/kpis/<scenario>/SubRegions/95_historic_commercial_vehicle_involved_fatal_and_serious_injury_crashes.parquet
#   data/kpis/<scenario>/Region/95_historic_commercial_vehicle_involved_fatal_and_serious_injury_crashes.parquet

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

KPI_NAME = '95_historic_commercial_vehicle_involved_fatal_and_serious_injury_crashes'
KPI_ID = 'kpi-6cf2045e-ed6f-4cb9-99f3-fdcccb8e7f2e'
SCENARIO_TYPE = 'Base Year'

# Local variables and non-global dimension options:
# WINDOW_YEARS = None  # TODO: Define Window Years (\{WindowYears\})
# YEAR_OPTIONS = []  # TODO: Define years, e.g. from project OpenYear/EndYear


def validate(context: RunContext) -> dict[str, object]:
    # kpi_96_link = loader.load(context, '96_historical_crashes', path='kpis', scale='link')
    # base_highway_links = validate_table(context, 'PreprocessedConstants', 'BaseHighwayLinks')
    # historic_crashes = validate_table(context, 'PreprocessedConstants', 'HistoricCrashes')
    # window_years = WINDOW_YEARS
    # crash_severity = get_domain('Crash Severity')
    # year_options = YEAR_OPTIONS
    # cells = validate_table(context, 'PreprocessedConstants', 'Cells')
    # projects = validate_table(context, 'ScenarioUpstream', 'Projects')
    # ta_zs = validate_table(context, 'PreprocessedConstants', 'TAZs')
    # corridors = validate_table(context, 'PreprocessedConstants', 'Corridors')
    # sub_regions = validate_table(context, 'PreprocessedConstants', 'SubRegions')
    # return {
    #     'kpi_96_link': kpi_96_link,
    #     'base_highway_links': base_highway_links,
    #     'historic_crashes': historic_crashes,
    #     'window_years': window_years,
    #     'crash_severity': crash_severity,
    #     'year_options': year_options,
    #     'cells': cells,
    #     'projects': projects,
    #     'ta_zs': ta_zs,
    #     'corridors': corridors,
    #     'sub_regions': sub_regions,
    # }
    raise NotImplementedError(f'{KPI_NAME}: implement validate')


def process(
    kpi_96_link: pd.DataFrame,
    base_highway_links: pd.DataFrame,
    historic_crashes: pd.DataFrame,
    window_years: object,
    crash_severity: list[str],
    year_options: list[object],
    cells: pd.DataFrame,
    projects: pd.DataFrame,
    ta_zs: pd.DataFrame,
    corridors: pd.DataFrame,
    sub_regions: pd.DataFrame,
) -> dict[str, pd.DataFrame]:
    # Formula reference (processing is intentionally left blank):
    # Filter_{Link} = (LinkID_{Point}=LinkID_{Link})\bigcap(CommercialVehicle_{Point})\bigcap Severity_{Point} \in \{K, A\} \bigcap Year_{Point}\in\{WindowYears\})
    # CommercialVehSeriousCrashCount_{Link} = \frac{1}{\Vert\{WindowYears\}\Vert}\times \Vert\{CrashPointID_{Point}|_{Filter_{Link}}\}\Vert
    # TODO: Implement processing from the inputs above.
    # Suggested output structure: one geography row, one column per option combination.
    # output_columns = ['historic_commercial_vehicle_involved_fatal_and_serious_injury_crashes']
    # link: basic unit;
    # link_index = base_highway_links.index.rename('link_id')
    # link_output = pd.DataFrame(index=link_index, columns=output_columns)
    # cell: aggregation;
    # \sum_{Link \in Cell}CommercialVehSeriousCrashCount_{Link}
    # cell_index = cells.index.rename('cell_id')
    # cell_output = pd.DataFrame(index=cell_index, columns=output_columns)
    # project: aggregation;
    # \sum_{Link \in Project}CommercialVehSeriousCrashCount_{Link}
    # project_index = projects.index.rename('project_id')
    # project_output = pd.DataFrame(index=project_index, columns=output_columns)
    # taz: aggregation;
    # \sum_{Link \in TAZ}CommercialVehSeriousCrashCount_{Link}
    # taz_index = ta_zs.index.rename('taz_id')
    # taz_output = pd.DataFrame(index=taz_index, columns=output_columns)
    # corridor: aggregation;
    # \sum_{Link \in Corridor}CommercialVehSeriousCrashCount_{Link}
    # corridor_index = corridors.index.rename('corridor_id')
    # corridor_output = pd.DataFrame(index=corridor_index, columns=output_columns)
    # subRegion: aggregation;
    # \sum_{Link \in SubRegion}CommercialVehSeriousCrashCount_{Link}
    # sub_region_index = sub_regions.index.rename('subregion_id')
    # sub_region_output = pd.DataFrame(index=sub_region_index, columns=output_columns)
    # region: aggregation;
    # \sum_{Link \in Region}CommercialVehSeriousCrashCount_{Link}
    # region_index = pd.Index(['Region'], name='region_id')
    # region_output = pd.DataFrame(index=region_index, columns=output_columns)
    # return {
    #     'link': link_output,
    #     'cell': cell_output,
    #     'project': project_output,
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
