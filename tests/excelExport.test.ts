import assert from 'node:assert/strict';
import test from 'node:test';
import JSZip from 'jszip';
import { createBlankConfig, createBlankKpi } from '../src/configSchema.ts';
import type { DataSourceField } from '../src/types.ts';
import {
  createKpiExcelWorkbook,
  createTableSchemaExcelWorkbook,
  KPI_EXCEL_COLUMNS,
  markdownToExcelRichText,
  markdownToExcelText
} from '../src/excelExport.ts';

test('converts Markdown emphasis to styled runs without delimiter characters', () => {
  assert.deepEqual(
    markdownToExcelRichText('Plain **bold**, *italic*, and ~~removed~~.'),
    [
      { text: 'Plain ' },
      { text: 'bold', bold: true },
      { text: ', ' },
      { text: 'italic', italic: true },
      { text: ', and ' },
      { text: 'removed', strike: true },
      { text: '.' }
    ]
  );
});

test('recognizes fully escaped emphasis delimiters from imported notes', () => {
  assert.deepEqual(
    markdownToExcelRichText(String.raw`Escaped \*\*bold\*\* and \*italic\*.`),
    [
      { text: 'Escaped ' },
      { text: 'bold', bold: true },
      { text: ' and ' },
      { text: 'italic', italic: true },
      { text: '.' }
    ]
  );
});

test('removes blank Markdown separator lines from Excel text', () => {
  assert.equal(
    markdownToExcelText('First line\n\n\nSecond line\n\n- Third line'),
    'First line\nSecond line\n• Third line'
  );
});

test('writes rich-text formatting to the Remaining Ambiguities cell XML', async () => {
  const bytes = await createKpiExcelWorkbook('Test', [{
    userGroup: 'Planner',
    useCase: 'Review',
    name: 'Sample KPI',
    description: 'Description',
    note: 'Bold and italic',
    noteMarkdown: '**Bold** and *italic*',
    performanceAreas: 'Mobility'
  }]);
  const zip = await JSZip.loadAsync(bytes);
  const worksheet = await zip.file('xl/worksheets/sheet1.xml')?.async('string');

  assert.ok(worksheet);
  assert.match(worksheet, /<c r="E4"[^>]*>.*<rPr><b\/><\/rPr><t xml:space="preserve">Bold<\/t>.*<rPr><i\/><\/rPr><t xml:space="preserve">italic<\/t>.*<\/c>/s);
  assert.doesNotMatch(worksheet, /\*\*Bold\*\*|\*italic\*/);
});

test('exports only selected columns in the shared column-definition order', async () => {
  const bytes = await createKpiExcelWorkbook('Test', [{
    userGroup: 'Planner',
    useCase: 'Review',
    name: 'Sample KPI',
    description: 'Description',
    note: 'Note',
    noteLabels: 'Needs review',
    performanceAreas: 'Mobility'
  }], ['name', 'userGroup']);
  const zip = await JSZip.loadAsync(bytes);
  const worksheet = await zip.file('xl/worksheets/sheet1.xml')?.async('string');

  assert.ok(worksheet);
  assert.match(worksheet, /<dimension ref="A1:B4"\/>/);
  assert.match(worksheet, /<c r="A3"[^>]*>.*User Group.*<\/c><c r="B3"[^>]*>.*Name.*<\/c>/s);
  assert.match(worksheet, /<c r="A4"[^>]*>.*Planner.*<\/c><c r="B4"[^>]*>.*Sample KPI.*<\/c>/s);
  assert.doesNotMatch(worksheet, />Use Case</);
});

test('keeps every export option in the workbook when no column selection is supplied', async () => {
  const bytes = await createKpiExcelWorkbook('Test', []);
  const zip = await JSZip.loadAsync(bytes);
  const worksheet = await zip.file('xl/worksheets/sheet1.xml')?.async('string');

  assert.ok(worksheet);
  assert.match(worksheet, new RegExp(`<dimension ref="A1:${String.fromCharCode(64 + KPI_EXCEL_COLUMNS.length)}3"\\/>`));
  KPI_EXCEL_COLUMNS.forEach(({ label }) => assert.match(worksheet, new RegExp(`>${label}<`)));
});

