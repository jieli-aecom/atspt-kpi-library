# Source table descriptions and field processing (schema 40)

Tables and table library groups accept an optional `description` string. Fields accept optional `sources` and `formulas` arrays. The field popup edits these arrays; populated formulae are also displayed read-only beneath the field in the source table library.

Field sources use the same IDs, LaTeX expressions, and reference shapes as KPI sources, restricted to `dataField`, `variable` (constant), `lookup`, and `custom`. A field cannot reference itself. Field formulae use `KpiFormulaItem` directly, with no persisted formula groups. Formula controls and decorations reuse the KPI editor through an in-memory context.

Existing configurations migrate through `repairConfig` to schema 40, preserving notes, preferred LaTeX, dimensions, relations, and KPI definitions. Absent descriptions and processing arrays become empty during migration; they remain optional for newly created entries. Import/export, concurrent saves, and offline HTML snapshots retain the new properties. Future schema versions are still rejected.

Moving a field retargets references from KPIs and other fields without rewriting formula text. Copying a table remaps references to copied fields. Deleting a source removes its reference while retaining written formulae for review. Global preferred-LaTeX changes now update matching field processing sources and their formula references as well as KPI sources.

## Regression checks

The field popup includes supported KPIs, with separate direct and indirect lists and an example dependency path for each result. Table headers and diagram field/table View buttons expose the same trace. Table totals deduplicate KPIs across all fields. Tracing follows field processing sources, KPI sources, and KPI prerequisites, handles cycles and missing references, and does not infer dependencies from formula text or table relationships alone. Results are computed from the current configuration, including offline snapshots; no schema change is needed.

Support tracing checks:

```powershell
node node_modules/typescript/bin/tsc tests/kpiSupport.test.ts --outDir tmp-schema-check/kpi-support-tests --module nodenext --target ES2022 --skipLibCheck --esModuleInterop --rewriteRelativeImportExtensions
node --test --test-isolation=none tmp-schema-check/kpi-support-tests/tests/kpiSupport.test.js
```

```powershell
node node_modules/typescript/bin/tsc tests/fieldProcessing.test.ts tests/tableFieldMove.test.ts --outDir tmp-schema-check/field-processing-tests --module nodenext --target ES2022 --skipLibCheck --esModuleInterop --rewriteRelativeImportExtensions
node --test --test-isolation=none tmp-schema-check/field-processing-tests/tests/fieldProcessing.test.js tmp-schema-check/field-processing-tests/tests/tableFieldMove.test.js
npm run build
```
