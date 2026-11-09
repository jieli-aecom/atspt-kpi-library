# KPI 84: eVTOL-Induced Job Change
# ID: kpi-3502a612-d241-4963-bfae-21e859d035ca
# Group: Scenario
# Unit:
# Required sources:
#   kpi_81_taz: 81_employment_within_catchment_area.parquet at taz, current scenario (CatchmentJobs_{TAZ})
#   Local variable eVTOL Jobs (eVTOLJobs)
#   Output geography: PreprocessedConstants.TAZs; use table-schema joins for aggregation
# Expected output files:
#   data/kpis/<scenario>/TAZs/84_e_vtol_induced_job_change.parquet
# Is this the intended formula?

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

KPI_NAME = '84_e_vtol_induced_job_change'
KPI_ID = 'kpi-3502a612-d241-4963-bfae-21e859d035ca'
SCENARIO_TYPE = 'Scenario'

# Local variables and non-global dimension options:
# E_VTOL_JOBS = None  # TODO: Define eVTOL Jobs (eVTOLJobs)


def validate(context: RunContext) -> dict[str, object]:
    # kpi_81_taz = loader.load(context, '81_employment_within_catchment_area', path='kpis', scale='taz')
    # e_vtol_jobs = E_VTOL_JOBS
    # ta_zs = validate_table(context, 'PreprocessedConstants', 'TAZs')
    # return {
    #     'kpi_81_taz': kpi_81_taz,
    #     'e_vtol_jobs': e_vtol_jobs,
    #     'ta_zs': ta_zs,
    # }
    raise NotImplementedError(f'{KPI_NAME}: implement validate')


def process(
    kpi_81_taz: pd.DataFrame,
    e_vtol_jobs: object,
    ta_zs: pd.DataFrame,
) -> dict[str, pd.DataFrame]:
    # Formula reference (processing is intentionally left blank):
    # Change_{TAZ} = \frac{eVTOLJobs}{CatchmentJobs_{TAZ}}
    # TODO: Implement processing from the inputs above.
    # Suggested output structure: one geography row, one column per option combination.
    # output_columns = ['e_vtol_induced_job_change']
    # taz: basic unit;
    # taz_index = ta_zs.index.rename('taz_id')
    # taz_output = pd.DataFrame(index=taz_index, columns=output_columns)
    # return {
    #     'taz': taz_output,
    # }
    raise NotImplementedError(f'{KPI_NAME}: implement process')


def calculate(context: RunContext) -> None:
    # outputs = process(**validate(context))
    # for scale, output in outputs.items():
    #     writer.write_table(context, KPI_NAME, output, path='kpis', scale=scale)
    raise NotImplementedError(f'{KPI_NAME}: implement calculate')
