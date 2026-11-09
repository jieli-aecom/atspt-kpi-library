"""Command-line entry points call the same functions used in notebooks."""

import argparse
from typing import Literal

from .context import RunContext
from .initiate import initiate
from .run import calculate, discover, kpi_validate, prepare, prepare_validate


def main(
    argv: list[str] | None = None,
    *,
    command: Literal["prepare", "calculate", "initiate"] | None = None,
) -> int:
    parser = argparse.ArgumentParser(
        prog=f"python -m {command}" if command else None,
        description="Initiate library scaffolding, prepare spatial data, and calculate KPIs",
    )
    if command is None:
        commands = parser.add_subparsers(dest="command", required=True)
        parsers = {
            name: commands.add_parser(
                name, aliases=["KPI-validate"] if name == "kpi-validate" else []
            )
            for name in ("initiate", "prepare-validate", "kpi-validate", "prepare", "calculate")
        }
    else:
        parser.set_defaults(command=command)
        parsers = {command: parser}
    for entry_command, entry_parser in parsers.items():
        if entry_command == "initiate":
            entry_parser.add_argument(
                "--library", help="Library export path; defaults to src/config/library-schema.json"
            )
            continue
        entry_parser.add_argument(
            "name", nargs="?", help="Module filename without .py; omit for all"
        )
        entry_parser.add_argument("--scenario", required=True)
        entry_parser.add_argument(
            "--reference-scenario", help="Reference scenario for comparison inputs"
        )
        if entry_command in ("prepare", "calculate"):
            entry_parser.add_argument(
                "--validate", action="store_true", help="Check readiness without running"
            )
    args = parser.parse_args(argv)
    if args.command == "initiate":
        try:
            result = initiate(args.library) if args.library else initiate()
        except (KeyError, ValueError) as exc:
            parser.error(f"Invalid library export: {exc}")
        print(
            f"Created {len(result.created)} files; updated {len(result.updated)} files; "
            f"deleted {len(result.deleted)} unimplemented scripts; "
            f"preserved {len(result.preserved)} existing files."
        )
        for warning in result.warnings:
            print(f"NOTE: {warning}")
        return 0
    if getattr(args, "validate", False):
        args.command = "prepare-validate" if args.command == "prepare" else "kpi-validate"
    entries = discover("preparators" if args.command.startswith("prepare") else "calculators")
    if args.name is not None and args.name not in entries:
        parser.error(f"Unknown entry: {args.name}")
    methods = {
        "prepare-validate": prepare_validate,
        "kpi-validate": kpi_validate,
        "KPI-validate": kpi_validate,
        "prepare": prepare,
        "calculate": calculate,
    }
    results = methods[args.command](RunContext(args.scenario, args.reference_scenario), args.name)
    for result in results:
        print(f"{result.status.upper():13} {result.name}")
        for message in result.messages:
            print(f"  {message}")
    return 1 if any(result.status in ("blocked", "unimplemented") for result in results) else 0
