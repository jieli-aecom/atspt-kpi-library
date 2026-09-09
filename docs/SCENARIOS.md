# KPI scenarios (schema 43)

Each KPI has a `scenarioType`: `Base Year`, `Scenario`, or `Inter-Scenario`. Existing and new KPIs default to `Scenario`. The selector appears beneath By. The two `scenarioNames` default to `Scenario` and `Scenario 2` whenever the user switches to Inter-Scenario.

Tables in Scenario Upstream or KPI Preparation depend on a scenario. A containing table group's category takes precedence over the table category. Source citations show a non-bold `scenario` badge; spatial/dimension badges show `by Link`, etc., without brackets.

The Inter-Scenario source picker starts with two name inputs and offers each dependent field and each Scenario-type KPI twice. Choices are independent: changing the KPI type assigns existing dependent sources to the first scenario without selecting additional fields. Base Year KPIs, Inter-Scenario KPIs, constants, and other source kinds remain single choices. Each selected field or KPI reference stores a stable `scenarioSlot` (0 or 1) rather than using the editable name as its identity.

Automatic LaTeX adds the whitespace-free scenario name to the source's existing subscript and displays it in light blue. Preferred field expressions, dimensions, and collection notation remain the base. Expressions without a braced subscript are grouped before adding a scenario subscript. The source editor edits the base expression and previews the complete expression. `scenarioBaseLatex` preserves this base across renaming and global expression updates. Scenario names are escaped as text, so they cannot inject LaTeX commands. KPI references use their existing output expression as the base, or the whitespace-free KPI name when there is no output expression.

Fallbacks:

- Blank names use the defaults. Names that collide after removing whitespace and ignoring case receive a ` 2` suffix on the second name.
- Renaming preserves source IDs and updates formula references, including formula terms and spatial formulas.
- Returning to Base Year or Scenario retains the first selected instance of each field, its full expression, and written formulas. Formula text referencing a removed instance is deliberately retained for review. Base metadata is kept so switching back does not stack scenario suffixes.
- Changing a referenced KPI between Scenario and either of the other types reconciles its references immediately, using the same first-copy and expression-preservation rules.
- Schema 43 preserves scenario slots and base expressions on KPI references. Version 42 references to Scenario KPIs are assigned to the first comparison scenario; written formulas are updated to the suffixed expression.
- Changing table categories applies the same reconciliation. Moving a table into a dependent category assigns existing references to the first scenario; moving it out collapses duplicate selections while preserving written expressions.
- Import, export, and hosted repair retain the two distinct source identities and repair missing scenario fields. Future schemas remain rejected. Offline HTML still disables hosted Refresh, Save, and Force Save.

Regression tests (using the installed TypeScript compiler and Node 24):

```powershell
node node_modules/typescript/bin/tsc tests/scenarios.test.ts --outDir tmp-schema-check/scenario-tests --module nodenext --target ES2022 --skipLibCheck --esModuleInterop --rewriteRelativeImportExtensions
node --test --test-isolation=none tmp-schema-check/scenario-tests/tests/scenarios.test.js
npm run build
```
