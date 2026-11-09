"""Schema-aware placeholders and field status for local source staging."""

import json

import geopandas as gpd
import pandas as pd

from ..config import LIBRARY_PATH
from ..utilities.naming import snake_case
from .validation import _field, _field_key, _joins, load_schema


def stage_fields(frame, category, table):
    """Keep contract fields/geometry; add typed nulls for missing stored fields."""
    schema = load_schema()
    definition = schema[category][table]
    required_joins = {
        _field_key(secondary[2]) for _, _, secondary, _ in _joins(schema)
        if secondary[:2] == (category, table)
    }
    allowed = {_field_key(f["Name"]) for f in definition["Fields"]}
    geometry = frame.active_geometry_name if isinstance(frame, gpd.GeoDataFrame) else None
    frame = frame[[c for c in frame if _field_key(c) in allowed or c == geometry]].copy()
    present = {_field_key(c) for c in [*frame.columns, *frame.index.names] if c}
    for field in definition["Fields"]:
        key = _field_key(field["Name"])
        if key in present or (field.get("Virtual") and key not in required_joins):
            continue
        if field["Name"] == definition["PK"]:
            raise ValueError(f"{table}: cannot create a placeholder primary key")
        dtype = {"number": "Float64", "boolean": "boolean", "id": "string",
                 "text": "string", "enum": "string", "collection": "object"}[field["Type"]]
        frame[snake_case(field["Name"])] = pd.Series(pd.NA, index=frame.index, dtype=dtype)
    return frame


def field_status(frame, category, table, *, issues=None):
    """Audit stored fields against the current contract and library notes.

    Preserve the three-key status format. Missing percentages include fully null
    placeholders; derivation formulas and unresolved provenance go in issues.
    """
    definition = load_schema()[category][table]
    library = json.loads(LIBRARY_PATH.read_text(encoding="utf-8-sig"))
    sources = [s for s in library["Data Sources"] if _field_key(s["name"]) == _field_key(table)]
    metadata = {_field_key(f["name"]): f for s in sources for f in s["fields"]}
    status = {"completed_fields": [], "fields_with_missing_values": {}, "problematic_fields": {}}
    issues = issues or {}
    for field in definition["Fields"]:
        try:
            values = _field(frame, field["Name"])
        except KeyError:
            if field.get("Virtual"):
                continue
            raise
        name = values.name
        # Exported dimensions expand a library field into suffixed columns.
        key = _field_key(field["Name"])
        matches = [k for k in metadata if key == k
                   or _field_key(field["Name"].rsplit("_", 1)[0]) == k or (
            snake_case(field["Name"]).startswith(snake_case(metadata[k]["name"]) + "_")
        )]
        info = metadata[max(matches, key=len)] if matches else {}
        problems = [issues[name]] if name in issues else []
        missing = float(values.isna().mean() * 100) if len(values) else None
        if missing is None:
            problems.append("no rows available")
        elif missing > 0:
            status["fields_with_missing_values"][name] = round(missing, 4)
            if missing == 100:
                problems.append("100% missing values; nullable placeholder")
        options = info.get("options", [])
        if options and not values.dropna().map(lambda v: snake_case(str(v))).isin(
            [snake_case(str(option)) for option in options]
        ).all():
            problems.append("outside allowed domain; source values retained")
        derived = info.get("derived") or any(
            flag["Name"] == "Derived" for flag in field.get("Flags", [])
        )
        if derived and (problems or missing):
            formulas = [f["formula"] for f in info.get("formulas", []) if f.get("formula")]
            notes = [info.get("details", "")]
            notes += [f.get("generalExplanation", "") for f in info.get("formulas", [])]
            reference = "; ".join(filter(None, [*formulas, *notes]))
            problems.append(
                f"derivation reference: library-schema.json / {table} / {info.get('name', field['Name'])}"
                + (f": {reference}" if reference else "; formula not supplied")
            )
        if missing or problems:
            for flag in field.get("Flags", []):
                if flag.get("Note"):
                    problems.append(flag["Note"])
        if problems:
            status["problematic_fields"][name] = "; ".join(dict.fromkeys(problems))
        if missing == 0 and not problems:
            status["completed_fields"].append(name)
    return status
