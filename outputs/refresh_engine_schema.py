"""Apply the November 9 exported-schema refresh without replacing notebook setup."""
from pathlib import Path
import ast
import hashlib
import json
import shutil
import nbformat

ROOT = Path('C:/repos/compass-kpi-engine').resolve()
ARTIFACTS = Path('C:/repos/atspt-kpi-pool/outputs/engine-schema-refresh-20261109')
ARTIFACTS.mkdir(exist_ok=True)
BACKUP = ARTIFACTS / 'before'
for relative in ['notebooks/create_temp_schema.ipynb', 'notebooks/test_schema.ipynb',
                 'src/config/_status.json', 'src/config/library-schema.json',
                 'src/config/table-schema.json', 'README.md', 'tests/test_staging.py']:
    destination = BACKUP / relative
    destination.parent.mkdir(parents=True, exist_ok=True)
    if not destination.exists():
        shutil.copy2(ROOT / relative, destination)
source_hashes = {}
implemented = {}
for path in (ROOT / 'src').rglob('*.py'):
    relative = path.relative_to(ROOT).as_posix()
    content = path.read_bytes()
    source_hashes[relative] = hashlib.sha256(content).hexdigest()
    destination = BACKUP / relative
    destination.parent.mkdir(parents=True, exist_ok=True)
    if not destination.exists():
        destination.write_bytes(content)
    if path.parent.name in {'calculators', 'preparators', 'lookups'} and not any(
        isinstance(node, ast.Raise) and node.exc is not None and
        any(isinstance(part, ast.Name) and part.id == 'NotImplementedError' for part in ast.walk(node.exc))
        for node in ast.walk(ast.parse(content))
    ):
        implemented[relative] = source_hashes[relative]
(ARTIFACTS / 'implemented-before.json').write_text(json.dumps(implemented, indent=2))

create_path = ROOT / 'notebooks/create_temp_schema.ipynb'
create = nbformat.read(create_path, as_version=4)
original_sources = [c.source for c in create.cells]
assert 'Type remains unresolved' in create.cells[13].source
create.cells[7].source = create.cells[7].source.replace(
    '"distance_miles": "base_year_distance_miles",',
    '"distance_miles": "base_year_distance_miles",\n    "roadway_class": "base_year_roadway_class",',
)
create.cells[7].source += '''

# The refreshed source supplies roadway class; normalize to the exported domain.
base["base_year_roadway_class"] = base["base_year_roadway_class"].replace({
    "FringeRural": "Fringe Rural",
    "L2+3_Suburban": "L2 L3 Suburban",
    "L4+5_Suburban": "L4 L5 Suburban",
    "UrbanCore": "Urban Core",
})
'''
create.cells[12].source = '### HistoricCrashes — retain both crash-type flags and derive severity\n'
create.cells[13].source = '''crashes = gpd.read_parquet(CONSTANTS_DATA_FOLDER / "crashes.parquet")
crashes = crashes.set_index("crash_point_id", verify_integrity=True).rename(columns={
    "crash_type_intersection": "is_intersection",
    "crash_type_ped_cyclist": "involves_pedestrian_cyclist",
}).copy()
crashes["severity"] = crashes.severity.str.extract(r"\\(([KABCO])\\)\\s*$", expand=False)
# Keep independent flags, including overlaps and unknowns. KPI 96 classifies them.
crashes["is_intersection"] = crashes["is_intersection"].astype("boolean")
crashes["involves_pedestrian_cyclist"] = crashes["involves_pedestrian_cyclist"].astype("boolean")
crash_flag_overlap = int((crashes["involves_pedestrian_cyclist"] & crashes["is_intersection"]).sum())
print(f"HistoricCrashes: {len(crashes):,} source rows; {crash_flag_overlap:,} rows have both flags; both flags retained")
'''
obsolete_issue = '''    if name == "HistoricCrashes":
        issues["type"] = (f"source supplies crash_type_ped_cyclist and crash_type_intersection flags; "
                          f"{crash_flag_overlap:,} rows have both flags; single-category mapping unresolved")
'''
assert obsolete_issue in create.cells[25].source
create.cells[25].source = create.cells[25].source.replace(obsolete_issue, '')
for i, source in enumerate(original_sources):
    if i not in {7, 12, 13, 25}:
        assert create.cells[i].source == source
assert create.cells[0].source.startswith('%reload_ext autoreload\n%autoreload 2')
nbformat.validate(create)
nbformat.write(create, create_path)

display_path = ROOT / 'notebooks/test_schema.ipynb'
display = nbformat.read(display_path, as_version=4)
original_sources = [c.source for c in display.cells]
# Preserve the user's standalone data display while making it runnable in a fresh kernel.
assert display.cells[8].source.strip() == 'historic_crashes'
display.cells[8].source = '''historic_crashes = loader.load(context, "HistoricCrashes", category="PreprocessedConstants")
historic_crashes'''
display.cells[5].source = display.cells[5].source.replace(
    'base_highway_links.head()',
    '''display(base_highway_links["base_year_roadway_class"].value_counts(dropna=False).rename("link_count").to_frame())
base_highway_links.head()''',
)
display.cells[9].source = '''# HistoricCrashes — the two flags are independent, not mutually exclusive.
print_status("HistoricCrashes")
historic_crashes = validate_table(context, "PreprocessedConstants", "HistoricCrashes")
crash_type_fields = ["is_intersection", "involves_pedestrian_cyclist"]
display(historic_crashes[crash_type_fields + ["severity", "commercial_vehicle", "year", "link_id"]].head())
display(historic_crashes.groupby(crash_type_fields, dropna=False).size().rename("crash_count").to_frame())
historic_crashes.head()
'''
for i, source in enumerate(original_sources):
    if i not in {5, 8, 9}:
        assert display.cells[i].source == source
assert display.cells[0].source.startswith('%reload_ext autoreload\n%autoreload 2')
nbformat.validate(display)
nbformat.write(display, display_path)

readme_path = ROOT / 'README.md'
readme = readme_path.read_text(encoding='utf8')
readme = readme.replace(
    'Crash type codes are retained and flagged. Two highway field\naliases are renamed to match the contract, and missing roadway class is a nullable\nplaceholder.',
    'HistoricCrashes retains independent nullable boolean `is_intersection` and\n`involves_pedestrian_cyclist` fields, mapped from the corresponding source flags.\nOverlapping flags are valid and preserved; KPI 96 supplies the crash-type classification\nrule. The obsolete single `type` placeholder is not staged. The refreshed highway\nsource supplies `roadway_class`, renamed to `base_year_roadway_class` and normalized\nto the exported Roadway Class domain. Missing source values remain null.',
)
readme_path.write_text(readme, encoding='utf8')
print('Updated targeted notebook cells and documentation; preserved setup, order, and other source cells.')
print('Input schema JSONs preserved; staging and template generation use the updated exports.')
