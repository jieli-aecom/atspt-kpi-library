"""Paths to the table schema and the library export used for initiation."""

from pathlib import Path

CONFIG_DIR = Path(__file__).resolve().parent
LIBRARY_PATH = CONFIG_DIR / "library-schema.json"
TABLE_SCHEMA_PATH = CONFIG_DIR / "table-schema.json"
