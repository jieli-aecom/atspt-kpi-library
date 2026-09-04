import assert from 'node:assert/strict';
import test from 'node:test';
import JSZip from 'jszip';
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
  assert.match(worksheet, />Group: Operations\. Spatial unit: Not specified\. 0 fields\.</);
});
