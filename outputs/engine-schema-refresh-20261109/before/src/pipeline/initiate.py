"""Seed code definitions and calculator scaffolding from a library export.

Unimplemented scaffolds follow the export; implemented code is preserved.
Domain options and constant defaults follow the export even when edited locally.
Existing Python files are inspected with AST rather than executed.
"""

import ast
import json
import math
import re
from dataclasses import dataclass, field
from pathlib import Path
from pprint import pformat

from ..config import LIBRARY_PATH, TABLE_SCHEMA_PATH
from ..data_interface.storage import DEFAULT_SCALE_FOLDERS
from ..utilities.naming import identifier, kpi_filename, snake_case

SOURCE_DIR = Path(__file__).resolve().parents[1]

# Table names are defined by table-schema.json, independently of KPI names.
GEOGRAPHIES = {
    "link": ("PreprocessedConstants", "BaseHighwayLinks", "link_id"),
    "cell": ("PreprocessedConstants", "Cells", "cell_id"),
    "project": ("ScenarioUpstream", "Projects", "project_id"),
    "taz": ("PreprocessedConstants", "TAZs", "taz_id"),
    "corridor": ("PreprocessedConstants", "Corridors", "corridor_id"),
    "subRegion": ("PreprocessedConstants", "SubRegions", "subregion_id"),
    "region": (None, None, "region_id"),
}


@dataclass
class InitiationResult:
    created: list[Path] = field(default_factory=list)
    updated: list[Path] = field(default_factory=list)
    deleted: list[Path] = field(default_factory=list)
    preserved: list[Path] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)


def _key(value: str) -> str:
    return re.sub(r"[^a-z0-9]", "", value.lower())


def _comments(value: str, indent: str = "") -> list[str]:
    return [f"{indent}# {line}".rstrip() for line in str(value).splitlines()]


def _formula_items(kpi: dict) -> list[dict]:
    return [item for group in kpi["Formula"]["Groups"] for item in group["items"]]


def _split_arguments(text: str) -> list[str]:
    """Split LaTeX arguments without splitting inside subscripts or nested calls."""
    result, start, depth = [], 0, 0
    for i, char in enumerate(text):
        if char in "{([":
            depth += 1
        elif char in "})]":
            depth -= 1
        elif char == "," and depth == 0:
            result.append(text[start:i].strip())
            start = i + 1
    result.append(text[start:].strip())
    return result


def _lookup_calls(name: str, text: str) -> list[list[str]]:
    calls = []
    for match in re.finditer(r"(?<![A-Za-z0-9])" + re.escape(name) + r"\s*\(", text):
        start, depth = match.end(), 1
        for end in range(start, len(text)):
            if text[end] == "(":
                depth += 1
            elif text[end] == ")":
                depth -= 1
            if depth == 0:
                calls.append(_split_arguments(text[start:end]))
                break
    return calls


def _subscripts(text: str) -> list[str]:
    result = []
    for match in re.finditer(r"_\{", text):
        start, depth = match.end(), 1
        for end in range(start, len(text)):
            if text[end] == "{":
                depth += 1
            elif text[end] == "}":
                depth -= 1
            if depth == 0:
                result.extend(_split_arguments(text[start:end]))
                break
    return result


def _constant_value(value: object) -> object:
    """Interpret the numeric, percent, and dollar defaults used by this export."""
    if value is None or value == "":
        return None
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        if not math.isfinite(value):
            raise ValueError(f"Default must be finite, got {value!r}")
        return value
    if not isinstance(value, str):
        raise TypeError(f"Expected a numeric default or None, got {value!r}")
    text = value.strip()
    if not text:
        return None
    percent = text.endswith("%")
    numeric = text.removeprefix("$").removesuffix("%").strip()
    if not re.fullmatch(
        r"[+-]?(?:(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?",
        numeric,
    ):
        raise ValueError(f"Unrecognized numeric default {value!r}")
    numeric = numeric.replace(",", "")
    if not math.isfinite(float(numeric)):
        raise ValueError(f"Default must be finite, got {value!r}")
    if percent:
        return float(numeric) / 100
    return int(numeric) if re.fullmatch(r"[+-]?\d+", numeric) else float(numeric)


def _defined_names(path: Path, registry: str) -> set[str]:
    """Recognize dictionary literals, keyed assignments, and setdefault entries."""
    if not path.exists():
        return set()
    names = set()
    tree = ast.parse(path.read_text(encoding="utf-8-sig"), filename=str(path))
    for node in ast.walk(tree):
        if isinstance(node, (ast.Assign, ast.AnnAssign)):
            targets = node.targets if isinstance(node, ast.Assign) else [node.target]
            for target in targets:
                if (
                    isinstance(target, ast.Name)
                    and target.id == registry
                    and isinstance(node.value, ast.Dict)
                ):
                    names.update(k.value for k in node.value.keys if isinstance(k, ast.Constant))
                if (
                    isinstance(target, ast.Subscript)
                    and isinstance(target.value, ast.Name)
                    and target.value.id == registry
                    and isinstance(target.slice, ast.Constant)
                ):
                    names.add(target.slice.value)
        if (
            isinstance(node, ast.Call)
            and isinstance(node.func, ast.Attribute)
            and isinstance(node.func.value, ast.Name)
            and node.func.value.id == registry
            and node.func.attr == "setdefault"
            and node.args
            and isinstance(node.args[0], ast.Constant)
        ):
            names.add(node.args[0].value)
    return names


