import { tableSourceCategories, type DataLibraryGroup, type TableSourceCategory } from './types.js';

type LayoutTable = { id: string; width: number; height: number; category: TableSourceCategory; groupId?: string };
export type DiagramRegion = { id: string; label: string; category: TableSourceCategory; kind: 'category' | 'group'; x: number; y: number; width: number; height: number };
const PADDING = 24;
const HEADING = 44;
const TABLE_GAP = 48;
const GROUP_GAP = 36;

/** Pack whole groups into category bands; never split a group across regions. */
export const layoutTableRegions = (tables: LayoutTable[], groups: DataLibraryGroup[]) => {
  const positions = new Map<string, { x: number; y: number }>();
  const regions: DiagramRegion[] = [];
  const orderedGroups = [...groups].sort((a, b) => a.position - b.position);
  const categories = tableSourceCategories.map((category) => {
    const categoryTables = tables.filter((table) => table.category === category);
    const buckets = [
      ...orderedGroups.map((group) => ({ id: group.id, label: group.name.trim() || 'Untitled group', tables: categoryTables.filter((table) => table.groupId === group.id) })),
      { id: '__ungrouped__', label: 'Ungrouped tables', tables: categoryTables.filter((table) => !table.groupId) }
    ].filter((bucket) => bucket.tables.length);
    return { category, blocks: buckets.map((bucket) => {
      const columns = Math.min(3, Math.ceil(Math.sqrt(bucket.tables.length)));
      const columnWidths = Array.from({ length: columns }, (_, column) => Math.max(...bucket.tables.filter((_, index) => index % columns === column).map((table) => table.width)));
      const rowHeights = Array.from({ length: Math.ceil(bucket.tables.length / columns) }, (_, row) => Math.max(...bucket.tables.slice(row * columns, (row + 1) * columns).map((table) => table.height)));
      const localPositions = bucket.tables.map((table, index) => {
        const column = index % columns;
        const row = Math.floor(index / columns);
        return { id: table.id,
          x: PADDING + columnWidths.slice(0, column).reduce((sum, width) => sum + width + TABLE_GAP, 0),
          y: HEADING + rowHeights.slice(0, row).reduce((sum, height) => sum + height + TABLE_GAP, 0) };
      });
      return { ...bucket, localPositions,
        width: PADDING * 2 + columnWidths.reduce((sum, width) => sum + width, 0) + (columns - 1) * TABLE_GAP,
        height: HEADING + PADDING + rowHeights.reduce((sum, height) => sum + height, 0) + (rowHeights.length - 1) * TABLE_GAP };
    }) };
  }).filter(({ blocks }) => blocks.length);
  if (!tables.length) return { positions, regions, width: 760, height: 410 };
  const contentWidth = Math.max(760, ...categories.map(({ blocks }) => Math.min(1500, blocks.reduce((sum, block) => sum + block.width + GROUP_GAP, -GROUP_GAP))));
  const bandWidth = contentWidth + PADDING * 2;
  let bandY = 126;
  for (const { category, blocks } of categories) {
    const band: DiagramRegion = { id: category, label: category, category, kind: 'category', x: 48, y: bandY, width: bandWidth, height: 0 };
    regions.push(band);
    let x = 0;
    let y = HEADING;
    let rowHeight = 0;
    for (const block of blocks) {
      if (x && x + block.width > contentWidth) { x = 0; y += rowHeight + GROUP_GAP; rowHeight = 0; }
      const blockX = band.x + PADDING + x;
      const blockY = band.y + y;
      regions.push({ id: `${category}:${block.id}`, label: block.label, category, kind: 'group', x: blockX, y: blockY, width: block.width, height: block.height });
      for (const position of block.localPositions) positions.set(position.id, { x: blockX + position.x, y: blockY + position.y });
      x += block.width + GROUP_GAP;
      rowHeight = Math.max(rowHeight, block.height);
    }
    band.height = y + rowHeight + PADDING;
    bandY += band.height + 56;
  }
  return { positions, regions, width: bandWidth + 96, height: bandY - 56 + 48 };
};
