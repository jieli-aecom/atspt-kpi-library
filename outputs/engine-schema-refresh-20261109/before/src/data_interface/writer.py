"""Write a complete table or one field, aligning values by index label."""

from collections.abc import Callable
from typing import Literal

import geopandas as gpd
import pandas as pd

from ..pipeline.context import RunContext, SpatialScale
from . import loader


def save_table(
    context: RunContext,
    table: str,
    frame: pd.DataFrame,
    scenario: str | None = None,
    path: Literal["source", "kpis"] = "source",
    scale: SpatialScale | str | None = None,
) -> None:
    """Local write boundary. A cloud implementation replaces this function."""
    file_path = loader.table_path(context, table, scenario, path, scale)
    temporary = file_path.with_suffix(".tmp.parquet")
    frame.to_parquet(temporary, index=True)
    temporary.replace(file_path)


def write_table(
    context: RunContext,
    table: str,
    frame: pd.DataFrame,
    *,
    scenario: str | None = None,
    path: Literal["source", "kpis"] = "source",
    scale: SpatialScale | str | None = None,
) -> None:
    """Write a complete table to path='source' or 'kpis'; KPI writes require scale."""
    save_table(context, table, frame, scenario, path, scale)


def write(
    context: RunContext,
    table: str,
    field: str,
    values: pd.Series,
    filter: Callable[[pd.DataFrame], pd.Series] | None = None,
    *,
    scenario: str | None = None,
    path: Literal["source", "kpis"] = "source",
    scale: SpatialScale | str | None = None,
    template: pd.DataFrame | None = None,
) -> None:
    """Update exactly the selected rows; template supplies geometry when creating a table."""
    try:
        frame = loader.load(context, table, scenario=scenario, path=path, scale=scale)
    except FileNotFoundError:
        frame = template.copy() if template is not None else pd.DataFrame(index=values.index)
    selected = frame.loc[filter(frame)].index if filter is not None else frame.index
    if (
        not values.index.is_unique
        or len(values) != len(selected)
        or not selected.isin(values.index).all()
    ):
        raise ValueError("Values must have exactly the selected index labels")
    if field not in frame:
        frame[field] = pd.Series(index=frame.index, dtype=values.convert_dtypes().dtype)
    if isinstance(values, gpd.GeoSeries) and values.crs != frame.crs:
        raise ValueError("Geometry CRS must match the target")
    frame.loc[selected, field] = values.reindex(selected)
    write_table(context, table, frame, scenario=scenario, path=path, scale=scale)
