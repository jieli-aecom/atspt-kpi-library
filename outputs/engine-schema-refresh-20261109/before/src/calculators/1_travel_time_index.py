# KPI 1: Travel Time Index
# ID: kpi-19ac616a-be85-4922-8364-ba5775263683
# Group: Scenario; unit: index
# Required sources:
#   Common BaseHighwayLinks: corridor_id, subregion_ids.
#   Current ScenarioLinks: distance_miles, free_flow_speed_mph, is_removed_from_base.
#   Current CalibratedNetworkOutput: total_calibrated_daily_vmt and
#     calibrated_travel_minutes_<period>.
#   Domain: Period. No prerequisite KPIs, constants, or lookups.
# Expected output files:
#   data/kpis/<scenario>/Links/1_travel_time_index.parquet
#   data/kpis/<scenario>/Corridors/1_travel_time_index.parquet
#   data/kpis/<scenario>/SubRegions/1_travel_time_index.parquet
#   data/kpis/<scenario>/Region/1_travel_time_index.parquet
# Each output has one geography row and travel_time_index_<period> columns.

import numpy as np
import pandas as pd

from ..data_interface import writer
from ..data_interface.validation import validate_table
from ..pipeline.context import RunContext, SpatialScale
from ..utilities.domains import get_domain

KPI_NAME = "1_travel_time_index"
KPI_ID = "kpi-19ac616a-be85-4922-8364-ba5775263683"
SCENARIO_TYPE = "Scenario"
PERIODS = get_domain("Period")


def validate(context: RunContext) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    return (
        validate_table(context, "PreprocessedConstants", "BaseHighwayLinks"),
        validate_table(context, "ScenarioUpstream", "ScenarioLinks"),
        validate_table(context, "KPIPreparation", "CalibratedNetworkOutput"),
    )


def process(
    base: pd.DataFrame, scenario: pd.DataFrame, network: pd.DataFrame
) -> dict[SpatialScale, pd.DataFrame]:
    """Return period KPI frames by scale without loading or writing data."""
    scenario_ids = scenario.index
    scenario = scenario.loc[~scenario["is_removed_from_base"].eq(True).fillna(False)]
    network = network.reindex(scenario.index)
    # Base links supply group memberships only. Added links can still contribute to the region.
    base = base.reindex(scenario.index)

    distance = scenario["distance_miles"]
    speed = scenario["free_flow_speed_mph"]
    valid_free_flow = (np.isfinite(distance) & distance.gt(0)
                       & np.isfinite(speed) & speed.gt(0)).fillna(False)
    free_flow_minutes = (distance / speed * 60).where(valid_free_flow)
    links = pd.DataFrame(
        {
            f"travel_time_index_{period.lower()}": network[
                f"calibrated_travel_minutes_{period.lower()}"
            ]
            / free_flow_minutes
            for period in PERIODS
        }
    )
    links = links.where(np.isfinite(links) & links.ge(0))
    weights = network["total_calibrated_daily_vmt"]
    weights = weights.where(np.isfinite(weights) & weights.gt(0))
    # Each period's numerator and denominator must cover exactly the same links.
    # Null placeholders must not silently count as zero TTI with a positive weight.
    valid_weights = links.notna().mul(weights, axis="index").where(links.notna())
    weighted = links.mul(valid_weights)
    outputs = {SpatialScale.LINKS: links.reindex(scenario_ids)}
    for scale, field, group_name in (
        (SpatialScale.CORRIDORS, "corridor_id", "corridor_id"),
        (SpatialScale.SUBREGIONS, "subregion_ids", "subregion_id"),
    ):
        groups = base[field]
        if field == "subregion_ids":
            groups = groups.dropna().map(lambda ids: list(dict.fromkeys(ids))).explode()
        groups = groups.dropna()
        contributions = weighted.loc[groups.index].copy()
        contributions.index = pd.Index(groups.to_numpy(), name=group_name)
        denominators = valid_weights.loc[groups.index].copy()
        denominators.index = contributions.index
        totals = contributions.groupby(level=0).sum(min_count=1)
        total_weights = denominators.groupby(level=0).sum(min_count=1)
        outputs[scale] = totals.div(total_weights.where(total_weights.gt(0)))
    outputs[SpatialScale.REGION] = pd.DataFrame(
        [weighted.sum(min_count=1) / valid_weights.sum(min_count=1).replace(0, np.nan)],
        index=pd.Index(["Region"], name="region_id")
    )

    return outputs


def calculate(context: RunContext) -> None:
    """CLI entry: validate, process and write one KPI file per spatial scale."""
    outputs = process(*validate(context))
    for scale, output in outputs.items():
        writer.write_table(context, KPI_NAME, output, path="kpis", scale=scale)