def _registry_header(registry: str) -> str:
    if registry == "LOOKUPS":
        return '''"""Named lookup functions, each implemented in its own module."""

from collections.abc import Callable
from importlib import import_module

LOOKUPS: dict[str, str] = {}


def get_lookup(name: str) -> Callable[..., object]:
    """Return a callable lookup by name; unknown names raise KeyError."""
    return import_module(f".{LOOKUPS[name]}", __name__).lookup
'''
    if registry == "DOMAINS":
        return '''"""Code-defined domains, synchronized with library options by initiate."""

DOMAINS: dict[str, list[str]] = {}


def get_domain(name: str) -> list[str]:
    """Return a copy of a domain's options; unknown names raise KeyError."""
    return list(DOMAINS[name])
'''
    return '''"""Code-defined constants, synchronized with library defaults by initiate."""

CONSTANTS: dict[str, object] = {}


def get_constant(name: str) -> object:
    """Return a named constant's value; unknown names raise KeyError."""
    return CONSTANTS[name]
'''


def _read_source(path: Path) -> str:
    # Keep existing line endings and the BOM when editing a shared registry.
    return path.read_bytes().decode("utf-8")


def _parse_source(source: str, path: Path) -> ast.Module:
    return ast.parse(source.removeprefix("\ufeff"), filename=str(path))


def _script_state(source: str, path: Path, *, lookup: bool) -> tuple[str | None, bool]:
    """Identify exported scripts without importing or executing user code."""
    marker = re.match(
        r"# (?:Lookup|KPI \d+): [^\n]*\n# ID: ([^\r\n]+)", source.removeprefix("\ufeff")
    )
    identity = marker[1] if marker else None
    try:
        tree = _parse_source(source, path)
    except SyntaxError:
        return identity, False
    if not lookup:
        # KPI_ID remains authoritative if the generated header was edited.
        for node in tree.body:
            if isinstance(node, (ast.Assign, ast.AnnAssign)):
                targets = node.targets if isinstance(node, ast.Assign) else [node.target]
                if (
                    any(
                        isinstance(target, ast.Name) and target.id == "KPI_ID" for target in targets
                    )
                    and isinstance(node.value, ast.Constant)
                    and isinstance(node.value.value, str)
                ):
                    identity = node.value.value
        # A remaining NotImplementedError is the explicit opt-in to KPI refresh,
        # including when other functions or parts of the script are implemented.
        return identity, identity is not None and any(
            isinstance(node, ast.Raise)
            and (
                isinstance(node.exc, ast.Name)
                and node.exc.id == "NotImplementedError"
                or isinstance(node.exc, ast.Call)
                and isinstance(node.exc.func, ast.Name)
                and node.exc.func.id == "NotImplementedError"
            )
            for node in ast.walk(tree)
        )
    if identity is None:
        return None, False
    functions = set()
    for node in tree.body:
        if isinstance(node, ast.FunctionDef):
            if (
                node.name != "lookup"
                or node.name in functions
                or node.decorator_list
                or node.args.defaults
                or any(default is not None for default in node.args.kw_defaults)
                or len(node.body) != 1
                or not isinstance(node.body[0], ast.Raise)
                or node.body[0].cause is not None
            ):
                return identity, False
            exception = node.body[0].exc
            if not (
                isinstance(exception, ast.Call)
                and isinstance(exception.func, ast.Name)
                and exception.func.id == "NotImplementedError"
                and not exception.keywords
                and not any(
                    isinstance(child, (ast.Call, ast.NamedExpr, ast.Await, ast.Yield))
                    for argument in exception.args
                    for child in ast.walk(argument)
                )
            ):
                return identity, False
            functions.add(node.name)
        else:
            # Lookup helpers and partial bodies represent implementation work.
            return identity, False
    return identity, functions == {"lookup"}


def _sync_scripts(
    folder: Path,
    desired: dict[str, tuple[Path, str]],
    planned: dict[Path, str],
    deletions: set[Path],
    result: InitiationResult,
    *,
    lookup: bool = False,
    protected: set[str] | None = None,
) -> set[str]:
    existing = {}
    for path in sorted(folder.glob("*.py")):
        if path.name == "__init__.py":
            continue
        source = _read_source(path)
        identity, unimplemented = _script_state(source, path, lookup=lookup)
        existing[path] = (identity, unimplemented, source)
    protected = set(protected or ())
    protected.update(identity for identity, stub, _ in existing.values() if identity and not stub)
    for identity, (path, content) in desired.items():
        previous = [old for old, (key, _, _) in existing.items() if key == identity]
        if identity in protected or (
            path in existing and (not existing[path][1] or existing[path][0] in protected)
        ):
            protected.add(identity)
            if path not in previous:
                result.warnings.append(
                    f"Preserved existing code for {identity}; could not generate {path.name}."
                )
            continue
        for old in previous:
            if old != path:
                deletions.add(old)
        if path not in existing or existing[path][2].replace("\r\n", "\n") != content:
            planned[path] = content
    for path, (identity, stub, _) in existing.items():
        if stub and identity not in desired and identity not in protected and path not in planned:
            deletions.add(path)
        elif path not in planned and path not in deletions:
            result.preserved.append(path)
    # A rename can reuse another obsolete scaffold's filename.
    deletions.difference_update(planned)
    return protected


