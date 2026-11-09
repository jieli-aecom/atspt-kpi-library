"""Validate table fields and directed joins using config/table-schema.json."""

import json
import re
from numbers import Integral, Real
from typing import Any

import numpy as np
import pandas as pd
import geopandas as gpd

from ..config import TABLE_SCHEMA_PATH as SCHEMA_PATH
from ..pipeline.context import RunContext
from . import loader


def load_schema() -> dict[str, dict[str, Any]]:
    """Read the current configuration, including JSON-only edits in notebook sessions."""
    return json.loads(SCHEMA_PATH.read_text(encoding="utf-8-sig"))


def _field_key(name: str) -> str:
    """Compare schema labels and data fields independently of case/separators."""
    return re.sub(r"[^a-z0-9]", "", name.lower())


def _field(frame: pd.DataFrame, name: str) -> pd.Series:
    """Resolve a schema label without renaming the schema or stored field."""
    key = _field_key(name)
    for column in frame.columns:
        if _field_key(column) == key:
            return frame[column]
    for level in frame.index.names:
        if level is not None and _field_key(level) == key:
            return pd.Series(frame.index.get_level_values(level), index=frame.index, name=level)
    raise KeyError(name)


def _matches_type(value: object, kind: str, element_type: str | None = None) -> bool:
    if kind == "number":
        return isinstance(value, Real) and not isinstance(value, (bool, np.bool_))
    if kind in ("id", "enum"):
        return isinstance(value, (str, Integral)) and not isinstance(value, (bool, np.bool_))
    if kind == "text":
        return isinstance(value, str)
    if kind == "boolean":
        return isinstance(value, (bool, np.bool_))
    if kind == "collection":
        return isinstance(value, (list, tuple, np.ndarray)) and all(
            _matches_type(item, element_type) for item in value
        )
    raise ValueError(f"Unknown schema type: {kind}")


