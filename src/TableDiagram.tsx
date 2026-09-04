import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Download, Link2, Minus, Plus, RotateCcw, X } from 'lucide-react';
import type {
  DataSource,
  DataSourceField,
  DataSourceFieldDimension,
  KpiPoolConfig,
  TableRelation
} from './types';

const CARD_GAP_X = 92;
const CARD_GAP_Y = 78;
const CARD_HEADER_HEIGHT = 50;
const CARD_META_HEIGHT = 24;
const FIELD_ROW_HEIGHT = 28;
const GROUP_ROW_HEIGHT = 27;
const DIMENSION_ROW_HEIGHT = 23;
const EMPTY_ROW_HEIGHT = 34;
const CANVAS_PADDING = 48;
const DIAGRAM_TOP = 126;
const OUTER_CANVAS_MARGIN = 140;
const DRAG_AUTOSCROLL_EDGE = 42;
const DRAG_AUTOSCROLL_MAX_STEP = 18;

type DiagramRow =
  | { kind: 'field'; field: DataSourceField; grouped: boolean; height: number }
  | { kind: 'group'; id: string; label: string; height: number }
  | { kind: 'dimension'; id: string; dimension: DataSourceFieldDimension; height: number }
  | { kind: 'empty'; height: number };

type DiagramTable = {
  source: DataSource;
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

const buildRows = (source: DataSource): DiagramRow[] => {
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
        group.dimensions.forEach((dimension) => rows.push({
          kind: 'dimension',
          id: `${group.id}:${dimension.id}`,
          dimension,
          height: DIMENSION_ROW_HEIGHT
        }));
        group.fieldIds.forEach((fieldId) => {
          const field = source.fields.find((entry) => entry.id === fieldId);
          if (field) rows.push({ kind: 'field', field, grouped: true, height: FIELD_ROW_HEIGHT });
        });
      });
    const field = source.fields[position];
    if (field && !groupedFieldIds.has(field.id)) {
      rows.push({ kind: 'field', field, grouped: false, height: FIELD_ROW_HEIGHT });
    }
  }
  return rows.length ? rows : [{ kind: 'empty', height: EMPTY_ROW_HEIGHT }];
};

const tableWidth = (source: DataSource) => {
  const longestField = source.fields.reduce((length, field) => Math.max(length, field.name.trim().length), 0);
  const longestDimension = source.fieldGroups.flatMap((group) => group.dimensions)
    .reduce((length, dimension) => Math.max(length, dimension.name.trim().length + dimension.options.join(' · ').length), 0);
  const richness = Math.max(source.name.trim().length + 8, longestField + 18, Math.min(longestDimension, 54));
  return Math.max(286, Math.min(374, 216 + richness * 2.35));
};

const connectedOrder = (sources: DataSource[], relations: TableRelation[]) => {
  const sourceIds = new Set(sources.map((source) => source.id));
  const neighbors = new Map(sources.map((source) => [source.id, new Set<string>()]));
  relations.forEach((relation) => {
    if (!sourceIds.has(relation.sourceDataSourceId) || !sourceIds.has(relation.targetDataSourceId)) return;
    neighbors.get(relation.sourceDataSourceId)?.add(relation.targetDataSourceId);
    neighbors.get(relation.targetDataSourceId)?.add(relation.sourceDataSourceId);
  });
  const sourceIndex = new Map(sources.map((source, index) => [source.id, index]));
  const remaining = new Set(sources.map((source) => source.id));
  const components: string[][] = [];
  while (remaining.size) {
    const seed = [...remaining].sort((left, right) =>
      (neighbors.get(right)?.size ?? 0) - (neighbors.get(left)?.size ?? 0) ||
      (sourceIndex.get(left) ?? 0) - (sourceIndex.get(right) ?? 0)
    )[0];
    const queue = [seed];
    const component: string[] = [];
    remaining.delete(seed);
    while (queue.length) {
      const current = queue.shift()!;
      component.push(current);
      [...(neighbors.get(current) ?? [])]
        .filter((id) => remaining.has(id))
        .sort((left, right) => (neighbors.get(right)?.size ?? 0) - (neighbors.get(left)?.size ?? 0))
        .forEach((id) => {
          remaining.delete(id);
          queue.push(id);
        });
    }
    components.push(component);
  }
  components.sort((left, right) => right.length - left.length);
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  return components.flatMap((component) => component.map((id) => sourceById.get(id)!));
};