@dataclass
class _RegistryBlock:
    identity: str
    name: str
    value: ast.expr
    start: int
    end: int
    node: ast.stmt


def _registry_blocks(source: str, tree: ast.Module, registry: str) -> list[_RegistryBlock]:
    """Locate generated ID/comment/registration blocks without touching other code."""
    lines = source.splitlines(keepends=True)
    blocks = []
    for node in tree.body:
        if not (
            isinstance(node, ast.Expr)
            and isinstance(node.value, ast.Call)
            and isinstance(node.value.func, ast.Attribute)
            and isinstance(node.value.func.value, ast.Name)
            and node.value.func.value.id == registry
            and node.value.func.attr == "setdefault"
            and len(node.value.args) == 2
            and not node.value.keywords
            and isinstance(node.value.args[0], ast.Constant)
            and isinstance(node.value.args[0].value, str)
            and node.col_offset == 0
        ):
            continue
        # Do not swallow another statement or a user comment on the same line.
        suffix = lines[node.end_lineno - 1].encode("utf-8")[node.end_col_offset :]
        if suffix.strip():
            continue
        start = node.lineno - 1
        while start > 0 and lines[start - 1].startswith("#"):
            start -= 1
        if start == node.lineno - 1 or not lines[start].startswith("# ID: "):
            continue
        blocks.append(
            _RegistryBlock(
                lines[start].removeprefix("# ID: ").strip(),
                node.value.args[0].value,
                node.value.args[1],
                start,
                node.end_lineno,
                node,
            )
        )
    return blocks


def _sync_registry(
    path: Path,
    registry: str,
    entries: dict[str, tuple[str, object, str]],
    protected: set[str],
) -> str:
    source = _read_source(path) if path.exists() else _registry_header(registry)
    tree = _parse_source(source, path)
    blocks = _registry_blocks(source, tree, registry)
    names = _defined_names(path, registry)
    lines = source.splitlines(keepends=True)
    edits = []
    handled = set()
    generated_nodes = {id(block.node) for block in blocks}
    header_nodes = {ast.dump(node) for node in ast.parse(_registry_header(registry)).body}
    # Dynamic or handwritten registry operations may depend on any existing key.
    # Leave their definitions intact and retain setdefault for appended entries.
    customized = any(
        id(node) not in generated_nodes
        and ast.dump(node) not in header_nodes
        and not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))
        and any(isinstance(child, ast.Name) and child.id == registry for child in ast.walk(node))
        for node in tree.body
    )

    def render(identity: str, entry: tuple[str, object, str]) -> str:
        name, value, description = entry
        comments = "\n".join(_comments(f"ID: {identity}\n{description}".rstrip()))
        return f"{comments}\n{registry}.setdefault({name!r}, {pformat(value, width=88, sort_dicts=False)})\n"

    for block in blocks:
        try:
            value = ast.literal_eval(block.value)
        except (ValueError, TypeError):
            value = object()  # A computed value is meaningful user code.
        entry = entries.get(block.identity)
        if entry is not None:
            handled.add(block.identity)
        editable = not customized and sum(b.identity == block.identity for b in blocks) == 1
        if registry == "DOMAINS":
            editable = editable and (entry is not None or value == [])
        elif registry == "CONSTANTS":
            editable = editable and (entry is not None or value is None)
        else:
            module = path.parent / f"{value}.py" if isinstance(value, str) else None
            module_is_stub = (
                module is None
                or not module.exists()
                or _script_state(_read_source(module), module, lookup=True)[1]
            )
            editable = (
                editable
                and block.identity not in protected
                and value == identifier(block.name)
                and module_is_stub
            )
        if entry is not None and entry[0] != block.name and entry[0] in names:
            editable = False
        if not editable:
            if registry == "LOOKUPS":
                protected.add(block.identity)
            continue
        replacement = render(block.identity, entry) if entry is not None else ""
        original = "".join(lines[block.start : block.end])
        if original.replace("\r\n", "\n") != replacement:
            edits.append((block.start, block.end, replacement))
    for start, end, replacement in reversed(edits):
        lines[start:end] = [replacement]
    content = "".join(lines)
    for identity, entry in entries.items():
        if registry == "LOOKUPS" and identity not in handled and entry[0] in names:
            protected.add(identity)
        if identity not in handled and entry[0] not in names and identity not in protected:
            content += "\n\n" + render(identity, entry)
    return content


