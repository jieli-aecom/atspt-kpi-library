import { sourceTableUnit } from './types.js';
import { fieldSourceRows } from './fieldSourceSummary';
import { layoutTableRegions } from './tableDiagramLayout';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Download, Eye, Link2, Minus, Plus, RotateCcw, X } from 'lucide-react';
import type {
  DataSource,
  DataSourceField,
  DataSourceFieldDimension,
  KpiPoolConfig,
  TableRelation,
  TableSourceCategory
} from './types';
import type { SupportTarget } from './kpiSupport';
import { downloadTableSchemaExcelWorkbook } from './excelExport';

const CARD_HEADER_HEIGHT = 68;
const CARD_META_HEIGHT = 24;
const FIELD_ROW_HEIGHT = 28;
const GROUP_ROW_HEIGHT = 27;
const DIMENSION_LINE_HEIGHT = 16;
const EMPTY_ROW_HEIGHT = 34;
const CANVAS_PADDING = 48;
const DIAGRAM_TOP = 126;
const DEFAULT_ZOOM = 0.75;
const OUTER_CANVAS_MARGIN = 140;
const DRAG_AUTOSCROLL_EDGE = 42;
const DRAG_AUTOSCROLL_MAX_STEP = 18;

type DiagramRow =
  | { kind: 'field'; field: DataSourceField; grouped: boolean; height: number }
  | { kind: 'group'; id: string; label: string; height: number }
  | { kind: 'dimension'; id: string; dimension: DataSourceFieldDimension; lines: string[]; height: number }
  | { kind: 'empty'; height: number };

type DiagramTable = {
  source: DataSource;
  groupName: string;
  category: TableSourceCategory;
  rows: DiagramRow[];
  width: number;
  height: number;
  x: number;
  y: number;
  fieldY: Map<string, number>;
};

const shortened = (value: string, limit: number) => {
  const text = value.trim();
  return text.length > limit ? `${text.slice(0, Math.max(1, limit - 1))}…` : text;
};

const fieldTypeLabel = (field: DataSourceField) => {
  const type = field.dataType === 'collection'
    ? `${field.collectionItemType ?? 'value'}[]`
    : field.dataType;
  return field.valueUnit.trim() ? `${type} · ${field.valueUnit.trim()}` : type;
};

const groupedByLabel = (dimensions: DataSourceFieldDimension[]) => {
  const names = dimensions.map((dimension) => dimension.name.trim()).filter(Boolean);
  return `BY ${names.length ? names.join(' · ').toLocaleUpperCase() : 'CATEGORY'}`;
};

const dimensionLabel = (dimension: DataSourceFieldDimension) =>
  `${dimension.name.trim() || 'Category'} = ${dimension.options.length ? dimension.options.join(' · ') : 'no values defined'}`;

const wrapDimension = (label: string, width: number) => {
  const limit = Math.max(1, Math.floor((width - 40) / 10));
  const lines: string[] = [];
  let remaining = label;
  while (remaining.length > limit) {
    const space = remaining.lastIndexOf(' ', limit);
    const end = space > 0 ? space : limit;
    lines.push(remaining.slice(0, end));
    remaining = remaining.slice(end).trimStart();
  }
  if (remaining) lines.push(remaining);
  return lines;
};

const sourceSummaryText = (config: KpiPoolConfig, field: DataSourceField) => {
  const rows = fieldSourceRows(config, field);
  return rows.length ? `From: ${rows.map((row) => `${row.label} ${row.fields.map((source) => source.name).join(' \u00b7 ')}`).join(' and ')}` : '';
};

// Reserve enough space for natural wrapping, including long unbroken field names.
// Measuring all text in bold is conservative for the mixed-weight source line.
let sourceTextContext: CanvasRenderingContext2D | null | undefined;
const wrapSourceSummary = (value: string, width: number) => {
  sourceTextContext ??= document.createElement('canvas').getContext('2d');
  if (sourceTextContext) sourceTextContext.font = '700 10px Arial';
  const fits = (text: string) => (sourceTextContext?.measureText(text).width ?? text.length * 10) <= width;
  const lines: string[] = [];
  let line = '';
  for (const word of value.split(/\s+/).filter(Boolean)) {
    if (line && !fits(`${line} ${word}`)) { lines.push(line); line = ''; }
    if (fits(word)) { line = line ? `${line} ${word}` : word; continue; }
    for (const character of word) {
      if (line && !fits(line + character)) { lines.push(line); line = ''; }
      line += character;
    }
  }
  if (line) lines.push(line);
  return lines;
};

const fieldRowHeight = (config: KpiPoolConfig, field: DataSourceField, width: number) => FIELD_ROW_HEIGHT
  + wrapSourceSummary(sourceSummaryText(config, field), width - 32).length * 20;

const buildRows = (source: DataSource, width: number, config: KpiPoolConfig): DiagramRow[] => {
  const groupedFieldIds = new Set(source.fieldGroups.flatMap((group) => group.fieldIds));
  const rows: DiagramRow[] = [];
  for (let position = 0; position <= source.fields.length; position += 1) {
    source.fieldGroups
      .filter((group) => group.position === position)
      .forEach((group) => {
        rows.push({
          kind: 'group',
          id: group.id,
          label: groupedByLabel(group.dimensions),
          height: GROUP_ROW_HEIGHT
        });
        group.dimensions.forEach((original) => {
          const domain = config.valueEnums.find((entry) => entry.id === original.enumId);
          const dimension = domain ? { ...original, options: domain.options } : original;
          const lines = wrapDimension(dimensionLabel(dimension), width);
          rows.push({
            kind: 'dimension',
            id: `${group.id}:${dimension.id}`,
            dimension,
            lines,
            height: lines.length * DIMENSION_LINE_HEIGHT + 10
          });
        });
        group.fieldIds.forEach((fieldId) => {
          const field = source.fields.find((entry) => entry.id === fieldId);
          if (field) rows.push({ kind: 'field', field, grouped: true, height: fieldRowHeight(config, field, width) });
        });
      });
    const field = source.fields[position];
    if (field && !groupedFieldIds.has(field.id)) {
      rows.push({ kind: 'field', field, grouped: false, height: fieldRowHeight(config, field, width) });
    }
  }
  return rows.length ? rows : [{ kind: 'empty', height: EMPTY_ROW_HEIGHT }];
};

