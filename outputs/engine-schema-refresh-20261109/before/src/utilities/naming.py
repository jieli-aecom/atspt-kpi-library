"""Names shared by scaffolding and dimension-column suggestions."""

import keyword
import re


def snake_case(name: str) -> str:
    """Convert a display name or dimension option into an identifier component."""
    name = re.sub(r"([A-Z]+)([A-Z][a-z])", r"\1_\2", name)
    name = re.sub(r"([a-z0-9])([A-Z])", r"\1_\2", name)
    return re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")


def identifier(name: str) -> str:
    """Produce a valid Python argument name, including for numeric options."""
    name = snake_case(name) or "value"
    if name[0].isdigit():
        name = f"value_{name}"
    return f"{name}_" if keyword.iskeyword(name) else name


def kpi_filename(number: int, name: str) -> str:
    """Return the common stem for a KPI's Python module and local Parquet file."""
    if isinstance(number, bool) or not isinstance(number, int) or number < 1:
        raise ValueError(f"KPI Number must be a positive integer: {number!r}")
    stem = snake_case(name)
    if not stem:
        raise ValueError("KPI Name must contain letters or digits")
    return f"{number}_{stem}"