class _Library:
    def __init__(self, library: dict, table_schema: dict):
        self._check_structure(library)
        self.library = library
        self.kpis = self._indexed(library["KPIs"], "ID", "KPI")
        self.sources = self._indexed(library["Data Sources"], "id", "source")
        self.constants = self._indexed(library["Constants"], "id", "constant")
        self.domains = self._indexed(
            library["Domain Definitions"]["Global Domains"], "id", "domain"
        )
        self.domain_names = {_key(d["name"]): d["name"] for d in self.domains.values()}
        self.scales = self._indexed(library["Domain Definitions"]["Spatial Scales"], "id", "scale")
        self.scale_tokens = {
            _key(token): scale["id"]
            for scale in self.scales.values()
            for token in (scale["id"], scale["label"])
        }
        self.tables = {
            (_key(category), _key(name)): (category, name)
            for category, tables in table_schema.items()
            for name in tables
        }
        self.lookups: dict[str, dict] = {}
        for source in self.sources.values():
            self.table(source)
            self._indexed(source["fields"], "id", f"field in {source['name']}")
            dimensions = [
                dimension
                for group in source.get("fieldGroups", [])
                for dimension in group["dimensions"]
            ]
            for definition in [*source["fields"], *dimensions]:
                if definition.get("enumId") and definition["enumId"] not in self.domains:
                    raise ValueError(
                        f"Source {source['name']}, {definition['name']}: unknown domain ID {definition['enumId']!r}"
                    )
        self.constant_values = {}
        for constant in self.constants.values():
            try:
                self.constant_values[constant["id"]] = _constant_value(constant.get("defaultValue"))
            except (TypeError, ValueError) as exc:
                raise ValueError(f"Constant {constant['name']!r}: {exc}") from exc
        numbers, filenames = set(), set()
        for kpi in self.kpis.values():
            filename = kpi_filename(kpi["Number"], kpi["Name"])
            if kpi["Number"] in numbers or filename in filenames:
                raise ValueError(f"Duplicate KPI number or filename: {filename}")
            numbers.add(kpi["Number"])
            filenames.add(filename)
            for index, source in enumerate(kpi["Source"]):
                try:
                    self._check_source(kpi, source)
                except KeyError as exc:
                    raise ValueError(
                        f"KPI {kpi['Number']} ({kpi['Name']}), Source[{index}]: missing required key {exc.args[0]!r}"
                    ) from exc
                except (TypeError, ValueError) as exc:
                    raise ValueError(
                        f"KPI {kpi['Number']} ({kpi['Name']}), Source[{index}]: {exc}"
                    ) from exc
            for scale in kpi["Spatial Scales"]:
                if scale not in self.scales:
                    raise ValueError(f"{filename}: unknown output scale {scale!r}")
            if not any(d["applicable"] for d in kpi["Spatial Scales"].values()):
                raise ValueError(f"{filename}: no applicable spatial scales are declared")
        for definitions in (self.constants.values(), self.domains.values()):
            names = [d["name"] for d in definitions]
            if len(names) != len(set(names)):
                raise ValueError("Duplicate constant or domain names")
        lookup_names = [lookup["name"] for lookup in self.lookups.values()]
        lookup_files = [identifier(name) for name in lookup_names]
        if len(set(lookup_files)) != len(lookup_files):
            raise ValueError("Lookup names resolve to duplicate filenames")
        for lookup in self.lookups.values():
            lengths = {len(call) for call in lookup["calls"]}
            if len(lengths) != 1 or any(not arg for call in lookup["calls"] for arg in call):
                raise ValueError(
                    f"Lookup {lookup['name']!r}: missing or inconsistent formula-call arguments"
                )
        for kpi in self.kpis.values():
            for source in kpi["Source"]:
                if source["type"] == "kpi":
                    try:
                        self.referenced_scales(source)
                    except ValueError as exc:
                        raise ValueError(f"KPI {kpi['Number']} ({kpi['Name']}): {exc}") from exc
        folders = [self.folder(scale) for scale in self.scales]
        if len({folder.casefold() for folder in folders}) != len(folders):
            raise ValueError("Spatial scale folders must be unique (ignoring case)")

    @staticmethod
    def _check_structure(library: dict) -> None:
        def require(condition: bool, location: str, expected: str) -> None:
            if not condition:
                raise ValueError(f"{location}: {expected}")

        require(isinstance(library, dict), "Library", "expected a JSON object")
        for section in ("KPIs", "Data Sources", "Constants"):
            require(isinstance(library.get(section), list), section, "expected an array")
        definitions = library.get("Domain Definitions")
        require(isinstance(definitions, dict), "Domain Definitions", "expected an object")
        for section in ("Global Domains", "Spatial Scales"):
            require(isinstance(definitions.get(section), list), section, "expected an array")
        for section, records, keys in (
            ("Constants", library["Constants"], ("id", "name")),
            ("Data Sources", library["Data Sources"], ("id", "name", "category")),
            ("Global Domains", definitions["Global Domains"], ("id", "name")),
            ("Spatial Scales", definitions["Spatial Scales"], ("id", "label")),
            ("KPIs", library["KPIs"], ("ID", "Name", "ScenarioType", "Unit")),
        ):
            for index, record in enumerate(records):
                where = f"{section}[{index}]"
                require(isinstance(record, dict), where, "expected an object")
                for key in keys:
                    require(isinstance(record.get(key), str), f"{where}.{key}", "expected a string")
                    if key != "Unit":
                        require(bool(record[key].strip()), f"{where}.{key}", "must not be empty")
        for domain in definitions["Global Domains"]:
            require(
                isinstance(domain.get("options"), list)
                and all(isinstance(option, str) for option in domain["options"]),
                f"Domain {domain['name']!r}.options",
                "expected an array of strings (may be empty)",
            )
        for source in library["Data Sources"]:
            require(
                isinstance(source.get("fields"), list),
                f"Source {source['name']}",
                "fields must be an array",
            )
            for index, data_field in enumerate(source["fields"]):
                require(
                    isinstance(data_field, dict)
                    and isinstance(data_field.get("id"), str)
                    and isinstance(data_field.get("name"), str),
                    f"Source {source['name']}.fields[{index}]",
                    "expected field id and name strings",
                )
        for kpi in library["KPIs"]:
            where = f"KPI {kpi.get('Number', '?')} ({kpi['Name']})"
            kpi_filename(kpi.get("Number"), kpi["Name"])
            require(
                kpi["ScenarioType"] in ("Base Year", "Scenario", "Inter-Scenario"),
                where,
                "unknown ScenarioType",
            )
            require(isinstance(kpi.get("Source"), list), where, "Source must be an array")
            require(
                isinstance(kpi.get("Spatial Scales"), dict),
                where,
                "Spatial Scales must be an object",
            )
            for scale, spec in kpi["Spatial Scales"].items():
                require(
                    isinstance(spec, dict) and isinstance(spec.get("applicable"), bool),
                    f"{where}, scale {scale}",
                    "applicable must be a boolean",
                )
            formula = kpi.get("Formula")
            require(
                isinstance(formula, dict) and isinstance(formula.get("Groups"), list),
                where,
                "Formula.Groups must be an array",
            )
            for index, group in enumerate(formula["Groups"]):
                require(
                    isinstance(group, dict) and isinstance(group.get("items"), list),
                    f"{where}, Formula.Groups[{index}]",
                    "items must be an array",
                )
                for item in group["items"]:
                    require(
                        isinstance(item, dict) and isinstance(item.get("formula"), str),
                        where,
                        "formula items must contain formula text",
                    )

    @staticmethod
    def _indexed(items: list[dict], key: str, label: str) -> dict:
        result = {}
        for item in items:
            if item[key] in result:
                raise ValueError(f"Duplicate {label} ID: {item[key]}")
            result[item[key]] = item
        return result

    def table(self, source: dict) -> tuple[str, str]:
        key = _key(source["category"]), _key(source["name"])
        if key not in self.tables:
            raise ValueError(
                f"Source {source['category']}.{source['name']} has no matching table in table-schema.json"
            )
        return self.tables[key]

    def _check_source(self, kpi: dict, source: dict) -> None:
        kind = source["type"]
        slot = source.get("scenarioSlot", 0)
        if type(slot) is not int or slot not in (0, 1):
            raise ValueError(f"KPI {kpi['Number']}: invalid scenarioSlot")
        if kind == "dataField":
            if source["dataSourceId"] not in self.sources:
                raise ValueError(f"Unknown data source ID {source['dataSourceId']!r}")
            table = self.sources[source["dataSourceId"]]
            self.table(table)
            if source["fieldId"] not in {f["id"] for f in table["fields"]}:
                raise ValueError(f"Unknown field reference: {source['fieldId']}")
        elif kind == "variable":
            if source["variableId"] not in self.constants:
                raise ValueError(f"Unknown constant ID {source['variableId']!r}")
        elif kind == "kpi":
            if source["kpiId"] not in self.kpis:
                raise ValueError(
                    f"Unknown prerequisite KPI ID {source['kpiId']!r} ({source.get('latex', '')})"
                )
        elif kind == "lookup":
            name = source["latex"].split("(")[0].strip()
            lookup = self.lookups.setdefault(
                source["lookupId"],
                {
                    "name": name,
                    "id": source["lookupId"],
                    "calls": [],
                    "kpis": [],
                },
            )
            if lookup["name"] != name:
                raise ValueError(f"Conflicting names for lookup {source['lookupId']}")
            lookup["kpis"].append(kpi["Number"])
            for item in _formula_items(kpi):
                lookup["calls"].extend(_lookup_calls(name, item.get("formula", "")))
        elif kind != "custom":
            raise ValueError(f"Unsupported source type {kind!r}")

    def folder(self, scale: str) -> str:
        folder = self.scales[scale].get("folder", DEFAULT_SCALE_FOLDERS.get(scale, scale))
        if not folder or folder in (".", "..") or re.search(r'[<>:"/\\|?*]', folder):
            raise ValueError(f"Invalid scale folder {folder!r}")
        return folder

    def referenced_scales(self, source: dict) -> list[str]:
        upstream = self.kpis[source["kpiId"]]
        tokens = {_key(t) for t in re.findall(r"[A-Za-z][A-Za-z0-9]*", source["latex"])}
        scales = list(dict.fromkeys(self.scale_tokens[t] for t in self.scale_tokens if t in tokens))
        if not scales:
            raise ValueError(
                f"Prerequisite KPI {upstream['Number']}: no spatial scale in source {source['latex']!r}"
            )
        for scale in scales:
            if not upstream["Spatial Scales"].get(scale, {}).get("applicable"):
                raise ValueError(
                    f"Prerequisite KPI {upstream['Number']}: {scale!r} is not an applicable output scale"
                )
        return scales


