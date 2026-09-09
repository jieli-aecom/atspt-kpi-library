# KPI scenarios (schema 45)

Each KPI has a `scenarioType`: `Base Year`, `Scenario`, or `Inter-Scenario`. Existing and new KPIs default to `Scenario`. The selector appears beneath By. The two `scenarioNames` default to `Scenario` and `Scenario 2` whenever the user switches to Inter-Scenario.

Tables in Scenario Upstream or KPI Preparation depend on a scenario. A containing table group's category takes precedence over the table category. Source citations show a non-bold `scenario` badge; spatial/dimension badges show `by Link`, etc., without brackets.

The Inter-Scenario source picker starts with two name inputs and lists each source once. Selecting a dependent field or Scenario-type KPI automatically includes both scenarios. Selected Sources shows one shared entry with the name, domains, dimensions, one view button, and one delete button; each scenario gets its own label, editable LaTeX expression, and preview. Unchecking the source or deleting its selected entry removes both variants. Base Year KPIs, Inter-Scenario KPIs, constants, and other source kinds remain single expressions.

The stored source variants retain separate stable IDs and `scenarioSlot` values (0 or 1), so formula references and individual expression edits remain intact. They form one logical selection based on the table/field identity or referenced KPI ID. Schema 45 completes partially selected pairs using the existing base expression; previously edited variants are preserved. Switching to Inter-Scenario completes pairs for existing dependent selections as well.

Automatic LaTeX adds the whitespace-free scenario name to the source's existing subscript and displays it in light blue through the automatic semantic-decoration system. The stored/exported LaTeX contains no generated color commands; CSS controls the scenario decoration alongside dimension and spatial-scale decorations. Preferred field expressions, dimensions, and collection notation remain the base. Expressions without a braced subscript are grouped before adding a scenario subscript. The source editor shows and edits the complete expression, exactly as inserted into formulas. Re-entering that expression does not duplicate the scenario suffix. `scenarioBaseLatex` preserves this base across renaming and global expression updates. Scenario names are escaped as text, so they cannot inject LaTeX commands. KPI references use their existing output expression as the base, or the whitespace-free KPI name when there is no output expression.

Fallbacks:

- Blank names use the defaults. Names that collide after removing whitespace and ignoring case receive a ` 2` suffix on the second name.
- Renaming preserves source IDs and updates formula references, including formula terms and spatial formulas.
- Returning to Base Year or Scenario retains the first selected instance of each field, its full expression, and written formulas. Formula text referencing a removed instance is deliberately retained for review. Base metadata is kept so switching back does not stack scenario suffixes.
- Changing a referenced KPI between Scenario and either of the other types reconciles its references immediately, using the same first-copy and expression-preservation rules.
- Schema 44 removes the generated v42/v43 scenario color wrappers from stored expressions and formula terms, preserving the scenario names and other user-authored formatting.
- Schema 43 preserves scenario slots and base expressions on KPI references. Version 42 references to Scenario KPIs are assigned to the first comparison scenario; written formulas are updated to the suffixed expression.
- Changing table categories applies the same reconciliation. Moving a table into a dependent category assigns existing references to the first scenario; moving it out collapses duplicate selections while preserving written expressions.
- Import, export, and hosted repair retain the two distinct source identities and repair missing scenario fields. Future schemas remain rejected. Offline HTML still disables hosted Refresh, Save, and Force Save.

Regression tests (using the installed TypeScript compiler and Node 24):

```powershell
node node_modules/typescript/bin/tsc tests/scenarios.test.ts --outDir tmp-schema-check/scenario-tests --module nodenext --target ES2022 --skipLibCheck --esModuleInterop --rewriteRelativeImportExtensions
node --test --test-isolation=none tmp-schema-check/scenario-tests/tests/scenarios.test.js
npm run build
```
