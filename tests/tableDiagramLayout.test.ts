import assert from 'node:assert/strict';
import test from 'node:test';
import { layoutTableRegions } from '../src/tableDiagramLayout.ts';
import { tableSourceCategories, type DataLibraryGroup } from '../src/types.ts';

const groups: DataLibraryGroup[] = [
  { id: 'g1', name: 'First group', position: 0, itemIds: [] },
  { id: 'g2', name: 'Second group', position: 2, itemIds: [] }
];
const tables = Array.from({ length: 30 }, (_, index) => ({
  id: `t${index}`, width: 286 + index % 4 * 24, height: 150 + index % 7 * 100,
  category: tableSourceCategories[index % 3], groupId: index % 4 === 0 ? undefined : index % 2 ? 'g1' : 'g2'
}));
const overlaps = (a: { x: number; y: number; width: number; height: number }, b: typeof a) =>
  a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;

test('category regions follow the configured order across the canvas and contain their groups', () => {
  const layout = layoutTableRegions(tables, groups);
  const bands = layout.regions.filter((region) => region.kind === 'category');
  assert.deepEqual(bands.map((band) => band.category), tableSourceCategories);
  for (let index = 1; index < bands.length; index++) {
    assert.ok(bands[index].x > bands[index - 1].x + bands[index - 1].width);
    assert.equal(bands[index].y, bands[0].y);
  }
  for (const region of layout.regions.filter((entry) => entry.kind === 'group')) {
    const band = bands.find((entry) => entry.category === region.category)!;
    assert.ok(region.x >= band.x && region.y >= band.y);
    assert.ok(region.x + region.width <= band.x + band.width);
    assert.ok(region.y + region.height <= band.y + band.height);
  }
});

test('shorter tables fill space below their column without waiting for the tallest table', () => {
  const staggered = [600, 150, 180, 200].map((height, index) => ({
    id: `staggered-${index}`, width: 300, height, category: tableSourceCategories[0], groupId: 'g1'
  }));
  const layout = layoutTableRegions(staggered, groups);
  const first = layout.positions.get(staggered[0].id)!;
  const second = layout.positions.get(staggered[1].id)!;
  const third = layout.positions.get(staggered[2].id)!;
  assert.equal(third.x, second.x);
  assert.ok(third.y >= second.y + staggered[1].height);
  assert.ok(third.y < first.y + staggered[0].height);
});

test('variable-height tables fit in their own group regions without overlapping', () => {
  const layout = layoutTableRegions(tables, groups);
  const placed = tables.map((table) => ({ ...table, ...layout.positions.get(table.id)! }));
  for (const table of placed) {
    const region = layout.regions.find((entry) => table.groupId ? entry.kind === 'group' && entry.id === `${table.category}:${table.groupId}` : entry.kind === 'category' && entry.category === table.category)!;
    assert.ok(table.x >= region.x && table.y >= region.y + 44);
    assert.ok(table.x + table.width <= region.x + region.width);
    assert.ok(table.y + table.height <= region.y + region.height);
    assert.ok(table.x + table.width <= layout.width && table.y + table.height <= layout.height);
  }
  for (let i = 0; i < placed.length; i++) for (let j = i + 1; j < placed.length; j++) assert.equal(overlaps(placed[i], placed[j]), false);
  assert.deepEqual(layout, layoutTableRegions(tables, groups));
});

test('empty and single-table layouts remain finite and show only populated regions', () => {
  assert.equal(layoutTableRegions([], groups).regions.length, 0);
  const layout = layoutTableRegions([tables[0]], groups);
  assert.equal(layout.regions.length, 1);
  assert.equal(layout.positions.size, 1);
  assert.ok(Number.isFinite(layout.width) && Number.isFinite(layout.height));
});