def _lookup_script(lookup: dict) -> str:
    calls = lookup["calls"]
    lengths = {len(call) for call in calls}
    names = []
    if len(lengths) == 1:
        for i in range(next(iter(lengths))):
            variants = list(dict.fromkeys(call[i].split("_{")[0].strip() for call in calls))
            name = identifier(variants[0]) if len(variants) == 1 else f"input_{i + 1}"
            if name in names:
                name = f"{name}_{i + 1}"
            names.append(name)
    lines = _comments(f"Lookup: {lookup['name']}\nID: {lookup['id']}")
    lines += _comments("Referenced by KPIs: " + ", ".join(map(str, sorted(set(lookup["kpis"])))))
    lines += ["# Inputs follow formula call positions; no lookup processing is generated."]
    for i, name in enumerate(names):
        variants = list(dict.fromkeys(call[i] for call in calls))
        lines += _comments(f"{name}: " + "; ".join(variants))
    lines += ["# Output: lookup value; fill in its concrete type and implementation.", ""]
    signature = ", ".join(f"{name}: object" for name in names) if names else "*inputs: object"
    lines += [
        f"def lookup({signature}) -> object:",
        "    # TODO: Process the declared inputs to obtain the lookup value.",
        "    # result = ...",
        "    # return result",
        f"    raise NotImplementedError({lookup['name']!r} + ' lookup is not implemented')",
        "",
    ]
    return "\n".join(lines)


