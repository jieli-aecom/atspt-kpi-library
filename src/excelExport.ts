import JSZip from 'jszip';
import type { DataSource, DataSourceField, KpiMetric, KpiPoolConfig } from './types';

const EXCEL_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export type ExcelExportFilters = {
  userGroups: readonly string[];
  useCases: readonly string[];
  performanceAreas: readonly string[];
};

export type KpiExcelRow = {
  userGroup: string;
  useCase: string;
  name: string;
  description: string;
  note: string;
  noteMarkdown?: string;
  noteLabels?: string;
  performanceAreas: string;
};

type KpiExcelColumnDefinition = {
  key: Exclude<keyof KpiExcelRow, 'noteMarkdown'>;
  label: string;
  width: number;
  richTextKey?: 'noteMarkdown';
};

export const KPI_EXCEL_COLUMNS = [
  { key: 'userGroup', label: 'User Group', width: 24 },
  { key: 'useCase', label: 'Use Case', width: 32 },
  { key: 'name', label: 'Name', width: 34 },
  { key: 'description', label: 'Description', width: 58 },
  { key: 'note', label: 'Notes', width: 58, richTextKey: 'noteMarkdown' },
  { key: 'noteLabels', label: 'Labels', width: 34 },
  { key: 'performanceAreas', label: 'Performance Areas', width: 44 }
] as const satisfies readonly KpiExcelColumnDefinition[];

export type KpiExcelColumnKey = (typeof KPI_EXCEL_COLUMNS)[number]['key'];

export type ExcelRichTextRun = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  strike?: boolean;
};

const unique = (values: readonly string[]) => [...new Set(values)];

const decodeMarkdownEntities = (value: string) => value
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'");

/**
 * Some imported notes contain Markdown emphasis delimiters with every marker
 * escaped (for example, `\*\*important\*\*`). Treat a complete escaped pair as
 * formatting while continuing to preserve isolated escaped punctuation.
 */
const restoreEscapedMarkdownEmphasis = (value: string) => value
  .replace(/\\\*\\\*\\\*([^\n]+?)\\\*\\\*\\\*/g, '***$1***')
  .replace(/\\_\\_\\_([^\n]+?)\\_\\_\\_/g, '___$1___')
  .replace(/\\\*\\\*([^\n]+?)\\\*\\\*/g, '**$1**')
  .replace(/\\_\\_([^\n]+?)\\_\\_/g, '__$1__')
  .replace(/\\~\\~([^\n]+?)\\~\\~/g, '~~$1~~')
  .replace(/\\\*([^\n]+?)\\\*/g, '*$1*')
  .replace(/\\_([^\n]+?)\\_/g, '_$1_');

const appendRichTextRun = (
  runs: ExcelRichTextRun[],
  text: string,
  style: Omit<ExcelRichTextRun, 'text'> = {}
) => {
  const decodedText = decodeMarkdownEntities(text);
  if (!decodedText) return;
  const previous = runs[runs.length - 1];
  if (
    previous &&
    Boolean(previous.bold) === Boolean(style.bold) &&
    Boolean(previous.italic) === Boolean(style.italic) &&
    Boolean(previous.strike) === Boolean(style.strike)
  ) {
    previous.text += decodedText;
    return;
  }
  runs.push({ text: decodedText, ...style });
};

