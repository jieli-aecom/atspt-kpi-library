"""Read a table, selected fields or geometry, preserving its index."""

import json
import os
from collections.abc import Callable, Sequence
from pathlib import Path
from typing import Literal

import geopandas as gpd
import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq

from ..pipeline.context import RunContext, SpatialScale
from .storage import get_scale_folder

# The writer uses this same local storage configuration through table_path().
DATA_DIR: Path = Path(__file__).resolve().parents[2] / "data"
CATEGORY_SCOPES: dict[str, str] = {
    "PreprocessedConstants": "common",
    "KPIPreparation": "scenario",
    "ScenarioUpstream": "scenario",
}


def table_path(
    context: RunContext,
    table: str,
    scenario: str | None = None,
    path: Literal["source", "kpis"] = "source",
    scale: SpatialScale | str | None = None,
) -> Path:
    """Resolve a table path and create the scenario's source and KPI folders."""
    root = Path(os.environ.get("COMPASS_DATA_DIR", DATA_DIR)).resolve()
    scenario_name = scenario or context.scenario
    scenario_source = (root / "source" / "scenarios" / scenario_name).resolve()
    scenario_kpis = (root / "kpis" / scenario_name).resolve()
    if path == "kpis":
        directory = scenario_kpis / get_scale_folder(scale)
    else:
        directory = scenario_source if scenario else root / "source" / "common"
    file_path = (directory / f"{table}.parquet").resolve()
    if any(not item.is_relative_to(root) for item in (file_path, scenario_source, scenario_kpis)):
        raise ValueError("Table path is outside the data directory")
    for directory in (scenario_source, scenario_kpis, file_path.parent):
        directory.mkdir(parents=True, exist_ok=True)
    return file_path


def read_table(
    context: RunContext,
    table: str,
    scenario: str | None = None,
    path: Literal["source", "kpis"] = "source",
    scale: SpatialScale | str | None = None,
) -> pd.DataFrame:
    """Local read boundary. A cloud implementation replaces this function."""
    file_path = table_path(context, table, scenario, path, scale)
    metadata = pq.read_schema(file_path).metadata or {}
    if b"geo" in metadata:
        frame = gpd.read_parquet(file_path)
    else:
        # Batches avoid Arrow's nested-array size limit for large accessibility lists.
        with pq.ParquetFile(file_path) as parquet:
            frame = pa.Table.from_batches(
                parquet.iter_batches(), schema=parquet.schema_arrow
            ).to_pandas()
    # Arrow sometimes restores a pandas string index as object; use its recorded dtype.
    pandas_metadata = json.loads(metadata.get(b"pandas", b"{}"))
    for column in pandas_metadata.get("columns", []):
        if (
            column["field_name"] in pandas_metadata.get("index_columns", [])
            and column["numpy_type"] == "string"
        ):
            frame.index = frame.index.astype("string")
    return frame


def load(
    context: RunContext,
    table: str,
    fields: str | Sequence[str] | None = None,
    filter: Callable[[pd.DataFrame], pd.Series] | None = None,
    *,
    scenario: str | None = None,
    category: str | None = None,
    path: Literal["source", "kpis"] = "source",
    scale: SpatialScale | str | None = None,
    reference: bool = False,
) -> pd.Series | pd.DataFrame:
    """Select fields/rows from common data or one of the context's scenarios.

    reference=True selects the reference scenario instead of the current one.
    Common source categories remain common in either case. path selects 'source'
    or 'kpis'. For KPIs, table is the numbered KPI filename stem and scale selects
    the spatial scale.
    """
    if scenario is not None and reference:
        raise ValueError("Use either an explicit scenario or reference=True")
    if scenario is None and (
        path == "kpis"
        or (category is not None and CATEGORY_SCOPES[category] == "scenario")
        or (category is None and reference)
    ):
        scenario = context.reference_scenario if reference else context.scenario
        if reference and not scenario:
            raise ValueError("Reference input requires a reference scenario")
    frame = read_table(context, table, scenario, path, scale)
    if filter is not None:
        frame = frame.loc[filter(frame)]
    if fields is not None:
        frame = frame[fields if isinstance(fields, str) else list(fields)]
    return frame