const buildDiagram = (config: KpiPoolConfig) => {
  const orderedSources = connectedOrder(config.dataSources, config.tableRelations);
  const tableDrafts = orderedSources.map((source) => {
    const rows = buildRows(source);
    return {
      source,
      rows,
      width: tableWidth(source),
      height: CARD_HEADER_HEIGHT + CARD_META_HEIGHT + rows.reduce((total, row) => total + row.height, 0),
      x: 0,
      y: 0,
      fieldY: new Map<string, number>()
    } satisfies DiagramTable;
  });
  if (!tableDrafts.length) {
    return { tables: tableDrafts, width: 760, height: 410 };
  }
  const columns = Math.max(1, Math.min(5, Math.ceil(Math.sqrt(tableDrafts.length * 1.35))));
  const rowCount = Math.ceil(tableDrafts.length / columns);
  const placements = tableDrafts.map((_, index) => {
    const row = Math.floor(index / columns);
    const indexInRow = index % columns;
    const tablesInRow = Math.min(columns, tableDrafts.length - row * columns);
    return { row, column: indexInRow + Math.floor((columns - tablesInRow) / 2) };
  });
  const columnWidths = Array.from({ length: columns }, (_, column) => Math.max(
    ...tableDrafts.filter((_, index) => placements[index].column === column).map((table) => table.width),
    0
  ));
  const rowHeights = Array.from({ length: rowCount }, (_, row) => Math.max(
    ...tableDrafts.filter((_, index) => placements[index].row === row).map((table) => table.height),
    0
  ));
  const columnX = columnWidths.map((_, column) => CANVAS_PADDING + columnWidths.slice(0, column).reduce((sum, width) => sum + width, 0) + column * CARD_GAP_X);
  const rowY = rowHeights.map((_, row) => DIAGRAM_TOP + rowHeights.slice(0, row).reduce((sum, height) => sum + height, 0) + row * CARD_GAP_Y);
  tableDrafts.forEach((table, index) => {
    const { column, row } = placements[index];
    table.x = columnX[column] + (columnWidths[column] - table.width) / 2;
    table.y = rowY[row];
    let rowYPosition = table.y + CARD_HEADER_HEIGHT + CARD_META_HEIGHT;
    table.rows.forEach((diagramRow) => {
      if (diagramRow.kind === 'field') table.fieldY.set(diagramRow.field.id, rowYPosition + diagramRow.height / 2);
      rowYPosition += diagramRow.height;
    });
  });
  const width = CANVAS_PADDING * 2 + columnWidths.reduce((sum, value) => sum + value, 0) + (columns - 1) * CARD_GAP_X;
  const height = DIAGRAM_TOP + rowHeights.reduce((sum, value) => sum + value, 0) + (rowCount - 1) * CARD_GAP_Y + CANVAS_PADDING;
  return { tables: tableDrafts, width, height };
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
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', svg.viewBox.baseVal.width.toString());
  clone.setAttribute('height', svg.viewBox.baseVal.height.toString());
  return new XMLSerializer().serializeToString(clone);
};

const positionsFromDiagram = (diagram: ReturnType<typeof buildDiagram>) => Object.fromEntries(
  diagram.tables.map((table) => [table.source.id, { x: table.x, y: table.y }])
);