const parseMarkdownInlineSegment = (
  value: string,
  startIndex: number,
  inheritedStyle: Omit<ExcelRichTextRun, 'text'>,
  closingDelimiter?: string
): { runs: ExcelRichTextRun[]; index: number; closed: boolean } => {
  const runs: ExcelRichTextRun[] = [];
  let index = startIndex;

  const appendRuns = (nestedRuns: ExcelRichTextRun[]) => {
    nestedRuns.forEach((run) => appendRichTextRun(runs, run.text, run));
  };

  while (index < value.length) {
    if (closingDelimiter && value.startsWith(closingDelimiter, index)) {
      const delimiterRun = value.slice(index).match(new RegExp(`^\\${closingDelimiter[0]}+`))?.[0] ?? '';
      if (closingDelimiter.length > 1 || delimiterRun.length % 2 === 1) {
        return { runs, index: index + closingDelimiter.length, closed: true };
      }
    }

    if (value[index] === '\\' && index + 1 < value.length && /[\\`*{}\[\]()#+\-.!_>|~]/.test(value[index + 1])) {
      appendRichTextRun(runs, value[index + 1], inheritedStyle);
      index += 2;
      continue;
    }

    const remainder = value.slice(index);
    const image = remainder.match(/^!\[([^\]]*)\]\(([^)]+)\)/);
    if (image) {
      const label = image[1].trim();
      const target = image[2].trim();
      if (label) {
        appendRuns(parseMarkdownInlineSegment(label, 0, inheritedStyle).runs);
        appendRichTextRun(runs, ` (${target})`, inheritedStyle);
      } else {
        appendRichTextRun(runs, target, inheritedStyle);
      }
      index += image[0].length;
      continue;
    }

    const link = remainder.match(/^\[([^\]]+)\]\(([^)]+)\)/);
    if (link) {
      const label = link[1].trim();
      const target = link[2].trim();
      appendRuns(parseMarkdownInlineSegment(label, 0, inheritedStyle).runs);
      if (label !== target) appendRichTextRun(runs, ` (${target})`, inheritedStyle);
      index += link[0].length;
      continue;
    }

    const automaticLink = remainder.match(/^<((?:https?:\/\/|mailto:)[^>]+)>/);
    if (automaticLink) {
      appendRichTextRun(runs, automaticLink[1], inheritedStyle);
      index += automaticLink[0].length;
      continue;
    }

    const htmlTag = remainder.match(/^<[^>]+>/);
    if (htmlTag) {
      index += htmlTag[0].length;
      continue;
    }

    if (value[index] === '`') {
      const openingFence = value.slice(index).match(/^`+/)?.[0] ?? '`';
      const closingIndex = value.indexOf(openingFence, index + openingFence.length);
      if (closingIndex >= 0) {
        appendRichTextRun(
          runs,
          value.slice(index + openingFence.length, closingIndex).replace(/^ | $/g, ''),
          inheritedStyle
        );
        index = closingIndex + openingFence.length;
        continue;
      }
    }

    const emphasis = ([
      ['***', { bold: true, italic: true }],
      ['___', { bold: true, italic: true }],
      ['**', { bold: true }],
      ['__', { bold: true }],
      ['~~', { strike: true }],
      ['*', { italic: true }],
      ['_', { italic: true }]
    ] as const).find(([delimiter]) => value.startsWith(delimiter, index));
    if (emphasis) {
      const [delimiter, style] = emphasis;
      const nested = parseMarkdownInlineSegment(
        value,
        index + delimiter.length,
        { ...inheritedStyle, ...style },
        delimiter
      );
      if (nested.closed) {
        appendRuns(nested.runs);
        index = nested.index;
        continue;
      }
    }

    const nextSpecialOffset = value.slice(index + 1).search(/[\\!\[<`*_~]/);
    const end = nextSpecialOffset < 0 ? value.length : index + 1 + nextSpecialOffset;
    appendRichTextRun(runs, value.slice(index, end), inheritedStyle);
    index = end;
  }

  return { runs, index, closed: false };
};

const parseMarkdownInlineRuns = (
  value: string,
  inheritedStyle: Omit<ExcelRichTextRun, 'text'> = {}
): ExcelRichTextRun[] => parseMarkdownInlineSegment(value, 0, inheritedStyle).runs;

const joinRichTextLines = (lines: ExcelRichTextRun[][]) => {
  const runs: ExcelRichTextRun[] = [];
  lines.forEach((line, index) => {
    if (index > 0) appendRichTextRun(runs, '\n');
    line.forEach((run) => appendRichTextRun(runs, run.text, run));
  });
  if (runs.length > 0) runs[0].text = runs[0].text.trimStart();
  if (runs.length > 0) runs[runs.length - 1].text = runs[runs.length - 1].text.trimEnd();
  return runs.filter((run) => run.text.length > 0);
};

/** Converts common Markdown constructs to readable Excel rich text. */
export const markdownToExcelRichText = (markdown: string): ExcelRichTextRun[] => {
  const lines = restoreEscapedMarkdownEmphasis(markdown.replace(/\r\n?/g, '\n')).split('\n');
  let inFence = false;
  const output: ExcelRichTextRun[][] = [];
  lines.forEach((sourceLine) => {
    const line = sourceLine.trimEnd();
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      return;
    }
    if (inFence) {
      output.push([{ text: line }]);
      return;
    }
    if (/^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line)) return;

    const tableLine = line.trim();
    if (tableLine.includes('|') && /^\|.*\|$/.test(tableLine)) {
      const tableRuns: ExcelRichTextRun[] = [];
      tableLine.slice(1, -1).split('|').forEach((cell, index) => {
        if (index > 0) appendRichTextRun(tableRuns, '\t');
        parseMarkdownInlineRuns(cell.trim()).forEach((run) => appendRichTextRun(tableRuns, run.text, run));
      });
      output.push(tableRuns);
      return;
    }

    const heading = line.match(/^\s{0,3}#{1,6}\s+(.*)$/);
    output.push(parseMarkdownInlineRuns((heading?.[1] ?? line)
      .replace(/^\s*>\s?/, '› ')
      .replace(/^\s*[-+*]\s+\[[ xX]\]\s+/, (marker) => /[xX]/.test(marker) ? '☑ ' : '☐ ')
      .replace(/^\s*[-+*]\s+/, '• ')
      .replace(/^\s*(\d+)[.)]\s+/, '$1. ')
      .replace(/^\s*(?:-{3,}|_{3,}|\*{3,})\s*$/, '────────────────'), heading ? { bold: true } : {}));
  });

  // Excel already renders each newline as a visible line break. Markdown's
  // blank separator lines would therefore create unwanted empty Excel lines.
  const compactOutput = output.filter((line) => line.some((run) => run.text.trim().length > 0));
  return joinRichTextLines(compactOutput);
};

/** Converts common Markdown constructs to readable plain text for an Excel cell. */
export const markdownToExcelText = (markdown: string) =>
  markdownToExcelRichText(markdown).map((run) => run.text).join('');

export const buildKpiExcelRows = (
  config: KpiPoolConfig,
  kpis: readonly KpiMetric[],
  filters: ExcelExportFilters
): KpiExcelRow[] => {
  const userGroupLabelById = new Map(config.enums.userGroup.map((option) => [option.id, option.label]));
  const useCaseLabelById = new Map(config.enums.useCase.map((option) => [option.id, option.label]));
  const performanceAreaById = new Map(config.enums.performanceArea.map((option) => [option.id, option]));
  const noteLabelById = new Map(config.noteLabels.map((label) => [label.id, label.name]));
  const selectedPerformanceAreaLabels = new Set(
    filters.performanceAreas.map((id) => performanceAreaById.get(id)?.label ?? id)
  );

  return kpis.flatMap((kpi) => {
    const assignments = unique(
      kpi.userGroupUseCases.flatMap((entry) => entry.useCases.map((useCase) => `${entry.userGroup}\u0000${useCase}`))
    ).map((key) => {
      const [userGroup, useCase] = key.split('\u0000');
      return { userGroup, useCase };
    });
    const rowsForKpi = assignments.length > 0 ? assignments : [{ userGroup: '', useCase: '' }];

    const matchingAssignments = rowsForKpi.flatMap(({ userGroup, useCase }) => {
      if (filters.userGroups.length > 0 && !filters.userGroups.includes(userGroup)) return [];
      if (filters.useCases.length > 0 && !filters.useCases.includes(useCase)) return [];

      const scopedPerformanceAreaIds = useCase
        ? kpi.performanceAreasByUseCase.find((entry) => entry.useCase === useCase)?.performanceAreas ?? kpi.performanceArea
        : kpi.performanceAreasByUseCase.length > 0
          ? kpi.performanceAreasByUseCase.flatMap((entry) => entry.performanceAreas)
          : kpi.performanceArea;
      const performanceAreaLabels = unique(
        scopedPerformanceAreaIds.map((id) => performanceAreaById.get(id)?.label ?? id)
      );

      if (
        selectedPerformanceAreaLabels.size > 0 &&
        !performanceAreaLabels.some((label) => selectedPerformanceAreaLabels.has(label))
      ) {
        return [];
      }

      return [{ userGroup, useCase, performanceAreaLabels }];
    });

    if (matchingAssignments.length === 0) return [];

    return [{
      userGroup: unique(
        matchingAssignments
          .map(({ userGroup }) => userGroupLabelById.get(userGroup) ?? userGroup)
          .filter(Boolean)
      ).join(', '),
      useCase: unique(
        matchingAssignments
          .map(({ useCase }) => useCaseLabelById.get(useCase) ?? useCase)
          .filter(Boolean)
      ).join(', '),
      name: kpi.name,
      description: kpi.description.overview,
      note: markdownToExcelText(kpi.note),
      noteMarkdown: kpi.note,
      noteLabels: unique(kpi.noteLabels.map((id) => noteLabelById.get(id) ?? id)).join(', '),
      performanceAreas: unique(
        matchingAssignments.flatMap(({ performanceAreaLabels }) => performanceAreaLabels)
      ).join('; ')
    }];
  });
};

export async function createKpiExcelWorkbook(
  title: string,
  rows: readonly KpiExcelRow[],
  selectedColumnKeys: readonly KpiExcelColumnKey[] = KPI_EXCEL_COLUMNS.map(({ key }) => key)
): Promise<Uint8Array> {
  const zip = new JSZip();
  const now = new Date().toISOString();
  const sheetTitle = title.trim() || 'KPI Library';

  zip.file('[Content_Types].xml', contentTypesXml);
  zip.folder('_rels')?.file('.rels', rootRelationshipsXml);
  zip.folder('docProps')?.file('app.xml', appPropertiesXml);
  zip.folder('docProps')?.file('core.xml', corePropertiesXml(sheetTitle, now));
  zip.folder('xl')?.file('workbook.xml', workbookXml);
  zip.folder('xl')?.folder('_rels')?.file('workbook.xml.rels', workbookRelationshipsXml);
  zip.folder('xl')?.file('styles.xml', stylesXml);
  zip.folder('xl')?.folder('worksheets')?.file('sheet1.xml', worksheetXml(sheetTitle, rows, selectedColumnKeys));

  return zip.generateAsync({
    type: 'uint8array',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
    mimeType: EXCEL_MIME_TYPE
  });
}

export async function downloadKpiExcelWorkbook(
  fileName: string,
  title: string,
  rows: readonly KpiExcelRow[],
  selectedColumnKeys?: readonly KpiExcelColumnKey[]
) {
  const bytes = await createKpiExcelWorkbook(title, rows, selectedColumnKeys);
  const blob = new Blob([Uint8Array.from(bytes).buffer], { type: EXCEL_MIME_TYPE });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName.toLowerCase().endsWith('.xlsx') ? fileName : `${fileName}.xlsx`;
  anchor.style.display = 'none';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export async function createTableSchemaExcelWorkbook(config: KpiPoolConfig): Promise<Uint8Array> {
  if (config.dataSources.length === 0) throw new Error('Add at least one source table before exporting.');
  const zip = new JSZip();
  const now = new Date().toISOString();
  const workbookTitle = `${config.title.trim() || 'KPI Library'} table schema`;
  const sheetNames = worksheetNames(config.dataSources);

  zip.file('[Content_Types].xml', tableSchemaContentTypesXml(sheetNames.length));
  zip.folder('_rels')?.file('.rels', rootRelationshipsXml);
  zip.folder('docProps')?.file('app.xml', tableSchemaAppPropertiesXml(sheetNames));
  zip.folder('docProps')?.file('core.xml', corePropertiesXml(workbookTitle, now));
  zip.folder('xl')?.file('workbook.xml', tableSchemaWorkbookXml(sheetNames));
  zip.folder('xl')?.folder('_rels')?.file('workbook.xml.rels', tableSchemaWorkbookRelationshipsXml(sheetNames.length));
  zip.folder('xl')?.file('styles.xml', tableSchemaStylesXml);
  const worksheets = zip.folder('xl')?.folder('worksheets');
  config.dataSources.forEach((source, index) => {
    worksheets?.file(`sheet${index + 1}.xml`, tableSchemaWorksheetXml(config, source));
  });

  return zip.generateAsync({
    type: 'uint8array',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
    mimeType: EXCEL_MIME_TYPE
  });
}

export async function downloadTableSchemaExcelWorkbook(fileName: string, config: KpiPoolConfig) {
  const bytes = await createTableSchemaExcelWorkbook(config);
  const blob = new Blob([Uint8Array.from(bytes).buffer], { type: EXCEL_MIME_TYPE });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName.toLowerCase().endsWith('.xlsx') ? fileName : `${fileName}.xlsx`;
  anchor.style.display = 'none';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function worksheetXml(
  title: string,
  rows: readonly KpiExcelRow[],
  selectedColumnKeys: readonly KpiExcelColumnKey[]
) {
  const selectedColumnKeySet = new Set(selectedColumnKeys);
  const selectedColumns = KPI_EXCEL_COLUMNS.filter(({ key }) => selectedColumnKeySet.has(key));
  if (selectedColumns.length === 0) {
    throw new Error('Select at least one column to export.');
  }
  const headerRow = 3;
  const firstDataRow = headerRow + 1;
  const lastRow = Math.max(headerRow, headerRow + rows.length);
  const lastColumnName = columnName(selectedColumns.length);
  const columns = selectedColumns
    .map(({ width }, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`)
    .join('');
  const headerCells = selectedColumns
    .map(({ label }, index) => stringCell(`${columnName(index + 1)}${headerRow}`, label, 3))
    .join('');
  const dataRows = rows.map((row, index) => {
    const rowNumber = firstDataRow + index;
    return `<row r="${rowNumber}" ht="45" customHeight="1">${selectedColumns.map((column, columnIndex) => {
      const reference = `${columnName(columnIndex + 1)}${rowNumber}`;
      const richText = 'richTextKey' in column ? row[column.richTextKey] : undefined;
      return richText !== undefined
        ? richMarkdownCell(reference, richText, 4)
        : stringCell(reference, row[column.key] ?? '', 4);
    }).join('')}</row>`;
  }).join('');

  return xmlDocument(`<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="A1:${lastColumnName}${lastRow}"/>
  <sheetViews><sheetView workbookViewId="0"><pane ySplit="3" topLeftCell="A4" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  <sheetFormatPr defaultRowHeight="15"/>
  <cols>${columns}</cols>
  <sheetData>
    <row r="1" ht="26" customHeight="1">${stringCell('A1', title, 1)}</row>
    <row r="2" ht="20" customHeight="1">${stringCell('A2', `${rows.length} filtered KPI${rows.length === 1 ? '' : 's'}`, 2)}</row>
    <row r="${headerRow}" ht="24" customHeight="1">${headerCells}</row>
    ${dataRows}
  </sheetData>
  <autoFilter ref="A${headerRow}:${lastColumnName}${lastRow}"/>
  <mergeCells count="2"><mergeCell ref="A1:${lastColumnName}1"/><mergeCell ref="A2:${lastColumnName}2"/></mergeCells>
  <pageMargins left="0.25" right="0.25" top="0.5" bottom="0.5" header="0.2" footer="0.2"/>
  <pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0"/>
</worksheet>`);
}

function stringCell(reference: string, value: string, style: number) {
  return `<c r="${reference}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value.slice(0, 32767))}</t></is></c>`;
}

function richMarkdownCell(reference: string, markdown: string, style: number) {
  const runs = markdownToExcelRichText(markdown);
  let remainingCharacters = 32767;
  const runXml = runs.flatMap((run) => {
    if (remainingCharacters <= 0) return [];
    const text = run.text.slice(0, remainingCharacters);
    remainingCharacters -= text.length;
    if (!text) return [];
    const properties = [run.bold ? '<b/>' : '', run.italic ? '<i/>' : '', run.strike ? '<strike/>' : ''].join('');
    return `<r>${properties ? `<rPr>${properties}</rPr>` : ''}<t xml:space="preserve">${escapeXml(text)}</t></r>`;
  }).join('');
  return runXml
    ? `<c r="${reference}" s="${style}" t="inlineStr"><is>${runXml}</is></c>`
    : stringCell(reference, '', style);
}

const tableSchemaColumns = [
  { label: 'Key', width: 10 },
  { label: 'Field name', width: 32 },
  { label: 'Type', width: 20 },
  { label: 'Unit', width: 18 },
  { label: 'By', width: 48 },
  { label: 'Preprocessing needed', width: 22 },
  { label: 'Preprocessing note', width: 58 }
] as const;

const tableSchemaFieldType = (field: DataSourceField) => {
  const labels = { id: 'ID', number: 'Number', boolean: 'Boolean', text: 'Text', enum: 'Domain', collection: 'Collection' } as const;
  if (field.dataType !== 'collection') return labels[field.dataType];
  const itemLabels = { id: 'IDs', number: 'Numbers', boolean: 'Booleans', text: 'Text values', enum: 'Domains' } as const;
  return `${labels.collection} (${field.collectionItemType ? itemLabels[field.collectionItemType] : 'Values'})`;
};

const tableSchemaFieldDimensions = (config: KpiPoolConfig, source: DataSource, fieldId: string) => source.fieldGroups
  .filter((group) => group.fieldIds.includes(fieldId))
  .flatMap((group) => group.dimensions)
  .map((dimension) => {
    const name = dimension.name.trim() || 'Category';
    const globalOptions = dimension.enumId
      ? config.valueEnums.find((definition) => definition.id === dimension.enumId)?.options
      : undefined;
    const options = globalOptions ?? dimension.options;
    return options.length ? `${name}: ${options.join(', ')}` : name;
  })
  .join('; ');

function tableSchemaWorksheetXml(config: KpiPoolConfig, source: DataSource) {
  const ordinaryFields = source.fields.filter((field) => !field.generatedRelationId);
  const virtualFields = source.fields.filter((field) => field.generatedRelationId);
  const headerRow = 3;
  const firstDataRow = headerRow + 1;
  const joinRow = virtualFields.length ? firstDataRow + ordinaryFields.length : undefined;
  const lastRow = headerRow + source.fields.length + (joinRow ? 1 : 0);
  const lastColumnName = columnName(tableSchemaColumns.length);
  const columns = tableSchemaColumns
    .map(({ width }, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`)
    .join('');
  const headerCells = tableSchemaColumns
    .map(({ label }, index) => stringCell(`${columnName(index + 1)}${headerRow}`, label, 3))
    .join('');
  const fieldRow = (field: DataSourceField, rowNumber: number, virtual: boolean) => {
    const style = virtual ? 6 : 4;
    const needsPreprocessing = field.preprocessingNeeded || Boolean(field.details.trim());
    const values = [
      field.id === source.primaryKeyFieldId ? 'PK' : '',
      field.name,
      tableSchemaFieldType(field),
      field.valueUnit.trim(),
      tableSchemaFieldDimensions(config, source, field.id),
      needsPreprocessing ? 'Yes' : 'No',
      markdownToExcelText(field.details)
    ];
    return `<row r="${rowNumber}" ht="32" customHeight="1">${values.map((value, index) => stringCell(`${columnName(index + 1)}${rowNumber}`, value, style)).join('')}</row>`;
  };
  const ordinaryRows = ordinaryFields.map((field, index) => fieldRow(field, firstDataRow + index, false)).join('');
  const joinsSection = joinRow
    ? `<row r="${joinRow}" ht="24" customHeight="1">${stringCell(`A${joinRow}`, 'Joins', 5)}</row>`
    : '';
  const virtualRows = virtualFields.map((field, index) => fieldRow(field, (joinRow ?? firstDataRow) + 1 + index, true)).join('');
  const mergeRanges = [`A1:${lastColumnName}1`, `A2:${lastColumnName}2`, ...(joinRow ? [`A${joinRow}:${lastColumnName}${joinRow}`] : [])];
  const spatialUnit = source.spatialUnit || 'Not specified';
  const fieldCount = `${source.fields.length} field${source.fields.length === 1 ? '' : 's'}`;
  const sourceGroupName = config.dataSourceGroups.find((group) => group.itemIds.includes(source.id))?.name.trim();
  const sourceGroupText = sourceGroupName ? `Group: ${sourceGroupName}. ` : '';

  return xmlDocument(`<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="A1:${lastColumnName}${Math.max(headerRow, lastRow)}"/>
  <sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane ySplit="3" topLeftCell="A4" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  <sheetFormatPr defaultRowHeight="18"/>
  <cols>${columns}</cols>
  <sheetData>
    <row r="1" ht="26" customHeight="1">${stringCell('A1', source.name.trim() || 'Untitled table', 1)}</row>
    <row r="2" ht="20" customHeight="1">${stringCell('A2', `${sourceGroupText}Spatial unit: ${spatialUnit}. ${fieldCount}.`, 2)}</row>
    <row r="${headerRow}" ht="26" customHeight="1">${headerCells}</row>
    ${ordinaryRows}
    ${joinsSection}
    ${virtualRows}
  </sheetData>
  <mergeCells count="${mergeRanges.length}">${mergeRanges.map((range) => `<mergeCell ref="${range}"/>`).join('')}</mergeCells>
  <pageMargins left="0.25" right="0.25" top="0.5" bottom="0.5" header="0.2" footer="0.2"/>
  <pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0"/>
</worksheet>`);
}

function worksheetNames(sources: readonly DataSource[]) {
  const used = new Set<string>();
  return sources.map((source, index) => {
    const cleaned = source.name.trim().replace(/[\\/\[\]:*?]/g, ' ').replace(/\s+/g, ' ').replace(/^'+|'+$/g, '') || `Table ${index + 1}`;
    let suffix = 1;
    let name = cleaned.slice(0, 31).trim();
    while (used.has(name.toLocaleLowerCase())) {
      suffix += 1;
      const ending = ` (${suffix})`;
      name = `${cleaned.slice(0, 31 - ending.length).trim()}${ending}`;
    }
    used.add(name.toLocaleLowerCase());
    return name;
  });
}

const tableSchemaContentTypesXml = (sheetCount: number) => xmlDocument(`<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${Array.from({ length: sheetCount }, (_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`);

const tableSchemaWorkbookXml = (sheetNames: readonly string[]) => xmlDocument(`<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView xWindow="0" yWindow="0" windowWidth="24000" windowHeight="14000"/></bookViews><sheets>${sheetNames.map((name, index) => `<sheet name="${escapeXml(name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join('')}</sheets></workbook>`);

const tableSchemaWorkbookRelationshipsXml = (sheetCount: number) => xmlDocument(`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${Array.from({ length: sheetCount }, (_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join('')}<Relationship Id="rId${sheetCount + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);

const tableSchemaAppPropertiesXml = (sheetNames: readonly string[]) => xmlDocument(`<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>KPI Library Manager</Application><DocSecurity>0</DocSecurity><ScaleCrop>false</ScaleCrop><HeadingPairs><vt:vector size="2" baseType="variant"><vt:variant><vt:lpstr>Worksheets</vt:lpstr></vt:variant><vt:variant><vt:i4>${sheetNames.length}</vt:i4></vt:variant></vt:vector></HeadingPairs><TitlesOfParts><vt:vector size="${sheetNames.length}" baseType="lpstr">${sheetNames.map((name) => `<vt:lpstr>${escapeXml(name)}</vt:lpstr>`).join('')}</vt:vector></TitlesOfParts><Company></Company><LinksUpToDate>false</LinksUpToDate><SharedDoc>false</SharedDoc><HyperlinksChanged>false</HyperlinksChanged><AppVersion>16.0300</AppVersion></Properties>`);

function columnName(index: number) {
  let value = index;
  let result = '';
  while (value > 0) {
    value -= 1;
    result = String.fromCharCode(65 + (value % 26)) + result;
    value = Math.floor(value / 26);
  }
  return result;
}

function escapeXml(value: string) {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function xmlDocument(body: string) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${body}`;
}

function corePropertiesXml(title: string, now: string) {
  return xmlDocument(`<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${escapeXml(title)}</dc:title><dc:creator>KPI Library Manager</dc:creator><cp:lastModifiedBy>KPI Library Manager</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`);
}

const contentTypesXml = xmlDocument(`<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`);

const rootRelationshipsXml = xmlDocument(`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`);

const workbookXml = xmlDocument(`<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView xWindow="0" yWindow="0" windowWidth="24000" windowHeight="14000"/></bookViews><sheets><sheet name="Filtered KPIs" sheetId="1" r:id="rId1"/></sheets></workbook>`);

const workbookRelationshipsXml = xmlDocument(`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);

const appPropertiesXml = xmlDocument(`<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>KPI Library Manager</Application><DocSecurity>0</DocSecurity><ScaleCrop>false</ScaleCrop><HeadingPairs><vt:vector size="2" baseType="variant"><vt:variant><vt:lpstr>Worksheets</vt:lpstr></vt:variant><vt:variant><vt:i4>1</vt:i4></vt:variant></vt:vector></HeadingPairs><TitlesOfParts><vt:vector size="1" baseType="lpstr"><vt:lpstr>Filtered KPIs</vt:lpstr></vt:vector></TitlesOfParts><Company></Company><LinksUpToDate>false</LinksUpToDate><SharedDoc>false</SharedDoc><HyperlinksChanged>false</HyperlinksChanged><AppVersion>16.0300</AppVersion></Properties>`);

const stylesXml = xmlDocument(`<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="4"><font><sz val="11"/><name val="Aptos"/><family val="2"/><scheme val="minor"/></font><font><b/><sz val="16"/><color rgb="FF0F172A"/><name val="Aptos Display"/><family val="2"/></font><font><i/><sz val="10"/><color rgb="FF64748B"/><name val="Aptos"/><family val="2"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Aptos"/><family val="2"/></font></fonts>
  <fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF174A5B"/><bgColor indexed="64"/></patternFill></fill></fills>
  <borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFD7DEE3"/></left><right style="thin"><color rgb="FFD7DEE3"/></right><top style="thin"><color rgb="FFD7DEE3"/></top><bottom style="thin"><color rgb="FFD7DEE3"/></bottom><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="3" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf></cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles><dxfs count="0"/><tableStyles count="0" defaultTableStyle="TableStyleMedium2" defaultPivotStyle="PivotStyleLight16"/>
</styleSheet>`);

const tableSchemaStylesXml = xmlDocument(`<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="6">
    <font><sz val="11"/><name val="Aptos"/><family val="2"/><scheme val="minor"/></font>
    <font><b/><sz val="16"/><color rgb="FF0F172A"/><name val="Aptos Display"/><family val="2"/></font>
    <font><i/><sz val="10"/><color rgb="FF64748B"/><name val="Aptos"/><family val="2"/></font>
    <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Aptos"/><family val="2"/></font>
    <font><sz val="11"/><color rgb="FF6B7280"/><name val="Aptos"/><family val="2"/></font>
    <font><b/><sz val="11"/><color rgb="FF4B5563"/><name val="Aptos"/><family val="2"/></font>
  </fonts>
  <fills count="5">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF174A5B"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFD1D5DB"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF3F4F6"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFD7DEE3"/></left><right style="thin"><color rgb="FFD7DEE3"/></right><top style="thin"><color rgb="FFD7DEE3"/></top><bottom style="thin"><color rgb="FFD7DEE3"/></bottom><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="7">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="center"/></xf>
    <xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="center"/></xf>
    <xf numFmtId="0" fontId="3" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="5" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>
    <xf numFmtId="0" fontId="4" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles><dxfs count="0"/><tableStyles count="0" defaultTableStyle="TableStyleMedium2" defaultPivotStyle="PivotStyleLight16"/>
</styleSheet>`);
