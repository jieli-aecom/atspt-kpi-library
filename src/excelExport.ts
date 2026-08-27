import JSZip from 'jszip';
import type { KpiMetric, KpiPoolConfig } from './types';

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
  performanceAreas: string;
};

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
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
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

    output.push(parseMarkdownInlineRuns(line
      .replace(/^\s{0,3}#{1,6}\s+/, '')
      .replace(/^\s*>\s?/, '› ')
      .replace(/^\s*[-+*]\s+\[[ xX]\]\s+/, (marker) => /[xX]/.test(marker) ? '☑ ' : '☐ ')
      .replace(/^\s*[-+*]\s+/, '• ')
      .replace(/^\s*(\d+)[.)]\s+/, '$1. ')
      .replace(/^\s*(?:-{3,}|_{3,}|\*{3,})\s*$/, '────────────────')));
  });

  const compactOutput = output.filter((line, index) =>
    line.length > 0 || index === 0 || output[index - 1].length > 0
  );
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

    return rowsForKpi.flatMap(({ userGroup, useCase }) => {
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

      return [{
        userGroup: userGroupLabelById.get(userGroup) ?? userGroup,
        useCase: useCaseLabelById.get(useCase) ?? useCase,
        name: kpi.name,
        description: kpi.description.overview,
        note: markdownToExcelText(kpi.note),
        noteMarkdown: kpi.note,
        performanceAreas: performanceAreaLabels.join('; ')
      }];
    });
  });
};

export async function createKpiExcelWorkbook(title: string, rows: readonly KpiExcelRow[]): Promise<Uint8Array> {
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
  zip.folder('xl')?.folder('worksheets')?.file('sheet1.xml', worksheetXml(sheetTitle, rows));

  return zip.generateAsync({
    type: 'uint8array',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
    mimeType: EXCEL_MIME_TYPE
  });
}

export async function downloadKpiExcelWorkbook(fileName: string, title: string, rows: readonly KpiExcelRow[]) {
  const bytes = await createKpiExcelWorkbook(title, rows);
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

function worksheetXml(title: string, rows: readonly KpiExcelRow[]) {
  const headerRow = 3;
  const firstDataRow = headerRow + 1;
  const lastRow = Math.max(headerRow, headerRow + rows.length);
  const headers = ['User Group', 'Use Case', 'Name', 'Description', 'Remaining Ambiguities', 'Performance Areas'];
  const widths = [24, 32, 34, 58, 58, 44];
  const columns = widths
    .map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`)
    .join('');
  const headerCells = headers
    .map((header, index) => stringCell(`${columnName(index + 1)}${headerRow}`, header, 3))
    .join('');
  const dataRows = rows.map((row, index) => {
    const rowNumber = firstDataRow + index;
    return `<row r="${rowNumber}" ht="45" customHeight="1">${[
      row.userGroup,
      row.useCase,
      row.name,
      row.description,
      row.note,
      row.performanceAreas
    ].map((value, columnIndex) => {
      const reference = `${columnName(columnIndex + 1)}${rowNumber}`;
      return columnIndex === 4 && row.noteMarkdown !== undefined
        ? richMarkdownCell(reference, row.noteMarkdown, 4)
        : stringCell(reference, value, 4);
    }).join('')}</row>`;
  }).join('');

  return xmlDocument(`<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="A1:F${lastRow}"/>
  <sheetViews><sheetView workbookViewId="0"><pane ySplit="3" topLeftCell="A4" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  <sheetFormatPr defaultRowHeight="15"/>
  <cols>${columns}</cols>
  <sheetData>
    <row r="1" ht="26" customHeight="1">${stringCell('A1', title, 1)}</row>
    <row r="2" ht="20" customHeight="1">${stringCell('A2', `${rows.length} filtered user group / use case entr${rows.length === 1 ? 'y' : 'ies'}`, 2)}</row>
    <row r="${headerRow}" ht="24" customHeight="1">${headerCells}</row>
    ${dataRows}
  </sheetData>
  <autoFilter ref="A${headerRow}:F${lastRow}"/>
  <mergeCells count="2"><mergeCell ref="A1:F1"/><mergeCell ref="A2:F2"/></mergeCells>
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
