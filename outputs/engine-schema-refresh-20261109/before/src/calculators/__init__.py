"""Calculators expose validate(context), process(dataframes), and calculate(context)."""

from importlib import import_module


def __getattr__(name: str):
    # Preserve the existing notebook import while the actual filename is numbered.
    if name == "travel_time_index":
        return import_module(".1_travel_time_index", __name__)
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
