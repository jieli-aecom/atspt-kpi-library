import assert from 'node:assert/strict';
import test from 'node:test';
import { filteredUseCaseIds, matchesUseCaseSelection, moveEnumOption, movePerformanceArea, compareFocusedPerformanceAreas, compareUseCaseAssignments } from '../src/useCaseFilters.ts';
import { createBlankConfig, createBlankKpi, prepareForExport, repairConfig } from '../src/configSchema.ts';
import { buildKpiExcelRows } from '../src/excelExport.ts';
import type { KpiPoolConfig } from '../src/types.ts';

const useCases = [
  { id: 'a1', label: 'Review', userGroup: 'a' },
  { id: 'b1', label: 'Review', userGroup: 'b' },
  { id: 'a2', label: 'Plan', userGroup: 'a' },
  { id: 'b2', label: 'Plan', userGroup: 'b' }
];
const areas = [
  { id: 'a-z', label: 'Zebra', useCase: 'a1' },
  { id: 'b-z', label: 'Zebra', useCase: 'b1' },
  { id: 'a-a', label: 'Alpha', useCase: 'a1' },
  { id: 'a-m', label: 'Middle', useCase: 'a1' }
];
const metric = (id: string, useCase: string, performanceAreas: string[]) => ({
  ...createBlankKpi(), id, name: id,
  userGroupUseCases: [{ userGroup: useCase.startsWith('a') ? 'a' : 'b', useCases: [useCase] }],
  performanceAreasByUseCase: [{ useCase, performanceAreas }], performanceArea: performanceAreas
});
const fixture = (): KpiPoolConfig => ({
  ...createBlankConfig(), enums: { ...createBlankConfig().enums,
    userGroup: [{ id: 'a', label: 'Group A' }, { id: 'b', label: 'Group B' }, { id: 'empty', label: 'Empty' }],
    useCase: useCases, performanceArea: areas
  }
});

test('group and case choices form a union, including cases outside the selected group', () => {
  assert.deepEqual(filteredUseCaseIds(useCases, ['a'], ['b1']), ['a1', 'b1', 'a2']);
  assert.deepEqual(filteredUseCaseIds(useCases, [], ['a2']), ['a2']);
  assert.deepEqual(filteredUseCaseIds(useCases, [], []), ['a1', 'b1', 'a2', 'b2']);
  assert.deepEqual(filteredUseCaseIds(useCases, ['empty'], []), []);
  const groups = new Set(['a']); const cases = new Set(['b1']);
  assert.equal(matchesUseCaseSelection(metric('first', 'a2', []), groups, cases), true);
  assert.equal(matchesUseCaseSelection(metric('second', 'b1', []), groups, cases), true);
  assert.equal(matchesUseCaseSelection(metric('excluded', 'b2', []), groups, cases), false);
  assert.equal(matchesUseCaseSelection({ userGroupUseCases: [{ userGroup: 'a', useCases: [] }] }, groups, cases), true);
});

test('moving an area changes only its use case order and survives export/repair', () => {
  const moved = movePerformanceArea(areas, 'a-a', 'a1', -1);
  assert.deepEqual(moved.map((option) => option.id), ['a-a', 'b-z', 'a-z', 'a-m']);
  assert.deepEqual(areas.map((option) => option.id), ['a-z', 'b-z', 'a-a', 'a-m']);
  assert.equal(movePerformanceArea(areas, 'a-z', 'a1', -1), areas);
  assert.equal(movePerformanceArea(areas, 'a-m', 'a1', 1), areas);
  const config = fixture(); config.enums.performanceArea = moved;
  const restored = repairConfig(JSON.parse(JSON.stringify(prepareForExport(config)))).config;
  assert.deepEqual(restored.enums.performanceArea.filter((option) => option.useCase === 'a1').map((option) => option.id), ['a-a', 'a-z', 'a-m']);
});

test('focused sort follows definition order, reverses, and leaves unassigned rows last', () => {
  const rows = [metric('alpha', 'a1', ['a-a']), metric('empty', 'a1', []), metric('zebra', 'a1', ['a-z']), metric('other', 'b1', ['b-z'])];
  const sort = (order: 'asc' | 'desc') => [...rows].sort((a, b) => compareFocusedPerformanceAreas(areas, a, b, 'a1', order)).map((kpi) => kpi.id);
  assert.deepEqual(sort('asc'), ['zebra', 'alpha', 'empty', 'other']);
  assert.deepEqual(sort('desc'), ['alpha', 'zebra', 'empty', 'other']);
  const reordered = movePerformanceArea(areas, 'a-a', 'a1', -1);
  assert.ok(compareFocusedPerformanceAreas(reordered, rows[0], rows[2], 'a1', 'asc') < 0);
  const multiple = metric('multiple', 'a1', ['a-m', 'a-z']);
  assert.ok(compareFocusedPerformanceAreas(areas, multiple, rows[0], 'a1', 'asc') < 0);
  assert.ok(compareFocusedPerformanceAreas(areas, multiple, rows[0], 'a1', 'desc') < 0);
});

