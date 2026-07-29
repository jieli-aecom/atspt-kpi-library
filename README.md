# KPI Library Manager

Local, single-HTML web app for curating a KPI library. The KPI data is embedded directly inside the HTML file.

## Commands

```bash
npm install
npm run dev
npm run build
npm run preview
```

The production artifact is `dist/index.html`. It is fully bundled for offline use and includes an embedded KPI pool configuration. Opening the HTML shows the current embedded state immediately.

The app supports one local persistence path:

- **Import HTML** merges another KPI Library HTML into the current state. Older HTML files remain supported and are upgraded during import. New KPI, data-source, and enum IDs are added; a matching KPI ID is replaced only when the imported KPI has a later `lastModified` timestamp.
- **Export HTML** downloads a new `.html` file with the merged/current configuration embedded inside it and solidifies the current KPI timestamps as the new edit baselines.

Table columns can be resized by dragging the dividers in the header row.

## Embedded Config Shape

The app stores JSON in a script tag with `id="kpi-pool-config"`:

- `schemaVersion`: always `18`
- `title`: pool title
- `updatedAt`: ISO timestamp written on export
- `enums`: option lists for `prerequisiteModule`, `userGroup`, `previousApplication`, `federalRequirement`, `performanceArea`, and group-owned `useCase`
- `dataSources`: reusable data-source definitions with stable `id`, `name`, custom `spatialUnit`, fields, and optional versioned field groups
- `dataSources[].fields`: fields with stable `id`, `name`, `meaning`, and `valueUnit`
- `lookups`: reusable function-like definitions with documented input representations and an explained output
- `kpis`: KPI objects with stable `id`, ISO `lastModified` timestamp, display `name`, `sources`, description overview, grouped `description.formulas`, retained legacy prerequisite data, spatial scale settings, grouped user-group/use-case references, use-case-scoped performance-area references, notes, and enum ID references
- `kpis[].sources`: data-source/field references, lookup references, KPI references, or named custom sources, each paired with a user-authored `latex` representation
- `description.formulas`: list of formula groups with `name` and `items`
- `description.formulas[].items`: formula items with `tag`, separate LaTeX `leftExpression` and `rightExpression`, a backward-compatible combined `formula`, `generalExplanation`, and term-wise explanation pairs
- `spatialScales`: per-scale applicability/basic-unit settings plus LaTeX `leftExpression`, `rightExpression`, combined `formula`, and the retained `aggregationMethod` text used as a hidden explanation
- `description.formulaComment`: optional explanatory text displayed when the KPI has no formula, such as “Direct from source”
- `prerequisite.modules`: list of `prerequisiteModule` enum option IDs
- `prerequisite.kpis`: list of prerequisite KPI IDs
- `userGroupUseCases`: list of objects with `userGroup` enum option ID and `useCases` enum option IDs
- `performanceAreasByUseCase`: list of objects with `useCase` enum option ID and `performanceAreas` enum option IDs
- `enums.useCase[]`: each use-case enum option includes a `userGroup` ID tying it to one user group

If the embedded configuration is older or partial, the app repairs missing IDs and optional fields, maps legacy enum labels to option IDs when possible, splits legacy combined formulas at the first equals sign, and shows warnings for dropped or corrected values. A KPI without a timestamp receives the HTML import time.
