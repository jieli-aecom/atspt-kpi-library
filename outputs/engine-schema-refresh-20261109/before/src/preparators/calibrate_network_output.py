"""Placeholder calibration with VMT and period V/C from the library formulas."""

import json

import numpy as np
import pandas as pd

from ..config import CONFIG_DIR
from ..data_interface import writer
from ..data_interface.staging import field_status
from ..data_interface.validation import validate_table
from ..pipeline.context import RunContext
from ..utilities import get_domain


def validate(context: RunContext) -> tuple[pd.DataFrame, pd.DataFrame]:
    network = validate_table(context, "ScenarioUpstream", "NetworkOutput")
    links = validate_table(context, "ScenarioUpstream", "ScenarioLinks")
    return network, links


def process(network: pd.DataFrame, links: pd.DataFrame) -> pd.DataFrame:
    """Copy volumes, derive VMT/period V/C, and leave unavailable travel times null."""
    # Join validation rejects unknown IDs. Pad any scenario links without model output.
    network = network.reindex(links.index)
    output = pd.DataFrame(index=links.index.copy())

    for period in get_domain("Period"):
        period = period.lower()
        output[f"calibrated_volume_{period}"] = network[f"volume_{period}"]
        # Library source references resolve the truck percentages to NetworkOutput.
        output[f"calibrated_truck_volume_{period}"] = (
            output[f"calibrated_volume_{period}"]
            * (network[f"medium_truck_ratio_{period}"] + network[f"heavy_truck_ratio_{period}"])
            / 100
        )
        output[f"calibrated_vmt_{period}"] = (
            network[f"volume_{period}"] * links["distance_miles"]
        )
        output[f"calibrated_truck_vmt_{period}"] = (
            output[f"calibrated_truck_volume_{period}"] * links["distance_miles"]
        )
        output[f"calibrated_travel_minutes_{period}"] = pd.Series(
            pd.NA, index=network.index, dtype="Float64"
        )
        # Library: CalibratedVolume / (ScenarioLinks.Capacity / PeriodHours).
        # Preserve the supplied division by hours; store the result in percent.
        hours = {"am": 3, "pm": 4, "md": 6, "ov": 11}[period]
        capacity = links["capacity"].reindex(network.index) / hours
        volume = output[f"calibrated_volume_{period}"]
        valid = (capacity > 0) & np.isfinite(capacity) & (volume >= 0) & np.isfinite(volume)
        output[f"calibrated_vc_{period}"] = (volume / capacity.where(valid) * 100).astype("Float64")

    output["total_calibrated_daily_volume"] = (
        network["volume_am"] + network["volume_pm"] + network["volume_md"] + network["volume_ov"]
    )
    output["total_calibrated_daily_vmt"] = (
        output["total_calibrated_daily_volume"] * links["distance_miles"]
    )
    output["total_calibrated_daily_truck_volume"] = (
        output["calibrated_truck_volume_am"] + output["calibrated_truck_volume_pm"]
        + output["calibrated_truck_volume_md"] + output["calibrated_truck_volume_ov"]
    )
    output["total_daily_truck_vmt"] = (
        output["total_calibrated_daily_truck_volume"] * links["distance_miles"]
    )
    return output


def prepare(context: RunContext) -> None:
    """Validate, synthesize and write scenario-scoped CalibratedNetworkOutput."""
    network, links = validate(context)
    output = process(network, links)
    validate_table(context, "KPIPreparation", "CalibratedNetworkOutput", tables={
        "CalibratedNetworkOutput": output, "ScenarioLinks": links, "NetworkOutput": network,
    })
    writer.write_table(context, "CalibratedNetworkOutput", output, scenario=context.scenario)
    # The compact status file is the latest local staging snapshot.
    status_path = CONFIG_DIR / "_status.json"
    status = json.loads(status_path.read_text(encoding="utf-8")) if status_path.exists() else {}
    issues = {
        field: f"synthetic from NetworkOutput ({context.scenario}); calibration pending"
        for field in output
    }
    for period in get_domain("Period"):
        field = f"calibrated_vc_{period.lower()}"
        issues[field] += (
            "; percent = 100 * calibrated volume / (ScenarioLinks capacity / period hours); "
            "unavailable or nonpositive capacities remain null"
        )
    status["CalibratedNetworkOutput"] = field_status(
        output, "KPIPreparation", "CalibratedNetworkOutput", issues=issues
    )
    status_path.write_text(json.dumps(status, indent=2) + "\n", encoding="utf-8")