def validate_table(
    context: RunContext,
    category: str,
    table: str,
    *,
    tables: dict[str, pd.DataFrame] | None = None,
    reference: bool = False,
) -> pd.DataFrame:
    """Return the loaded table or raise a readable validation error.

    Secondary join fields are required, including virtual fields. Other virtual
    fields are optional, but checked when present. Secondary IDs must reference
    principal IDs; they need not cover them all. N:N references are collections.
    AllowMissingWhen names a secondary boolean field exempting added records
    from principal membership, while retaining uniqueness and type checks.
    ScenarioLinks -> BaseHighwayLinks uses IsAddedToBase by default, including
    when the exported schema omits that exception.
    Principal tables need no secondary tables unless a virtual join is explicit.
    Supply in-memory tables to validate fields and joins before publishing.
    Schema labels keep their original names; data fields remain snake_case.
    Each call reads one current schema snapshot for both fields and joins.
    reference=True selects the reference scenario for the table and its joins;
    common tables are shared between both scenarios.
    """

    def get_frame(cat: str, name: str) -> pd.DataFrame:
        if tables is not None and name in tables:
            return tables[name]
        return loader.load(context, name, category=cat, reference=reference)

    definitions = load_schema()
    schema = definitions[category][table]
    frame = get_frame(category, table)
    names = [*frame.columns, *(name for name in frame.index.names if name is not None)]
    if any(
        not isinstance(name, str) or not re.fullmatch(r"[a-z][a-z0-9]*(?:_[a-z0-9]+)*", name)
        for name in names
    ):
        raise ValueError(f"{category}.{table}: field names must use snake_case")
    if not frame.columns.is_unique:
        raise ValueError(f"{category}.{table}: duplicate field names")
    field_keys = {_field_key(name) for name in names}
    if len(field_keys) != len(set(names)):
        raise ValueError(f"{category}.{table}: ambiguous field names after ignoring separators")
    allowed_fields = {_field_key(field["Name"]) for field in schema["Fields"]}
    if isinstance(frame, gpd.GeoDataFrame) and frame.active_geometry_name is not None:
        allowed_fields.add(_field_key(frame.active_geometry_name))
    extra_fields = [name for name in names if _field_key(name) not in allowed_fields]
    if extra_fields:
        raise ValueError(f"{category}.{table}: fields outside schema: {extra_fields}")
    joins = list(_joins(definitions))
    stored_join_fields = {
        _field_key(secondary[2]) for _, _, secondary, _ in joins
        if secondary[:2] == (category, table)
    }

    problems: list[str] = []
    for field in schema["Fields"]:
        name, kind = field["Name"], field["Type"]
        if (
            field.get("Virtual", False)
            and _field_key(name) not in stored_join_fields
            and _field_key(name) not in field_keys
        ):
            continue
        try:
            values = _field(frame, name)
        except KeyError:
            problems.append(f"{category}.{table}: missing field {name}")
            continue
        if not all(
            _matches_type(value, kind, field.get("ElementType")) for value in values.dropna()
        ):
            expected = f"collection<{field['ElementType']}>" if kind == "collection" else kind
            problems.append(f"{category}.{table}.{name}: expected {expected}")
    if schema["PK"] is not None:
        try:
            key = _field(frame, schema["PK"])
            if key.isna().any() or not key.is_unique:
                problems.append(
                    f"{category}.{table}: PK {schema['PK']} must be unique and non-null"
                )
        except KeyError:
            problems.append(f"{category}.{table}: missing PK field {schema['PK']}")
    if problems:
        raise ValueError("\n".join(problems))

    frames = {(category, table): frame}
    for kind, principal, secondary, allow_missing_when in joins:
        principal_field = next(
            (
                f
                for f in definitions[principal[0]][principal[1]]["Fields"]
                if _field_key(f["Name"]) == _field_key(principal[2])
            ),
            {},
        )
        explicit_reverse = (
            principal[:2] == (category, table)
            and principal_field.get("Virtual", False)
            and _field_key(principal[2]) in field_keys
        )
        if secondary[:2] != (category, table) and not explicit_reverse:
            continue
        # A virtual reverse field contains secondary IDs; the secondary field
        # still references the principal PK, not that optional reverse field.
        if principal_field.get("Virtual", False):
            principal_key = (*principal[:2], definitions[principal[0]][principal[1]]["PK"])
        else:
            principal_key = principal
        try:
            for cat, name, _ in (principal, secondary):
                if (cat, name) not in frames:
                    frames[cat, name] = get_frame(cat, name)
            principal_ids = _field(frames[principal[:2]], principal_key[2])
            secondary_ids = _field(frames[secondary[:2]], secondary[2])
        except (KeyError, FileNotFoundError) as exc:
            problems.append(f"{category}.{table}: join {secondary} -> {principal}: {exc}")
            continue
        if principal_ids.isna().any() or not principal_ids.is_unique:
            problems.append(
                f"{principal[1]}.{principal_key[2]}: principal IDs must be unique and non-null"
            )
        references = secondary_ids.dropna()
        if kind == "N:N":
            if not all(_matches_type(value, "collection", "id") for value in references):
                problems.append(
                    f"{secondary[1]}.{secondary[2]}: expected collection<id> for N:N join"
                )
                continue
            references = references.explode().dropna()
        elif not all(_matches_type(value, "id") for value in references):
            problems.append(f"{secondary[1]}.{secondary[2]}: expected scalar IDs for {kind} join")
            continue
        if kind == "1:1" and not references.is_unique:
            problems.append(f"{secondary[1]}.{secondary[2]}: 1:1 join IDs must be unique")
        if allow_missing_when:
            try:
                added = _field(frames[secondary[:2]], allow_missing_when)
            except KeyError:
                problems.append(f"{secondary[1]}: missing exception field {allow_missing_when}")
                continue
            if not all(_matches_type(value, "boolean") for value in added.dropna()):
                problems.append(f"{secondary[1]}.{allow_missing_when}: expected boolean")
                continue
            references = references[~added.eq(True).fillna(False).reindex(references.index)]
        missing = references[~references.isin(principal_ids)].unique().tolist()
        if missing:
            problems.append(
                f"{secondary[1]}.{secondary[2]}: IDs not found in "
                f"{principal[1]}.{principal_key[2]}: {missing[:10]}"
            )
        if explicit_reverse:
            reverse = _field(frame, principal[2]).dropna()
            if principal_field.get("Type") == "collection":
                reverse = reverse.explode().dropna()
            secondary_pk = definitions[secondary[0]][secondary[1]]["PK"]
            missing = reverse[~reverse.isin(_field(frames[secondary[:2]], secondary_pk))]
            if not missing.empty:
                problems.append(
                    f"{table}.{principal[2]}: reverse IDs not found in {secondary[1]}.{secondary_pk}"
                )
    if problems:
        raise ValueError("\n".join(problems))
    return frame


def _joins(definitions):
    """Yield each relationship once, independent of declaration order/direction."""
    locations = {name: cat for cat, tables in definitions.items() for name in tables}
    checked = set()
    for category, tables in definitions.items():
        for table, definition in tables.items():
            for join in definition["Joins"]:
                left = (category, table, join["LeftOn"])
                right = (locations[join["With"]], join["With"], join["RightOn"])
                kind = join["Type"]
                if kind in ("1:N", "N:1"):
                    principal, secondary = (left, right) if kind == "1:N" else (right, left)
                    kind = "N:1"
                elif kind in ("1:1", "N:N"):
                    roles = (join.get("LeftRole"), join.get("RightRole"))
                    if roles == ("principal", "secondary"):
                        principal, secondary = left, right
                    elif roles == ("secondary", "principal"):
                        principal, secondary = right, left
                    else:
                        raise ValueError(f"{table}: {kind} join requires principal/secondary roles")
                else:
                    raise ValueError(f"Unknown join type: {kind}")
                allow_missing_when = join.get("AllowMissingWhen")
                # Exported schemas omit this established scenario-network rule.
                # Only added links may lack a corresponding base-year record.
                if (
                    allow_missing_when is None
                    and kind == "1:1"
                    and principal == ("PreprocessedConstants", "BaseHighwayLinks", "LinkID")
                    and secondary == ("ScenarioUpstream", "ScenarioLinks", "LinkID")
                ):
                    allow_missing_when = "IsAddedToBase"
                identity = kind, principal, secondary, allow_missing_when
                if identity not in checked:
                    checked.add(identity)
                    yield identity