test('includes the source-table group in schema workbook metadata', async () => {
  const bytes = await createTableSchemaExcelWorkbook({
    title: 'Test',
    dataSources: [{ id: 'table-1', name: 'Signal Events', spatialUnit: '', fields: [], fieldGroups: [] }],
    dataSourceGroups: [{ id: 'group-1', name: 'Operations', itemIds: ['table-1'], position: 0 }]
  } as never);
  const zip = await JSZip.loadAsync(bytes);
  const worksheet = await zip.file('xl/worksheets/sheet1.xml')?.async('string');

  assert.ok(worksheet);
  assert.match(worksheet, />Category: Preprocessed Constants\. Group: Operations\. Spatial unit: Not specified\. 0 fields\.</);
});

test('table sheets include category, units, descriptions, sources and direct/indirect KPI names', async () => {
  const config = createBlankConfig();
  const raw: DataSourceField = { id: 'raw', name: 'Raw speed', meaning: '**Observed** speed', details: '', preprocessingNeeded: false, preferredLatex: '', dataType: 'number', valueUnit: 'mph', options: [] };
  const processed: DataSourceField = { ...raw, id: 'processed', name: 'Speed samples', dataType: 'collection', collectionItemType: 'number', details: 'Clean missing values', sources: [{ id: 'input', type: 'dataField', dataSourceId: 'traffic', fieldId: 'raw', latex: 'x' }] };
  config.dataSources = [
    { id: 'traffic', name: 'Traffic', category: 'Preprocessed Constants', spatialUnit: 'Link', fields: [raw, processed], fieldGroups: [] },
    { id: 'other', name: 'Other', category: 'KPI Preparation', spatialUnit: '', fields: [{ ...raw, id: 'unused', valueUnit: '', meaning: '' }], fieldGroups: [] }
  ];
  config.dataSourceGroups = [{ id: 'group', name: 'Operations', category: 'Scenario Upstream', itemIds: ['traffic'], position: 0 }];
  const direct = { ...createBlankKpi(), id: 'direct', name: 'Travel speed', sources: [{ id: 'source', type: 'dataField' as const, dataSourceId: 'traffic', fieldId: 'processed', latex: 'v' }] };
  const downstream = { ...createBlankKpi(), id: 'downstream', name: 'Accessibility', sources: [{ id: 'dependency', type: 'kpi' as const, kpiId: 'direct', latex: 'k' }] };
  config.kpis = [direct, downstream];
  const zip = await JSZip.loadAsync(await createTableSchemaExcelWorkbook(config));
  const sheet = (await zip.file('xl/worksheets/sheet1.xml')!.async('string'));
  const other = (await zip.file('xl/worksheets/sheet2.xml')!.async('string'));
  const cell = (xml: string, address: string) => xml.match(new RegExp(`<c r="${address}"[^>]*>(.*?)</c>`))?.[1] ?? '';
  assert.match(cell(sheet, 'A2'), /Category: Scenario Upstream\. Group: Operations\./);
  assert.match(cell(other, 'A2'), /Category: KPI Preparation\./);
  assert.doesNotMatch(cell(other, 'A2'), /Group:/);
  assert.match(cell(sheet, 'D4'), />mph</);
  assert.doesNotMatch(cell(sheet, 'E4'), /mph/);
  assert.doesNotMatch(cell(sheet, 'D5'), /mph/);
  assert.match(cell(sheet, 'E5'), />mph</);
  assert.match(cell(sheet, 'F4'), />Observed speed</);
  assert.match(cell(sheet, 'H4'), />No</);
  assert.match(cell(sheet, 'H5'), />Yes</);
  assert.match(cell(sheet, 'J5'), /From: Operations · Traffic Raw speed/);
  assert.match(cell(sheet, 'K4'), />Travel speed, Accessibility</);
  assert.match(cell(sheet, 'K5'), />Travel speed, Accessibility</);
  assert.doesNotMatch(cell(other, 'K4'), /Travel speed|Accessibility/);
  assert.match(sheet, /dimension ref="A1:K5"/);
  assert.match(cell(sheet, 'K3'), />Supported KPIs</);
});