const tableWidth = (source: DataSource, groupName: string) => {
  const longestField = source.fields.reduce((length, field) => Math.max(length, field.name.trim().length), 0);
  const longestDimension = source.fieldGroups.flatMap((group) => group.dimensions)
    .reduce((length, dimension) => Math.max(length, dimension.name.trim().length + dimension.options.join(' · ').length), 0);
  const richness = Math.max(source.name.trim().length + 8, groupName.length + 8, longestField + 18, Math.min(longestDimension, 54));
  return Math.max(286, Math.min(374, 216 + richness * 2.35));
};

const buildDiagram = (config: KpiPoolConfig) => {
  const tableDrafts = config.dataSources.map((source) => {
    const groupName = config.dataSourceGroups.find((group) => group.itemIds.includes(source.id))?.name.trim() || '';
    const width = tableWidth(source, groupName);
    const rows = buildRows(source, width, config);
    return {
      source,
      groupName,
      category: config.dataSourceGroups.find((group) => group.itemIds.includes(source.id))?.category ?? source.category ?? 'Preprocessed Constants',
      rows,
      width,
      height: CARD_HEADER_HEIGHT + CARD_META_HEIGHT + rows.reduce((total, row) => total + row.height, 0),
      x: 0,
      y: 0,
      fieldY: new Map<string, number>()
    } satisfies DiagramTable;
  });
  const layout = layoutTableRegions(tableDrafts.map((table) => ({
    id: table.source.id, width: table.width, height: table.height, category: table.category,
    groupId: config.dataSourceGroups.find((group) => group.itemIds.includes(table.source.id))?.id
  })), config.dataSourceGroups);
  tableDrafts.forEach((table) => {
    const position = layout.positions.get(table.source.id)!;
    table.x = position.x;
    table.y = position.y;
    let rowYPosition = table.y + CARD_HEADER_HEIGHT + CARD_META_HEIGHT;
    table.rows.forEach((diagramRow) => {
      if (diagramRow.kind === 'field') table.fieldY.set(diagramRow.field.id, rowYPosition + FIELD_ROW_HEIGHT / 2);
      rowYPosition += diagramRow.height;
    });
  });
  return { tables: tableDrafts, regions: layout.regions, width: layout.width, height: layout.height };
};

const relationLabel = (relation: TableRelation) => relation.cardinality === 'oneToOne'
  ? '1 : 1'
  : relation.cardinality === 'manyToMany'
    ? 'N : N'
    : '1 : N';

const relationField = (table: DiagramTable, relation: TableRelation, sourceEnd: boolean) => {
  const generated = table.source.fields.find((field) => field.generatedRelationId === relation.id && (
    sourceEnd
      ? field.generatedRelationRole === 'oneCollection' || field.generatedRelationRole === 'sourceCollection'
      : field.generatedRelationRole === 'manyForeignKey' || field.generatedRelationRole === 'targetCollection'
  ));
  return generated ?? table.source.fields.find((field) => field.id === table.source.primaryKeyFieldId);
};

const downloadBlob = (blob: Blob, name: string) => {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
};

const serializedSvg = (svg: SVGSVGElement) => {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  // HTML inside an SVG taints the PNG canvas. Use portable SVG text for exports.
  clone.querySelectorAll<SVGForeignObjectElement>('foreignObject').forEach((object) => {
    const summary = object.querySelector('.diagram-field-summary');
    if (!summary) return;
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    const x = object.x.baseVal.value;
    const width = object.width.baseVal.value;
    let y = object.y.baseVal.value + 13;
    summary.querySelectorAll('.field-source-summary-row, .interactive-inline-formula').forEach((entry) => {
      const isSource = entry.classList.contains('field-source-summary-row');
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      const content = isSource
        ? entry.getAttribute('title') ?? entry.textContent ?? ''
        : entry.querySelector('.katex-html')?.textContent ?? entry.getAttribute('title') ?? '';
      text.setAttribute('x', String(x));
      text.setAttribute('y', String(y));
      text.setAttribute('font-size', '10');
      text.setAttribute('fill', isSource ? '#315f70' : '#223d47');
      const lines = isSource ? wrapSourceSummary(content, width) : [shortened(content, Math.floor(width / 6))];
      lines.forEach((line, index) => {
        const span = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
        span.setAttribute('x', String(x));
        span.setAttribute('dy', index ? '20' : '0');
        span.textContent = line;
        text.appendChild(span);
      });
      const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
      title.textContent = content;
      text.appendChild(title);
      group.appendChild(text);
      y += isSource ? lines.length * 20 : 44;
    });
    object.replaceWith(group);
  });
  clone.querySelectorAll('.diagram-support-control').forEach((control) => control.remove());
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', svg.viewBox.baseVal.width.toString());
  clone.setAttribute('height', svg.viewBox.baseVal.height.toString());
  return new XMLSerializer().serializeToString(clone);
};

const positionsFromDiagram = (diagram: ReturnType<typeof buildDiagram>) => Object.fromEntries(
  diagram.tables.map((table) => [table.source.id, { x: table.x, y: table.y }])
);

const supportButton = (x: number, y: number, target: SupportTarget, label: string, onViewSupport: (target: SupportTarget) => void) => (
  <foreignObject className="diagram-support-control" x={x} y={y} width="42" height="24" onPointerDown={(event) => event.stopPropagation()}>
    <button className="diagram-support-button" type="button" title={`View KPIs supported by ${label}`} aria-label={`View KPIs supported by ${label}`} onClick={(event) => { event.stopPropagation(); onViewSupport(target); }}><Eye size={13} aria-hidden="true" /></button>
  </foreignObject>
);

