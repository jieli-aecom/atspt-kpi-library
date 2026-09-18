# Global notation (schema 47)

Use the controller in the **Spatial Scales** heading to edit scale names and LaTeX.
The seven scale identities and their hierarchy are fixed. A name change also changes
its notation while the two are identical; a separately customized notation remains
independent. **Apply spatial scales** updates existing formula references and table
units, including references inside subscripts and other expressions.

A plain scale token denotes the geographical unit being calculated and appears red.
An indexed token such as `Cell_i`, `Cell_{j,k}`, or `\mathrm{Cell}_{other}` denotes
another unit and appears orange. The same rules apply to customized notation.

**Constants → Logic** holds LaTeX expressions and explanations (for example `\max`).
These definitions do not require KPI source selection. Matching formula tokens
appear teal; clicking or pressing Enter/Space opens their definition. The formula
editor also provides logic insertion shortcuts. **Apply logic** updates matching
references globally. **Reset** discards a row's draft. Deleting a logic definition
retains formula text and removes its highlighting.

## Persistence and migration

- Schema 47 adds `spatialScaleDefinitions`, keyed by stable scale identity, and
  `logic`, a list of `{ id, latex, explanation }` records.
- Historical schema 46's `parcel` KPI settings migrate to `cell`; Parcel/Parcels
  notation and spatial units migrate to Cell/Cells. IDs, ordinary prose, names,
  and unrelated identifiers remain intact. Earlier Grid/Cell configurations
  continue through their historical migrations.
- This migration runs only for versions below 47 (or unversioned imports).
  A user can deliberately name a scale Parcel again without another automatic rename.
- Exported HTML preserves both catalogs and remains an offline snapshot: local
  editing and HTML import/export work; Refresh, Save and Force Save stay disabled.
- Imports retain existing definitions when merging a populated library. Imported
  formulas are aligned to the retained scale notation and logic definitions with
  matching IDs. A blank library adopts the imported definitions. Concurrent hosted
  saves merge scale definitions per identity and logic per ID, aligning formulas
  before the existing entity merge rules run.
- Notation replacement uses literal tokens, respects identifier/command boundaries,
  and replaces multiple names simultaneously. In prose, only delimited math changes.
  Edits are drafted locally; Apply walks the configuration in time slices, yields
  to the browser, retains unchanged branches, and commits once. A concurrent local
  edit aborts the pending commit rather than overwriting newer work.

## Verification

Run `npm test` with Node 24 or newer and `npm run build`. Regression tests cover
migration and round trips, nested/indexed tokens, global changes, catalog render
invalidation, import/concurrent merges, and yielding across a 3,000-KPI library.
Hosted development uses `npx vercel dev` at `http://localhost:3000`.