def _calculator_script(kpi: dict, library: _Library, warnings: list[str]) -> str:
    stem = kpi_filename(kpi["Number"], kpi["Name"])
    output_scales = [s for s, d in kpi["Spatial Scales"].items() if d["applicable"]]
    # Each entry supplies one argument in validate -> process, with no I/O in process.
    inputs: dict[str, tuple[str, str]] = {}
    descriptions = []
    domains: dict[str, str] = {}
    local_variables: dict[str, str] = {}

    def add_input(name: str, annotation: str, expression: str) -> str:
        if name in inputs and inputs[name] != (annotation, expression):
            raise ValueError(
                f"KPI {kpi['Number']} ({kpi['Name']}): distinct inputs produce the same argument name {name!r}"
            )
        inputs[name] = annotation, expression
        return name

    def add_table(category: str, table: str, slot: int = 0) -> str:
        if category == "PreprocessedConstants":
            slot = 0
        name = identifier(table) + ("_reference" if slot == 1 else "")
        extra = ", reference=True" if slot else ""
        expression = f"validate_table(context, {category!r}, {table!r}{extra})"
        return add_input(name, "pd.DataFrame", expression)

    for source in kpi["Source"]:
        kind, slot = source["type"], source.get("scenarioSlot", 0)
        if kind == "dataField":
            table = library.sources[source["dataSourceId"]]
            category, table_name = library.table(table)
            arg = add_table(category, table_name, slot)
            data_field = next(f for f in table["fields"] if f["id"] == source["fieldId"])
            descriptions.append(
                f"{arg}: {category}.{table_name}.{data_field['name']} ({source['latex']})"
            )
            if data_field.get("enumId") in library.domains:
                d = library.domains[data_field["enumId"]]
                domains[d["name"]] = identifier(d["name"])
            for group in table.get("fieldGroups", []):
                if data_field["id"] in group["fieldIds"]:
                    for dimension in group["dimensions"]:
                        if dimension.get("enumId") in library.domains:
                            d = library.domains[dimension["enumId"]]
                            domains[d["name"]] = identifier(d["name"])
                        else:
                            local = identifier(dimension["name"]) + "_options"
                            local_variables[local.upper()] = repr(dimension.get("options", []))
                            add_input(local, "list[str]", local.upper())
                        descriptions.append(
                            f"  Field dimension {dimension['name']}: {dimension.get('options', [])!r}"
                        )
        elif kind == "kpi":
            upstream = library.kpis[source["kpiId"]]
            upstream_stem = kpi_filename(upstream["Number"], upstream["Name"])
            extra = ", reference=True" if slot else ""
            scenario_role = "reference" if slot else "current"
            for scale in library.referenced_scales(source):
                arg = f"kpi_{upstream['Number']}_{identifier(scale)}" + (
                    "_reference" if slot else ""
                )
                add_input(
                    arg,
                    "pd.DataFrame",
                    (
                        f"loader.load(context, {upstream_stem!r}, path='kpis', "
                        f"scale={scale!r}{extra})"
                    ),
                )
                descriptions.append(
                    f"{arg}: {upstream_stem}.parquet at {scale}, {scenario_role} scenario ({source['latex']})"
                )
        elif kind == "variable":
            constant = library.constants[source["variableId"]]
            add_input(identifier(constant["name"]), "object", f"get_constant({constant['name']!r})")
            descriptions.append(f"Constant {constant['name']}: {source['latex']}")
        elif kind == "lookup":
            lookup = library.lookups[source["lookupId"]]
            add_input(
                identifier(lookup["name"]),
                "Callable[..., object]",
                f"get_lookup({lookup['name']!r})",
            )
            descriptions.append(f"Lookup {lookup['name']} ({source['latex']})")
        else:
            arg = identifier(source["name"])
            local_variables[arg.upper()] = (
                f"None  # TODO: Define {source['name']} ({source['latex']})"
            )
            add_input(arg, "object", arg.upper())
            descriptions.append(f"Local variable {source['name']} ({source['latex']})")

    formulas = _formula_items(kpi)
    formula_text = "\n".join(item.get("formula", "") for item in formulas)
    formula_text += "\n" + "\n".join(d.get("formula", "") for d in kpi["Spatial Scales"].values())
    words = {_key(word) for word in re.findall(r"[A-Za-z][A-Za-z0-9]*", formula_text)}
    for key, name in library.domain_names.items():
        if key in words:
            domains[name] = identifier(name)
    for name, arg in domains.items():
        domains[name] = add_input(arg, "list[str]", f"get_domain({name!r})")

    if "year" in words:
        local_variables["YEAR_OPTIONS"] = (
            "[]  # TODO: Define years, e.g. from project OpenYear/EndYear"
        )
        add_input("year_options", "list[object]", "YEAR_OPTIONS")

    # Output dimensions come from the final expression, not domains summed away.
    final = formulas[-1] if formulas else {}
    lhs = final.get("leftExpression") or final.get("formula", "").split("=")[0]
    dimension_arguments = []
    for dimension in dict.fromkeys(_subscripts(lhs)):
        key = _key(dimension)
        if key in library.scale_tokens or key in ("zone", "point"):
            continue
        if not re.fullmatch(r"[A-Za-z][A-Za-z0-9 ]*", dimension):
            continue
        if key in library.domain_names:
            name = library.domain_names[key]
            dimension_arguments.append(domains[name])
        else:
            arg = identifier(dimension) + "_options"
            local_variables[arg.upper()] = f"[]  # TODO: Define options for {dimension}"
            dimension_arguments.append(add_input(arg, "list[object]", arg.upper()))

    geography_args = {}
    for scale in output_scales:
        category, table, _ = GEOGRAPHIES.get(scale, (None, None, f"{identifier(scale)}_id"))
        if table:
            geography_args[scale] = add_table(category, table)
            descriptions.append(
                f"Output geography: {category}.{table}; use table-schema joins for aggregation"
            )

    lines = _comments(
        f"KPI {kpi['Number']}: {kpi['Name']}\nID: {kpi['ID']}\nGroup: {kpi['ScenarioType']}\nUnit: {kpi['Unit']}"
    )
    lines += ["# Required sources:"]
    for description in descriptions:
        lines += _comments("  " + description)
    lines += ["# Expected output files:"]
    for scale in output_scales:
        lines += [f"#   data/kpis/<scenario>/{library.folder(scale)}/{stem}.parquet"]
    if not output_scales:
        warning = f"KPI {kpi['Number']} ({kpi['Name']}): no applicable output scales; scaffold contains a TODO"
        warnings.append(warning)
        lines += ["#   TODO: No applicable output scales are declared in the library."]
    lines += _comments(kpi.get("Note", ""))
    lines += ["", "from __future__ import annotations", ""]
    if any(annotation.startswith("Callable") for annotation, _ in inputs.values()):
        lines += ["from collections.abc import Callable", ""]
    lines += ["import pandas as pd"]
    lines += [
        "",
        "from ..pipeline.context import RunContext",
        "",
        "# Suggested imports for the bodies below:",
        "# from itertools import product",
        "# from ..data_interface import loader, writer",
        "# from ..utilities.constants import get_constant",
        "# from ..utilities.domains import get_domain",
        "# from ..utilities.lookups import get_lookup",
        "# from ..utilities.naming import snake_case",
        "# from ..data_interface.validation import validate_table",
        "",
        f"KPI_NAME = {stem!r}",
        f"KPI_ID = {kpi['ID']!r}",
        f"SCENARIO_TYPE = {kpi['ScenarioType']!r}",
        "",
    ]
    if local_variables:
        lines += ["# Local variables and non-global dimension options:"]
        lines += [f"# {name} = {value}" for name, value in local_variables.items()]
        lines += [""]
    lines += ["", "def validate(context: RunContext) -> dict[str, object]:"]
    if kpi["ScenarioType"] == "Inter-Scenario":
        lines += [
            "    # if not context.reference_scenario:",
            "    #     raise ValueError('This KPI requires a reference scenario')",
        ]
    for arg, (_, expression) in inputs.items():
        lines += [f"    # {arg} = {expression}"]
    lines += ["    # return {"]
    lines += [f"    #     {arg!r}: {arg}," for arg in inputs]
    lines += [
        "    # }",
        "    raise NotImplementedError(f'{KPI_NAME}: implement validate')",
        "",
        "",
        "def process(",
    ]
    lines += [f"    {arg}: {annotation}," for arg, (annotation, _) in inputs.items()]
    lines += [
        ") -> dict[str, pd.DataFrame]:",
        "    # Formula reference (processing is intentionally left blank):",
    ]
    lines += _comments(kpi["Formula"].get("Comment", ""), "    ")
    for item in formulas:
        lines += _comments(item.get("formula", ""), "    ")
    lines += [
        "    # TODO: Implement processing from the inputs above.",
        "    # Suggested output structure: one geography row, one column per option combination.",
    ]
    if dimension_arguments:
        lines += [
            "    # output_columns = [",
            f"    #     {snake_case(kpi['Name'])!r} + '_' + '_'.join(snake_case(str(v)) for v in options)",
            f"    #     for options in product({', '.join(dimension_arguments)})",
            "    # ]",
        ]
    else:
        lines += [f"    # output_columns = [{snake_case(kpi['Name'])!r}]"]
    for scale in output_scales:
        definition = kpi["Spatial Scales"][scale]
        basic = "basic unit" if definition.get("isBasicUnit") else "aggregation"
        lines += _comments(f"{scale}: {basic}; {definition.get('aggregationMethod', '')}", "    ")
        lines += _comments(definition.get("formula", ""), "    ")
        index_name = GEOGRAPHIES.get(scale, (None, None, f"{identifier(scale)}_id"))[2]
        if scale == "region":
            index = "pd.Index(['Region'], name='region_id')"
        elif scale in geography_args:
            index = f"{geography_args[scale]}.index.rename({index_name!r})"
        else:
            index = f"pd.Index([], name={index_name!r})  # TODO: Define geography IDs"
        lines += [f"    # {identifier(scale)}_index = {index}"]
        lines += [
            f"    # {identifier(scale)}_output = pd.DataFrame(index={identifier(scale)}_index, columns=output_columns)"
        ]
    if output_scales:
        lines += ["    # return {"]
        lines += [f"    #     {scale!r}: {identifier(scale)}_output," for scale in output_scales]
        lines += ["    # }"]
    else:
        lines += ["    # TODO: Declare output scales before constructing output frames."]
    lines += [
        "    raise NotImplementedError(f'{KPI_NAME}: implement process')",
        "",
        "",
        "def calculate(context: RunContext) -> None:",
        "    # outputs = process(**validate(context))",
        "    # for scale, output in outputs.items():",
        "    #     writer.write_table(context, KPI_NAME, output, path='kpis', scale=scale)",
        "    raise NotImplementedError(f'{KPI_NAME}: implement calculate')",
        "",
    ]
    return "\n".join(lines)


