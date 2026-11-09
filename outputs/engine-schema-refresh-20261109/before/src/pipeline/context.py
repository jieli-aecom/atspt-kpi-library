from dataclasses import dataclass
from enum import StrEnum


class SpatialScale(StrEnum):
    """Built-in IDs; library folder overrides take precedence over storage defaults."""

    LINKS = "link"
    PROJECTS = "project"
    CELLS = "cell"
    TAZS = "taz"
    CORRIDORS = "corridor"
    SUBREGIONS = "subRegion"
    REGION = "region"


@dataclass(frozen=True)
class RunContext:
    """Current and optional reference scenario names for a run."""

    scenario: str
    reference_scenario: str | None = None
