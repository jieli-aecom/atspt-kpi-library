"""Discover component scripts by filename and run one or all of them."""

from dataclasses import dataclass
from importlib import import_module
from pathlib import Path
from typing import Literal

from .context import RunContext


def discover(folder: Literal["preparators", "calculators"]) -> dict[str, str]:
    """Map public filenames to import paths, ordered by KPI number when present."""

    def order(path: Path) -> tuple[int, str]:
        prefix = path.stem.partition("_")[0]
        return (int(prefix) if prefix.isdigit() else 0, path.stem)

    return {
        path.stem: f"{__package__.rsplit('.', 1)[0]}.{folder}.{path.stem}"
        for path in sorted((Path(__file__).resolve().parents[1] / folder).glob("*.py"), key=order)
        if not path.stem.startswith("_")
    }


@dataclass(frozen=True)
class EntryResult:
    name: str
    status: Literal["ready", "blocked", "completed", "unimplemented"]
    messages: tuple[str, ...] = ()


def _validate(context: RunContext, entries: dict[str, str], name: str | None) -> list[EntryResult]:
    selected = entries if name is None else {name: entries[name]}
    results = []
    for key, module_path in selected.items():
        check = import_module(module_path).validate
        try:
            check(context)
        except NotImplementedError as exc:
            results.append(EntryResult(key, "unimplemented", (str(exc),)))
        except (FileNotFoundError, ValueError) as exc:
            results.append(EntryResult(key, "blocked", (str(exc),)))
        else:
            results.append(EntryResult(key, "ready"))
    return results


def _run(
    context: RunContext,
    entries: dict[str, str],
    name: str | None,
    action: Literal["prepare", "calculate"],
) -> list[EntryResult]:
    selected = entries if name is None else {name: entries[name]}
    pending = {
        key: getattr(import_module(module_path), action) for key, module_path in selected.items()
    }
    results = []
    while pending:
        progressed = False
        blocked = []
        for key, execute in list(pending.items()):
            try:
                # Each script loads and checks its inputs before writing; read them only once.
                execute(context)
            except NotImplementedError as exc:
                results.append(EntryResult(key, "unimplemented", (str(exc),)))
                del pending[key]
                continue
            except (FileNotFoundError, ValueError) as exc:
                blocked.append(EntryResult(key, "blocked", (str(exc),)))
                continue
            results.append(EntryResult(key, "completed"))
            progressed = True
            del pending[key]
        if not progressed:
            return results + blocked
    return results


def prepare_validate(context: RunContext, name: str | None = None) -> list[EntryResult]:
    return _validate(context, discover("preparators"), name)


def kpi_validate(context: RunContext, name: str | None = None) -> list[EntryResult]:
    return _validate(context, discover("calculators"), name)


def prepare(context: RunContext, name: str | None = None) -> list[EntryResult]:
    return _run(context, discover("preparators"), name, "prepare")


def calculate(context: RunContext, name: str | None = None) -> list[EntryResult]:
    return _run(context, discover("calculators"), name, "calculate")
