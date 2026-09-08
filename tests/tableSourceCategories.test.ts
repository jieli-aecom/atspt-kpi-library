import assert from 'node:assert/strict';
import test from 'node:test';
import { createBlankConfig, repairConfig, prepareForExport, kpiPoolConfigSchema } from '../src/configSchema.ts';
import { CURRENT_SCHEMA_VERSION, tableSourceCategories } from '../src/types.ts';

const fixture = () => ({
  ...createBlankConfig(),
  dataSources: [{ id: 'table', name: 'Table', spatialUnit: '' as const, fields: [], fieldGroups: [] }],
  dataSourceGroups: [{ id: 'group', name: 'Group', itemIds: ['table'], position: 0 }]
});

test('schema 40 migrates tables and groups to Preprocessed Constants without changing membership', () => {
  const config = repairConfig({ ...fixture(), schemaVersion: 40 }).config;
  assert.equal(config.schemaVersion, CURRENT_SCHEMA_VERSION);
  assert.equal(config.dataSources[0].category, 'Preprocessed Constants');
  assert.equal(config.dataSourceGroups[0].category, 'Preprocessed Constants');
  assert.deepEqual(config.dataSourceGroups[0].itemIds, ['table']);
  assert.equal(repairConfig(config).config, config);
});

test('all category assignments survive repair and export', () => {
  for (const category of tableSourceCategories) {
    const original = fixture();
    const config = repairConfig({ ...original,
      dataSources: original.dataSources.map((source) => ({ ...source, category })),
      dataSourceGroups: original.dataSourceGroups.map((group) => ({ ...group, category }))
    }).config;
    const exported = prepareForExport(config);
    assert.equal(exported.dataSources[0].category, category);
    assert.equal(exported.dataSourceGroups[0].category, category);
    assert.ok(kpiPoolConfigSchema.safeParse(exported).success);
  }
});

test('invalid categories are repaired to the transition default', () => {
  const original = fixture();
  const config = repairConfig({ ...original,
    dataSources: original.dataSources.map((source) => ({ ...source, category: 'unknown' })),
    dataSourceGroups: original.dataSourceGroups.map((group) => ({ ...group, category: 'unknown' }))
  }).config;
  assert.equal(config.dataSources[0].category, 'Preprocessed Constants');
  assert.equal(config.dataSourceGroups[0].category, 'Preprocessed Constants');
});
