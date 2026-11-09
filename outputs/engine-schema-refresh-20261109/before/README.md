# COMPASS KPI Engine

## Package layout

```text
src/
  data_interface/  loader.py, writer.py, storage.py, validation.py
  utilities/       constants.py, domains.py, naming.py, visualize.py, lookups/
  pipeline/        context.py, run.py, cli.py, initiate.py
  calculators/     numbered KPI scripts
  preparators/     source-table preparation scripts
  config/          library and table schemas
```

Import data access from `src.data_interface`, execution from `src.pipeline`,
and shared definitions from `src.utilities`. The root `prepare.py`, `calculate.py`,
and `initiate.py` remain thin command entry points. New scaffolds use this layout.

## Data

Data is stored locally as Parquet files:

- `data/source/common/<Table>.parquet`: shared source tables.
- `data/source/scenarios/<scenario>/<Table>.parquet`: scenario inputs and preparator outputs.
- `data/kpis/<scenario>/<scale>/<KPI>.parquet`: one file per KPI and spatial scale.

Source table names and field definitions follow `src/config/table-schema.json`.
Schema field labels retain their exported names, such as `TAZID` and `TAZIDs`.
Validation matches labels to data fields ignoring case and separators, without
renaming either the JSON or the data (for example, `TAZIDs` matches `taz_ids`).
Each validation call reads the current table schema, so JSON edits take effect
in an existing notebook session without reloading the validation module.
All column and named-index fields use snake_case, including KPI period columns
such as `travel_time_index_am`. Source table names retain their configured names.
KPI Python modules and local Parquet files share the stem
`<Number>_<name_in_snake_case>` from the library. Column names have no number prefix.
KPI files are indexed by geography ID, with period results in separate columns.
For example: `data/kpis/TestScenario/Links/1_travel_time_index.parquet`.
Cell-scale KPIs use `SpatialScale.CELLS` (`"cell"`) and are written to
`data/kpis/<scenario>/Cells/<KPI>.parquet`. The source table is
`data/source/common/Cells.parquet`, indexed by `cell_id`.

Spatial-scale names are configured in `src/config/library-schema.json` under
`Domain Definitions` → `Spatial Scales`. Each entry has a stable `id`, a display
`label`, and an optional `folder` for KPI storage. For example:

```json
{"id": "cell", "label": "Cell", "latex": "Cell", "folder": "Cells"}
```

Set `folder` to rename the output directory without changing Python code.
When an export omits `folder`, the built-in scales retain `Links`, `Cells`,
`Projects`, `TAZs`, `Corridors`, `SubRegions`, and `Region`. A new scale defaults
to its ID as the folder name.
Readers and writers accept the scale ID, its `SpatialScale` constant, or the
configured folder name (case-insensitive). New scale IDs work as strings without
adding enum members. Folder names must be unique, single directory names.
Configuration is read on each storage call, so edits also apply in notebooks.
Scale folder resolution lives in `src/data_interface/storage.py`, separate from domain definitions.
Existing files are not moved automatically when a folder name changes.
Source table names and fields remain governed by `table-schema.json`;
`ScenarioLinks` now belongs to `ScenarioUpstream`.

Join validation follows principal/secondary roles. The N side of N:1 is always
secondary; N:N and 1:1 use the roles declared in the table schema. Secondary join
fields are required even when marked virtual, and their non-null IDs must exist
on the principal side. N:N fields store lists of IDs (empty lists are allowed);
1:1 secondary IDs must be unique. Secondary tables may cover only part of a
principal table. Principal virtual reverse fields are optional; principal-side
join checks run only when a virtual join field is explicitly stored.
The ScenarioLinks-to-BaseHighwayLinks 1:1 join exempts rows explicitly marked
`is_added_to_base = True` from base membership (`AllowMissingWhen` in the schema).
Their IDs must still be unique. NetworkOutput references ScenarioLinks directly.

Cells reference TAZs through the N:N `taz_ids` list field, for example `["101", "102"]`
or `[]`, and Corridors through the N:N `corridor_ids` list field. TAZs and Corridors
remain principal and need no reverse cell list. BaseHighwayLinks
still use the scalar `taz_id` field for their separate N:1 relationship to TAZs.