test('Excel honors mixed selections and distinguishes same-named performance areas', () => {
  const config = fixture();
  const rows = [metric('a', 'a1', ['a-z']), metric('b', 'b1', ['b-z']), metric('excluded', 'b2', [])];
  const selection = { userGroups: ['a'], useCases: ['b1'], performanceAreas: [] as string[] };
  assert.deepEqual(buildKpiExcelRows(config, rows, selection).map((row) => row.name), ['a', 'b']);
  assert.deepEqual(buildKpiExcelRows(config, rows, { ...selection, performanceAreas: ['a-z'] }).map((row) => row.name), ['a']);
  assert.deepEqual(buildKpiExcelRows(config, rows, { userGroups: [], useCases: ['b1'], performanceAreas: [] }).map((row) => row.name), ['b']);
});

test('user groups and use cases can be reordered without moving cases into another group', () => {
  const config = fixture();
  config.kpis = [metric('assigned', 'a1', ['a-z'])];
  const before = structuredClone(config.kpis);
  config.enums.userGroup = moveEnumOption(config.enums.userGroup, 'b', -1);
  config.enums.useCase = moveEnumOption(config.enums.useCase, 'a2', -1, ['a1', 'a2']);
  assert.deepEqual(config.enums.useCase.map((option) => option.id), ['a2', 'b1', 'a1', 'b2']);
  assert.equal(moveEnumOption(config.enums.useCase, 'a2', -1, ['a1', 'a2']), config.enums.useCase);
  assert.equal(moveEnumOption(config.enums.useCase, 'missing', 1), config.enums.useCase);
  assert.deepEqual(config.kpis, before);
  const restored = repairConfig(JSON.parse(JSON.stringify(prepareForExport(config)))).config;
  assert.deepEqual(restored.enums.userGroup.map((option) => option.id), ['b', 'a', 'empty']);
  assert.deepEqual(restored.enums.useCase.filter((option) => option.userGroup === 'a').map((option) => option.id), ['a2', 'a1']);
  assert.deepEqual(restored.kpis[0].userGroupUseCases, before[0].userGroupUseCases);
});

test('use case sorting follows both hierarchy levels, reverses, and reacts to definition reordering', () => {
  const groups = [{ id: 'b', label: 'Zebra' }, { id: 'a', label: 'Alpha' }];
  const cases = [useCases[2], useCases[0], useCases[3], useCases[1]];
  const rows = [metric('a1', 'a1', []), metric('a2', 'a2', []), metric('b1', 'b1', []), metric('b2', 'b2', []),
    { ...metric('empty', 'a1', []), userGroupUseCases: [] }];
  const sorted = (order: 'asc' | 'desc') => [...rows].sort((a, b) => compareUseCaseAssignments(groups, cases, a, b, order)).map((row) => row.id);
  assert.deepEqual(sorted('asc'), ['b2', 'b1', 'a2', 'a1', 'empty']);
  assert.deepEqual(sorted('desc'), ['a1', 'a2', 'b1', 'b2', 'empty']);
  const changedGroups = moveEnumOption(groups, 'a', -1);
  assert.ok(compareUseCaseAssignments(changedGroups, cases, rows[0], rows[2], 'asc') < 0);
  const changedCases = moveEnumOption(cases, 'a1', -1, ['a1', 'a2']);
  assert.ok(compareUseCaseAssignments(groups, changedCases, rows[0], rows[1], 'asc') < 0);
  const multiple = { ...rows[0], userGroupUseCases: [...rows[0].userGroupUseCases, ...rows[3].userGroupUseCases] };
  assert.ok(compareUseCaseAssignments(groups, cases, multiple, rows[2], 'asc') < 0);
  assert.ok(compareUseCaseAssignments(groups, cases, multiple, rows[1], 'desc') < 0);
  assert.equal(compareUseCaseAssignments(groups, cases, rows[0], rows[0], 'asc'), 0);
  const groupOnly = { userGroupUseCases: [{ userGroup: 'b', useCases: [] }] };
  assert.ok(compareUseCaseAssignments(groups, cases, groupOnly, rows[0], 'asc') < 0);
});
