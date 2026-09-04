import assert from 'node:assert/strict';
import test from 'node:test';
import { moveTableField } from '../src/tableFieldMove.ts';
import type { DataSource, KpiMetric, KpiPoolConfig } from '../src/types.ts';

const field = {
  id: 'field-speed',
  name: 'Speed',
  meaning: 'Observed speed',
  details: '',
  preprocessingNeeded: false,
  preferredLatex: 'v_{link}',
  dataType: 'number' as const,
  valueUnit: 'mph',
  options: []
};

const table = (id: string, spatialUnit: DataSource['spatialUnit']): DataSource => ({
  id,
  name: id,
  spatialUnit,
  fields: [],
  fieldGroups: []
});

const configWith = (dataSources: DataSource[], kpis: KpiMetric[] = []): KpiPoolConfig => ({
  dataSources,
  kpis,
  tableRelations: []
} as unknown as KpiPoolConfig);

test('moves a field and retargets KPI sources without changing source latex or formulas', () => {
  const source = { ...table('source', 'Link'), fields: [field] };
  const target = table('target', 'Link');
  const kpi = {
    id: 'kpi-1',
    sources: [{ id: 'source-1', type: 'dataField', dataSourceId: source.id, fieldId: field.id, latex: 'custom_{latex}' }],
    description: {
      formulas: [{
        name: 'Main formula',
        items: [{ id: 'formula-1', name: 'Result', latex: 'custom_{latex} + 1', explanation: '', terms: [] }]
      }]
    }
  } as unknown as KpiMetric;
  const formulaBefore = structuredClone(kpi.description.formulas);

  const result = moveTableField(configWith([source, target], [kpi]), source.id, field.id, target.id);

  assert.equal(result.moved, true);
  assert.deepEqual(result.config.dataSources[0].fields, []);
  assert.deepEqual(result.config.dataSources[1].fields, [field]);
  assert.deepEqual(result.config.kpis[0].sources, [{
    id: 'source-1',
    type: 'dataField',
    dataSourceId: target.id,
    fieldId: field.id,
    latex: 'custom_{latex}'
  }]);
  assert.deepEqual(result.config.kpis[0].description.formulas, formulaBefore);
});

test('rejects a target table with a different spatial unit', () => {
  const source = { ...table('source', 'Link'), fields: [field] };
  const target = table('target', 'TAZ');
  const original = configWith([source, target]);

  const result = moveTableField(original, source.id, field.id, target.id);

  assert.equal(result.moved, false);
  assert.equal(result.config, original);
});