`notebooks/create_temp_schema.ipynb` loads the established geographies and processed
BaseHighwayLinks, BaseYearTDM, BikePedAccessibilityMatrix, HistoricCrashes, INRIX,
and ZoneAccessibilityMatrix from
the configured local SharePoint shortcut. Separate cells process each product, then audit and write the
processed inputs using the data writer: constants to `data/source/common`
and scenario inputs to `data/source/scenarios/<scenario>`. Processed outputs retain only fields defined by their table schema, including
schema-defined keys stored in the index. Existing geometry is retained as spatial data, but is not listed in status.
Audit fields such as `severity_source` are not exported or listed in status. Crash severity descriptions
are mapped to K/A/B/C/O; Unknown remains null.
Highway cross section, facility, and area/access use tentative mappings,
and all three stay flagged for review. The raw
median classification supplies cross section only; the deleted base/scenario
median fields are not exported. The remaining project `MedianTypeChangedTo`
field and Median Type domain are still present in the supplied schema. Facility maps freeway mainlines to
Interstate, principal arterials and toll mainlines to Non Interstate NHS, and the
remaining classes to Other. Area/access keeps explicit Rural/Urban prefixes and
treats toll/HOT labels as Restricted; absent Rural/Urban designations remain null.
Crash type codes are retained and flagged. Two highway field
aliases are renamed to match the contract, and missing roadway class is a nullable
placeholder. Missingness and desired/current enum differences are recorded in
`src/config/_status.json`, with exactly three entries per table: `completed_fields`
is a field-name list; `fields_with_missing_values` maps fields to numeric missing
percentages (0-100, rounded to four decimal places); `problematic_fields` maps
fields to short issue descriptions. A field with missing values and another issue
appears in both issue categories; completed fields have neither. Enum options come
from `library-schema.json` because the
table contract exports enum types without option lists. A ready table has passed
field/type/key/join validation, which rejects non-schema attributes (existing
geometry is permitted), but can still have
documented measurement gaps or
category exceptions. Both origin and destination bike/ped cell IDs are checked.
Fully null placeholders appear as 100% missing and include an issue description.
Derived fields with gaps or unresolved provenance reference the current library's
formula and notes. The shared staging helpers retain schema fields, existing
geometry and keys, and add typed nulls for missing stored fields. Optional virtual
reverse fields are not materialized. Existing Projects are audited as well;
their AddsSRTS values remain unverified until the derivation threshold is supplied.

The implemented `1_travel_time_index` calculator uses links present in
BaseHighwayLinks, ScenarioLinks, and CalibratedNetworkOutput, excluding links marked
`is_removed_from_base`. It includes each link in every listed subregion's weighted
average. Free-flow time uses ScenarioLinks distance and speed; travel time and daily
VMT weights come from `KPIPreparation.CalibratedNetworkOutput`. Missing or invalid
free-flow inputs produce null link results. Each aggregate uses matching valid
period results and positive finite VMT for its numerator and denominator.

Future ScenarioLinks uses exactly the IDs and order of the scenario's NetworkOutput.
Matching base attributes are copied without `base_year_` prefixes. Base-only links
are omitted from the future table. New IDs retain their network geometry and
`is_added_to_base = True`; unavailable attributes, project assignment, and HRN
status remain null. All three future tables—ScenarioLinks, NetworkOutput, and
CalibratedNetworkOutput—have identical link IDs. Added links are exempt from base
membership; NetworkOutput references ScenarioLinks instead of BaseHighwayLinks.

TDM means travel demand model output for either a base or future year.
`BaseYearTDM` is the shared base-year product. `NetworkOutput` is the selected
scenario's TDM output (future year in TestScenario). The notebook reads the latter
from `data/_temp/network_output.parquet`, exporting only the NetworkOutput
schema fields. The updated contract removes its V/C fields and adds medium/heavy
truck percentages. These new inputs, and the corresponding BaseYearTDM fields,
remain nullable placeholders when absent from the source. Neither TDM table
stores period capacity; capacity remains a ScenarioLinks attribute.
Truck volume is volume times the sum of medium/heavy truck percentages divided
by 100, following the library formula and percent units. Missing inputs propagate
to null results. Missing period occupancies also stay null; daily occupancy is not
a period substitute.

