import { tableSourceCategories, type DataLibraryGroup, type TableSourceCategory } from './types.js';

type LayoutTable = { id: string; width: number; height: number; category: TableSourceCategory; groupId?: string };
export type DiagramRegion = { id: string; label: string; category: TableSourceCategory; kind: 'category' | 'group'; x: number; y: number; width: number; height: number };
const PADDING = 24;
const HEADING = 44;
const TABLE_GAP = 48;
const GROUP_GAP = 36;
const MAX_CONTENT_WIDTH = 2400;

/** Keep groups together, stagger variable-height tables, and place categories side by side. */
export const layoutTableRegions = (tables: LayoutTable[], groups: DataLibraryGroup[]) => {
  const positions = new Map<string, { x: number; y: number }>();
  const regions: DiagramRegion[] = [];
  const orderedGroups = [...groups].sort((a, b) => a.position - b.position);
  const categories = tableSourceCategories.map((category) => {
    const categoryTables = tables.filter((table) => table.category === category);
    const buckets = [
      ...orderedGroups.map((group) => ({ id: group.id, label: group.name.trim() || 'Untitled group', tables: categoryTables.filter((table) => table.groupId === group.id) })),
      { id: '__ungrouped__', label: '', tables: categoryTables.filter((table) => !table.groupId) }
    ].filter((bucket) => bucket.tables.length);
    return { category, blocks: buckets.map((bucket) => {
      const columns = Math.min(3, Math.ceil(Math.sqrt(bucket.tables.length)));
      const columnWidth = Math.max(...bucket.tables.map((table) => table.width));
      const columnBottoms = Array<number>(columns).fill(bucket.id === '__ungrouped__' ? PADDING : HEADING);
      const localPositions = bucket.tables.map((table) => {
        const column = columnBottoms.indexOf(Math.min(...columnBottoms));
        const position = { id: table.id,
          x: PADDING + column * (columnWidth + TABLE_GAP),
          y: columnBottoms[column] };
        columnBottoms[column] += table.height + TABLE_GAP;
        return position;
      });
      return { ...bucket, localPositions,
        width: PADDING * 2 + columns * columnWidth + (columns - 1) * TABLE_GAP,
        height: Math.max(...columnBottoms) - TABLE_GAP + PADDING };
    }) };
  }).filter(({ blocks }) => blocks.length);
  if (!tables.length) return { positions, regions, width: 760, height: 410 };
  let bandX = 48;
  let maxBottom = 126;
  for (const { category, blocks } of categories) {
    const contentWidth = Math.max(...blocks.map((block) => block.width), Math.min(MAX_CONTENT_WIDTH, blocks.reduce((sum, block) => sum + block.width + GROUP_GAP, -GROUP_GAP)));
    const band: DiagramRegion = { id: category, label: category, category, kind: 'category', x: bandX, y: 126, width: contentWidth + PADDING * 2, height: 0 };
    regions.push(band);
    let x = 0;
    let y = HEADING;
    let rowHeight = 0;
    for (const block of blocks) {
      if (x && x + block.width > contentWidth) { x = 0; y += rowHeight + GROUP_GAP; rowHeight = 0; }
      const blockX = band.x + PADDING + x;
      const blockY = band.y + y;
      if (block.id !== '__ungrouped__') regions.push({ id: `${category}:${block.id}`, label: block.label, category, kind: 'group', x: blockX, y: blockY, width: block.width, height: block.height });
      for (const position of block.localPositions) positions.set(position.id, { x: blockX + position.x, y: blockY + position.y });
      x += block.width + GROUP_GAP;
      rowHeight = Math.max(rowHeight, block.height);
    }
    band.height = y + rowHeight + PADDING;
    bandX += band.width + 56;
    maxBottom = Math.max(maxBottom, band.y + band.height);
  }
  return { positions, regions, width: bandX - 56 + 48, height: maxBottom + 48 };
};