export function TableDiagram({ config, onClose, onViewSupport, renderFieldSummary }: { renderFieldSummary: (table: DataSource, field: DataSourceField) => ReactNode; config: KpiPoolConfig; onClose: () => void; onViewSupport: (target: SupportTarget) => void }) {
  const diagram = useMemo(() => buildDiagram(config), [config.dataSourceGroups, config.dataSources, config.tableRelations, config.valueEnums]);
  const [viewedDimension, setViewedDimension] = useState<DataSourceFieldDimension>();
  const domainDialogRef = useRef<HTMLDialogElement>(null);
  const viewedDomain = config.valueEnums.find((domain) => domain.id === viewedDimension?.enumId);
  useEffect(() => {
    const dialog = domainDialogRef.current;
    if (viewedDimension) dialog?.showModal();
    return () => { dialog?.close(); };
  }, [viewedDimension]);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [tablePositions, setTablePositions] = useState<Record<string, { x: number; y: number }>>(() => positionsFromDiagram(diagram));
  const [dragging, setDragging] = useState<{ tableId: string; pointerId: number; offsetX: number; offsetY: number }>();
  const [frontTableId, setFrontTableId] = useState<string>();
  const [hoveredRelationId, setHoveredRelationId] = useState<string>();
  const [selectedRelationId, setSelectedRelationId] = useState<string>();
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef<typeof dragging>();
  const dragPointerRef = useRef<{ clientX: number; clientY: number; dirty: boolean }>();
  const dragFrameRef = useRef<number>();
  const previousCanvasOriginRef = useRef({ x: 0, y: 0 });
  const svgId = 'current-source-table-diagram';
  const safeName = shortened(config.title || 'KPI source tables', 64).replace(/[^a-z0-9_-]+/gi, '-').replace(/^-|-$/g, '') || 'source-tables';
  const activeRelationId = hoveredRelationId ?? selectedRelationId;
  const activeRelation = config.tableRelations.find((relation) => relation.id === activeRelationId);
  const selectedRelation = config.tableRelations.find((relation) => relation.id === selectedRelationId);
  const activeTableIds = new Set(activeRelation ? [activeRelation.sourceDataSourceId, activeRelation.targetDataSourceId] : []);
  const orderedTables = frontTableId
    ? [...diagram.tables].sort((left, right) => Number(left.source.id === frontTableId) - Number(right.source.id === frontTableId))
    : diagram.tables;
  const canvasBounds = useMemo(() => {
    let minX = 0;
    let minY = 0;
    let maxX = diagram.width;
    let maxY = diagram.height;
    diagram.tables.forEach((table) => {
      const position = tablePositions[table.source.id] ?? { x: table.x, y: table.y };
      if (position.x < 20) minX = Math.min(minX, position.x - OUTER_CANVAS_MARGIN);
      if (position.y < DIAGRAM_TOP) minY = Math.min(minY, position.y - OUTER_CANVAS_MARGIN);
      if (position.x + table.width > diagram.width - 20) maxX = Math.max(maxX, position.x + table.width + OUTER_CANVAS_MARGIN);
      if (position.y + table.height > diagram.height - 20) maxY = Math.max(maxY, position.y + table.height + OUTER_CANVAS_MARGIN);
    });
    return { minX, minY, width: maxX - minX, height: maxY - minY };
  }, [diagram, tablePositions]);
  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const previous = previousCanvasOriginRef.current;
    if (viewport) {
      viewport.scrollLeft += (previous.x - canvasBounds.minX) * zoom;
      viewport.scrollTop += (previous.y - canvasBounds.minY) * zoom;
    }
    previousCanvasOriginRef.current = { x: canvasBounds.minX, y: canvasBounds.minY };
  }, [canvasBounds.minX, canvasBounds.minY, zoom]);
  useEffect(() => {
    setTablePositions((current) => Object.fromEntries(diagram.tables.map((table) => [
      table.source.id,
      current[table.source.id] ?? { x: table.x, y: table.y }
    ])));
  }, [diagram]);
  useEffect(() => {
    if (selectedRelationId && !config.tableRelations.some((relation) => relation.id === selectedRelationId)) {
      setSelectedRelationId(undefined);
    }
  }, [config.tableRelations, selectedRelationId]);
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !document.querySelector('.library-details-backdrop, .kpi-support-backdrop')) onClose();
    };
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [onClose]);
  useEffect(() => () => {
    if (dragFrameRef.current !== undefined) window.cancelAnimationFrame(dragFrameRef.current);
  }, []);
  const pointerPosition = (clientX: number, clientY: number) => {
    const svg = document.getElementById(svgId) as SVGSVGElement | null;
    const bounds = svg?.getBoundingClientRect();
    if (!bounds?.width || !bounds.height) return undefined;
    const viewBox = svg!.viewBox.baseVal;
    return {
      x: viewBox.x + (clientX - bounds.left) * viewBox.width / bounds.width,
      y: viewBox.y + (clientY - bounds.top) * viewBox.height / bounds.height
    };
  };
  const queueDragFrame = () => {
    if (dragFrameRef.current !== undefined) return;
    dragFrameRef.current = window.requestAnimationFrame(() => {
      dragFrameRef.current = undefined;
      const currentDragging = draggingRef.current;
      const currentPointer = dragPointerRef.current;
      if (!currentDragging || !currentPointer) return;
      const viewport = viewportRef.current;
      let scrollVelocityX = 0;
      let scrollVelocityY = 0;
      let scrolled = false;
      if (viewport) {
        const bounds = viewport.getBoundingClientRect();
        const edgeVelocity = (distance: number) => Math.min(DRAG_AUTOSCROLL_MAX_STEP, Math.max(0, distance / DRAG_AUTOSCROLL_EDGE * DRAG_AUTOSCROLL_MAX_STEP));
        if (currentPointer.clientX > bounds.right - DRAG_AUTOSCROLL_EDGE) scrollVelocityX = edgeVelocity(currentPointer.clientX - (bounds.right - DRAG_AUTOSCROLL_EDGE));
        else if (currentPointer.clientX < bounds.left + DRAG_AUTOSCROLL_EDGE) scrollVelocityX = -edgeVelocity(bounds.left + DRAG_AUTOSCROLL_EDGE - currentPointer.clientX);
        if (currentPointer.clientY > bounds.bottom - DRAG_AUTOSCROLL_EDGE) scrollVelocityY = edgeVelocity(currentPointer.clientY - (bounds.bottom - DRAG_AUTOSCROLL_EDGE));
        else if (currentPointer.clientY < bounds.top + DRAG_AUTOSCROLL_EDGE) scrollVelocityY = -edgeVelocity(bounds.top + DRAG_AUTOSCROLL_EDGE - currentPointer.clientY);
        const previousScrollLeft = viewport.scrollLeft;
        const previousScrollTop = viewport.scrollTop;
        viewport.scrollLeft += scrollVelocityX;
        viewport.scrollTop += scrollVelocityY;
        scrolled = viewport.scrollLeft !== previousScrollLeft || viewport.scrollTop !== previousScrollTop;
      }
      if (currentPointer.dirty || scrolled) {
        const pointer = pointerPosition(currentPointer.clientX, currentPointer.clientY);
        if (pointer) {
          setTablePositions((current) => ({
            ...current,
            [currentDragging.tableId]: {
              x: pointer.x - currentDragging.offsetX,
              y: pointer.y - currentDragging.offsetY
            }
          }));
        }
        currentPointer.dirty = false;
      }
      if (scrollVelocityX || scrollVelocityY) queueDragFrame();
    });
  };
  const relationTableDetails = (sourceId: string) => {
    const source = config.dataSources.find((entry) => entry.id === sourceId);
    if (!source) return { name: 'Missing table', groupName: '' };
    return {
      name: source.name || 'Untitled table',
      groupName: config.dataSourceGroups.find((group) => group.itemIds.includes(sourceId))?.name.trim() || ''
    };
  };
  const relationDescription = (relation: TableRelation) => {
    const tableName = (sourceId: string) => {
      const details = relationTableDetails(sourceId);
      return details.groupName ? `${details.groupName} ${details.name}` : details.name;
    };
    const sourceName = tableName(relation.sourceDataSourceId);
    const targetName = tableName(relation.targetDataSourceId);
    return `${sourceName} ${relationLabel(relation)} ${targetName}`;
  };
  const renderRelationTableLabel = (sourceId: string) => {
    const details = relationTableDetails(sourceId);
    return <span className="table-diagram-relation-table">
      {details.groupName ? <small>{details.groupName}</small> : null}
      <span>{details.name}</span>
    </span>;
  };
  const exportSvg = () => {
    const svg = document.getElementById(svgId) as SVGSVGElement | null;
    if (!svg) return;
    downloadBlob(new Blob([serializedSvg(svg)], { type: 'image/svg+xml;charset=utf-8' }), `${safeName}-diagram.svg`);
  };
  const exportPng = () => {
    const svg = document.getElementById(svgId) as SVGSVGElement | null;
    if (!svg) return;
    const image = new Image();
    const url = URL.createObjectURL(new Blob([serializedSvg(svg)], { type: 'image/svg+xml;charset=utf-8' }));
    image.onload = () => {
      const exportScale = Math.min(2, 12000 / Math.max(canvasBounds.width, canvasBounds.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(canvasBounds.width * exportScale));
      canvas.height = Math.max(1, Math.round(canvasBounds.height * exportScale));
      const context = canvas.getContext('2d');
      if (!context) return;
      context.scale(exportScale, exportScale);
      context.drawImage(image, 0, 0, canvasBounds.width, canvasBounds.height);
      canvas.toBlob((blob) => {
        if (blob) downloadBlob(blob, `${safeName}-diagram.png`);
        URL.revokeObjectURL(url);
      }, 'image/png');
    };
    image.onerror = () => URL.revokeObjectURL(url);
    image.src = url;
  };
  const exportExcel = () => downloadTableSchemaExcelWorkbook(`${safeName}-table-schema.xlsx`, config);

  return <div className="table-diagram-backdrop" role="presentation" onMouseDown={(event) => {
    if (event.target === event.currentTarget) onClose();
  }}>
    <section className="table-diagram-dialog" role="dialog" aria-modal="true" aria-label="Current source table diagram">
      <header className="table-diagram-toolbar">
        <div>
          <strong>Source table diagram</strong>
          <span>{config.dataSources.length} {config.dataSources.length === 1 ? 'table' : 'tables'} · {config.tableRelations.length} {config.tableRelations.length === 1 ? 'join' : 'joins'}</span>
        </div>
        <div className="table-diagram-actions">
          {selectedRelation ? <button className="table-diagram-selected-relation" type="button" title="Clear highlighted join" onClick={() => setSelectedRelationId(undefined)}>
            <Link2 size={12} />
            <span className="table-diagram-relation-description">{renderRelationTableLabel(selectedRelation.sourceDataSourceId)}<b>{relationLabel(selectedRelation)}</b>{renderRelationTableLabel(selectedRelation.targetDataSourceId)}</span>
            <X size={11} />
          </button> : <span className="table-diagram-interaction-hint">Drag tables · click joins</span>}
          <button className="secondary-action small table-diagram-reset" type="button" disabled={!config.dataSources.length} onClick={() => {
            setTablePositions(positionsFromDiagram(diagram));
            setSelectedRelationId(undefined);
            setFrontTableId(undefined);
          }}><RotateCcw size={13} /> Reset layout</button>
          <div className="table-diagram-zoom" aria-label="Diagram zoom controls">
            <button className="mini-icon-button" type="button" title="Zoom out" aria-label="Zoom out" disabled={zoom <= 0.5} onClick={() => setZoom((current) => Math.max(0.5, current - 0.1))}><Minus size={13} /></button>
            <button type="button" title="Reset zoom" onClick={() => setZoom(DEFAULT_ZOOM)}>{Math.round(zoom * 100)}%</button>
            <button className="mini-icon-button" type="button" title="Zoom in" aria-label="Zoom in" disabled={zoom >= 1.5} onClick={() => setZoom((current) => Math.min(1.5, current + 0.1))}><Plus size={13} /></button>
          </div>
          <button className="secondary-action small" type="button" disabled={!config.dataSources.length} onClick={exportExcel}><Download size={13} /> Export Excel</button>
          <button className="secondary-action small" type="button" disabled={!config.dataSources.length} onClick={exportSvg}><Download size={13} /> Export SVG</button>
          <button className="primary-action small" type="button" disabled={!config.dataSources.length} onClick={exportPng}><Download size={13} /> Export PNG</button>
          <button className="mini-icon-button table-diagram-close" type="button" aria-label="Close source table diagram" title="Close" onClick={onClose}><X size={16} /></button>
        </div>
      </header>
      <div className="table-diagram-viewport" ref={viewportRef}>
        <div className="table-diagram-stage" style={{ width: canvasBounds.width * zoom, height: canvasBounds.height * zoom }}>
          <svg
            id={svgId}
            className="table-diagram-svg"
            viewBox={`${canvasBounds.minX} ${canvasBounds.minY} ${canvasBounds.width} ${canvasBounds.height}`}
            width={canvasBounds.width}
            height={canvasBounds.height}
            style={{ transform: `scale(${zoom})` }}
            role="group"
            aria-label="Entity relationship diagram of the current source tables"
          >
            <rect x={canvasBounds.minX} y={canvasBounds.minY} width={canvasBounds.width} height={canvasBounds.height} fill="#f5f8f9" onClick={() => setSelectedRelationId(undefined)} />
            <text x={CANVAS_PADDING} y="46" fill="#183642" fontSize="24" fontWeight="800">Source table diagram</text>
            <text x={CANVAS_PADDING} y="70" fill="#60727a" fontSize="12">Drag a table to untangle joins · hover or click a join to highlight it</text>
            <g transform={`translate(${CANVAS_PADDING}, 88)`} fontFamily="Inter, Segoe UI, Arial, sans-serif" fontSize="10" fill="#435861">
              <g><rect width="31" height="18" rx="4" fill="#f5e9bd" stroke="#b88b13" /><text x="7" y="13" fontWeight="800">PK</text></g>
              <g transform="translate(47,0)"><rect width="66" height="18" rx="4" fill="#e3f2ee" stroke="#3d7e6c" strokeDasharray="4 2" /><text x="8" y="13" fontWeight="700">VIRTUAL</text></g>
              <g transform="translate(129,0)"><rect width="91" height="18" rx="4" fill="#fff0ed" stroke="#c85a50" /><circle cx="10" cy="9" r="3" fill="#c85a50" /><text x="18" y="13">Preprocess</text></g>
              <g transform="translate(236,0)"><rect width="101" height="18" rx="4" fill="#f0eafa" stroke="#8062a8" /><text x="8" y="13">Grouped fields</text></g>
              <g transform="translate(354,0)"><path d="M0 9H31" stroke="#456c7b" strokeWidth="1.5" /><path d="M1 4V14M5 4V14M30 9L21 4M30 9L21 9M30 9L21 14" stroke="#456c7b" strokeWidth="1.5" fill="none" /><text x="39" y="13">1:N join</text></g>
            </g>
            <defs>
              <filter id="table-shadow" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="3" stdDeviation="5" floodColor="#17333d" floodOpacity="0.13" /></filter>
              <marker id="relation-one-start" markerWidth="13" markerHeight="13" refX="2" refY="6.5" orient="auto-start-reverse" markerUnits="userSpaceOnUse"><path d="M2 1V12M6 1V12" stroke="#456c7b" strokeWidth="1.5" fill="none" /></marker>
              <marker id="relation-one-end" markerWidth="13" markerHeight="13" refX="11" refY="6.5" orient="auto" markerUnits="userSpaceOnUse"><path d="M7 1V12M11 1V12" stroke="#456c7b" strokeWidth="1.5" fill="none" /></marker>
              <marker id="relation-many-start" markerWidth="15" markerHeight="15" refX="1" refY="7.5" orient="auto-start-reverse" markerUnits="userSpaceOnUse"><path d="M1 7.5L12 1M1 7.5H12M1 7.5L12 14" stroke="#456c7b" strokeWidth="1.5" fill="none" /></marker>
              <marker id="relation-many-end" markerWidth="15" markerHeight="15" refX="14" refY="7.5" orient="auto" markerUnits="userSpaceOnUse"><path d="M14 7.5L3 1M14 7.5H3M14 7.5L3 14" stroke="#456c7b" strokeWidth="1.5" fill="none" /></marker>
              <marker id="relation-one-start-highlight" markerWidth="13" markerHeight="13" refX="2" refY="6.5" orient="auto-start-reverse" markerUnits="userSpaceOnUse"><path d="M2 1V12M6 1V12" stroke="#d75a32" strokeWidth="2.4" fill="none" /></marker>
              <marker id="relation-one-end-highlight" markerWidth="13" markerHeight="13" refX="11" refY="6.5" orient="auto" markerUnits="userSpaceOnUse"><path d="M7 1V12M11 1V12" stroke="#d75a32" strokeWidth="2.4" fill="none" /></marker>
              <marker id="relation-many-start-highlight" markerWidth="15" markerHeight="15" refX="1" refY="7.5" orient="auto-start-reverse" markerUnits="userSpaceOnUse"><path d="M1 7.5L12 1M1 7.5H12M1 7.5L12 14" stroke="#d75a32" strokeWidth="2.4" fill="none" /></marker>
              <marker id="relation-many-end-highlight" markerWidth="15" markerHeight="15" refX="14" refY="7.5" orient="auto" markerUnits="userSpaceOnUse"><path d="M14 7.5L3 1M14 7.5H3M14 7.5L3 14" stroke="#d75a32" strokeWidth="2.4" fill="none" /></marker>
            </defs>
            {!diagram.tables.length ? <g transform="translate(380,224)" textAnchor="middle"><text fill="#4f6670" fontSize="17" fontWeight="700">No source tables to diagram</text><text y="27" fill="#788990" fontSize="12">Add a source table, then reopen this view.</text></g> : null}
            <g className="table-diagram-regions" pointerEvents="none">
              {diagram.regions.map((region) => <g key={`${region.kind}:${region.id}`}>
                <rect x={region.x} y={region.y} width={region.width} height={region.height} rx={region.kind === 'category' ? 16 : 10} fill={region.kind === 'category' ? '#e8eff3' : '#f7fafb'} stroke={region.kind === 'category' ? '#b9cbd5' : '#cbd8df'} strokeDasharray={region.kind === 'group' ? '5 4' : undefined} />
                <text x={region.x + 20} y={region.y + 28} fill="#315f70" fontSize={region.kind === 'category' ? 18 : 13} fontWeight="700">{shortened(region.label, Math.floor((region.width - 40) / (region.kind === 'category' ? 10 : 8)))}<title>{region.label}</title></text>
              </g>)}
            </g>
            <g className="table-diagram-relations">
              {config.tableRelations.map((relation, relationIndex) => {
                const source = diagram.tables.find((table) => table.source.id === relation.sourceDataSourceId);
                const target = diagram.tables.find((table) => table.source.id === relation.targetDataSourceId);
                if (!source || !target) return null;
                const sourcePosition = tablePositions[source.source.id] ?? { x: source.x, y: source.y };
                const targetPosition = tablePositions[target.source.id] ?? { x: target.x, y: target.y };
                const sourceDeltaY = sourcePosition.y - source.y;
                const targetDeltaY = targetPosition.y - target.y;
                const sourceField = relationField(source, relation, true);
                const targetField = relationField(target, relation, false);
                const sourceY = (sourceField ? source.fieldY.get(sourceField.id) ?? source.y + CARD_HEADER_HEIGHT : source.y + CARD_HEADER_HEIGHT) + sourceDeltaY;
                const targetY = (targetField ? target.fieldY.get(targetField.id) ?? target.y + CARD_HEADER_HEIGHT : target.y + CARD_HEADER_HEIGHT) + targetDeltaY;
                const targetToRight = targetPosition.x >= sourcePosition.x + source.width / 2;
                const horizontallySeparated = Math.abs((sourcePosition.x + source.width / 2) - (targetPosition.x + target.width / 2)) > Math.min(source.width, target.width) * 0.6;
                let startX: number;
                let startY: number;
                let endX: number;
                let endY: number;
                let path: string;
                if (horizontallySeparated) {
                  startX = targetToRight ? sourcePosition.x + source.width + 8 : sourcePosition.x - 8;
                  endX = targetToRight ? targetPosition.x - 8 : targetPosition.x + target.width + 8;
                  startY = sourceY;
                  endY = targetY;
                  const bend = Math.max(46, Math.abs(endX - startX) * 0.42);
                  path = `M${startX} ${startY} C${startX + (targetToRight ? bend : -bend)} ${startY},${endX + (targetToRight ? -bend : bend)} ${endY},${endX} ${endY}`;
                } else {
                  const targetBelow = targetPosition.y > sourcePosition.y;
                  startX = sourcePosition.x + source.width / 2 + ((relationIndex % 3) - 1) * 18;
                  endX = targetPosition.x + target.width / 2 + ((relationIndex % 3) - 1) * 18;
                  startY = targetBelow ? sourcePosition.y + source.height + 8 : sourcePosition.y - 8;
                  endY = targetBelow ? targetPosition.y - 8 : targetPosition.y + target.height + 8;
                  const bend = Math.max(40, Math.abs(endY - startY) * 0.42);
                  path = `M${startX} ${startY} C${startX} ${startY + (targetBelow ? bend : -bend)},${endX} ${endY + (targetBelow ? -bend : bend)},${endX} ${endY}`;
                }
                const manyAtStart = relation.cardinality === 'manyToMany';
                const manyAtEnd = relation.cardinality !== 'oneToOne';
                const midX = (startX + endX) / 2;
                const midY = (startY + endY) / 2;
                const highlighted = activeRelationId === relation.id;
                const muted = Boolean(activeRelationId && !highlighted);
                const markerVariant = highlighted ? '-highlight' : '';
                return <g
                  key={relation.id}
                  className={`table-diagram-relation ${highlighted ? 'is-highlighted' : ''} ${muted ? 'is-muted' : ''}`}
                  role="button"
                  tabIndex={0}
                  aria-label={`${relationDescription(relation)} join`}
                  aria-pressed={selectedRelationId === relation.id}
                  onPointerEnter={() => setHoveredRelationId(relation.id)}
                  onPointerLeave={() => setHoveredRelationId((current) => current === relation.id ? undefined : current)}
                  onFocus={() => setHoveredRelationId(relation.id)}
                  onBlur={() => setHoveredRelationId((current) => current === relation.id ? undefined : current)}
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelectedRelationId((current) => current === relation.id ? undefined : relation.id);
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter' && event.key !== ' ') return;
                    event.preventDefault();
                    setSelectedRelationId((current) => current === relation.id ? undefined : relation.id);
                  }}
                >
                  <title>{relationDescription(relation)}</title>
                  <path className="table-diagram-relation-hit" d={path} fill="none" stroke="transparent" strokeWidth="18" />
                  <path d={path} fill="none" stroke="#f5f8f9" strokeWidth={highlighted ? 9 : 7} />
                  <path d={path} fill="none" stroke={highlighted ? '#d75a32' : '#456c7b'} strokeWidth={highlighted ? 3.1 : 1.7} markerStart={`url(#relation-${manyAtStart ? 'many' : 'one'}-start${markerVariant})`} markerEnd={`url(#relation-${manyAtEnd ? 'many' : 'one'}-end${markerVariant})`} />
                  <rect x={midX - 22} y={midY - 11} width="44" height="22" rx="11" fill={highlighted ? '#fff0e9' : '#ffffff'} stroke={highlighted ? '#d75a32' : '#9aabb2'} strokeWidth={highlighted ? 2 : 1} />
                  <text x={midX} y={midY + 3.5} textAnchor="middle" fill={highlighted ? '#a83f20' : '#344f5a'} fontSize="10" fontWeight="800">{relationLabel(relation)}</text>
                </g>;
              })}
            </g>
            <g className="table-diagram-tables">
              {orderedTables.map((table) => {
                const position = tablePositions[table.source.id] ?? { x: table.x, y: table.y };
                const deltaX = position.x - table.x;
                const deltaY = position.y - table.y;
                const relatedToActive = activeTableIds.has(table.source.id);
                const muted = Boolean(activeRelationId && !relatedToActive);
                const groupBadgeLabel = table.groupName
                  ? shortened(table.groupName, Math.floor((table.width - 58) / 5.2))
                  : '';
                const groupBadgeWidth = groupBadgeLabel
                  ? Math.min(table.width - 48, Math.max(34, groupBadgeLabel.length * 5.2 + 14))
                  : 0;
                let rowTop = table.y + CARD_HEADER_HEIGHT + CARD_META_HEIGHT;
                return <g
                  key={table.source.id}
                  data-table-id={table.source.id}
                  className={`table-diagram-table ${dragging?.tableId === table.source.id ? 'is-dragging' : ''} ${relatedToActive ? 'is-related' : ''} ${muted ? 'is-muted' : ''}`}
                  fontFamily="Inter, Segoe UI, Arial, sans-serif"
                  transform={`translate(${deltaX} ${deltaY})`}
                  onPointerDown={(event) => {
                    if (event.button !== 0) return;
                    const pointer = pointerPosition(event.clientX, event.clientY);
                    if (!pointer) return;
                    event.stopPropagation();
                    event.currentTarget.setPointerCapture(event.pointerId);
                    setFrontTableId(table.source.id);
                    const nextDragging = { tableId: table.source.id, pointerId: event.pointerId, offsetX: pointer.x - position.x, offsetY: pointer.y - position.y };
                    draggingRef.current = nextDragging;
                    dragPointerRef.current = { clientX: event.clientX, clientY: event.clientY, dirty: false };
                    setDragging(nextDragging);
                  }}
                  onPointerMove={(event) => {
                    const currentDragging = draggingRef.current;
                    if (!currentDragging || currentDragging.tableId !== table.source.id || currentDragging.pointerId !== event.pointerId) return;
                    dragPointerRef.current = { clientX: event.clientX, clientY: event.clientY, dirty: true };
                    queueDragFrame();
                  }}
                  onPointerUp={(event) => {
                    const currentDragging = draggingRef.current;
                    if (currentDragging?.pointerId !== event.pointerId) return;
                    const pointer = pointerPosition(event.clientX, event.clientY);
                    if (pointer) setTablePositions((current) => ({ ...current, [currentDragging.tableId]: { x: pointer.x - currentDragging.offsetX, y: pointer.y - currentDragging.offsetY } }));
                    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
                    if (dragFrameRef.current !== undefined) window.cancelAnimationFrame(dragFrameRef.current);
                    dragFrameRef.current = undefined;
                    draggingRef.current = undefined;
                    dragPointerRef.current = undefined;
                    setDragging(undefined);
                  }}
                  onPointerCancel={() => {
                    if (dragFrameRef.current !== undefined) window.cancelAnimationFrame(dragFrameRef.current);
                    dragFrameRef.current = undefined;
                    draggingRef.current = undefined;
                    dragPointerRef.current = undefined;
                    setDragging(undefined);
                  }}
                >
                  <rect x={table.x} y={table.y} width={table.width} height={table.height} rx="10" fill="#ffffff" stroke={relatedToActive ? '#d75a32' : '#b8c8cf'} strokeWidth={relatedToActive ? 2.5 : 1} filter="url(#table-shadow)" />
                  <path d={`M${table.x + 10} ${table.y}H${table.x + table.width - 10}Q${table.x + table.width} ${table.y} ${table.x + table.width} ${table.y + 10}V${table.y + CARD_HEADER_HEIGHT}H${table.x}V${table.y + 10}Q${table.x} ${table.y} ${table.x + 10} ${table.y}`} fill="#315f70" />
                  <text x={table.x + 15} y={table.y + 14} fill="#d8e8ee" fontSize="10" fontWeight="700">{table.category}</text>
                  {table.groupName ? <g><title>{table.groupName}</title><rect x={table.x + 14} y={table.y + 22} width={groupBadgeWidth} height="13" rx="6.5" fill="#d9e9ee" /><text x={table.x + 21} y={table.y + 31.5} fill="#315f70" fontSize="8" fontWeight="800">{groupBadgeLabel}</text></g> : null}
                  <text x={table.x + 15} y={table.y + (table.groupName ? 47 : 41)} fill="#ffffff" fontSize={table.groupName ? 14 : 15} fontWeight="800">{shortened(table.source.name || 'Untitled table', Math.floor((table.width - 90) / 8))}</text>
                  <text x={table.x + 15} y={table.y + (table.groupName ? 61 : 58)} fill="#d8e8ee" fontSize={table.groupName ? 9.5 : 10.5}>{table.source.fields.length} {table.source.fields.length === 1 ? 'field' : 'fields'} · {sourceTableUnit(table.source) || 'No spatial unit'}</text>
                  {supportButton(table.x + table.width - 70, table.y + 32, { dataSourceId: table.source.id }, table.source.name || 'table', onViewSupport)}
                  <g className="table-diagram-drag-handle" aria-hidden="true">
                    {[0, 1, 2].flatMap((row) => [0, 1].map((column) => <circle key={`${row}:${column}`} cx={table.x + table.width - 17 + column * 5} cy={table.y + 34 + row * 5} r="1.25" fill="#d8e8ee" />))}
                  </g>
                  <rect x={table.x} y={table.y + CARD_HEADER_HEIGHT} width={table.width} height={CARD_META_HEIGHT} fill="#edf3f5" />
                  <text x={table.x + 12} y={table.y + CARD_HEADER_HEIGHT + 16} fill="#60747d" fontSize="9.5" fontWeight="700">FIELD</text>
                  <text x={table.x + table.width - 58} y={table.y + CARD_HEADER_HEIGHT + 16} textAnchor="end" fill="#60747d" fontSize="9.5" fontWeight="700">TYPE / UNIT</text>
                  {table.rows.map((row, rowIndex) => {
                    const y = rowTop;
                    rowTop += row.height;
                    if (row.kind === 'empty') return <g key="empty">
                      <line x1={table.x} y1={y} x2={table.x + table.width} y2={y} stroke="#dce5e9" />
                      <text x={table.x + table.width / 2} y={y + 21} textAnchor="middle" fill="#89989e" fontSize="11">No fields</text>
                    </g>;
                    if (row.kind === 'group') return <g key={`group:${row.id}`}>
                      <rect x={table.x + 1} y={y} width={table.width - 2} height={row.height} fill="#f0eafa" />
                      <rect x={table.x + 1} y={y} width="4" height={row.height} fill="#8062a8" />
                      <text x={table.x + 13} y={y + 18} fill="#684b91" fontSize="9.5" fontWeight="800" letterSpacing="0.6"><title>{row.label}</title>{shortened(row.label, Math.floor((table.width - 26) / 6))}</text>
                    </g>;
                    if (row.kind === 'dimension') {
                      const label = dimensionLabel(row.dimension);
                      return <g key={`dimension:${row.id}`} className="diagram-dimension" role="button" tabIndex={0}
                        aria-label={`View domain: ${label}`} aria-haspopup="dialog"
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={() => setViewedDimension(row.dimension)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            event.stopPropagation();
                            setViewedDimension(row.dimension);
                          }
                        }}>
                        <rect x={table.x + 1} y={y} width={table.width - 2} height={row.height} fill="#f8f4fd" />
                        <rect x={table.x + 1} y={y} width="4" height={row.height} fill="#8062a8" />
                        <circle cx={table.x + 17} cy={y + row.height / 2} r="3" fill="#8062a8" />
                        <text x={table.x + 27} y={y + 16} fill="#665778" fontSize="10"><title>{label} — Click to view domain</title>{row.lines.map((line, index) => <tspan key={index} x={table.x + 27} dy={index ? DIMENSION_LINE_HEIGHT : 0}>{line}</tspan>)}</text>
                      </g>;
                    }
                    const field = row.field;
                    const isPrimary = field.id === table.source.primaryKeyFieldId;
                    const isVirtual = Boolean(field.generatedRelationId);
                    const needsPreprocessing = field.preprocessingNeeded || Boolean(field.details.trim());
                    const rowFill = needsPreprocessing ? '#fff0ed' : isVirtual ? '#eaf6f2' : row.grouped ? '#fbf9fe' : '#ffffff';
                    const nameX = table.x + 12;
                    const markerWidth = (isPrimary ? 22 : 0) + (isVirtual ? 15 : 0) + (needsPreprocessing ? 15 : 0);
                    const nameLimit = Math.max(4, Math.floor((table.width * 0.75 - 78 - markerWidth) / 6.2));
                    return <g key={`field:${field.id}`}>
                      <rect x={table.x + 1} y={y} width={table.width - 2} height={row.height} fill={rowFill} />
                      {row.grouped ? <rect x={table.x + 1} y={y} width="4" height={row.height} fill="#b4a0cc" /> : null}
                      {isVirtual ? <rect x={table.x + 5} y={y + 3} width={table.width - 10} height={row.height - 6} rx="4" fill="none" stroke="#4c927f" strokeDasharray="4 3" /> : null}
                      {needsPreprocessing ? <rect x={table.x + 1} y={y} width="4" height={row.height} fill="#c85a50" /> : null}
                      <text x={nameX} y={y + 18} fill="#223d47" fontSize="11" fontWeight={isPrimary ? 750 : 600}>
                        <title>{field.name || 'Untitled field'}</title>
                        <tspan>{shortened(field.name || 'Untitled field', nameLimit)}</tspan>
                        {isPrimary ? <tspan dx="6" fill="#76580b" fontSize="8.5" fontWeight="900"><title>Primary key</title>PK</tspan> : null}
                        {isVirtual ? <tspan dx="6" fill="#397562" fontSize="8" fontWeight="900"><title>Virtual field</title>V</tspan> : null}
                        {needsPreprocessing ? <tspan dx="6" fill="#c85a50" fontSize="10"><title>Preprocessing needed</title>{'\u25cf'}</tspan> : null}
                      </text>
                      <text x={table.x + table.width - 58} y={y + 18} textAnchor="end" fill={isVirtual ? '#397562' : '#60747d'} fontSize="9.5" fontStyle={isVirtual ? 'italic' : 'normal'}><title>{fieldTypeLabel(field)}</title>{shortened(fieldTypeLabel(field), Math.floor((table.width * 0.25) / 5.5))}</text>
                      {row.height > FIELD_ROW_HEIGHT ? <foreignObject x={table.x + 20} y={y + FIELD_ROW_HEIGHT} width={table.width - 32} height={row.height - FIELD_ROW_HEIGHT}
                        onPointerDown={(event) => event.stopPropagation()}>
                        <div className="diagram-field-summary">{renderFieldSummary(table.source, field)}</div>
                      </foreignObject> : null}
                      {supportButton(table.x + table.width - 48, y + 2, { dataSourceId: table.source.id, fieldId: field.id }, `${table.source.name} — ${field.name}`, onViewSupport)}
                      <line x1={table.x + 1} y1={y + row.height} x2={table.x + table.width - 1} y2={y + row.height} stroke="#e2e9ec" />
                    </g>;
                  })}
                </g>;
              })}
            </g>
          </svg>
        </div>
      </div>
    </section>
    {viewedDimension ? <dialog ref={domainDialogRef} className="diagram-domain-dialog" aria-labelledby="diagram-domain-title"
      onKeyDown={(event) => event.stopPropagation()}
      onCancel={(event) => { event.preventDefault(); setViewedDimension(undefined); }}>
      <header><div><strong id="diagram-domain-title">{viewedDomain?.name || viewedDimension.name || 'Custom domain'}</strong><small>{viewedDomain ? 'Global domain' : 'Custom dimension domain'} · Read only</small></div>
        <button autoFocus className="mini-icon-button" type="button" aria-label="Close domain details" onClick={() => setViewedDimension(undefined)}><X size={16} /></button>
      </header>
      <h3>Options</h3>
      {(viewedDomain?.options ?? viewedDimension.options).length ? <ul>{(viewedDomain?.options ?? viewedDimension.options).map((option, index) => <li key={index}>{option}</li>)}</ul> : <p>No options defined.</p>}
      <h3>Notes</h3><p className="diagram-domain-notes">{viewedDomain?.notes || 'No notes.'}</p>
    </dialog> : null}
  </div>;
}