The notebook stages and validates inputs, then invokes `calibrate_network_output`
through the preparation runner before KPI 1. The preparator writes
`data/source/scenarios/<scenario>/CalibratedNetworkOutput.parquet`. It uses
ScenarioLinks capacity for calibrated V/C and does not read BaseYearTDM.
Calibration coefficients are not specified, so the current result is
**synthetic**. Period vehicle volumes are copied directly; calibrated truck volumes
are derived from those volumes and the NetworkOutput truck percentages. Period VMT is volume times
scenario distance, and daily volumes are the sum of the four periods. Daily VMT
is daily volume times distance. Travel times are null placeholders because
NetworkOutput has no travel-time field in its schema. Missing volumes or distances
remain null. The implementation has only one loop, over periods.
Calibrated V/C is stored separately for AM, PM, MD and OV. Following the library's
formula, its percentage is `100 * calibrated_volume / (capacity / period_hours)`,
with 3, 4, 6 and 11 hours respectively. Missing, nonfinite, or nonpositive
ScenarioLinks capacities yield null. Values retain the synthetic calibration
warning, including when V/C can now be calculated.
The preparator rejects missing, duplicate, or mismatched link IDs and records
synthetic provenance and missingness in `_status.json` after writing. That JSON
is the latest local staging snapshot, not a multi-scenario status database.
KPI 1 still excludes links without base geography membership.

INRIX is a shared preprocessed constant, written to
`data/source/common/INRIX.parquet`. ZoneAccessibilityMatrix is a ScenarioUpstream
input, written to `data/source/scenarios/<scenario>/ZoneAccessibilityMatrix.parquet`.
Its raw input currently comes from the same source folder as the constants, but
its stored data and calculator reads belong to the selected scenario.
INRIX observations remain null wherever the source is unavailable. Zone origins
and destination collections are checked against TAZs. Raw `taz5808` is renamed
to `taz_id` in both TAZ and zone-accessibility imports, and all TAZ references use
string IDs. The schemas retain `TAZID` for TAZs, TAZDemographics, BaseHighwayLinks,
and ZoneAccessibilityMatrix; `TAZIDs` for Cells; and `OriginTAZID` for SkimmedZones.
Data uses `taz_id`, `taz_ids`, and `origin_taz_id`, respectively. Reachability
collections retain their descriptive names, such as `drive_30_min_taz_ids`.

Refresh current inputs with `notebooks/create_temp_schema.ipynb` and the registered preparator.
Inspect processed files in `notebooks/test_schema.ipynb`: each table cell reloads
its entry from `src/config/_status.json`, prints field counts and displays missing
percentages and issues (including derivation references), loads the table with `loader.load`,
and displays the data. Set `context.scenario` in the setup cell to select the
scenario. Status is the latest staging snapshot.

`src/data_interface/loader.py` reads tables or selected fields and filtered rows into pandas/GeoPandas,
preserving their index. `src/data_interface/writer.py` writes complete tables or updates fields by index.
Both handle storage paths and create missing folders. Source data must be supplied.
Use `path="source"` (the default) or `path="kpis"` in loader and writer calls.
This argument selects the data destination; local filesystem paths are resolved internally.

Base Year and Scenario KPI results both belong to the selected scenario. Inter-Scenario
results also write to the current scenario; the reference scenario is used for inputs.
Running the same comparison KPI again with another reference replaces its current
scenario output, following the existing one-file-per-KPI storage layout.

## Initiate library scaffolding

After updating `src/config/library-schema.json`, run:

```powershell
python -m initiate
# Equivalent installed command:
compass-kpi initiate
# Optional alternate export:
python -m initiate --library path/to/library-schema.json
```

Initiation synchronizes code definitions and unimplemented scripts with the export:

- `src/utilities/domains.py`: all Global Domains, including empty option lists and their notes.
- `src/utilities/constants.py`: named constants with numeric defaults. For example, `3.1%`
  becomes `0.031`, `$0.128` becomes `0.128`, and missing or blank defaults become `None`.
- `src/utilities/lookups/`: one scaffold per referenced lookup. Argument positions come from
  formula calls; alternate argument symbols are recorded in comments. Processing
  and the return-value suggestion remain commented out.
- `src/calculators/<Number>_<name_in_snake_case>.py`: one calculator per KPI, with
  executable `validate`, `process`, and `calculate` headers. Suggested imports,
  source reads, prerequisite KPI reads, local variables, formulas, output frames,
  and writer calls are comments. Stub bodies raise `NotImplementedError` until filled in.

Repeated initiation automatically refreshes generated KPI scripts containing any
`raise NotImplementedError`, even if other parts have been implemented. Once no such
raises remain, the KPI script is preserved. Comments and strings mentioning the
exception do not count. Lookup scripts are refreshed while their function is still
only a `NotImplementedError` stub; partial lookup implementations are preserved.
Renamed scaffolds are matched by export ID, and obsolete unimplemented scripts and
lookup registrations are removed. Handwritten scripts without generated IDs remain
untouched. An implemented script that was renamed in the export stays at its
original path with a note for manual review.

