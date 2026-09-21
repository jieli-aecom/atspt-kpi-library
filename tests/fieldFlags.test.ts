import assert from 'node:assert/strict';
import test from 'node:test';
import { createBlankConfig, repairConfig, prepareForExport, kpiPoolConfigSchema } from '../src/configSchema.ts';
import { mergeConcurrentConfig } from '../src/configMerge.ts';
import { buildTableSchemaJsonExport } from '../src/tableSchemaJsonExport.ts';
import { fieldFlagsText, fieldFlagTone } from '../src/fieldFlags.ts';
import type { DataSourceField, KpiPoolConfig } from '../src/types.ts';

const formula = { tag: 'Adjusted value', formula: 'y = x + 1', leftExpression: 'y', rightExpression: 'x + 1', generalExplanation: '', terms: [] };
const field: DataSourceField = { id: 'value', name: 'Value', meaning: '', details: 'Clean inputs', preprocessingNeeded: false, preferredLatex: '', dataType: 'number', valueUnit: '', options: [], formulas: [formula] };
const fixture = (): KpiPoolConfig => ({ ...createBlankConfig(), dataSources: [{ id: 'table', name: 'Table', spatialUnit: '', fields: [structuredClone(field)], fieldGroups: [] }] });

test('schema 49 upgrades implied statuses once, retaining notes and formulae', () => {
  const old = fixture();
  const upgraded = repairConfig({ ...old, schemaVersion: 49 }).config;
  const actual = upgraded.dataSources[0].fields[0];
  assert.equal(upgraded.schemaVersion, 50);
  assert.equal(actual.preprocessingNeeded, true);
  assert.equal(actual.derived, true);
  assert.equal(actual.potentiallyUnavailable, false);
  assert.equal(actual.details, field.details);
  assert.deepEqual(actual.formulas, [formula]);
  assert.equal(repairConfig(upgraded).config, upgraded);
  assert.equal(old.dataSources[0].fields[0].preprocessingNeeded, false);
  assert.throws(() => repairConfig({ ...old, schemaVersion: 51 }), /newer than/);
});

test('explicit false flags survive current-schema repair, export and merge despite notes and formulae', () => {
  const base = fixture();
  const edited = structuredClone(base);
  edited.dataSources[0].fields[0] = { ...field, derived: false, potentiallyUnavailable: false, potentiallyUnavailableNote: 'Keep this note' };
  // Force the repair path rather than only exercising the current-config fast path.
  const repaired = repairConfig({ ...edited, title: undefined }).config;
  const roundTrip = repairConfig(JSON.parse(JSON.stringify(prepareForExport(repaired)))).config;
  const remote = { ...base, title: 'Remote title' };
  const merged = mergeConcurrentConfig(remote, base, roundTrip);
  const actual = merged.dataSources[0].fields[0];
  assert.equal(actual.preprocessingNeeded, false);
  assert.equal(actual.derived, false);
  assert.equal(actual.potentiallyUnavailable, false);
  assert.equal(actual.potentiallyUnavailableNote, 'Keep this note');
  assert.equal(actual.details, field.details);
  assert.deepEqual(actual.formulas, [formula]);
  assert.equal(fieldFlagsText(actual), '');
  assert.ok(kpiPoolConfigSchema.safeParse(roundTrip).success);
});

test('all flags and notes survive serialization and use U then P then D precedence', () => {
  for (const preprocessingNeeded of [false, true]) for (const derived of [false, true]) for (const potentiallyUnavailable of [false, true]) {
    const config = fixture();
    config.dataSources[0].fields[0] = { ...field, preprocessingNeeded, derived, potentiallyUnavailable, potentiallyUnavailableNote: 'Limited coverage' };
    const actual = repairConfig(JSON.parse(JSON.stringify(prepareForExport(config)))).config.dataSources[0].fields[0];
    assert.equal(fieldFlagTone(actual), potentiallyUnavailable ? 'unavailable' : preprocessingNeeded ? 'preprocessing' : derived ? 'derived' : '');
    assert.equal(fieldFlagsText(actual), [preprocessingNeeded && 'Preprocessing Needed: Clean inputs', derived && 'Derived', potentiallyUnavailable && 'Potentially Unavailable: Limited coverage'].filter(Boolean).join('; '));
  }
});

test('schema JSON adds flags to expanded fields while preserving the legacy shape', () => {
  const config = fixture();
  config.dataSources[0].fieldGroups = [{ id: 'group', position: 0, fieldIds: ['value'], dimensions: [{ id: 'time', name: 'Time', options: ['AM', 'PM'] }] }];
  const before = buildTableSchemaJsonExport(config);
  config.dataSources[0].fields[0] = { ...field, preprocessingNeeded: true, derived: true, potentiallyUnavailable: true, potentiallyUnavailableNote: 'Limited coverage' };
  const after = buildTableSchemaJsonExport(config);
  const fields = after.PreprocessedConstants.Table.Fields;
  for (const entry of fields) assert.deepEqual(entry.Flags, [{ Name: 'Preprocessing Needed', Note: 'Clean inputs' }, { Name: 'Derived' }, { Name: 'Potentially Unavailable', Note: 'Limited coverage' }]);
  for (const entry of fields) delete entry.Flags;
  assert.deepEqual(after, before);
});
