"""Resolve spatial-scale names at the storage boundary."""

import json

from ..config import LIBRARY_PATH

# Library exports may omit storage metadata. Preserve established output paths.
DEFAULT_SCALE_FOLDERS = {
    "link": "Links",
    "cell": "Cells",
    "project": "Projects",
    "taz": "TAZs",
    "corridor": "Corridors",
    "subRegion": "SubRegions",
    "region": "Region",
}


def get_scale_folder(scale: str | None) -> str:
    """Resolve a library scale ID or configured folder name, ignoring case.

    Read configuration at the storage boundary so edits also apply in notebooks.
    Additional scale IDs can be used as strings without extending SpatialScale.
    Missing folders use the built-in storage name, or the ID for a new scale.
    """
    library = json.loads(LIBRARY_PATH.read_text(encoding="utf-8-sig"))
    aliases: dict[str, str] = {}
    ids: set[str] = set()
    folders: set[str] = set()
    for entry in library["Domain Definitions"]["Spatial Scales"]:
        scale_id = entry["id"]
        if not isinstance(scale_id, str) or not scale_id.strip():
            raise ValueError("Spatial scale IDs must be non-empty strings")
        folder = entry.get("folder", DEFAULT_SCALE_FOLDERS.get(scale_id, scale_id))
        if (
            not isinstance(folder, str)
            or not folder
            or folder != folder.strip()
            or folder.endswith(".")
            or any(char in folder for char in '<>:"/\\|?*')
            or any(ord(char) < 32 for char in folder)
        ):
            raise ValueError(f"Spatial scale {scale_id!r} needs a single valid folder name")
        if scale_id.casefold() in ids or folder.casefold() in folders:
            raise ValueError(f"Duplicate spatial scale ID or folder: {scale_id!r}, {folder!r}")
        ids.add(scale_id.casefold())
        folders.add(folder.casefold())
        for alias in (scale_id.casefold(), folder.casefold()):
            if alias in aliases and aliases[alias] != folder:
                raise ValueError(f"Ambiguous spatial scale name: {alias!r}")
            aliases[alias] = folder
    if not isinstance(scale, str) or scale.casefold() not in aliases:
        raise ValueError(
            f"Unknown spatial scale {scale!r}; configured IDs: {', '.join(sorted(ids))}"
        )
    return aliases[scale.casefold()]