Generated domain and constant registrations still present in the export take its
current options/defaults, including replacing locally edited values. Removed entries
are deleted only when their local value is an empty domain (`[]`) or an unset
constant (`None`); nonempty domains and meaningful constants (including zero) remain.
Other handwritten registry code is preserved. Repeating an unchanged export makes
no further changes. The command reports created, updated, deleted, and preserved files.

The initializer checks export structure, IDs, source references, scale declarations,
lookup argument counts, and numeric defaults before writing files. Invalid input
produces a contextual error. It does not repair the export or translate formula text
into executable calculations. An export must include referenced prerequisite KPIs.

Output scaffolds use one geography row and a column per retained dimension option
or option combination. Registered dimensions use `get_domain`; Year and other local
dimensions have commented option-list placeholders in the KPI script. A dimension
summed away by the final expression is not retained in output columns. Formula text
and aggregation notes are preserved for implementation review.

## Shared definitions and scenario inputs

These utilities can be imported by any calculator or preparator:

```python
from src.utilities import get_constant, get_domain, get_lookup

periods = get_domain("Period")
discount_rate = get_constant("Discount Rate")
mobility_lookup = get_lookup("LevelOfMobilityLookup")
# mobility_lookup(vc) becomes callable once its processing is implemented.
```

Getters read Python definitions, not the library JSON. Unknown names raise `KeyError`;
an unfinished lookup raises `NotImplementedError` when called. Edit the corresponding
Python definition to change a runtime value.

Load current or reference inputs without constructing paths:

```python
from src.data_interface import loader
from src.data_interface.validation import validate_table
from src.pipeline.context import RunContext

context = RunContext("Build", reference_scenario="NoBuild")
current = loader.load(context, "NetworkOutput", category="ScenarioUpstream")
reference = loader.load(
    context, "NetworkOutput", category="ScenarioUpstream", reference=True
)
reference_kpi = loader.load(
    context, "38_annual_vehicle_miles_traveled_vmt",
    path="kpis", scale="link", reference=True,
)
checked_reference = validate_table(
    context, "ScenarioUpstream", "NetworkOutput", reference=True
)
```

`RunContext` stores the current and reference scenario names. The loader and validator
use the current scenario by default; `reference=True` selects the reference scenario.
Common source categories remain common. Validation uses the selected scenario for
scenario-specific join tables. Slots belong to KPI source metadata: initiation
translates slot `0` into a current-scenario read and slot `1` into `reference=True`.
A missing reference scenario or file is reported without falling back to current data.
KPI 66's With Project/No Project dimension is represented by fields in one Projects
table; it does not select another scenario directory.

## Python environment

From the repository root in PowerShell, create a virtual environment and install
from `requirements.txt`:

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
```

## Run

With the environment activated, replace `TestScenario` with your scenario name:

```powershell
# Prepare the selected scenario's network output
python -m prepare calibrate_network_output --scenario TestScenario
# Validate without writing:
python -m prepare calibrate_network_output --scenario TestScenario --validate
# Equivalent installed entry:
compass-kpi prepare calibrate_network_output --scenario TestScenario
# Run all registered preparators:
python -m prepare --scenario TestScenario

# All calculators
python -m calculate --scenario TestScenario

# One calculator
python -m calculate 1_travel_time_index --scenario TestScenario

# An Inter-Scenario calculator (currently a scaffold)
python -m calculate 35_multi_county_impact_reach --scenario Build --reference-scenario NoBuild
```

Scripts are discovered automatically in `src/preparators/` and `src/calculators/`.
Use the filename without `.py` to select one. Add `--validate` to check readiness only.
Calculators are discovered in number order. Unfinished scripts report `UNIMPLEMENTED`
and do not write results; implemented scripts can still run when selecting all.
Commands return a nonzero exit status if any selected entry is blocked or unimplemented.

Number-prefixed modules can be imported with `importlib`:

```python
from importlib import import_module

calculator = import_module("src.calculators.1_travel_time_index")
```

The existing notebook import `from src.calculators import travel_time_index` remains
supported as an alias for this numbered module. The included notebooks use the
package imports above; their setup, cell order, and calculations are preserved.