def initiate(
    library_path: str | Path = LIBRARY_PATH,
    *,
    destination: str | Path = SOURCE_DIR,
    table_schema_path: str | Path = TABLE_SCHEMA_PATH,
) -> InitiationResult:
    """Synchronize scaffolds and exported values while preserving implemented code.

    destination is the Python source package directory (normally src). The
    library is read only here; generated utility getters do not read JSON.
    """
    result = InitiationResult()

    def read_json(path: str | Path) -> dict:
        try:
            return json.loads(Path(path).read_text(encoding="utf-8-sig"))
        except json.JSONDecodeError as exc:
            raise ValueError(f"{path}:{exc.lineno}:{exc.colno}: {exc.msg}") from exc

    library = _Library(read_json(library_path), read_json(table_schema_path))
    destination = Path(destination)
    planned: dict[Path, str] = {}
    deletions: set[Path] = set()
    _sync_scripts(
        destination / "calculators",
        {
            kpi["ID"]: (
                destination / "calculators" / f"{kpi_filename(kpi['Number'], kpi['Name'])}.py",
                _calculator_script(kpi, library, result.warnings),
            )
            for kpi in sorted(library.kpis.values(), key=lambda k: k["Number"])
        },
        planned,
        deletions,
        result,
    )
    registry_entries = {
        "DOMAINS": (
            destination / "utilities" / "domains.py",
            {
                d["id"]: (d["name"], d["options"], d.get("notes", ""))
                for d in library.domains.values()
            },
        ),
        "CONSTANTS": (
            destination / "utilities" / "constants.py",
            {
                c["id"]: (
                    c["name"],
                    library.constant_values[c["id"]],
                    (
                        f"{c.get('explanation', '')}\n"
                        f"Export default: {c.get('defaultValue')!r}; unit: {c.get('unit', '')}"
                    ),
                )
                for c in library.constants.values()
            },
        ),
        "LOOKUPS": (
            destination / "utilities" / "lookups" / "__init__.py",
            {
                lookup["id"]: (lookup["name"], identifier(lookup["name"]), "")
                for lookup in library.lookups.values()
            },
        ),
    }
    # Protect lookup modules whose registrations cannot be synchronized, so a
    # rename/deletion never leaves a preserved registration pointing at a missing file.
    protected_lookups: set[str] = set()
    lookup_path, lookup_entries = registry_entries["LOOKUPS"]
    _sync_registry(lookup_path, "LOOKUPS", lookup_entries, protected_lookups)
    protected_lookups = _sync_scripts(
        destination / "utilities" / "lookups",
        {
            lookup["id"]: (
                destination / "utilities" / "lookups" / f"{identifier(lookup['name'])}.py",
                _lookup_script(lookup),
            )
            for lookup in library.lookups.values()
        },
        planned,
        deletions,
        result,
        lookup=True,
        protected=protected_lookups,
    )
    for registry, (path, entries) in registry_entries.items():
        content = _sync_registry(path, registry, entries, protected_lookups)
        if not path.exists() or content != _read_source(path):
            planned[path] = content
        else:
            result.preserved.append(path)
    packages = {
        "__init__.py": '"""Generated KPI package."""\n',
        "calculators/__init__.py": '"""Generated KPI calculators."""\n',
        "utilities/__init__.py": (
            '"""Shared definitions for calculators and preparators."""\n\n'
            "from .constants import get_constant\n"
            "from .domains import get_domain\n"
            "from .lookups import get_lookup\n\n"
            '__all__ = ["get_constant", "get_domain", "get_lookup"]\n'
        ),
    }
    for relative, content in packages.items():
        path = destination / relative
        if not path.exists():
            planned[path] = content
    # Check every generated file before writing any changes.
    for path, content in planned.items():
        _parse_source(content, path)
    for path, content in planned.items():
        path.parent.mkdir(parents=True, exist_ok=True)
        existed = path.exists()
        with path.open("w" if existed else "x", encoding="utf-8", newline="") as stream:
            stream.write(content)
        (result.updated if existed else result.created).append(path)
    for path in sorted(deletions):
        path.unlink()
        result.deleted.append(path)
    return result