export function TableDiagram({ config, onClose }: { config: KpiPoolConfig; onClose: () => void }) {
  const diagram = useMemo(() => buildDiagram(config), [config.dataSources, config.tableRelations]);
  const [zoom, setZoom] = useState(1);
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
      if (event.key === 'Escape') onClose();
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
  const relationDescription = (relation: TableRelation) => {
    const sourceName = config.dataSources.find((source) => source.id === relation.sourceDataSourceId)?.name || 'Missing table';
    const targetName = config.dataSources.find((source) => source.id === relation.targetDataSourceId)?.name || 'Missing table';
    return `${sourceName} ${relationLabel(relation)} ${targetName}`;
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
            <span>{relationDescription(selectedRelation)}</span>
            <X size={11} />
          </button> : <span className="table-diagram-interaction-hint">Drag tables · click joins</span>}
          <button className="secondary-action small table-diagram-reset" type="button" disabled={!config.dataSources.length} onClick={() => {
            setTablePositions(positionsFromDiagram(diagram));
            setSelectedRelationId(undefined);
            setFrontTableId(undefined);
          }}><RotateCcw size={13} /> Reset layout</button>
          <div className="table-diagram-zoom" aria-label="Diagram zoom controls">
            <button className="mini-icon-button" type="button" title="Zoom out" aria-label="Zoom out" disabled={zoom <= 0.5} onClick={() => setZoom((current) => Math.max(0.5, current - 0.1))}><Minus size={13} /></button>
            <button type="button" title="Reset zoom" onClick={() => setZoom(1)}>{Math.round(zoom * 100)}%</button>
            <button className="mini-icon-button" type="button" title="Zoom in" aria-label="Zoom in" disabled={zoom >= 1.5} onClick={() => setZoom((current) => Math.min(1.5, current + 0.1))}><Plus size={13} /></button>
          </div>
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
            role="img"
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
                  <text x={table.x + 15} y={table.y + 23} fill="#ffffff" fontSize="15" fontWeight="800">{shortened(table.source.name || 'Untitled table', Math.floor((table.width - 30) / 8))}</text>
                  <text x={table.x + 15} y={table.y + 40} fill="#d8e8ee" fontSize="10.5">{table.source.fields.length} {table.source.fields.length === 1 ? 'field' : 'fields'} · {table.source.spatialUnit || 'No spatial unit'}</text>
                  <g className="table-diagram-drag-handle" aria-hidden="true">
                    {[0, 1, 2].flatMap((row) => [0, 1].map((column) => <circle key={`${row}:${column}`} cx={table.x + table.width - 17 + column * 5} cy={table.y + 16 + row * 5} r="1.25" fill="#d8e8ee" />))}
                  </g>
                  <rect x={table.x} y={table.y + CARD_HEADER_HEIGHT} width={table.width} height={CARD_META_HEIGHT} fill="#edf3f5" />
                  <text x={table.x + 14} y={table.y + CARD_HEADER_HEIGHT + 16} fill="#60747d" fontSize="9.5" fontWeight="700">KEY</text>
                  <text x={table.x + 54} y={table.y + CARD_HEADER_HEIGHT + 16} fill="#60747d" fontSize="9.5" fontWeight="700">FIELD</text>
                  <text x={table.x + table.width - 12} y={table.y + CARD_HEADER_HEIGHT + 16} textAnchor="end" fill="#60747d" fontSize="9.5" fontWeight="700">TYPE / UNIT</text>
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
                      const optionText = row.dimension.options.length
                        ? `${row.dimension.options.slice(0, 3).join(' · ')}${row.dimension.options.length > 3 ? ` · +${row.dimension.options.length - 3}` : ''}`
                        : 'no values defined';
                      const label = `${row.dimension.name.trim() || 'Category'} = ${optionText}`;
                      return <g key={`dimension:${row.id}`}>
                        <rect x={table.x + 1} y={y} width={table.width - 2} height={row.height} fill="#f8f4fd" />
                        <rect x={table.x + 1} y={y} width="4" height={row.height} fill="#8062a8" />
                        <circle cx={table.x + 17} cy={y + row.height / 2} r="3" fill="#8062a8" />
                        <text x={table.x + 27} y={y + 15.5} fill="#665778" fontSize="10"><title>{label}</title>{shortened(label, Math.floor((table.width - 40) / 5.8))}</text>
                      </g>;
                    }
                    const field = row.field;
                    const isPrimary = field.id === table.source.primaryKeyFieldId;
                    const isVirtual = Boolean(field.generatedRelationId);
                    const needsPreprocessing = field.preprocessingNeeded || Boolean(field.details.trim());
                    const rowFill = needsPreprocessing ? '#fff0ed' : isVirtual ? '#eaf6f2' : row.grouped ? '#fbf9fe' : '#ffffff';
                    const nameX = table.x + 54 + (row.grouped ? 8 : 0);
                    return <g key={`field:${field.id}`}>
                      <rect x={table.x + 1} y={y} width={table.width - 2} height={row.height} fill={rowFill} />
                      {row.grouped ? <rect x={table.x + 1} y={y} width="4" height={row.height} fill="#b4a0cc" /> : null}
                      {isVirtual ? <rect x={table.x + 5} y={y + 3} width={table.width - 10} height={row.height - 6} rx="4" fill="none" stroke="#4c927f" strokeDasharray="4 3" /> : null}
                      {needsPreprocessing ? <><rect x={table.x + 1} y={y} width="4" height={row.height} fill="#c85a50" /><circle cx={table.x + 43} cy={y + row.height / 2} r="3.5" fill="#c85a50" /></> : null}
                      {isPrimary ? <g><rect x={table.x + 10} y={y + 6} width="26" height="16" rx="4" fill="#f5e9bd" stroke="#b88b13" /><text x={table.x + 23} y={y + 17.5} textAnchor="middle" fill="#76580b" fontSize="8.5" fontWeight="900">PK</text></g> : null}
                      {!isPrimary && isVirtual ? <text x={table.x + 13} y={y + 18} fill="#397562" fontSize="8" fontWeight="900">V</text> : null}
                      <text x={nameX} y={y + 18} fill="#223d47" fontSize="11" fontWeight={isPrimary ? 750 : 600}><title>{field.name || 'Untitled field'}</title>{shortened(field.name || 'Untitled field', Math.floor((table.width * 0.55) / 6.2))}</text>
                      <text x={table.x + table.width - 12} y={y + 18} textAnchor="end" fill={isVirtual ? '#397562' : '#60747d'} fontSize="9.5" fontStyle={isVirtual ? 'italic' : 'normal'}><title>{fieldTypeLabel(field)}</title>{shortened(fieldTypeLabel(field), Math.floor((table.width * 0.35) / 5.5))}</text>
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
  </div>;
}
