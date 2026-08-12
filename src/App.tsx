import { memo, useCallback, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentProps } from 'react';
import { BlockMath, InlineMath } from 'react-katex';
import katex, { type TrustContext } from 'katex';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  BookOpen,
  Check,
  ChevronDown,
  ChevronsUp,
  Columns3,
  Copy,
  Cloud,
  Database,
  Download,
  Eye,
  FileJson,
  GitFork,
  GripVertical,
  Gauge,
  Info,
  KeyRound,
  Link2,
  ListFilter,
  Plus,
  Pencil,
  RefreshCw,
  Save,
  Search,
  SortAsc,
  SortDesc,
  Settings2,
  Trash2,
  Table2,
  Upload,
  Variable as VariableIcon,
  X
} from 'lucide-react';
import {
  createBlankConfig,
  createBlankKpi,
  createEnumOption,
  prepareForExport,
  repairConfig
} from './configSchema';
import { mergeImportedConfig } from './configMerge';
import { buildSystematicJsonExport } from './systematicJsonExport';
import {
  forceRemoteConfig,
  loadRemoteConfig,
  LIBRARY_SECRET_SESSION_KEY,
  RemoteConfigError,
  syncRemoteConfig,
  type RemoteConfigResult
} from './remoteConfig';
import {
  enumCategoryLabels,
  enumCategoryKeys,
  genericSpatialUnits,
  type EnumOption,
  type EnumCategoryKey,
  type ValueEnumDefinition,
  type DataSource,
  type DataSourceField,
  dataSourceCollectionItemTypes,
  type DataSourceCollectionItemType,
  dataSourceFieldTypes,
  type DataSourceFieldType,
  type DataSourceFieldDimension,
  type DataSourceFieldGroup,
  type TableRelation,
  type LookupDefinition,
  type LookupInput,
  type LookupValueType,
  type VariableDefinition,
  type DataLibraryGroup,
  kpiEnumCategoryKeys,
  type KpiEnumCategoryKey,
  type KpiFormulaGroup,
  type KpiFormulaItem,
  type KpiFormulaTerm,
  type KpiMetric,
  type KpiPoolConfig,
  type KpiSourceItem,
  type KpiDefaultFocus,
  type KpiUseCasePerformanceArea,
  type KpiUserGroupUseCase,
  spatialScaleKeys,
  spatialScaleLabels,
  spatialUnitOptions,
  type SpatialScaleKey
} from './types';

type LoadState = {
  config: KpiPoolConfig;
  warnings: string[];
};

const CONFIG_SCRIPT_ID = 'kpi-pool-config';
const EXPORTED_SNAPSHOT_ATTRIBUTE = 'data-kpi-exported-snapshot';

type ColumnFilters = {
  name: string;
  description: string;
  formula: string;
  prerequisite: string;
  prerequisiteModules: string[];
  scales: SpatialScaleKey[];
  userGroups: string[];
  useCases: string[];
  enums: Record<KpiEnumCategoryKey, string[]>;
};

type DropPosition = 'before' | 'after';
type PerformanceAreaSortOrder = 'asc' | 'desc' | undefined;

type SourceLibraryEditTarget =
  | { kind: 'dataField'; dataSourceId: string; fieldId: string }
  | { kind: 'lookup'; lookupId: string }
  | { kind: 'variable'; variableId: string }
  | { kind: 'domain'; domainId: string };

type SourceLibraryEditRequest = SourceLibraryEditTarget & { requestId: number };
const transientSourceHighlightDurationMs = 2500;

type FormulaSemanticTarget =
  | { kind: 'source'; sourceId: string }
  | { kind: 'formula'; formulaIndex: number };

type FormulaSourceHighlight = { sourceId: string; requestId: number };

const sourceLibraryTargetKey = (target: SourceLibraryEditTarget) => target.kind === 'dataField'
  ? `field:${target.fieldId}`
  : target.kind === 'lookup'
    ? `lookup:${target.lookupId}`
    : target.kind === 'variable'
      ? `variable:${target.variableId}`
      : `domain:${target.domainId}`;

type UseCaseAssignment = {
  userGroup: string;
  useCase: string;
};

const validDefaultFocus = (config: KpiPoolConfig, focus?: KpiDefaultFocus): UseCaseAssignment | undefined =>
  focus && config.enums.useCase.some((option) => option.id === focus.useCase && option.userGroup === focus.userGroup)
    ? { userGroup: focus.userGroup, useCase: focus.useCase }
    : undefined;

const categoryFields: KpiEnumCategoryKey[] = [];

const initialColumnWidths = [220, 145, 225, 334, 251, 115, 120, 135, 145, 83];
const minColumnWidths = [170, 115, 165, 240, 180, 100, 105, 110, 125, 76];
const defaultHiddenEnumColumns: KpiEnumCategoryKey[] = ['previousApplication', 'federalRequirement'];
const estimatedCollapsedRowHeight = 78;
const estimatedExpandedRowHeight = 960;
const virtualOverscanPixels = 760;
const rowDragAutoScrollEdge = 52;
const rowDragAutoScrollStep = 18;
const rowHeightKey = (id: string, expanded: boolean) => `${id}:${expanded ? 'expanded' : 'collapsed'}`;
const rowToggleBlockedSelector = [
  'button',
  'input',
  'textarea',
  'select',
  'option',
  'a',
  'label',
  '[contenteditable]:not([contenteditable="false"])',
  '[role="button"]',
  '[role="dialog"]',
  '[role="menu"]',
  '[role="listbox"]',
  '[role="tooltip"]',
  '.cell-enum-popover',
  '.kpi-source-popover',
  '[data-row-toggle-ignore]'
].join(',');

const clickIntersectsRenderedText = (root: Element, clientX: number, clientY: number) => {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();

  while (node) {
    if (node.textContent?.trim()) {
      const range = document.createRange();
      range.selectNodeContents(node);
      const intersectsText = Array.from(range.getClientRects()).some(
        (rect) => clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom
      );
      range.detach();
      if (intersectsText) return true;
    }
    node = walker.nextNode();
  }

  return false;
};

const isRowBackgroundClick = (event: React.MouseEvent<HTMLTableRowElement>) => {
  if (event.defaultPrevented || event.button !== 0) return false;
  const target = event.target;
  if (!(target instanceof Element) || target.closest(rowToggleBlockedSelector)) return false;
  return !clickIntersectsRenderedText(event.currentTarget, event.clientX, event.clientY);
};

const emptyFilters = (): ColumnFilters => ({
  name: '',
  description: '',
  formula: '',
  prerequisite: '',
  prerequisiteModules: [],
  scales: [],
  userGroups: [],
  useCases: [],
  enums: {
    previousApplication: [],
    federalRequirement: [],
    performanceArea: []
  }
});

const normalize = (value: string) => value.trim().toLowerCase();

const createBlankFormulaItem = (index: number): KpiFormulaItem => ({
  tag: `Formula ${index + 1}`,
  formula: '',
  leftExpression: '',
  rightExpression: '',
  generalExplanation: '',
  terms: []
});

const createLocalId = (prefix: string) =>
  `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`}`;

const createBlankFormulaGroup = (index: number): KpiFormulaGroup => ({
  name: '',
  items: []
});

const createBlankFormulaTerm = (): KpiFormulaTerm => ({
  term: '',
  explanation: ''
});

const formulaItemsText = (groups: KpiFormulaGroup[]) =>
  groups
    .map((group) =>
      `${group.name} ${group.items
        .map(
          (item) =>
            `${item.tag} ${item.formula} ${item.generalExplanation} ${item.terms
              .map((term) => `${term.term} ${term.explanation}`)
              .join(' ')}`
        )
        .join(' ')}`
    )
    .join(' ');

type EnumOptionMaps = Record<EnumCategoryKey, Map<string, EnumOption>>;
type EnumLabelMaps = Record<EnumCategoryKey, Map<string, string>>;

type KpiSearchEntry = {
  name: string;
  description: string;
  formula: string;
  prerequisite: string;
};

type AppIndexes = {
  enumOptions: EnumOptionMaps;
  enumLabels: EnumLabelMaps;
  kpiNameById: Map<string, string>;
  useCaseIdsByUserGroup: Map<string, string[]>;
  allUseCaseIds: string[];
  performanceAreaLabelById: Map<string, string>;
  performanceAreaIdsByLabel: Map<string, string[]>;
  searchByKpiId: Map<string, KpiSearchEntry>;
};

type CompiledFilters = {
  source: ColumnFilters;
  name: string;
  description: string;
  formula: string;
  prerequisite: string;
  prerequisiteModules: Set<string>;
  scales: Set<SpatialScaleKey>;
  userGroups: Set<string>;
  useCases: Set<string>;
  enums: Record<KpiEnumCategoryKey, Set<string>>;
  performanceAreaLabels: Set<string>;
  activeCount: number;
  nameOnly: boolean;
};

const buildEnumMaps = (config: KpiPoolConfig) => {
  const enumOptions = Object.fromEntries(
    enumCategoryKeys.map((category) => [category, new Map(config.enums[category].map((option) => [option.id, option]))])
  ) as EnumOptionMaps;
  const enumLabels = Object.fromEntries(
    enumCategoryKeys.map((category) => [category, new Map(config.enums[category].map((option) => [option.id, option.label]))])
  ) as EnumLabelMaps;

  return { enumOptions, enumLabels };
};

const buildAppIndexes = (config: KpiPoolConfig, previousConfig?: KpiPoolConfig, previousIndexes?: AppIndexes): AppIndexes => {
  const enumMaps = previousConfig?.enums === config.enums && previousIndexes
    ? { enumOptions: previousIndexes.enumOptions, enumLabels: previousIndexes.enumLabels }
    : buildEnumMaps(config);
  const { enumOptions, enumLabels } = enumMaps;
  const kpiNameById = new Map(config.kpis.map((kpi) => [kpi.id, kpi.name]));
  const reuseUseCaseIndexes = previousConfig?.enums.useCase === config.enums.useCase && previousIndexes;
  const useCaseIdsByUserGroup = reuseUseCaseIndexes
    ? previousIndexes.useCaseIdsByUserGroup
    : new Map<string, string[]>();
  if (!reuseUseCaseIndexes) {
    for (const option of config.enums.useCase) {
      if (!option.userGroup) {
        continue;
      }

      const current = useCaseIdsByUserGroup.get(option.userGroup) ?? [];
      current.push(option.id);
      useCaseIdsByUserGroup.set(option.userGroup, current);
    }
  }

  const reusePerformanceAreaIndexes = previousConfig?.enums.performanceArea === config.enums.performanceArea && previousIndexes;
  const performanceAreaIdsByLabel = reusePerformanceAreaIndexes
    ? previousIndexes.performanceAreaIdsByLabel
    : new Map<string, string[]>();
  if (!reusePerformanceAreaIndexes) {
    for (const option of config.enums.performanceArea) {
      const current = performanceAreaIdsByLabel.get(option.label) ?? [];
      current.push(option.id);
      performanceAreaIdsByLabel.set(option.label, current);
    }
  }

  const searchByKpiId = new Map<string, KpiSearchEntry>();
  const previousKpisById = new Map(previousConfig?.kpis.map((kpi) => [kpi.id, kpi]) ?? []);
  const changedKpiNameIds = new Set<string>();
  if (previousConfig) {
    for (const previousKpi of previousConfig.kpis) {
      if (kpiNameById.get(previousKpi.id) !== previousKpi.name) {
        changedKpiNameIds.add(previousKpi.id);
      }
    }
    for (const kpi of config.kpis) {
      if (!previousKpisById.has(kpi.id)) {
        changedKpiNameIds.add(kpi.id);
      }
    }
  }
  const sourceCatalogsStable = previousConfig?.dataSources === config.dataSources && previousConfig.lookups === config.lookups && previousConfig.variables === config.variables;
  for (const kpi of config.kpis) {
    const previousKpi = previousKpisById.get(kpi.id);
    const previousSearch = previousIndexes?.searchByKpiId.get(kpi.id);
    const referencedKpiNameChanged = kpi.sources.some((source) => source.type === 'kpi' && changedKpiNameIds.has(source.kpiId));
    if (previousKpi === kpi && previousSearch && sourceCatalogsStable && !referencedKpiNameChanged) {
      searchByKpiId.set(kpi.id, previousSearch);
      continue;
    }

    const sourceText = kpi.sources.map((source) => `${sourceItemLabel(config, source)} ${source.latex}`).join(' ');
    searchByKpiId.set(kpi.id, {
      name: normalize(kpi.name),
      description: normalize(kpi.description.overview),
      formula: normalize(`${formulaItemsText(kpi.description.formulas)} ${kpi.description.formulaComment}`),
      prerequisite: normalize(sourceText)
    });
  }

  return {
    enumOptions,
    enumLabels,
    kpiNameById,
    useCaseIdsByUserGroup,
    allUseCaseIds: reuseUseCaseIndexes ? previousIndexes.allUseCaseIds : config.enums.useCase.map((option) => option.id),
    performanceAreaLabelById: enumLabels.performanceArea,
    performanceAreaIdsByLabel,
    searchByKpiId
  };
};

const compileFilters = (filters: ColumnFilters, indexes: AppIndexes): CompiledFilters => {
  const activeCount = activeFilterCount(filters);
  return {
    source: filters,
    name: normalize(filters.name),
    description: normalize(filters.description),
    formula: normalize(filters.formula),
    prerequisite: normalize(filters.prerequisite),
    prerequisiteModules: new Set(filters.prerequisiteModules),
    scales: new Set(filters.scales),
    userGroups: new Set(filters.userGroups),
    useCases: new Set(filters.useCases),
    enums: {
      previousApplication: new Set(filters.enums.previousApplication),
      federalRequirement: new Set(filters.enums.federalRequirement),
      performanceArea: new Set(filters.enums.performanceArea)
    },
    performanceAreaLabels: new Set(filters.enums.performanceArea.map((id) => indexes.performanceAreaLabelById.get(id) ?? id)),
    activeCount,
    nameOnly: activeCount === 1 && Boolean(filters.name)
  };
};

function useCloseOnOutsideClick<T extends HTMLElement>(
  open: boolean,
  onClose: () => void,
  additionalRef?: { current: HTMLElement | null }
) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && (ref.current?.contains(target) || additionalRef?.current?.contains(target))) {
        return;
      }

      onClose();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [additionalRef, open, onClose]);

  return ref;
}

function useStableCallback<Args extends unknown[], Result>(callback: (...args: Args) => Result) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;
  return useCallback((...args: Args) => callbackRef.current(...args), []);
}

const downloadFile = (fileName: string, text: string, type: string) => {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
};

const escapeEmbeddedJson = (json: string) => json.replace(/</g, '\\u003c');

const configFileStem = (title: string) => title.trim().replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'kpi-pool';

const readEmbeddedConfig = (): LoadState => {
  const script = document.getElementById(CONFIG_SCRIPT_ID);
  if (!script?.textContent?.trim()) {
    return {
      config: createBlankConfig(),
      warnings: ['No embedded KPI pool configuration was found; initialized a blank pool.']
    };
  }

  try {
    return repairConfig(JSON.parse(script.textContent));
  } catch (err) {
    return {
      config: createBlankConfig(),
      warnings: [
        `The embedded KPI pool configuration could not be parsed; initialized a blank pool. ${
          err instanceof Error ? err.message : ''
        }`.trim()
      ]
    };
  }
};

const readConfigFromHtml = (html: string) => {
  const parser = new DOMParser();
  const documentFromFile = parser.parseFromString(html, 'text/html');
  const configScript = documentFromFile.getElementById(CONFIG_SCRIPT_ID);
  const configText = configScript?.textContent?.trim();

  if (!configText) {
    throw new Error(`No embedded KPI library configuration was found. Expected a script tag with id="${CONFIG_SCRIPT_ID}".`);
  }

  try {
    return JSON.parse(configText);
  } catch (err) {
    throw new Error(`The embedded KPI library configuration could not be parsed. ${err instanceof Error ? err.message : ''}`.trim());
  }
};

const buildExportHtml = (config: KpiPoolConfig) => {
  const clone = document.documentElement.cloneNode(true) as HTMLElement;
  clone.setAttribute(EXPORTED_SNAPSHOT_ATTRIBUTE, 'true');
  const root = clone.querySelector('#root');
  if (root) {
    root.innerHTML = '';
  }

  let configScript = clone.querySelector<HTMLScriptElement>(`#${CONFIG_SCRIPT_ID}`);
  if (!configScript) {
    configScript = document.createElement('script');
    configScript.id = CONFIG_SCRIPT_ID;
    configScript.type = 'application/json';
    const clonedBody = clone.querySelector('body') ?? clone;
    clonedBody.insertBefore(configScript, clonedBody.firstChild);
  }

  configScript.textContent = `\n${escapeEmbeddedJson(JSON.stringify(config, null, 2))}\n`;
  return `<!doctype html>\n${clone.outerHTML}`;
};

const enumOptionMapCache = new WeakMap<KpiPoolConfig, EnumOptionMaps>();
const getCachedEnumOptionMaps = (config: KpiPoolConfig) => {
  const cached = enumOptionMapCache.get(config);
  if (cached) {
    return cached;
  }

  const maps = buildEnumMaps(config).enumOptions;
  enumOptionMapCache.set(config, maps);
  return maps;
};

const selectedOptions = (config: KpiPoolConfig, category: EnumCategoryKey, ids: string[]) => {
  const lookup = getCachedEnumOptionMaps(config)[category];
  return ids.map((id) => lookup.get(id)).filter(Boolean) as { id: string; label: string; description?: string }[];
};

const kpiEnumReferences = (kpi: KpiMetric, category: EnumCategoryKey) => {
  if (category === 'prerequisiteModule') {
    return kpi.prerequisite.modules;
  }

  if (category === 'userGroup') {
    return kpi.userGroupUseCases.map((entry) => entry.userGroup);
  }

  if (category === 'useCase') {
    return [...new Set(kpi.userGroupUseCases.flatMap((entry) => entry.useCases))];
  }

  if (category === 'performanceArea') {
    return aggregatePerformanceAreas(kpi.performanceAreasByUseCase).length
      ? aggregatePerformanceAreas(kpi.performanceAreasByUseCase)
      : kpi.performanceArea;
  }

  return kpi[category as KpiEnumCategoryKey];
};

const withKpiEnumReferences = (kpi: KpiMetric, category: EnumCategoryKey, ids: string[]): KpiMetric => {
  if (category === 'prerequisiteModule') {
    return {
      ...kpi,
      prerequisite: {
        ...kpi.prerequisite,
        modules: ids
      }
    };
  }

  if (category === 'userGroup') {
    return {
      ...kpi,
      userGroupUseCases: kpi.userGroupUseCases.filter((entry) => ids.includes(entry.userGroup))
    };
  }

  if (category === 'useCase') {
    const performanceAreasByUseCase = kpi.performanceAreasByUseCase.filter((entry) => ids.includes(entry.useCase));
    return {
      ...kpi,
      userGroupUseCases: kpi.userGroupUseCases.map((entry) => ({
        ...entry,
        useCases: entry.useCases.filter((id) => ids.includes(id))
      })),
      performanceAreasByUseCase,
      performanceArea: aggregatePerformanceAreas(performanceAreasByUseCase),
      notesByUseCase: kpi.notesByUseCase.filter((entry) => ids.includes(entry.useCase))
    };
  }

  if (category === 'performanceArea') {
    const performanceAreasByUseCase = kpi.performanceAreasByUseCase
      .map((entry) => ({
        ...entry,
        performanceAreas: entry.performanceAreas.filter((id) => ids.includes(id))
      }))
      .filter((entry) => entry.performanceAreas.length > 0);
    return {
      ...kpi,
      performanceAreasByUseCase,
      performanceArea: aggregatePerformanceAreas(performanceAreasByUseCase)
    };
  }

  return { ...kpi, [category]: ids } as KpiMetric;
};

const selectedUseCaseEntries = (config: KpiPoolConfig, entries: KpiUserGroupUseCase[]) => {
  const userGroupLookup = new Map(config.enums.userGroup.map((option) => [option.id, option]));
  const useCaseLookup = new Map(config.enums.useCase.map((option) => [option.id, option]));
  return entries.map((entry) => ({
    userGroup: userGroupLookup.get(entry.userGroup),
    useCases: entry.useCases.map((id) => useCaseLookup.get(id)).filter(Boolean) as { id: string; label: string; description?: string }[]
  }));
};

const userGroupUseCaseText = (config: KpiPoolConfig, kpi: KpiMetric) =>
  selectedUseCaseEntries(config, kpi.userGroupUseCases)
    .map((entry) => `${entry.userGroup?.label ?? ''} ${entry.useCases.map((option) => option.label).join(' ')}`)
    .join(' ');

const hasUseCaseAssignment = (kpi: KpiMetric, assignment?: UseCaseAssignment) =>
  assignment
    ? kpi.userGroupUseCases.some(
        (entry) => entry.userGroup === assignment.userGroup && entry.useCases.includes(assignment.useCase)
      )
    : false;

const useCaseNote = (kpi: KpiMetric, assignment?: UseCaseAssignment) =>
  assignment ? kpi.notesByUseCase.find((entry) => entry.useCase === assignment.useCase)?.note ?? '' : '';

const setUseCaseNote = (kpi: KpiMetric, assignment: UseCaseAssignment, note: string): KpiMetric => {
  const trimmedNote = note.trim();
  const existing = kpi.notesByUseCase.some((entry) => entry.useCase === assignment.useCase);
  const notesByUseCase = existing
    ? kpi.notesByUseCase
        .map((entry) => (entry.useCase === assignment.useCase ? { ...entry, note } : entry))
        .filter((entry) => entry.useCase !== assignment.useCase || trimmedNote)
    : trimmedNote
      ? [...kpi.notesByUseCase, { useCase: assignment.useCase, note }]
      : kpi.notesByUseCase;

  return {
    ...kpi,
    notesByUseCase
  };
};

const setUseCaseAssignment = (kpi: KpiMetric, assignment: UseCaseAssignment, assigned: boolean): KpiMetric => {
  if (assigned) {
    const existingEntry = kpi.userGroupUseCases.find((entry) => entry.userGroup === assignment.userGroup);
    const userGroupUseCases = existingEntry
      ? kpi.userGroupUseCases.map((entry) =>
          entry.userGroup === assignment.userGroup
            ? { ...entry, useCases: [...new Set([...entry.useCases, assignment.useCase])] }
            : entry
        )
      : [...kpi.userGroupUseCases, { userGroup: assignment.userGroup, useCases: [assignment.useCase] }];

    return {
      ...kpi,
      userGroupUseCases
    };
  }

  return {
    ...kpi,
    userGroupUseCases: kpi.userGroupUseCases
      .map((entry) =>
        entry.userGroup === assignment.userGroup
          ? { ...entry, useCases: entry.useCases.filter((id) => id !== assignment.useCase) }
          : entry
      )
      .filter((entry) => entry.userGroup !== assignment.userGroup || entry.useCases.length > 0)
  };
};

const aggregatePerformanceAreas = (entries: KpiUseCasePerformanceArea[]) => [
  ...new Set(entries.flatMap((entry) => entry.performanceAreas))
];

const performanceAreaLabel = (config: KpiPoolConfig, id: string) =>
  config.enums.performanceArea.find((option) => option.id === id)?.label ?? id;

const dedupePerformanceAreaIdsByLabel = (config: KpiPoolConfig, ids: string[]) => {
  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const id of ids) {
    const label = performanceAreaLabel(config, id);
    if (!seen.has(label)) {
      seen.add(label);
      deduped.push(id);
    }
  }

  return deduped;
};

const dedupePerformanceAreaOptionsByLabel = (options: EnumOption[]) => {
  const seen = new Set<string>();
  const deduped: EnumOption[] = [];
  for (const option of options) {
    if (!seen.has(option.label)) {
      seen.add(option.label);
      deduped.push(option);
    }
  }

  return deduped;
};

const performanceAreaOptionsForUseCases = (config: KpiPoolConfig, useCaseIds: string[]) => {
  const scopedOptions = useCaseIds.length
    ? config.enums.performanceArea.filter((option) => option.useCase && useCaseIds.includes(option.useCase))
    : config.enums.performanceArea;
  return useCaseIds.length === 1 ? scopedOptions : dedupePerformanceAreaOptionsByLabel(scopedOptions);
};

const scopedPerformanceAreas = (kpi: KpiMetric, useCaseIds: string[], fallbackToLegacy = true) => {
  if (useCaseIds.length === 0) {
    return aggregatePerformanceAreas(kpi.performanceAreasByUseCase).length
      ? aggregatePerformanceAreas(kpi.performanceAreasByUseCase)
      : kpi.performanceArea;
  }

  const scoped = kpi.performanceAreasByUseCase
    .filter((entry) => useCaseIds.includes(entry.useCase));
  if (scoped.length === 0) {
    return fallbackToLegacy ? kpi.performanceArea : [];
  }

  return aggregatePerformanceAreas(scoped);
};

const performanceAreaSortKey = (
  config: KpiPoolConfig,
  kpi: KpiMetric,
  filters: ColumnFilters,
  assignment: UseCaseAssignment | undefined,
  order: Exclude<PerformanceAreaSortOrder, undefined>
) => {
  const labels = [
    ...new Set(
      scopedPerformanceAreas(kpi, targetPerformanceAreaUseCases(config, kpi, filters, assignment), !assignment)
        .map((id) => performanceAreaLabel(config, id).trim())
        .filter(Boolean)
    )
  ].sort((left, right) => left.localeCompare(right, undefined, { sensitivity: 'base', numeric: true }));

  return order === 'asc' ? labels[0] ?? '' : labels[labels.length - 1] ?? '';
};

const expandPerformanceAreaSelection = (config: KpiPoolConfig, useCaseIds: string[], selectedIds: string[]) => {
  const selectedLabels = new Set(selectedIds.map((id) => performanceAreaLabel(config, id)));
  if (useCaseIds.length === 0) {
    return config.enums.performanceArea.filter((option) => selectedLabels.has(option.label)).map((option) => option.id);
  }

  return config.enums.performanceArea
    .filter((option) => option.useCase && useCaseIds.includes(option.useCase) && selectedLabels.has(option.label))
    .map((option) => option.id);
};

const targetPerformanceAreaUseCases = (config: KpiPoolConfig, kpi: KpiMetric, filters: ColumnFilters, assignment?: UseCaseAssignment) => {
  if (assignment) {
    return [assignment.useCase];
  }

  if (filters.useCases.length > 0) {
    return filters.useCases;
  }

  if (filters.userGroups.length > 0) {
    return config.enums.useCase
      .filter((option) => option.userGroup && filters.userGroups.includes(option.userGroup))
      .map((option) => option.id);
  }

  return config.enums.useCase.map((option) => option.id);
};

const setPerformanceAreasForUseCases = (
  config: KpiPoolConfig,
  kpi: KpiMetric,
  useCaseIds: string[],
  performanceAreas: string[]
): KpiMetric => {
  const selectedLabels = new Set(performanceAreas.map((id) => performanceAreaLabel(config, id)));
  if (useCaseIds.length === 0) {
    return {
      ...kpi,
      performanceArea: expandPerformanceAreaSelection(config, [], performanceAreas)
    };
  }

  const targets = new Set(useCaseIds);
  const existingUseCases = new Set(kpi.performanceAreasByUseCase.map((entry) => entry.useCase));
  const performanceAreasForUseCase = (useCase: string) =>
    config.enums.performanceArea
      .filter((option) => option.useCase === useCase && selectedLabels.has(option.label))
      .map((option) => option.id);
  const updatedEntries = kpi.performanceAreasByUseCase
    .map((entry) =>
      targets.has(entry.useCase)
        ? {
            ...entry,
            performanceAreas: performanceAreasForUseCase(entry.useCase)
          }
        : entry
    )
    .filter((entry) => targets.has(entry.useCase) || entry.performanceAreas.length > 0);

  for (const useCase of targets) {
    if (!existingUseCases.has(useCase)) {
      updatedEntries.push({
        useCase,
        performanceAreas: performanceAreasForUseCase(useCase)
      });
    }
  }

  const nextPerformanceAreasByUseCase = updatedEntries;
  return {
    ...kpi,
    performanceAreasByUseCase: nextPerformanceAreasByUseCase,
    performanceArea: aggregatePerformanceAreas(nextPerformanceAreasByUseCase)
  };
};

const hasUseCaseFilters = (kpi: KpiMetric, filters: ColumnFilters) => {
  if (filters.userGroups.length === 0 && filters.useCases.length === 0) {
    return true;
  }

  if (filters.userGroups.length > 0 && filters.useCases.length > 0) {
    return kpi.userGroupUseCases.some(
      (entry) => filters.userGroups.includes(entry.userGroup) && entry.useCases.some((id) => filters.useCases.includes(id))
    );
  }

  if (filters.userGroups.length > 0) {
    return kpi.userGroupUseCases.some((entry) => filters.userGroups.includes(entry.userGroup));
  }

  return kpi.userGroupUseCases.some((entry) => entry.useCases.some((id) => filters.useCases.includes(id)));
};

const hasCompiledUseCaseFilters = (kpi: KpiMetric, filters: CompiledFilters) => {
  if (filters.userGroups.size === 0 && filters.useCases.size === 0) {
    return true;
  }

  if (filters.userGroups.size > 0 && filters.useCases.size > 0) {
    return kpi.userGroupUseCases.some(
      (entry) => filters.userGroups.has(entry.userGroup) && entry.useCases.some((id) => filters.useCases.has(id))
    );
  }

  if (filters.userGroups.size > 0) {
    return kpi.userGroupUseCases.some((entry) => filters.userGroups.has(entry.userGroup));
  }

  return kpi.userGroupUseCases.some((entry) => entry.useCases.some((id) => filters.useCases.has(id)));
};

const targetPerformanceAreaUseCasesForCompiledFilters = (
  indexes: AppIndexes,
  filters: CompiledFilters,
  assignment?: UseCaseAssignment
) => {
  if (assignment) {
    return [assignment.useCase];
  }

  if (filters.useCases.size > 0) {
    return [...filters.useCases];
  }

  if (filters.userGroups.size > 0) {
    return [...filters.userGroups].flatMap((userGroup) => indexes.useCaseIdsByUserGroup.get(userGroup) ?? []);
  }

  return indexes.allUseCaseIds;
};

const hasAnySelected = (values: string[], selected: Set<string>) => values.some((id) => selected.has(id));

const hasAnyApplicableScale = (kpi: KpiMetric, scales: Set<SpatialScaleKey>) => {
  for (const scale of scales) {
    if (kpi.spatialScales[scale].applicable) {
      return true;
    }
  }

  return false;
};

const prerequisiteSearchText = (config: KpiPoolConfig, kpi: KpiMetric) =>
  `${selectedOptions(config, 'prerequisiteModule', kpi.prerequisite.modules)
    .map((option) => option.label)
    .join(' ')} ${kpi.prerequisite.kpis
    .map((id) => config.kpis.find((entry) => entry.id === id)?.name ?? '')
    .join(' ')} ${kpi.prerequisite.values}`;

const updateKpi = (config: KpiPoolConfig, kpiId: string, updater: (kpi: KpiMetric) => KpiMetric): KpiPoolConfig => ({
  ...config,
  kpis: config.kpis.map((kpi) => (kpi.id === kpiId ? updater(kpi) : kpi))
});

const sameStructuredValue = (left: unknown, right: unknown): boolean => {
  if (Object.is(left, right)) return true;
  if (typeof left !== 'object' || left === null || typeof right !== 'object' || right === null) return false;
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
    return left.every((value, index) => sameStructuredValue(value, right[index]));
  }

  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  const leftKeys = Object.keys(leftRecord);
  const rightKeys = Object.keys(rightRecord);
  return leftKeys.length === rightKeys.length && leftKeys.every((key) =>
    Object.prototype.hasOwnProperty.call(rightRecord, key) && sameStructuredValue(leftRecord[key], rightRecord[key])
  );
};

const preserveUnchangedEntries = <T extends { id: string }>(previous: T[], next: T[]): T[] => {
  if (previous === next) return previous;
  const previousById = new Map(previous.map((entry) => [entry.id, entry]));
  const reconciled = next.map((entry) => {
    const prior = previousById.get(entry.id);
    return prior && sameStructuredValue(prior, entry) ? prior : entry;
  });
  return previous.length === reconciled.length && previous.every((entry, index) => entry === reconciled[index])
    ? previous
    : reconciled;
};

const sameKpiMaterial = (left: KpiMetric, right: KpiMetric) =>
  left.id === right.id &&
  left.name === right.name &&
  sameStructuredValue(left.dimensions, right.dimensions) &&
  sameStructuredValue(left.sources, right.sources) &&
  sameStructuredValue(left.description, right.description) &&
  sameStructuredValue(left.prerequisite, right.prerequisite) &&
  sameStructuredValue(left.spatialScales, right.spatialScales) &&
  sameStructuredValue(left.previousApplication, right.previousApplication) &&
  sameStructuredValue(left.federalRequirement, right.federalRequirement) &&
  sameStructuredValue(left.performanceArea, right.performanceArea) &&
  sameStructuredValue(left.performanceAreasByUseCase, right.performanceAreasByUseCase) &&
  sameStructuredValue(left.notesByUseCase, right.notesByUseCase) &&
  sameStructuredValue(left.userGroupUseCases, right.userGroupUseCases);

const nextEditTimestamp = (previousTimestamp?: string) => {
  const previousTime = previousTimestamp ? Date.parse(previousTimestamp) : Number.NaN;
  return new Date(Math.max(Date.now(), Number.isFinite(previousTime) ? previousTime + 1 : 0)).toISOString();
};

const formatLastModified = (timestamp: string) => {
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) {
    return timestamp;
  }

  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(date);
};

const activeFilterCount = (filters: ColumnFilters) =>
  (filters.name || filters.description ? 1 : 0) +
  (filters.formula ? 1 : 0) +
  (filters.prerequisite ? 1 : 0) +
  filters.prerequisiteModules.length +
  filters.scales.length +
  filters.userGroups.length +
  filters.useCases.length +
  filters.enums.performanceArea.length +
  categoryFields.reduce((sum, category) => sum + filters.enums[category].length, 0);

const matchesFilters = (indexes: AppIndexes, kpi: KpiMetric, filters: CompiledFilters, pinnedNameFilterIds: Set<string>, assignment?: UseCaseAssignment) => {
  const search = indexes.searchByKpiId.get(kpi.id);
  if (
    filters.name &&
    !pinnedNameFilterIds.has(kpi.id) &&
    !search?.name.includes(filters.name) &&
    !search?.description.includes(filters.name)
  ) {
    return false;
  }

  if (filters.nameOnly) {
    return true;
  }

  if (filters.description && !search?.name.includes(filters.description) && !search?.description.includes(filters.description)) {
    return false;
  }

  if (filters.formula && !search?.formula.includes(filters.formula)) {
    return false;
  }

  if (filters.prerequisite && !search?.prerequisite.includes(filters.prerequisite)) {
    return false;
  }

  if (filters.prerequisiteModules.size > 0 && !hasAnySelected(kpi.prerequisite.modules, filters.prerequisiteModules)) {
    return false;
  }

  if (filters.scales.size > 0 && !hasAnyApplicableScale(kpi, filters.scales)) {
    return false;
  }

  if (!hasCompiledUseCaseFilters(kpi, filters)) {
    return false;
  }

  if (
    filters.enums.performanceArea.size > 0 &&
    !scopedPerformanceAreas(kpi, targetPerformanceAreaUseCasesForCompiledFilters(indexes, filters, assignment), !assignment).some(
      (performanceArea) => filters.performanceAreaLabels.has(indexes.performanceAreaLabelById.get(performanceArea) ?? performanceArea)
    )
  ) {
    return false;
  }

  for (const category of categoryFields) {
    const selected = filters.enums[category];
    if (selected.size > 0 && !hasAnySelected(kpi[category], selected)) {
      return false;
    }
  }

  return true;
};

const createKpiMatchingFilters = (filters: ColumnFilters, config: KpiPoolConfig): KpiMetric => {
  const kpi = createBlankKpi();
  const nameFilter = filters.name.trim();
  const descriptionFilter = filters.description.trim();
  const formulaFilter = filters.formula.trim();
  const prerequisiteFilter = filters.prerequisite.trim();
  const userGroups =
    filters.userGroups.length > 0
      ? filters.userGroups
      : filters.useCases.length > 0
        ? [
            ...new Set(
              filters.useCases
                .map((id) => config.enums.useCase.find((option) => option.id === id)?.userGroup)
                .filter(Boolean) as string[]
            )
          ]
        : [];
  const performanceTargetUseCases =
    filters.useCases.length > 0
      ? filters.useCases
      : filters.enums.performanceArea.length > 0
        ? config.enums.useCase
            .filter((option) => filters.userGroups.length === 0 || (option.userGroup && filters.userGroups.includes(option.userGroup)))
            .map((option) => option.id)
        : [];
  const userGroupsForUseCases = [
    ...new Set(
      performanceTargetUseCases
        .map((id) => config.enums.useCase.find((option) => option.id === id)?.userGroup)
        .filter(Boolean) as string[]
    )
  ];
  const nextUserGroups = [...new Set([...userGroups, ...userGroupsForUseCases])];
  const performanceAreaFilterLabels = new Set(filters.enums.performanceArea.map((id) => performanceAreaLabel(config, id)));
  const performanceAreasForUseCase = (useCase: string) =>
    config.enums.performanceArea
      .filter((option) => option.useCase === useCase && performanceAreaFilterLabels.has(option.label))
      .map((option) => option.id);
  const performanceAreasByUseCase = performanceTargetUseCases.map((useCase) => ({
    useCase,
    performanceAreas: performanceAreasForUseCase(useCase)
  }));

  return {
    ...kpi,
    name: nameFilter || kpi.name,
    description: {
      overview: descriptionFilter,
      formulaComment: '',
      formulas: formulaFilter
        ? [
            {
              name: 'Formula',
              items: [
                {
                  tag: 'Formula 1',
                  formula: formulaFilter,
                  leftExpression: '',
                  rightExpression: formulaFilter,
                  generalExplanation: formulaFilter,
                  terms: []
                }
              ]
            }
          ]
        : []
    },
    prerequisite: {
      modules: [...filters.prerequisiteModules],
      kpis: [],
      values: prerequisiteFilter
    },
    spatialScales: {
      ...kpi.spatialScales,
      ...Object.fromEntries(
        filters.scales.map((scale) => [
          scale,
          {
            ...kpi.spatialScales[scale],
            applicable: true,
            isBasicUnit: true
          }
        ])
      )
    },
    previousApplication: [...filters.enums.previousApplication],
    federalRequirement: [...filters.enums.federalRequirement],
    performanceArea: aggregatePerformanceAreas(performanceAreasByUseCase),
    performanceAreasByUseCase,
    notesByUseCase: [],
    userGroupUseCases: nextUserGroups.map((userGroup) => ({
      userGroup,
      useCases: performanceTargetUseCases.filter((id) => config.enums.useCase.find((option) => option.id === id)?.userGroup === userGroup)
    }))
  };
};

const duplicateKpiMetric = (kpi: KpiMetric, focusAssignment?: UseCaseAssignment): KpiMetric => {
  const performanceAreasByUseCase = kpi.performanceAreasByUseCase
    .filter((entry) => !focusAssignment || entry.useCase === focusAssignment.useCase)
    .map((entry) => ({
      useCase: entry.useCase,
      performanceAreas: [...entry.performanceAreas]
    }));

  return {
    id: createBlankKpi().id,
    lastModified: new Date().toISOString(),
    name: `${kpi.name || 'Untitled KPI'} Copy`,
    dimensions: kpi.dimensions.map((dimension) => ({
      ...dimension,
      id: createLocalId('kpi-dimension'),
      options: [...dimension.options]
    })),
    sources: kpi.sources.map((source) => ({ ...source, id: createLocalId('kpi-source') })),
    description: {
      overview: kpi.description.overview,
      formulaComment: kpi.description.formulaComment,
      formulas: kpi.description.formulas.map((group) => ({
        name: group.name,
        items: group.items.map((item) => ({
          ...item,
          terms: item.terms.map((term) => ({ ...term }))
        }))
      }))
    },
    prerequisite: {
      modules: [...kpi.prerequisite.modules],
      kpis: [...kpi.prerequisite.kpis],
      values: kpi.prerequisite.values
    },
    spatialScales: Object.fromEntries(spatialScaleKeys.map((scale) => [scale, { ...kpi.spatialScales[scale] }])) as KpiMetric['spatialScales'],
    previousApplication: [...kpi.previousApplication],
    federalRequirement: [...kpi.federalRequirement],
    performanceArea: focusAssignment ? aggregatePerformanceAreas(performanceAreasByUseCase) : [...kpi.performanceArea],
    performanceAreasByUseCase,
    notesByUseCase: kpi.notesByUseCase
      .filter((entry) => !focusAssignment || entry.useCase === focusAssignment.useCase)
      .map((entry) => ({
        useCase: entry.useCase,
        note: entry.note
      })),
    userGroupUseCases: focusAssignment
      ? [{ userGroup: focusAssignment.userGroup, useCases: [focusAssignment.useCase] }]
      : kpi.userGroupUseCases.map((entry) => ({
          userGroup: entry.userGroup,
          useCases: [...entry.useCases]
        }))
  };
};

function WarningBar({ warnings, onDismiss }: { warnings: string[]; onDismiss: () => void }) {
  const [expanded, setExpanded] = useState(false);
  if (warnings.length === 0) {
    return null;
  }

  return (
    <section className="warning-bar">
      <button className="warning-summary" type="button" onClick={() => setExpanded((value) => !value)}>
        <AlertTriangle size={15} aria-hidden="true" />
        <span>{warnings.length} configuration warning{warnings.length === 1 ? '' : 's'}</span>
        <ChevronDown size={15} aria-hidden="true" className={expanded ? 'rotate' : ''} />
      </button>
      <button className="icon-button" type="button" aria-label="Dismiss warnings" title="Dismiss warnings" onClick={onDismiss}>
        <X size={15} aria-hidden="true" />
      </button>
      {expanded ? (
        <ul className="warning-list">
          {warnings.map((warning, index) => (
            <li key={`${warning}-${index}`}>{warning}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function TextHeaderFilter({
  label,
  value,
  placeholder,
  onChange
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="header-control">
      <div className="header-title">
        <span>{label}</span>
        {value ? <strong>1</strong> : null}
      </div>
      <label className="header-search">
        <Search size={13} aria-hidden="true" />
        <input value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
      </label>
    </div>
  );
}

function HeaderMultiSelect({
  label,
  options,
  value,
  onChange
}: {
  label: string;
  options: { id: string; label: string }[];
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const controlRef = useCloseOnOutsideClick<HTMLDivElement>(open, () => setOpen(false));
  const selectedLabels = options.filter((option) => value.includes(option.id)).map((option) => option.label);

  const toggleOption = (id: string) => {
    onChange(value.includes(id) ? value.filter((selected) => selected !== id) : [...value, id]);
  };

  return (
    <div className="header-popover-control" ref={controlRef}>
      <button className="header-filter-button" type="button" onClick={() => setOpen((next) => !next)}>
        <ListFilter size={13} aria-hidden="true" />
        <span>{selectedLabels.length ? selectedLabels.join(', ') : 'Any'}</span>
        <ChevronDown size={13} aria-hidden="true" className={open ? 'rotate' : ''} />
      </button>
      {open ? (
        <div className="header-popover">
          <div className="popover-title">{label}</div>
          {options.length === 0 ? <span className="empty-option">No options</span> : null}
          {options.map((option) => (
            <label className="check-row" key={option.id}>
              <input type="checkbox" checked={value.includes(option.id)} onChange={() => toggleOption(option.id)} />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ScaleHeaderFilter({
  value,
  onChange
}: {
  value: SpatialScaleKey[];
  onChange: (next: SpatialScaleKey[]) => void;
}) {
  return (
    <div className="header-control">
      <div className="header-title">
        <span>Spatial Scales</span>
        {value.length ? <strong>{value.length}</strong> : null}
      </div>
      <HeaderMultiSelect
        label="Filter spatial scales"
        options={spatialScaleKeys.map((scale) => ({ id: scale, label: spatialScaleLabels[scale] }))}
        value={value}
        onChange={(next) => onChange(next as SpatialScaleKey[])}
      />
    </div>
  );
}

function ColumnVisibilityControl({
  hiddenCategories,
  onToggle
}: {
  hiddenCategories: KpiEnumCategoryKey[];
  onToggle: (category: KpiEnumCategoryKey) => void;
}) {
  const [open, setOpen] = useState(false);
  const controlRef = useCloseOnOutsideClick<HTMLDivElement>(open, () => setOpen(false));
  const hiddenCount = hiddenCategories.length;

  return (
    <div className="column-visibility-control" ref={controlRef}>
      <button
        className={`mini-icon-button column-visibility-button ${hiddenCount ? 'has-hidden' : ''}`}
        type="button"
        aria-label="Show or hide less-used columns"
        title="Show or hide columns"
        onClick={() => setOpen((next) => !next)}
      >
        <Columns3 size={13} aria-hidden="true" />
        {hiddenCount ? <span>{hiddenCount}</span> : null}
      </button>
      {open ? (
        <div className="header-popover column-visibility-popover">
          <div className="popover-title">Columns</div>
          {categoryFields.map((category) => (
            <label className="check-row" key={category}>
              <input
                type="checkbox"
                checked={!hiddenCategories.includes(category)}
                onChange={() => onToggle(category)}
              />
              <span>{enumCategoryLabels[category]}</span>
            </label>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function EnumHeader({
  config,
  category,
  filter,
  onFilterChange,
  onConfigChange,
  filterOptions,
  manageOptions,
  useCaseUserGroupOptions,
  performanceAreaUseCaseOptions,
  onCascadeUseCaseDelete
}: {
  config: KpiPoolConfig;
  category: EnumCategoryKey;
  filter: string[];
  onFilterChange: (next: string[]) => void;
  onConfigChange: (next: KpiPoolConfig) => void;
  filterOptions?: { id: string; label: string }[];
  manageOptions?: EnumOption[];
  useCaseUserGroupOptions?: EnumOption[];
  performanceAreaUseCaseOptions?: EnumOption[];
  onCascadeUseCaseDelete?: (ids: string[]) => void;
}) {
  const [manageOpen, setManageOpen] = useState(false);
  const [newUseCaseUserGroup, setNewUseCaseUserGroup] = useState('');
  const [newPerformanceAreaUseCase, setNewPerformanceAreaUseCase] = useState('');
  const managerRef = useCloseOnOutsideClick<HTMLDivElement>(manageOpen, () => setManageOpen(false));
  const allManagerOptions = manageOptions ?? config.enums[category];
  const addUseCaseUserGroupOptions = useCaseUserGroupOptions ?? config.enums.userGroup;
  const addPerformanceAreaUseCaseOptions = performanceAreaUseCaseOptions ?? config.enums.useCase;
  const managerOptions =
    category === 'useCase'
      ? allManagerOptions.filter((option) => option.userGroup === newUseCaseUserGroup)
      : category === 'performanceArea'
        ? allManagerOptions.filter((option) => option.useCase === newPerformanceAreaUseCase)
      : allManagerOptions;

  useEffect(() => {
    if (category !== 'useCase') {
      return;
    }

    if (!newUseCaseUserGroup || !addUseCaseUserGroupOptions.some((option) => option.id === newUseCaseUserGroup)) {
      setNewUseCaseUserGroup(addUseCaseUserGroupOptions[0]?.id ?? '');
    }
  }, [category, addUseCaseUserGroupOptions, newUseCaseUserGroup]);

  useEffect(() => {
    if (category !== 'performanceArea') {
      return;
    }

    if (
      !newPerformanceAreaUseCase ||
      !addPerformanceAreaUseCaseOptions.some((option) => option.id === newPerformanceAreaUseCase)
    ) {
      setNewPerformanceAreaUseCase(addPerformanceAreaUseCaseOptions[0]?.id ?? '');
    }
  }, [category, addPerformanceAreaUseCaseOptions, newPerformanceAreaUseCase]);

  const updatePerformanceAreaOption = (targetOption: EnumOption, field: 'label' | 'description', value: string) => {
    const targetUseCase = targetOption.useCase ?? newPerformanceAreaUseCase;
    const targetIndex = config.enums.performanceArea.findIndex(
      (option) => option.id === targetOption.id && option.useCase === targetUseCase
    );
    if (!targetUseCase || targetIndex < 0) {
      return;
    }

    const originalOption = config.enums.performanceArea[targetIndex];
    const referencedUseCases = new Set(
      config.kpis.flatMap((kpi) =>
        kpi.performanceAreasByUseCase
          .filter((entry) => entry.performanceAreas.includes(originalOption.id))
          .map((entry) => entry.useCase)
      )
    );
    const sameIdOptionCount = config.enums.performanceArea.filter((option) => option.id === originalOption.id).length;
    const isSharedAcrossUseCases =
      sameIdOptionCount > 1 || [...referencedUseCases].some((useCase) => useCase !== targetUseCase);
    const editedOption = isSharedAcrossUseCases
      ? {
          ...createEnumOption(originalOption.label, undefined, targetUseCase),
          description: originalOption.description
        }
      : originalOption;
    const nextOptions = isSharedAcrossUseCases
      ? config.enums.performanceArea.filter((option) => option.id !== originalOption.id)
      : [...config.enums.performanceArea];
    const replacementByUseCase = new Map<string, string>();
    const replacementForUseCase = (useCase: string) => {
      const cached = replacementByUseCase.get(useCase);
      if (cached) {
        return cached;
      }

      const existing = nextOptions.find(
        (option, index) => index !== targetIndex && option.useCase === useCase && option.label === originalOption.label
      );
      if (existing) {
        replacementByUseCase.set(useCase, existing.id);
        return existing.id;
      }

      const created = {
        ...createEnumOption(originalOption.label, undefined, useCase),
        description: originalOption.description
      };
      nextOptions.push(created);
      replacementByUseCase.set(useCase, created.id);
      return created.id;
    };

    if (isSharedAcrossUseCases) {
      for (const option of config.enums.performanceArea) {
        if (option.id === originalOption.id && option.useCase && option.useCase !== targetUseCase) {
          replacementForUseCase(option.useCase);
        }
      }
    }

    const kpis = config.kpis.map((kpi) => {
      const performanceAreasByUseCase = kpi.performanceAreasByUseCase.map((entry) => {
        if (!entry.performanceAreas.includes(originalOption.id)) {
          return entry;
        }

        const replacementId = entry.useCase === targetUseCase ? editedOption.id : replacementForUseCase(entry.useCase);
        return {
          ...entry,
          performanceAreas: [...new Set(entry.performanceAreas.map((id) => (id === originalOption.id ? replacementId : id)))]
        };
      });

      return {
        ...kpi,
        performanceAreasByUseCase,
        performanceArea: aggregatePerformanceAreas(performanceAreasByUseCase)
      };
    });

    const nextOption = {
      ...editedOption,
      useCase: targetUseCase,
      [field]: value
    };
    if (isSharedAcrossUseCases) {
      nextOptions.push(nextOption);
    } else {
      nextOptions[targetIndex] = nextOption;
    }

    onConfigChange({
      ...config,
      enums: {
        ...config.enums,
        performanceArea: nextOptions
      },
      kpis
    });
  };

  const updateOption = (option: EnumOption, field: 'label' | 'description', value: string) => {
    if (category === 'performanceArea') {
      updatePerformanceAreaOption(option, field, value);
      return;
    }

    onConfigChange({
      ...config,
      enums: {
        ...config.enums,
        [category]: config.enums[category].map((entry) => (entry.id === option.id ? { ...entry, [field]: value } : entry))
      }
    });
  };

  const addOption = () => {
    if (category === 'useCase' && !newUseCaseUserGroup) {
      return;
    }
    if (category === 'performanceArea' && !newPerformanceAreaUseCase) {
      return;
    }

    onConfigChange({
      ...config,
      enums: {
        ...config.enums,
        [category]: [
          ...config.enums[category],
          category === 'useCase'
            ? createEnumOption('New option', newUseCaseUserGroup)
            : category === 'performanceArea'
              ? createEnumOption('New option', undefined, newPerformanceAreaUseCase)
              : createEnumOption()
        ]
      }
    });
  };

  const deleteOption = (targetOption: EnumOption) => {
    const optionId = targetOption.id;
    const option = category === 'performanceArea'
      ? config.enums.performanceArea.find((entry) => entry.id === targetOption.id && entry.useCase === targetOption.useCase)
      : config.enums[category].find((entry) => entry.id === optionId);
    const ownedUseCaseIds =
      category === 'userGroup' ? config.enums.useCase.filter((entry) => entry.userGroup === optionId).map((entry) => entry.id) : [];
    const ownedUseCaseIdSet = new Set(ownedUseCaseIds);
    const affected = config.kpis.filter((kpi) => kpiEnumReferences(kpi, category).includes(optionId));
    const affectedNames = affected.map((kpi) => kpi.name).join(', ');
    const prompt = affected.length
      ? `Delete "${option?.label}" and remove it from ${affected.length} KPI(s): ${affectedNames}${
          ownedUseCaseIds.length ? `? This will also delete ${ownedUseCaseIds.length} owned use case option(s).` : '?'
        }`
      : `Delete "${option?.label}"?`;
    if (!window.confirm(prompt)) {
      return;
    }

    if (category === 'userGroup') {
      const ownedPerformanceAreaIds = config.enums.performanceArea
        .filter((entry) => entry.useCase && ownedUseCaseIdSet.has(entry.useCase))
        .map((entry) => entry.id);
      const ownedPerformanceAreaIdSet = new Set(ownedPerformanceAreaIds);
      onConfigChange({
        ...config,
        enums: {
          ...config.enums,
          userGroup: config.enums.userGroup.filter((entry) => entry.id !== optionId),
          useCase: config.enums.useCase.filter((entry) => !ownedUseCaseIdSet.has(entry.id)),
          performanceArea: config.enums.performanceArea.filter((entry) => !ownedPerformanceAreaIdSet.has(entry.id))
        },
        kpis: config.kpis.map((kpi) => {
          const performanceAreasByUseCase = kpi.performanceAreasByUseCase.filter((entry) => !ownedUseCaseIdSet.has(entry.useCase));
          return {
            ...kpi,
            userGroupUseCases: kpi.userGroupUseCases
              .filter((entry) => entry.userGroup !== optionId)
              .map((entry) => ({
                ...entry,
                useCases: entry.useCases.filter((id) => !ownedUseCaseIdSet.has(id))
            })),
            performanceAreasByUseCase,
            performanceArea: aggregatePerformanceAreas(performanceAreasByUseCase),
            notesByUseCase: kpi.notesByUseCase.filter((entry) => !ownedUseCaseIdSet.has(entry.useCase))
          };
        })
      });
      onFilterChange(filter.filter((id) => id !== optionId));
      onCascadeUseCaseDelete?.(ownedUseCaseIds);
      return;
    }

    if (category === 'useCase') {
      const ownedPerformanceAreaIds = config.enums.performanceArea
        .filter((entry) => entry.useCase === optionId)
        .map((entry) => entry.id);
      const ownedPerformanceAreaIdSet = new Set(ownedPerformanceAreaIds);
      onConfigChange({
        ...config,
        enums: {
          ...config.enums,
          useCase: config.enums.useCase.filter((entry) => entry.id !== optionId),
          performanceArea: config.enums.performanceArea.filter((entry) => !ownedPerformanceAreaIdSet.has(entry.id))
        },
        kpis: config.kpis.map((kpi) => {
          const performanceAreasByUseCase = kpi.performanceAreasByUseCase.filter((entry) => entry.useCase !== optionId);
          return {
            ...withKpiEnumReferences(
              {
                ...kpi,
                performanceAreasByUseCase,
                performanceArea: aggregatePerformanceAreas(performanceAreasByUseCase)
              },
              'useCase',
              kpiEnumReferences(kpi, 'useCase').filter((id) => id !== optionId)
            ),
            performanceAreasByUseCase,
            performanceArea: aggregatePerformanceAreas(performanceAreasByUseCase).filter((id) => !ownedPerformanceAreaIdSet.has(id)),
            notesByUseCase: kpi.notesByUseCase.filter((entry) => entry.useCase !== optionId)
          };
        })
      });
      onFilterChange(filter.filter((id) => id !== optionId));
      onCascadeUseCaseDelete?.([optionId]);
      return;
    }

    if (category === 'performanceArea') {
      const targetUseCase = option?.useCase;
      if (!targetUseCase) {
        return;
      }

      const nextOptions = config.enums.performanceArea.filter(
        (entry) => !(entry.id === optionId && entry.useCase === targetUseCase)
      );
      const replacementByUseCase = new Map<string, string>();
      const replacementForUseCase = (useCase: string) => {
        const cached = replacementByUseCase.get(useCase);
        if (cached) {
          return cached;
        }

        const existing = nextOptions.find(
          (entry) => entry.useCase === useCase && entry.label === option.label
        );
        if (existing) {
          replacementByUseCase.set(useCase, existing.id);
          return existing.id;
        }

        const created = {
          ...createEnumOption(option.label, undefined, useCase),
          description: option.description
        };
        nextOptions.push(created);
        replacementByUseCase.set(useCase, created.id);
        return created.id;
      };

      const nextKpis = config.kpis.map((kpi) => {
        const performanceAreasByUseCase = kpi.performanceAreasByUseCase.map((entry) => ({
          ...entry,
          performanceAreas: entry.useCase === targetUseCase
            ? entry.performanceAreas.filter((id) => id !== optionId)
            : entry.performanceAreas.map((id) => (id === optionId ? replacementForUseCase(entry.useCase) : id))
        }));
        return {
          ...kpi,
          performanceAreasByUseCase,
          performanceArea: aggregatePerformanceAreas(performanceAreasByUseCase)
        };
      });

      onConfigChange({
        ...config,
        enums: {
          ...config.enums,
          performanceArea: nextOptions
        },
        kpis: nextKpis
      });
      onFilterChange(filter.filter((id) => id !== optionId));
      return;
    }

    onConfigChange({
      ...config,
      enums: {
        ...config.enums,
        [category]: config.enums[category].filter((entry) => entry.id !== optionId)
      },
      kpis: config.kpis.map((kpi) =>
        withKpiEnumReferences(
          kpi,
          category,
          kpiEnumReferences(kpi, category).filter((id) => id !== optionId)
        )
      )
    });
    onFilterChange(filter.filter((id) => id !== optionId));
  };

  return (
    <div className="header-control">
      <div className="header-title">
        <span>{enumCategoryLabels[category]}</span>
        {filter.length ? <strong>{filter.length}</strong> : null}
        <div className="enum-manager-control" ref={managerRef}>
          <button
            className="mini-icon-button"
            type="button"
            aria-label={`Manage ${enumCategoryLabels[category]}`}
            title={`Manage ${enumCategoryLabels[category]}`}
            onClick={() => setManageOpen((next) => !next)}
          >
            <Settings2 size={13} aria-hidden="true" />
          </button>
          {manageOpen ? (
            <div className="enum-popover">
              <div className="popover-heading">
                <strong>{enumCategoryLabels[category]}</strong>
                {category === 'useCase' ? (
                  <label className="enum-add-group">
                    <span>User group</span>
                    <select value={newUseCaseUserGroup} onChange={(event) => setNewUseCaseUserGroup(event.target.value)}>
                      {addUseCaseUserGroupOptions.map((option) => (
                        <option value={option.id} key={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                {category === 'performanceArea' ? (
                  <label className="enum-add-group">
                    <span>Use case</span>
                    <select value={newPerformanceAreaUseCase} onChange={(event) => setNewPerformanceAreaUseCase(event.target.value)}>
                      {addPerformanceAreaUseCaseOptions.map((option) => (
                        <option value={option.id} key={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                <button
                  className="secondary-action tiny"
                  type="button"
                  onClick={addOption}
                  disabled={
                    (category === 'useCase' && !newUseCaseUserGroup) ||
                    (category === 'performanceArea' && !newPerformanceAreaUseCase)
                  }
                >
                  <Plus size={12} aria-hidden="true" />
                  Add option
                </button>
              </div>
              {category === 'useCase' && config.enums.userGroup.length === 0 ? (
                <span className="empty-option">Add a user group before adding use cases.</span>
              ) : null}
              {category === 'performanceArea' && addPerformanceAreaUseCaseOptions.length === 0 ? (
                <span className="empty-option">Add a use case before adding performance areas.</span>
              ) : null}
              <div className="enum-edit-list">
                {managerOptions.length === 0 ? (
                  <span className="empty-option">
                    {category === 'useCase' && newUseCaseUserGroup
                      ? 'No use cases for this user group.'
                      : category === 'performanceArea' && newPerformanceAreaUseCase
                        ? 'No performance areas for this use case.'
                        : 'No options in this category.'}
                  </span>
                ) : null}
                {managerOptions.map((option) => (
                  <div className={`enum-edit-row ${category === 'useCase' ? 'use-case-enum-row' : ''}`} key={`${option.id}-${option.useCase ?? option.userGroup ?? ''}`}>
                    <input value={option.label} onChange={(event) => updateOption(option, 'label', event.target.value)} />
                    <input
                      value={option.description ?? ''}
                      placeholder="Description"
                      onChange={(event) => updateOption(option, 'description', event.target.value)}
                    />
                    <button
                      className="mini-icon-button danger"
                      type="button"
                      aria-label={`Delete ${option.label}`}
                      title="Delete domain option"
                      onClick={() => deleteOption(option)}
                    >
                      <Trash2 size={13} aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
      <HeaderMultiSelect
        label={`Filter ${enumCategoryLabels[category]}`}
        options={filterOptions ?? config.enums[category]}
        value={filter}
        onChange={onFilterChange}
      />
    </div>
  );
}

function UseCaseHeader({
  config,
  userGroupFilter,
  useCaseFilter,
  onUserGroupFilterChange,
  onUseCaseFilterChange,
  onConfigChange
}: {
  config: KpiPoolConfig;
  userGroupFilter: string[];
  useCaseFilter: string[];
  onUserGroupFilterChange: (next: string[]) => void;
  onUseCaseFilterChange: (next: string[]) => void;
  onConfigChange: (next: KpiPoolConfig) => void;
}) {
  const userGroupLabels = new Map(config.enums.userGroup.map((option) => [option.id, option.label]));
  const visibleUserGroups = useMemo(
    () =>
      userGroupFilter.length > 0
        ? config.enums.userGroup.filter((option) => userGroupFilter.includes(option.id))
        : config.enums.userGroup,
    [config.enums.userGroup, userGroupFilter]
  );
  const visibleUseCases = useMemo(
    () =>
      userGroupFilter.length > 0
        ? config.enums.useCase.filter((option) => option.userGroup && userGroupFilter.includes(option.userGroup))
        : config.enums.useCase,
    [config.enums.useCase, userGroupFilter]
  );
  const visibleUseCaseIds = useMemo(() => new Set(visibleUseCases.map((option) => option.id)), [visibleUseCases]);
  const useCaseFilterOptions = visibleUseCases.map((option) => ({
    id: option.id,
    label: `${userGroupLabels.get(option.userGroup ?? '') ?? 'Unassigned'} / ${option.label}`
  }));

  useEffect(() => {
    const nextUseCaseFilter = useCaseFilter.filter((id) => visibleUseCaseIds.has(id));
    if (nextUseCaseFilter.length !== useCaseFilter.length) {
      onUseCaseFilterChange(nextUseCaseFilter);
    }
  }, [onUseCaseFilterChange, useCaseFilter, visibleUseCaseIds]);

  return (
    <div className="use-case-header-control">
      <div className="use-case-compact-title">User Group / Use Case</div>
      <div className="use-case-filter-row">
        <div className="use-case-filter-line">
          <span>UG</span>
          <EnumHeader
            config={config}
            category="userGroup"
            filter={userGroupFilter}
            onFilterChange={onUserGroupFilterChange}
            onCascadeUseCaseDelete={(deletedUseCaseIds) =>
              onUseCaseFilterChange(useCaseFilter.filter((id) => !deletedUseCaseIds.includes(id)))
            }
            onConfigChange={onConfigChange}
          />
        </div>
        <div className="use-case-filter-line">
          <span>UC</span>
          <EnumHeader
            config={config}
            category="useCase"
            filter={useCaseFilter}
            onFilterChange={onUseCaseFilterChange}
            filterOptions={useCaseFilterOptions}
            manageOptions={visibleUseCases}
            useCaseUserGroupOptions={visibleUserGroups}
            onConfigChange={onConfigChange}
          />
        </div>
      </div>
    </div>
  );
}

function UseCaseFocusController({
  config,
  examineAssignment,
  focusAssignment,
  hideUnassigned,
  onExamineAssignmentChange,
  onEnterFocus,
  onExitFocus,
  onHideUnassignedChange
}: {
  config: KpiPoolConfig;
  examineAssignment?: UseCaseAssignment;
  focusAssignment?: UseCaseAssignment;
  hideUnassigned: boolean;
  onExamineAssignmentChange: (next?: UseCaseAssignment) => void;
  onEnterFocus: (assignment: UseCaseAssignment) => void;
  onExitFocus: () => void;
  onHideUnassignedChange: (next: boolean) => void;
}) {
  const focusUserGroup = focusAssignment ? config.enums.userGroup.find((option) => option.id === focusAssignment.userGroup) : undefined;
  const focusUseCase = focusAssignment ? config.enums.useCase.find((option) => option.id === focusAssignment.useCase) : undefined;
  const examineUseCases = useMemo(
    () =>
      examineAssignment?.userGroup
        ? config.enums.useCase.filter((option) => option.userGroup === examineAssignment.userGroup)
        : [],
    [examineAssignment?.userGroup, config.enums.useCase]
  );

  useEffect(() => {
    if (examineAssignment) {
      const validExamineUseCase = config.enums.useCase.some(
        (option) => option.id === examineAssignment.useCase && option.userGroup === examineAssignment.userGroup
      );
      if (!validExamineUseCase) {
        onExamineAssignmentChange(undefined);
      }
    }

    if (focusAssignment) {
      const validFocusUseCase = config.enums.useCase.some(
        (option) => option.id === focusAssignment.useCase && option.userGroup === focusAssignment.userGroup
      );
      if (!validFocusUseCase) {
        onExitFocus();
      }
    }
  }, [config.enums.useCase, examineAssignment, focusAssignment, onExamineAssignmentChange, onExitFocus]);

  const changeExamineUserGroup = (userGroup: string) => {
    const firstUseCase = config.enums.useCase.find((option) => option.userGroup === userGroup);
    onExamineAssignmentChange(userGroup && firstUseCase ? { userGroup, useCase: firstUseCase.id } : undefined);
  };

  const changeExamineUseCase = (useCase: string) => {
    if (!examineAssignment?.userGroup) {
      return;
    }

    onExamineAssignmentChange({
      userGroup: examineAssignment.userGroup,
      useCase
    });
  };

  return (
    <section
      className={`topbar-focus-controller ${focusAssignment ? 'is-active' : 'is-picker'}`}
      aria-label="Use case focus controller"
    >
      <span className="focus-controller-label">Use Case Focus</span>
      {focusAssignment ? (
        <div className="focus-active-summary">
          <strong title={focusUserGroup?.label}>{focusUserGroup?.label ?? 'User group'}</strong>
          <strong title={focusUseCase?.label}>{focusUseCase?.label ?? 'Use case'}</strong>
          <button className="secondary-action tiny" type="button" onClick={onExitFocus}>
            Exit
          </button>
        </div>
      ) : (
        <div className="focus-picker">
          <select
            aria-label="User group for use case focus"
            value={examineAssignment?.userGroup ?? ''}
            onChange={(event) => changeExamineUserGroup(event.target.value)}
          >
            <option value="">User group</option>
            {config.enums.userGroup.map((option) => (
              <option value={option.id} key={option.id}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            aria-label="Use case for focus"
            value={examineAssignment?.useCase ?? ''}
            disabled={!examineAssignment?.userGroup || examineUseCases.length === 0}
            onChange={(event) => changeExamineUseCase(event.target.value)}
          >
            {examineUseCases.map((option) => (
              <option value={option.id} key={option.id}>
                {option.label}
              </option>
            ))}
          </select>
          <button
            className="primary-action tiny"
            type="button"
            disabled={!examineAssignment}
            onClick={() => examineAssignment && onEnterFocus(examineAssignment)}
          >
            Focus
          </button>
        </div>
      )}
      <label className="focus-hide-toggle">
        <input
          type="checkbox"
          checked={hideUnassigned}
          disabled={!focusAssignment}
          onChange={(event) => onHideUnassignedChange(event.target.checked)}
        />
        <span>Hide outside group</span>
      </label>
    </section>
  );
}

const spatialScaleFormulaItem = (scale: SpatialScaleKey, value: KpiMetric['spatialScales'][SpatialScaleKey]): KpiFormulaItem => ({
  tag: `${spatialScaleLabels[scale]} aggregation`,
  formula: value.formula,
  leftExpression: value.leftExpression,
  rightExpression: value.rightExpression,
  generalExplanation: value.aggregationMethod,
  terms: []
});

function SpatialScaleBadges({
  config,
  kpi,
  onSemanticTarget
}: {
  config: KpiPoolConfig;
  kpi: KpiMetric;
  onSemanticTarget: (target: FormulaSemanticTarget) => void;
}) {
  const applicableScales = spatialScaleKeys.filter((scale) => kpi.spatialScales[scale].applicable);
  const scalesWithoutFormula = applicableScales.filter((scale) => {
    const value = kpi.spatialScales[scale];
    return value.isBasicUnit || !value.formula.trim();
  });
  const scalesWithFormula = applicableScales.filter((scale) => {
    const value = kpi.spatialScales[scale];
    return !value.isBasicUnit && value.formula.trim();
  });

  if (applicableScales.length === 0) {
    return <span className="muted-dash">No applicable scales</span>;
  }

  return (
    <div className="scale-badges">
      {scalesWithoutFormula.length ? (
        <div className="scale-badge-only-list">
          {scalesWithoutFormula.map((scale) => {
            const value = kpi.spatialScales[scale];
            return (
              <span
                className={`scale-badge is-on ${value.isBasicUnit ? 'is-basic' : ''}`}
                key={scale}
                title={value.aggregationMethod || 'No aggregation formula'}
              >
                {spatialScaleLabels[scale]}
              </span>
            );
          })}
        </div>
      ) : null}
      {scalesWithFormula.map((scale) => {
        const value = kpi.spatialScales[scale];
        const item = spatialScaleFormulaItem(scale, value);
        return (
          <div className="scale-aggregation-summary is-on" key={scale}>
            <span
              className={`scale-badge is-on ${value.isBasicUnit ? 'is-basic' : ''}`}
              title={value.aggregationMethod || 'No aggregation explanation'}
            >
              {spatialScaleLabels[scale]}
            </span>
            <InteractiveFormulaPreview config={config} kpi={kpi} item={item} onSemanticTarget={onSemanticTarget} inline />
          </div>
        );
      })}
    </div>
  );
}

function FormulaDisplay({
  config,
  kpi,
  highlightedFormulaIndex,
  onSemanticTarget
}: {
  config: KpiPoolConfig;
  kpi: KpiMetric;
  highlightedFormulaIndex?: number;
  onSemanticTarget: (target: FormulaSemanticTarget) => void;
}) {
  const formulas = kpi.description.formulas;
  const comment = kpi.description.formulaComment;
  const hasFormula = formulas.some((group) => group.items.some((item) => item.formula.trim()));
  const displayRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const element = displayRef.current;
    if (!element) return undefined;
    const cell = element.closest<HTMLTableCellElement>('td');
    let active = true;
    let frame: number | null = null;

    const measure = () => {
      if (!active) return;
      frame = null;
      if (cell) {
        const cellStyle = getComputedStyle(cell);
        const availableCellHeight = cell.clientHeight
          - (Number.parseFloat(cellStyle.paddingTop) || 0)
          - (Number.parseFloat(cellStyle.paddingBottom) || 0);
        const rowAvailableHeight = `${Math.max(0, Math.floor(availableCellHeight))}px`;
        if (element.style.getPropertyValue('--formula-display-row-available-height') !== rowAvailableHeight) {
          element.style.setProperty('--formula-display-row-available-height', rowAvailableHeight);
        }
      }

    };

    const scheduleMeasure = () => {
      if (!active || frame !== null) return;
      frame = window.requestAnimationFrame(measure);
    };

    scheduleMeasure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(scheduleMeasure);
    observer?.observe(element);
    if (cell) {
      observer?.observe(cell);
    }
    Array.from(element.children).forEach((child) => observer?.observe(child));
    void document.fonts?.ready.then(scheduleMeasure);

    return () => {
      active = false;
      if (frame !== null) window.cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, [comment, formulas, hasFormula]);

  useEffect(() => {
    const element = displayRef.current;
    if (!element) return undefined;

    const handleWheel = (event: WheelEvent) => {
      if (event.deltaY === 0 || element.scrollHeight <= element.clientHeight + 1) return;
      const canScrollInDirection = event.deltaY < 0
        ? element.scrollTop > 1
        : element.scrollTop + element.clientHeight < element.scrollHeight - 1;
      if (canScrollInDirection) return;

      const tableScroller = element.closest<HTMLElement>('.table-scroll');
      if (!tableScroller) return;
      const deltaMultiplier = event.deltaMode === WheelEvent.DOM_DELTA_LINE
        ? 16
        : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
          ? tableScroller.clientHeight
          : 1;
      event.preventDefault();
      event.stopPropagation();
      tableScroller.scrollTop += event.deltaY * deltaMultiplier;
    };

    element.addEventListener('wheel', handleWheel, { passive: false });
    return () => element.removeEventListener('wheel', handleWheel);
  }, []);

  if (!hasFormula) {
    return (
      <div className="formula-display formula-comment-display" ref={displayRef}>
        {comment.trim() ? <span>{comment}</span> : <span className="muted-dash">No formula</span>}
      </div>
    );
  }
  const visibleGroups = formulas
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) =>
          item.tag.trim() ||
          item.formula.trim() ||
          item.generalExplanation.trim() ||
          item.terms.some((term) => term.term.trim() || term.explanation.trim())
      )
    }))
    .filter((group) => group.name.trim() || group.items.length > 0);

  return (
    <div className="formula-display" ref={displayRef}>
      {visibleGroups.length ? (
        visibleGroups.map((group, groupIndex) => (
          <div className="formula-display-group" key={`${group.name}-${groupIndex}`}>
            {group.name.trim() ? <span className="formula-group-label">{group.name}</span> : null}
            {group.items.length ? (
              group.items.map((item, itemIndex) => (
                <div className="formula-display-item" key={`${item.tag}-${groupIndex}-${itemIndex}`}>
                  <div className="formula-render-wrap">
                    {item.formula.trim() ? (
                      <InteractiveFormulaPreview
                        config={config}
                        kpi={kpi}
                        item={item}
                        highlightedFormulaIndex={highlightedFormulaIndex}
                        onSemanticTarget={onSemanticTarget}
                      />
                    ) : (
                      <span className="muted-dash">No formula</span>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <span className="muted-dash">No formula</span>
            )}
          </div>
        ))
      ) : (
        <span className="muted-dash">No formula</span>
      )}
    </div>
  );
}

type AutoGrowTextareaProps = Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange'> & {
  value: string;
  onValueChange: (value: string) => void;
  preventLineBreaks?: boolean;
  debounceMs?: number;
};

const textInputDebounceMs = 300;

function useDebouncedTextValue(value: string, onValueChange: (value: string) => void, debounceMs = textInputDebounceMs) {
  const [draft, setDraftState] = useState(value);
  const draftRef = useRef(value);
  const committedValueRef = useRef(value);
  const onValueChangeRef = useRef(onValueChange);
  const timeoutRef = useRef<number | null>(null);
  onValueChangeRef.current = onValueChange;

  const clearPendingCommit = useCallback(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const commit = useCallback((nextValue = draftRef.current) => {
    clearPendingCommit();
    if (nextValue !== committedValueRef.current) onValueChangeRef.current(nextValue);
  }, [clearPendingCommit]);

  const setDraft = useCallback((nextValue: string) => {
    draftRef.current = nextValue;
    setDraftState(nextValue);
    clearPendingCommit();
    timeoutRef.current = window.setTimeout(() => commit(nextValue), debounceMs);
  }, [clearPendingCommit, commit, debounceMs]);

  useEffect(() => {
    committedValueRef.current = value;
    if (value !== draftRef.current && timeoutRef.current === null) {
      draftRef.current = value;
      setDraftState(value);
    }
  }, [value]);

  useEffect(() => clearPendingCommit, [clearPendingCommit]);

  return { draft, setDraft, commit };
}

type DebouncedInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  value: string;
  onValueChange: (value: string) => void;
  debounceMs?: number;
};

function DebouncedInput({ value, onValueChange, debounceMs, onBlur, ...props }: DebouncedInputProps) {
  const debounced = useDebouncedTextValue(value, onValueChange, debounceMs);
  return (
    <input
      {...props}
      value={debounced.draft}
      onChange={(event) => debounced.setDraft(event.target.value)}
      onBlur={(event) => {
        debounced.commit(event.currentTarget.value);
        onBlur?.(event);
      }}
    />
  );
}

type DebouncedTextareaProps = Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'> & {
  value: string;
  onValueChange: (value: string) => void;
  debounceMs?: number;
};

function DebouncedTextarea({ value, onValueChange, debounceMs, onBlur, ...props }: DebouncedTextareaProps) {
  const debounced = useDebouncedTextValue(value, onValueChange, debounceMs);
  return (
    <textarea
      {...props}
      value={debounced.draft}
      onChange={(event) => debounced.setDraft(event.target.value)}
      onBlur={(event) => {
        debounced.commit(event.currentTarget.value);
        onBlur?.(event);
      }}
    />
  );
}

function AutoGrowTextarea({ value, onValueChange, preventLineBreaks = false, debounceMs, onBlur, ...props }: AutoGrowTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const debounced = useDebouncedTextValue(value, onValueChange, debounceMs);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return undefined;
    }

    const resize = () => {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    };

    resize();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize);
    observer?.observe(textarea);
    if (textarea.parentElement) {
      observer?.observe(textarea.parentElement);
    }
    window.addEventListener('resize', resize);

    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', resize);
    };
  }, [debounced.draft]);

  return (
    <textarea
      {...props}
      ref={textareaRef}
      value={debounced.draft}
      onChange={(event) => debounced.setDraft(event.target.value)}
      onBlur={(event) => {
        debounced.commit(event.currentTarget.value);
        onBlur?.(event);
      }}
      onKeyDown={(event) => {
        if (preventLineBreaks && event.key === 'Enter') {
          event.preventDefault();
        }
        props.onKeyDown?.(event);
      }}
    />
  );
}

function EnumOptionEditor({
  options,
  label,
  onChange,
  required = false,
  disabled = false
}: {
  options: string[];
  label: string;
  onChange: (options: string[]) => void;
  required?: boolean;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState('');

  const addOption = () => {
    const option = draft.trim();
    if (!option) return;
    if (!options.some((entry) => entry.trim().toLocaleLowerCase() === option.toLocaleLowerCase())) {
      onChange([...options, option]);
    }
    setDraft('');
  };

  const updateOption = (optionIndex: number, value: string) => {
    onChange(options.map((option, index) => index === optionIndex ? value : option));
  };

  const confirmOption = (optionIndex: number, value: string) => {
    const option = value.trim();
    if (!option) {
      onChange(options.filter((_, index) => index !== optionIndex));
      return;
    }
    if (option !== value) updateOption(optionIndex, option);
  };

  return (
    <div className="enum-option-editor">
      <div className="enum-option-list">
        {options.map((option, optionIndex) => (
          <span className="enum-option-chip" key={optionIndex}>
            <input
              disabled={disabled}
              value={option}
              size={Math.max(1, Math.min(32, option.length || 1))}
              aria-label={`${label} option ${optionIndex + 1}`}
              onBlur={(event) => confirmOption(optionIndex, event.target.value)}
              onChange={(event) => updateOption(optionIndex, event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  event.currentTarget.blur();
                }
              }}
            />
            <button
              disabled={disabled}
              type="button"
              title={`Remove ${option || 'option'}`}
              aria-label={`Remove ${label} option ${optionIndex + 1}`}
              onClick={() => onChange(options.filter((_, index) => index !== optionIndex))}
            ><X size={10} /></button>
          </span>
        ))}
        {!disabled ? <span className="enum-option-adder">
          <input
            value={draft}
            size={Math.max(8, Math.min(32, draft.length || 8))}
            aria-label={`New ${label} option`}
            placeholder="Add option"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return;
              event.preventDefault();
              addOption();
            }}
          />
          <button
            type="button"
            title="Add option"
            aria-label={`Add ${label} option`}
            disabled={!draft.trim()}
            onClick={addOption}
          ><Plus size={11} /></button>
        </span> : null}
      </div>
      {required && options.length === 0 ? <span className="enum-options-required">{disabled ? 'This global domain has no options. Add them in Domains.' : 'Add at least one option for this domain.'}</span> : null}
    </div>
  );
}

function ViewDomainButton({
  domainId,
  domainName,
  onView
}: {
  domainId: string;
  domainName: string;
  onView: (domainId: string) => void;
}) {
  return (
    <button
      className="mini-icon-button domain-view-button"
      type="button"
      title={`View ${domainName || 'domain'} in Domains`}
      aria-label={`View ${domainName || 'domain'} in Domains`}
      onClick={(event) => {
        event.stopPropagation();
        onView(domainId);
      }}
    >
      <Eye size={12} aria-hidden="true" />
    </button>
  );
}

type DomainChoiceSection = {
  id: string;
  label?: string;
  definitions: ValueEnumDefinition[];
};

const domainChoiceSections = (
  definitions: ValueEnumDefinition[],
  groups: DataLibraryGroup[]
): DomainChoiceSection[] => {
  const availableIds = new Set(definitions.map((definition) => definition.id));
  const groupedIds = new Set(groups.flatMap((group) => group.itemIds));
  const groupedSections = [...groups]
    .sort((first, second) => first.position - second.position)
    .map((group) => ({
      id: group.id,
      label: group.name || 'Untitled group',
      definitions: group.itemIds
        .filter((id) => availableIds.has(id))
        .map((id) => definitions.find((definition) => definition.id === id))
        .filter((definition): definition is ValueEnumDefinition => Boolean(definition))
    }))
    .filter((section) => section.definitions.length > 0);
  const ungrouped = definitions.filter((definition) => !groupedIds.has(definition.id));

  if (groupedSections.length === 0) {
    return [{ id: 'all-domains', definitions }];
  }
  return [
    ...groupedSections,
    ...(ungrouped.length ? [{ id: 'ungrouped-domains', definitions: ungrouped }] : [])
  ];
};

function GroupedDomainSelect({
  definitions,
  groups,
  value,
  label,
  onChange
}: {
  definitions: ValueEnumDefinition[];
  groups: DataLibraryGroup[];
  value: string;
  label: string;
  onChange: (domainId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const controlRef = useCloseOnOutsideClick<HTMLDivElement>(open, () => setOpen(false));
  const selected = definitions.find((definition) => definition.id === value);
  return (
    <div className="grouped-domain-select" ref={controlRef}>
      <button className="grouped-domain-select-trigger" type="button" aria-label={label} aria-expanded={open} onClick={() => setOpen((current) => !current)}>
        <ListFilter size={13} aria-hidden="true" />
        <span>{selected?.name || 'Untitled domain'}</span>
        <ChevronDown size={13} aria-hidden="true" className={open ? 'rotate' : ''} />
      </button>
      {open ? <div className="global-domain-picker grouped-domain-select-menu" role="menu">
        <GroupedDomainPickerOptions
          definitions={definitions}
          groups={groups}
          onSelect={(domainId) => {
            onChange(domainId);
            setOpen(false);
          }}
        />
      </div> : null}
    </div>
  );
}

function GroupedDomainPickerOptions({
  definitions,
  groups,
  onSelect
}: {
  definitions: ValueEnumDefinition[];
  groups: DataLibraryGroup[];
  onSelect: (domainId: string) => void;
}) {
  const [expandedSectionIds, setExpandedSectionIds] = useState<string[]>([]);
  const sections = domainChoiceSections(definitions, groups);
  return <>{sections.map((section) => (
    <div className="global-domain-picker-section" key={section.id}>
      {section.label ? <button
        className="global-domain-picker-heading"
        type="button"
        aria-expanded={expandedSectionIds.includes(section.id)}
        onClick={() => setExpandedSectionIds((current) => current.includes(section.id)
          ? current.filter((id) => id !== section.id)
          : [...current, section.id])}
      >
        <ChevronDown className={expandedSectionIds.includes(section.id) ? '' : 'is-collapsed'} size={11} aria-hidden="true" />
        <span>{section.label}</span>
        <small>{section.definitions.length}</small>
      </button> : null}
      {(!section.label || expandedSectionIds.includes(section.id)) ? section.definitions.map((definition) => (
        <button type="button" role="menuitem" key={definition.id} onClick={() => onSelect(definition.id)}>
          <strong>{definition.name || 'Untitled domain'}</strong>
          <small>{definition.options.length ? definition.options.join(', ') : 'No options defined'}</small>
        </button>
      )) : null}
    </div>
  ))}</>;
}

function ValueEnumModeControl({
  definitions,
  groups,
  enumId,
  label,
  onEnumChange,
  onViewDomain
}: {
  definitions: ValueEnumDefinition[];
  groups: DataLibraryGroup[];
  enumId?: string;
  label: string;
  onEnumChange: (enumId?: string) => void;
  onViewDomain: (domainId: string) => void;
}) {
  const selected = definitions.find((definition) => definition.id === enumId);
  const globalMode = Boolean(selected);
  return (
    <div className={`value-enum-mode-control ${globalMode ? 'is-global' : 'is-custom'}`}>
      <label className="value-enum-mode-toggle">
        <span>Custom</span>
        <input
          type="checkbox"
          role="switch"
          checked={globalMode}
          disabled={!globalMode && definitions.length === 0}
          aria-label={`Use a global domain for ${label}`}
          onChange={(event) => onEnumChange(event.target.checked ? definitions[0]?.id : undefined)}
        />
        <span>Global domain</span>
      </label>
      {selected ? <>
        <GroupedDomainSelect definitions={definitions} groups={groups} value={selected.id} label={`Global domain for ${label}`} onChange={onEnumChange} />
        <ViewDomainButton domainId={selected.id} domainName={selected.name} onView={onViewDomain} />
        <small className="value-enum-mode-summary">{selected.options.length ? selected.options.join(', ') : 'No options defined'}</small>
      </> : definitions.length === 0 ? <small className="value-enum-mode-summary">Create a domain in the Domains tray to enable global mode.</small> : null}
    </div>
  );
}

const markdownInlinePattern = /(`(?:\\.|[^\\`\n])+`|\[(?:\\.|[^\\\]\n])+\]\([^)\n]+\)|\*\*(?:\\.|(?!\*\*)[^\\\n])+\*\*|__(?:\\.|(?!__)[^\\\n])+__|~~(?:\\.|(?!~~)[^\\\n])+~~|\*(?:\\.|[^\\*\n])+\*|_(?:\\.|[^\\_\n])+_)/g;
const markdownEscapableCharacterPattern = /[\\`*_[\]{}()<>#+\-.!|>~]/g;
const markdownEscapeSequencePattern = /\\([\\`*_[\]{}()<>#+\-.!|>~])/g;

const encodeMarkdownText = (value: string) => value.replace(markdownEscapableCharacterPattern, '\\$&');
const decodeMarkdownText = (value: string) => value.replace(markdownEscapeSequencePattern, '$1');

const safeMarkdownHref = (href: string) =>
  /^(https?:\/\/|mailto:|#|\/(?!\/)|\.\.?\/)/i.test(href) ? href : undefined;

type MarkdownTextEdit = (start: number, end: number, value: string) => void;

function EditableMarkdownText({
  value,
  start,
  end,
  onTextEdit,
  placeholder = 'Edit text'
}: {
  value: string;
  start: number;
  end: number;
  onTextEdit: MarkdownTextEdit;
  placeholder?: string;
}) {
  const editableRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const editable = editableRef.current;
    if (editable && document.activeElement !== editable && editable.textContent !== value) editable.textContent = value;
  }, [value]);

  return (
    <span
      className="markdown-editable-text"
      contentEditable
      data-placeholder={placeholder}
      ref={editableRef}
      role="textbox"
      aria-label="Editable Markdown text"
      spellCheck
      suppressContentEditableWarning
      onBlur={(event) => {
        const nextValue = (event.currentTarget.textContent ?? '').replace(/\r?\n/g, ' ');
        if (nextValue !== value) onTextEdit(start, end, nextValue);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.preventDefault();
        if (event.key === 'Escape') event.currentTarget.blur();
      }}
      onPaste={(event) => {
        event.preventDefault();
        const pastedText = event.clipboardData.getData('text/plain').replace(/\r?\n/g, ' ');
        document.execCommand('insertText', false, pastedText);
      }}
    >{value}</span>
  );
}

const renderMarkdownText = (
  value: string,
  key: string,
  start: number,
  onTextEdit?: MarkdownTextEdit,
  placeholder?: string,
  encodeEdit = true
) => onTextEdit
  ? <EditableMarkdownText
      end={start + value.length}
      key={key}
      onTextEdit={(editStart, editEnd, nextValue) => onTextEdit(editStart, editEnd, encodeEdit ? encodeMarkdownText(nextValue) : nextValue)}
      placeholder={placeholder}
      start={start}
      value={encodeEdit ? decodeMarkdownText(value) : value}
    />
  : decodeMarkdownText(value);

function renderMarkdownInline(
  value: string,
  keyPrefix: string,
  baseOffset = 0,
  onTextEdit?: MarkdownTextEdit,
  allowEmpty = false
): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let tokenIndex = 0;
  for (const match of value.matchAll(markdownInlinePattern)) {
    const token = match[0];
    const index = match.index ?? 0;
    if (index > lastIndex) {
      nodes.push(renderMarkdownText(value.slice(lastIndex, index), `${keyPrefix}-text-${tokenIndex}`, baseOffset + lastIndex, onTextEdit));
    }
    const key = `${keyPrefix}-inline-${tokenIndex}`;
    tokenIndex += 1;
    if (token.startsWith('`')) {
      nodes.push(<code key={key}>{renderMarkdownText(token.slice(1, -1), `${key}-code`, baseOffset + index + 1, onTextEdit)}</code>);
    } else if (token.startsWith('[')) {
      const link = token.match(/^\[((?:\\.|[^\\\]])+)\]\((\S+?)(?:\s+"[^"]*")?\)$/);
      const href = link ? safeMarkdownHref(link[2]) : undefined;
      nodes.push(link && href
        ? <a href={href} key={key} onClick={(event) => onTextEdit && event.preventDefault()} rel="noreferrer" target={href.startsWith('#') ? undefined : '_blank'} title={onTextEdit ? `Link target: ${href}` : undefined}>{renderMarkdownInline(link[1], `${key}-link`, baseOffset + index + 1, onTextEdit)}</a>
        : renderMarkdownText(token, `${key}-text`, baseOffset + index, onTextEdit));
    } else if (token.startsWith('**') || token.startsWith('__')) {
      nodes.push(<strong key={key}>{renderMarkdownInline(token.slice(2, -2), `${key}-strong`, baseOffset + index + 2, onTextEdit)}</strong>);
    } else if (token.startsWith('~~')) {
      nodes.push(<del key={key}>{renderMarkdownInline(token.slice(2, -2), `${key}-strike`, baseOffset + index + 2, onTextEdit)}</del>);
    } else {
      nodes.push(<em key={key}>{renderMarkdownInline(token.slice(1, -1), `${key}-em`, baseOffset + index + 1, onTextEdit)}</em>);
    }
    lastIndex = index + token.length;
  }
  if (lastIndex < value.length) {
    nodes.push(renderMarkdownText(value.slice(lastIndex), `${keyPrefix}-text-${tokenIndex}`, baseOffset + lastIndex, onTextEdit));
  }
  if (allowEmpty && value.length === 0 && onTextEdit) {
    nodes.push(renderMarkdownText('', `${keyPrefix}-empty`, baseOffset, onTextEdit, 'Click to edit'));
  }
  return nodes;
}

type MarkdownTableCell = { value: string; start: number; end: number };

const isEscapedMarkdownCharacter = (value: string, index: number) => {
  let slashCount = 0;
  for (let cursor = index - 1; cursor >= 0 && value[cursor] === '\\'; cursor -= 1) slashCount += 1;
  return slashCount % 2 === 1;
};

const markdownTableCellRanges = (line: string, lineStart = 0): MarkdownTableCell[] => {
  const firstContentIndex = line.search(/\S/);
  if (firstContentIndex < 0) return [{ value: '', start: lineStart, end: lineStart }];
  let contentStart = line[firstContentIndex] === '|' ? firstContentIndex + 1 : firstContentIndex;
  let contentEnd = line.length;
  while (contentEnd > contentStart && /\s/.test(line[contentEnd - 1])) contentEnd -= 1;
  if (line[contentEnd - 1] === '|' && !isEscapedMarkdownCharacter(line, contentEnd - 1)) contentEnd -= 1;
  const cells: MarkdownTableCell[] = [];
  let cellStart = contentStart;
  for (let cursor = contentStart; cursor <= contentEnd; cursor += 1) {
    if (cursor < contentEnd && (line[cursor] !== '|' || isEscapedMarkdownCharacter(line, cursor))) continue;
    let trimmedStart = cellStart;
    let trimmedEnd = cursor;
    while (trimmedStart < trimmedEnd && /\s/.test(line[trimmedStart])) trimmedStart += 1;
    while (trimmedEnd > trimmedStart && /\s/.test(line[trimmedEnd - 1])) trimmedEnd -= 1;
    cells.push({ value: line.slice(trimmedStart, trimmedEnd), start: lineStart + trimmedStart, end: lineStart + trimmedEnd });
    cellStart = cursor + 1;
  }
  return cells;
};

const markdownTableCells = (line: string) => markdownTableCellRanges(line).map((cell) => cell.value);

const isMarkdownTableDivider = (line: string) => {
  const cells = markdownTableCells(line);
  return cells.length > 1 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
};

function renderMarkdownBlocks(value: string, keyPrefix: string, onTextEdit?: MarkdownTextEdit): React.ReactNode[] {
  const rawLines = value.split('\n');
  const lines = rawLines.map((line) => line.endsWith('\r') ? line.slice(0, -1) : line);
  const lineStarts: number[] = [];
  let lineOffset = 0;
  rawLines.forEach((line) => {
    lineStarts.push(lineOffset);
    lineOffset += line.length + 1;
  });
  const blocks: React.ReactNode[] = [];
  let index = 0;
  let blockIndex = 0;
  const nextKey = () => `${keyPrefix}-block-${blockIndex++}`;
  const isBlockStart = (lineIndex: number) => {
    const line = lines[lineIndex] ?? '';
    return /^\s*```/.test(line)
      || /^\s*#{1,6}\s+/.test(line)
      || /^\s*(?:[-*_]\s*){3,}$/.test(line)
      || /^\s*>\s?/.test(line)
      || /^\s*[-+*]\s+/.test(line)
      || /^\s*\d+[.)]\s+/.test(line)
      || (line.includes('|') && isMarkdownTableDivider(lines[lineIndex + 1] ?? ''));
  };

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }

    const fence = line.match(/^\s*```\s*([^\s`]*)\s*$/);
    if (fence) {
      const codeLineIndexes: number[] = [];
      index += 1;
      while (index < lines.length && !/^\s*```\s*$/.test(lines[index])) {
        codeLineIndexes.push(index);
        index += 1;
      }
      if (index < lines.length) index += 1;
      const key = nextKey();
      const codeNodes: React.ReactNode[] = [];
      codeLineIndexes.forEach((lineIndex, codeLineIndex) => {
        codeNodes.push(renderMarkdownText(lines[lineIndex], `${key}-code-${codeLineIndex}`, lineStarts[lineIndex], onTextEdit, 'Edit code', false));
        if (codeLineIndex < codeLineIndexes.length - 1) codeNodes.push(<br key={`${key}-code-break-${codeLineIndex}`} />);
      });
      blocks.push(<pre key={key}><code data-language={fence[1] || undefined}>{codeNodes}</code></pre>);
      continue;
    }

    const heading = line.match(/^\s*(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (heading) {
      const Heading = `h${heading[1].length}` as keyof React.JSX.IntrinsicElements;
      const key = nextKey();
      const contentStart = line.indexOf(heading[2], heading[1].length);
      blocks.push(<Heading key={key}>{renderMarkdownInline(heading[2], `${key}-heading`, lineStarts[index] + contentStart, onTextEdit)}</Heading>);
      index += 1;
      continue;
    }

    if (/^\s*(?:[-*_]\s*){3,}$/.test(line)) {
      blocks.push(<hr key={nextKey()} />);
      index += 1;
      continue;
    }

    if (line.includes('|') && isMarkdownTableDivider(lines[index + 1] ?? '')) {
      const headers = markdownTableCellRanges(line, lineStarts[index]);
      const alignments = markdownTableCells(lines[index + 1]).map((cell) => cell.startsWith(':') && cell.endsWith(':')
        ? 'center'
        : cell.endsWith(':') ? 'right' : 'left');
      const rows: MarkdownTableCell[][] = [];
      index += 2;
      while (index < lines.length && lines[index].trim() && lines[index].includes('|')) {
        rows.push(markdownTableCellRanges(lines[index], lineStarts[index]));
        index += 1;
      }
      const key = nextKey();
      blocks.push(
        <div className="markdown-table-scroll" key={key}>
          <table>
            <thead><tr>{headers.map((cell, cellIndex) => <th key={`${key}-head-${cellIndex}`} style={{ textAlign: alignments[cellIndex] as 'left' | 'center' | 'right' }}>{renderMarkdownInline(cell.value, `${key}-head-${cellIndex}`, cell.start, onTextEdit, true)}</th>)}</tr></thead>
            <tbody>{rows.map((row, rowIndex) => <tr key={`${key}-row-${rowIndex}`}>{headers.map((_, cellIndex) => {
              const cell = row[cellIndex];
              return <td key={`${key}-row-${rowIndex}-${cellIndex}`} style={{ textAlign: alignments[cellIndex] as 'left' | 'center' | 'right' }}>{cell ? renderMarkdownInline(cell.value, `${key}-row-${rowIndex}-${cellIndex}`, cell.start, onTextEdit, true) : null}</td>;
            })}</tr>)}</tbody>
          </table>
        </div>
      );
      continue;
    }

    if (/^\s*>\s?/.test(line)) {
      const quoteLines: { value: string; start: number }[] = [];
      while (index < lines.length && /^\s*>\s?/.test(lines[index])) {
        const quote = lines[index].match(/^(\s*>\s?)(.*)$/);
        if (quote) quoteLines.push({ value: quote[2], start: lineStarts[index] + quote[1].length });
        index += 1;
      }
      const key = nextKey();
      const quoteNodes: React.ReactNode[] = [];
      quoteLines.forEach((quote, quoteIndex) => {
        quoteNodes.push(...renderMarkdownInline(quote.value, `${key}-quote-${quoteIndex}`, quote.start, onTextEdit, true));
        if (quoteIndex < quoteLines.length - 1) quoteNodes.push(<br key={`${key}-quote-break-${quoteIndex}`} />);
      });
      blocks.push(<blockquote key={key}>{quoteNodes}</blockquote>);
      continue;
    }

    const unordered = line.match(/^\s*[-+*]\s+(.+)$/);
    const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (unordered || ordered) {
      const orderedList = Boolean(ordered);
      const items: { value: string; start: number }[] = [];
      const itemPattern = orderedList ? /^\s*\d+[.)]\s+(.+)$/ : /^\s*[-+*]\s+(.+)$/;
      while (index < lines.length) {
        const item = lines[index].match(itemPattern);
        if (!item) break;
        items.push({ value: item[1], start: lineStarts[index] + lines[index].indexOf(item[1]) });
        index += 1;
      }
      const key = nextKey();
      const children = items.map((item, itemIndex) => <li key={`${key}-item-${itemIndex}`}>{renderMarkdownInline(item.value, `${key}-item-${itemIndex}`, item.start, onTextEdit)}</li>);
      blocks.push(orderedList ? <ol key={key}>{children}</ol> : <ul key={key}>{children}</ul>);
      continue;
    }

    const paragraphLineIndexes = [index];
    index += 1;
    while (index < lines.length && lines[index].trim() && !isBlockStart(index)) {
      paragraphLineIndexes.push(index);
      index += 1;
    }
    const key = nextKey();
    const paragraphNodes: React.ReactNode[] = [];
    paragraphLineIndexes.forEach((lineIndex, paragraphLineIndex) => {
      const trimmed = lines[lineIndex].trim();
      const contentStart = lines[lineIndex].indexOf(trimmed);
      paragraphNodes.push(...renderMarkdownInline(trimmed, `${key}-paragraph-${paragraphLineIndex}`, lineStarts[lineIndex] + contentStart, onTextEdit));
      if (paragraphLineIndex < paragraphLineIndexes.length - 1) paragraphNodes.push(<br key={`${key}-paragraph-break-${paragraphLineIndex}`} />);
    });
    blocks.push(<p key={key}>{paragraphNodes}</p>);
  }
  return blocks;
}

function MarkdownContent({ value, onTextEdit }: { value: string; onTextEdit: MarkdownTextEdit }) {
  if (!value.trim()) {
    return (
      <div className="markdown-content is-empty">
        <EditableMarkdownText
          end={value.length}
          onTextEdit={(start, end, text) => onTextEdit(start, end, encodeMarkdownText(text))}
          placeholder="Click to add lookup details"
          start={0}
          value=""
        />
      </div>
    );
  }
  return <div className="markdown-content">{renderMarkdownBlocks(value, 'markdown', onTextEdit)}</div>;
}

function RowEnumSelect({
  config,
  category,
  selected,
  onChange,
  options,
  highlightedOptionId
}: {
  config: KpiPoolConfig;
  category: EnumCategoryKey;
  selected: string[];
  onChange: (next: string[]) => void;
  options?: { id: string; label: string; description?: string; userGroup?: string }[];
  highlightedOptionId?: string;
}) {
  const [open, setOpen] = useState(false);
  const controlRef = useCloseOnOutsideClick<HTMLDivElement>(open, () => setOpen(false));
  const availableOptions = options ?? config.enums[category];
  const selectedOptionDetails = options
    ? category === 'performanceArea'
      ? dedupePerformanceAreaOptionsByLabel(
          selected
            .map((id) => config.enums.performanceArea.find((option) => option.id === id) ?? availableOptions.find((option) => option.id === id))
            .filter(Boolean) as EnumOption[]
        )
      : selected
          .map((id) => availableOptions.find((option) => option.id === id))
          .filter(Boolean) as { id: string; label: string; description?: string }[]
    : selectedOptions(config, category, selected);
  const selectedLabels =
    category === 'performanceArea' ? new Set(selected.map((id) => performanceAreaLabel(config, id))) : new Set<string>();
  const optionSelected = (option: { id: string; label: string }) =>
    category === 'performanceArea' ? selectedLabels.has(option.label) : selected.includes(option.id);
  const toggle = (id: string) => {
    if (category !== 'performanceArea') {
      onChange(selected.includes(id) ? selected.filter((value) => value !== id) : [...selected, id]);
      return;
    }

    const label = performanceAreaLabel(config, id);
    onChange(selectedLabels.has(label) ? selected.filter((value) => performanceAreaLabel(config, value) !== label) : [...selected, id]);
  };

  return (
    <div className="cell-enum-control" ref={controlRef}>
      <button
        className="cell-enum-trigger"
        type="button"
        aria-label={`Edit ${enumCategoryLabels[category]} for row`}
        onClick={() => setOpen((next) => !next)}
      >
        {selectedOptionDetails.length ? (
          <span className="pill-list">
            {selectedOptionDetails.map((option) => (
              <span
                className={`option-pill ${highlightedOptionId === option.id ? 'is-highlighted' : ''}`}
                key={option.id}
                title={option.description || option.label}
              >
                {option.label}
              </span>
            ))}
          </span>
        ) : (
          <span className="muted-dash">Select...</span>
        )}
        <ChevronDown size={13} aria-hidden="true" className={open ? 'rotate' : ''} />
      </button>
      {open ? (
        <div className="cell-enum-popover">
          <div className="popover-title">{enumCategoryLabels[category]}</div>
          {availableOptions.length === 0 ? <span className="empty-option">No options defined.</span> : null}
          {availableOptions.map((option) => (
            <label className={`check-row ${highlightedOptionId === option.id ? 'is-highlighted' : ''}`} key={option.id}>
              <input type="checkbox" checked={optionSelected(option)} onChange={() => toggle(option.id)} />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function RowKpiSelect({
  kpis,
  currentKpiId,
  selected,
  onChange
}: {
  kpis: KpiMetric[];
  currentKpiId: string;
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const controlRef = useCloseOnOutsideClick<HTMLDivElement>(open, () => setOpen(false));
  const availableKpis = kpis.filter((kpi) => kpi.id !== currentKpiId);
  const normalizedQuery = normalize(query);
  const visibleKpis = normalizedQuery
    ? availableKpis.filter((kpi) =>
        normalize(`${kpi.name} ${kpi.description.overview}`).includes(normalizedQuery)
      )
    : availableKpis;
  const selectedKpis = selected
    .map((id) => availableKpis.find((kpi) => kpi.id === id))
    .filter(Boolean) as KpiMetric[];
  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter((value) => value !== id) : [...selected, id]);
  };

  useEffect(() => {
    if (!open) {
      setQuery('');
    }
  }, [open]);

  return (
    <div className="cell-enum-control cell-kpi-control" ref={controlRef}>
      <button
        className="cell-enum-trigger cell-kpi-trigger"
        type="button"
        aria-label="Edit prerequisite KPIs for row"
        onClick={() => setOpen((next) => !next)}
      >
        {selectedKpis.length ? (
          <span className="pill-list">
            {selectedKpis.map((option) => (
              <span className="option-pill" key={option.id} title={option.name}>
                {option.name}
              </span>
            ))}
          </span>
        ) : (
          <span className="muted-dash">Prerequisite KPI...</span>
        )}
        <ChevronDown size={13} aria-hidden="true" className={open ? 'rotate' : ''} />
      </button>
      {open ? (
        <div className="cell-enum-popover">
          <div className="popover-title">Prerequisite KPI</div>
          <label className="popover-search">
            <Search size={13} aria-hidden="true" />
            <input
              value={query}
              placeholder="Search KPIs..."
              onChange={(event) => setQuery(event.target.value)}
              autoFocus
            />
          </label>
          {availableKpis.length === 0 ? <span className="empty-option">No other KPIs.</span> : null}
          {availableKpis.length > 0 && visibleKpis.length === 0 ? <span className="empty-option">No matches.</span> : null}
          {visibleKpis.map((option) => (
            <label className="check-row" key={option.id}>
              <input type="checkbox" checked={selected.includes(option.id)} onChange={() => toggle(option.id)} />
              <span>{option.name || 'Untitled KPI'}</span>
            </label>
          ))}
        </div>
      ) : null}
    </div>
  );
}

const dimensionedSourceLabel = (name: string, dimensionLabel: string) =>
  `${name}${dimensionLabel ? ` [by ${dimensionLabel}]` : ''}`;

const spatiallyScaledTableLabel = (name: string, spatialUnit: string) =>
  `${name}${spatialUnit.trim() ? ` [by ${spatialUnit.trim()}]` : ''}`;

const sourceItemLabel = (config: KpiPoolConfig, item: KpiSourceItem) => {
  if (item.type === 'custom') {
    return item.name || 'Untitled custom source';
  }
  if (item.type === 'kpi') {
    const referencedKpi = config.kpis.find((kpi) => kpi.id === item.kpiId);
    if (!referencedKpi) return 'Missing KPI';
    const dimensionLabel = referencedKpi.dimensions.map((dimension) => dimension.name.trim()).filter(Boolean).join(', ');
    return dimensionedSourceLabel(referencedKpi.name, dimensionLabel);
  }
  if (item.type === 'lookup') {
    return config.lookups.find((lookup) => lookup.id === item.lookupId)?.outputName ?? 'Missing lookup';
  }
  if (item.type === 'variable') {
    return config.variables.find((variable) => variable.id === item.variableId)?.name ?? 'Missing variable';
  }
  const source = config.dataSources.find((entry) => entry.id === item.dataSourceId);
  const field = source?.fields.find((entry) => entry.id === item.fieldId);
  const group = source?.fieldGroups.find((entry) => entry.fieldIds.includes(item.fieldId));
  const dimensionNames = group?.dimensions.map((dimension) => dimension.name.trim()).filter(Boolean) ?? [];
  return `${source?.name ?? 'Missing source'} / ${dimensionedSourceLabel(field?.name ?? 'Missing field', dimensionNames.join(', '))}`;
};

const sourceItemTooltip = (config: KpiPoolConfig, item: KpiSourceItem) => {
  const label = sourceItemLabel(config, item);
  if (item.type === 'lookup') {
    const lookup = config.lookups.find((entry) => entry.id === item.lookupId);
    if (!lookup) return label;
    const type = lookup.outputValueType === 'enum'
      ? `Type: Domain${lookup.outputOptions.length ? ` (${lookup.outputOptions.join(', ')})` : ''}`
      : 'Type: Number';
    return [label, type, lookup.outputExplanation.trim()].filter(Boolean).join('\n');
  }
  if (item.type === 'variable') {
    const variable = config.variables.find((entry) => entry.id === item.variableId);
    const details = [variable?.explanation.trim(), variable?.unit.trim() ? `Unit: ${variable.unit.trim()}` : ''].filter(Boolean);
    return details.length ? `${label}\n${details.join('\n')}` : label;
  }
  if (item.type !== 'dataField') return label;
  const source = config.dataSources.find((entry) => entry.id === item.dataSourceId);
  const field = source?.fields.find((entry) => entry.id === item.fieldId);
  const details = [
    field ? `Type: ${dataSourceFieldTypeLabels[field.dataType]}` : '',
    field?.dataType === 'enum' && field.options.length ? `Options: ${field.options.join(', ')}` : '',
    field?.meaning.trim(),
    field?.valueUnit ? `Unit: ${field.valueUnit}` : ''
  ].filter(Boolean);
  return details.length ? `${label}\n${details.join('\n')}` : label;
};

const lookupDefaultLatex = (lookup: LookupDefinition) => {
  const name = latexIdentifier(lookup.outputName) || 'Lookup';
  return `${name}(${','.repeat(Math.max(0, lookup.inputs.length - 1))})`;
};

const variableDefaultLatex = (variable: VariableDefinition) => latexIdentifier(variable.name) || 'variable';

const selectedDataSourceGroups = (config: KpiPoolConfig, kpi: KpiMetric) =>
  config.dataSources.flatMap((dataSource) => {
    const items = kpi.sources.flatMap((source) => {
      if (source.type !== 'dataField' || source.dataSourceId !== dataSource.id) return [];
      const field = dataSource.fields.find((entry) => entry.id === source.fieldId);
      return field ? [{ source, field }] : [];
    });
    return items.length ? [{ dataSource, items }] : [];
  });

const latexIdentifier = (value: string) => value.replace(/\s+/g, '');

const sourceFieldDefaultLatex = (field: Pick<DataSourceField, 'name' | 'dataType'>, spatialUnit: string, dimensions: DataSourceFieldDimension[] = []) => {
  const fieldName = latexIdentifier(field.name);
  const spatial = latexIdentifier(spatialUnit);
  const dimensionTags = dimensions.map((dimension) => latexIdentifier(dimension.name)).filter(Boolean);
  const subscript = [...dimensionTags, spatial].filter(Boolean).join(',');
  const expression = field.dataType === 'collection' ? `\\{${fieldName}\\}` : fieldName;
  return subscript ? `${expression}_{${subscript}}` : expression;
};

const dataSourceFieldTypeLabels: Record<DataSourceFieldType, string> = {
  id: 'ID',
  number: 'Number',
  boolean: 'Boolean',
  text: 'Text',
  enum: 'Domain',
  collection: 'Collection'
};

const dataSourceCollectionItemTypeLabels: Record<DataSourceCollectionItemType, string> = {
  number: 'Numbers',
  enum: 'Domains',
  id: 'IDs',
  boolean: 'Booleans',
  text: 'Text values'
};

const fieldGroupDimensionLabel = (group?: DataSourceFieldGroup) =>
  group?.dimensions.map((dimension) => dimension.name.trim()).filter(Boolean).join(', ') ?? '';

const formulaDimensionsCache = new WeakMap<KpiMetric, { config: KpiPoolConfig; value: DataSourceFieldDimension[] }>();

const formulaDimensions = (config: KpiPoolConfig, kpi: KpiMetric): DataSourceFieldDimension[] => {
  const cached = formulaDimensionsCache.get(kpi);
  if (cached?.config === config) return cached.value;
  const combined = new Map<string, DataSourceFieldDimension>();
  const dimensions = [
    ...kpi.dimensions,
    ...kpi.sources.flatMap((source) => {
      if (source.type === 'kpi') {
        return config.kpis.find((entry) => entry.id === source.kpiId)?.dimensions ?? [];
      }
      if (source.type !== 'dataField') return [];
      const dataSource = config.dataSources.find((entry) => entry.id === source.dataSourceId);
      return dataSource?.fieldGroups.find((group) => group.fieldIds.includes(source.fieldId))?.dimensions ?? [];
    })
  ];
  dimensions.forEach((dimension) => {
    const key = dimension.name.trim().toLocaleLowerCase();
    if (!key) return;
    const existing = combined.get(key);
    if (!existing) {
      combined.set(key, { ...dimension, options: [...dimension.options] });
      return;
    }
    const existingOptions = new Set(existing.options.map((option) => option.toLocaleLowerCase()));
    dimension.options.forEach((option) => {
      const normalizedOption = option.toLocaleLowerCase();
      if (existingOptions.has(normalizedOption)) return;
      existing.options.push(option);
      existingOptions.add(normalizedOption);
    });
  });
  const value = [...combined.values()];
  formulaDimensionsCache.set(kpi, { config, value });
  return value;
};

type FormulaCollectionDomain = {
  key: string;
  name: string;
  options: string[];
};

const formulaCollectionDomainsCache = new WeakMap<KpiMetric, { config: KpiPoolConfig; value: FormulaCollectionDomain[] }>();

const formulaCollectionDomains = (config: KpiPoolConfig, kpi: KpiMetric): FormulaCollectionDomain[] => {
  const cached = formulaCollectionDomainsCache.get(kpi);
  if (cached?.config === config) return cached.value;
  const domains = new Map<string, FormulaCollectionDomain>();
  kpi.sources.forEach((source) => {
    if (source.type !== 'dataField') return;
    const dataSource = config.dataSources.find((entry) => entry.id === source.dataSourceId);
    const field = dataSource?.fields.find((entry) => entry.id === source.fieldId);
    if (!field || field.dataType !== 'collection' || field.collectionItemType !== 'enum') return;
    const globalDomain = field.enumId
      ? config.valueEnums.find((definition) => definition.id === field.enumId)
      : undefined;
    const key = globalDomain ? `global:${globalDomain.id}` : `field:${dataSource?.id ?? source.dataSourceId}:${field.id}`;
    domains.set(key, {
      key,
      name: globalDomain?.name.trim() || field.name.trim() || 'Domain',
      options: [...(globalDomain?.options ?? field.options)]
    });
  });
  const value = [...domains.values()];
  formulaCollectionDomainsCache.set(kpi, { config, value });
  return value;
};

function DataSourceHeader({
  config,
  onConfigChange,
  editRequest,
  onEditLibrarySource
}: {
  config: KpiPoolConfig;
  onConfigChange: (next: KpiPoolConfig) => void;
  editRequest?: SourceLibraryEditRequest;
  onEditLibrarySource: (target: SourceLibraryEditTarget) => void;
}) {
  const [open, setOpen] = useState(false);
  const [expandedSourceIds, setExpandedSourceIds] = useState<string[]>([]);
  const [collapsedFieldGroupIds, setCollapsedFieldGroupIds] = useState<string[]>([]);
  const [expandedLookupIds, setExpandedLookupIds] = useState<string[]>([]);
  const [expandedLookupGroupIds, setExpandedLookupGroupIds] = useState<string[]>([]);
  const [lookupDetailsSourceIds, setLookupDetailsSourceIds] = useState<string[]>([]);
  const [expandedVariableGroupIds, setExpandedVariableGroupIds] = useState<string[]>([]);
  const [expandedValueEnumGroupIds, setExpandedValueEnumGroupIds] = useState<string[]>([]);
  const [activeLibrarySection, setActiveLibrarySection] = useState<'variables' | 'enums' | 'lookups' | 'tables'>('variables');
  const [relationEditor, setRelationEditor] = useState<{
    sourceDataSourceId: string;
    targetDataSourceId: string;
    cardinality: TableRelation['cardinality'];
    direction: 'one' | 'many';
    anchor: 'primaryKey' | 'table';
  } | null>(null);
  const [fieldGroupDomainPickerId, setFieldGroupDomainPickerId] = useState<string>();
  const controlRef = useRef<HTMLDivElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const navigatedEditRequestIdRef = useRef<number>();
  const [sourceDragIndex, setSourceDragIndex] = useState<number | null>(null);
  const [sourceDragOver, setSourceDragOver] = useState<{ sourceIndex: number; position: DropPosition } | null>(null);
  const [fieldDrag, setFieldDrag] = useState<{ sourceIndex: number; fieldIndex: number } | null>(null);
  const [fieldDragOver, setFieldDragOver] = useState<{ sourceIndex: number; fieldIndex: number; position: DropPosition } | null>(null);
  const [fieldInsertDragOver, setFieldInsertDragOver] = useState<{ sourceIndex: number; targetKey: string } | null>(null);
  const [fieldGroupDragOver, setFieldGroupDragOver] = useState<{ sourceIndex: number; groupId?: string } | null>(null);
  const [libraryItemDrag, setLibraryItemDrag] = useState<{ kind: 'lookup' | 'variable' | 'enum'; itemIndex: number } | null>(null);
  const [libraryItemDragOver, setLibraryItemDragOver] = useState<{ kind: 'lookup' | 'variable' | 'enum'; itemIndex: number; position: DropPosition } | null>(null);
  const [libraryGroupDragOver, setLibraryGroupDragOver] = useState<{ kind: 'lookup' | 'variable' | 'enum'; groupId?: string; position?: DropPosition } | null>(null);
  const [libraryInsertDragOver, setLibraryInsertDragOver] = useState<{ kind: 'lookup' | 'variable' | 'enum'; key: string } | null>(null);
  const [popoverPosition, setPopoverPosition] = useState<{ top: number; left: number; width: number; maxHeight: number }>();
  const [focusedEditRequest, setFocusedEditRequest] = useState<SourceLibraryEditRequest>();
  useEffect(() => {
    if (!editRequest) return;
    setFocusedEditRequest(editRequest);
    setOpen(true);
    if (editRequest.kind === 'dataField') {
      setActiveLibrarySection('tables');
      setExpandedSourceIds((current) => [...new Set([...current, editRequest.dataSourceId])]);
      const source = config.dataSources.find((entry) => entry.id === editRequest.dataSourceId);
      const group = source?.fieldGroups.find((entry) => entry.fieldIds.includes(editRequest.fieldId));
      if (group) {
        setCollapsedFieldGroupIds((current) => current.filter((id) => id !== group.id));
      }
      return;
    }
    if (editRequest.kind === 'lookup') {
      setActiveLibrarySection('lookups');
      setExpandedLookupIds((current) => [...new Set([...current, editRequest.lookupId])]);
      const group = config.lookupGroups.find((entry) => entry.itemIds.includes(editRequest.lookupId));
      if (group) {
        setExpandedLookupGroupIds((current) => [...new Set([...current, group.id])]);
      }
      return;
    }
    if (editRequest.kind === 'domain') {
      setActiveLibrarySection('enums');
      const group = config.valueEnumGroups.find((entry) => entry.itemIds.includes(editRequest.domainId));
      if (group) {
        setExpandedValueEnumGroupIds((current) => [...new Set([...current, group.id])]);
      }
      return;
    }
    setActiveLibrarySection('variables');
    const group = config.variableGroups.find((entry) => entry.itemIds.includes(editRequest.variableId));
    if (group) {
      setExpandedVariableGroupIds((current) => [...new Set([...current, group.id])]);
    }
  }, [editRequest?.requestId]);

  useEffect(() => {
    if (!open || !popoverPosition || !focusedEditRequest) return undefined;
    if (navigatedEditRequestIdRef.current === focusedEditRequest.requestId) return undefined;
    const targetKey = sourceLibraryTargetKey(focusedEditRequest);
    const frame = window.requestAnimationFrame(() => {
      const target = [...(popoverRef.current?.querySelectorAll<HTMLElement>('[data-library-target]') ?? [])]
        .find((element) => element.dataset.libraryTarget === targetKey);
      if (!target) return;
      navigatedEditRequestIdRef.current = focusedEditRequest.requestId;
      target.scrollIntoView({ block: 'center' });
      if (focusedEditRequest.kind !== 'domain') {
        target.querySelector<HTMLInputElement>('input:not([type="checkbox"])')?.focus();
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [focusedEditRequest, open, popoverPosition]);

  useEffect(() => {
    if (!focusedEditRequest) return undefined;
    const requestId = focusedEditRequest.requestId;
    const targetKey = sourceLibraryTargetKey(focusedEditRequest);
    const timeout = window.setTimeout(() => {
      const target = [...(popoverRef.current?.querySelectorAll<HTMLElement>('[data-library-target]') ?? [])]
        .find((element) => element.dataset.libraryTarget === targetKey);
      if (target?.contains(document.activeElement)) {
        (document.activeElement as HTMLElement)?.blur();
      }
      setFocusedEditRequest((current) => current?.requestId === requestId ? undefined : current);
    }, transientSourceHighlightDurationMs);
    return () => window.clearTimeout(timeout);
  }, [focusedEditRequest?.requestId]);
  useLayoutEffect(() => {
    if (!open) return undefined;
    const updatePosition = () => {
      const anchor = controlRef.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      const width = Math.min(840, window.innerWidth - 24);
      const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12));
      const top = Math.min(rect.bottom + 6, window.innerHeight - 12);
      setPopoverPosition({ top, left, width, maxHeight: Math.max(180, window.innerHeight - top - 12) });
    };
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open]);
  useEffect(() => {
    if (!open) return undefined;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && (controlRef.current?.contains(target) || popoverRef.current?.contains(target))) return;
      const activeElement = document.activeElement;
      if (activeElement instanceof HTMLElement && activeElement.classList.contains('markdown-editable-text')) activeElement.blur();
      setOpen(false);
      setRelationEditor(null);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (relationEditor) setRelationEditor(null);
        else setOpen(false);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, relationEditor]);
  const patchDataSources = (dataSources: DataSource[]) => {
    onConfigChange({ ...config, dataSources });
  };
  const patchLookups = (lookups: LookupDefinition[], lookupGroups = config.lookupGroups) =>
    onConfigChange({ ...config, lookups, lookupGroups });
  const patchVariables = (variables: VariableDefinition[], variableGroups = config.variableGroups) =>
    onConfigChange({ ...config, variables, variableGroups });
  const patchValueEnums = (valueEnums: ValueEnumDefinition[], valueEnumGroups = config.valueEnumGroups) =>
    onConfigChange({ ...config, valueEnums, valueEnumGroups });
  const addValueEnum = (insertionIndex = config.valueEnums.length, groupId?: string, shiftGroupsAtInsertion = true) => {
    const definition: ValueEnumDefinition = { id: createLocalId('value-enum'), name: 'New domain', options: [] };
    const index = Math.max(0, Math.min(insertionIndex, config.valueEnums.length));
    patchValueEnums(
      [...config.valueEnums.slice(0, index), definition, ...config.valueEnums.slice(index)],
      config.valueEnumGroups.map((group) => ({
        ...group,
        position: shiftGroupsAtInsertion && group.position >= index && group.id !== groupId ? group.position + 1 : group.position,
        itemIds: group.id === groupId ? [...group.itemIds, definition.id] : group.itemIds
      }))
    );
  };
  const updateValueEnum = (enumIndex: number, partial: Partial<ValueEnumDefinition>) => {
    const current = config.valueEnums[enumIndex];
    if (!current) return;
    const updated = { ...current, ...partial };
    const syncDimension = (dimension: DataSourceFieldDimension) => dimension.enumId === current.id
      ? { ...dimension, name: updated.name, options: [...updated.options] }
      : dimension;
    onConfigChange({
      ...config,
      valueEnums: config.valueEnums.map((definition, index) => index === enumIndex ? updated : definition),
      dataSources: config.dataSources.map((source) => {
        const hasLinkedField = source.fields.some((field) => field.enumId === current.id);
        const hasLinkedGroupDimension = source.fieldGroups.some((group) =>
          group.dimensions.some((dimension) => dimension.enumId === current.id)
        );
        if (!hasLinkedField && !hasLinkedGroupDimension) return source;

        return {
          ...source,
          fields: hasLinkedField
            ? source.fields.map((field) => field.enumId === current.id
                ? { ...field, ...(field.dataType === 'enum' ? { name: updated.name } : {}), options: [...updated.options] }
                : field)
            : source.fields,
          fieldGroups: hasLinkedGroupDimension
            ? source.fieldGroups.map((group) => group.dimensions.some((dimension) => dimension.enumId === current.id)
                ? { ...group, dimensions: group.dimensions.map(syncDimension) }
                : group)
            : source.fieldGroups
        };
      }),
      lookups: config.lookups.map((lookup) => {
        const hasLinkedOutput = lookup.outputEnumId === current.id;
        const hasLinkedInput = lookup.inputs.some((input) => input.enumId === current.id);
        if (!hasLinkedOutput && !hasLinkedInput) return lookup;

        return {
          ...lookup,
          outputName: hasLinkedOutput ? updated.name : lookup.outputName,
          outputOptions: hasLinkedOutput ? [...updated.options] : lookup.outputOptions,
          inputs: hasLinkedInput
            ? lookup.inputs.map((input) => input.enumId === current.id ? { ...input, representation: updated.name, options: [...updated.options] } : input)
            : lookup.inputs
        };
      }),
      kpis: config.kpis.map((kpi) => kpi.dimensions.some((dimension) => dimension.enumId === current.id)
        ? { ...kpi, dimensions: kpi.dimensions.map(syncDimension) }
        : kpi)
    });
  };
  const duplicateValueEnum = (enumIndex: number) => {
    const definition = config.valueEnums[enumIndex];
    if (!definition) return;
    const duplicate = { ...definition, id: createLocalId('value-enum'), name: `${definition.name || 'Untitled domain'} copy`, options: [...definition.options] };
    const containingGroup = config.valueEnumGroups.find((group) => group.itemIds.includes(definition.id));
    patchValueEnums(
      [...config.valueEnums.slice(0, enumIndex + 1), duplicate, ...config.valueEnums.slice(enumIndex + 1)],
      config.valueEnumGroups.map((group) => {
        const memberIndex = group.itemIds.indexOf(definition.id);
        return {
          ...group,
          position: group.position > enumIndex ? group.position + 1 : group.position,
          itemIds: memberIndex < 0 ? group.itemIds : [...group.itemIds.slice(0, memberIndex + 1), duplicate.id, ...group.itemIds.slice(memberIndex + 1)]
        };
      })
    );
    if (containingGroup) setExpandedValueEnumGroupIds((currentIds) => [...new Set([...currentIds, containingGroup.id])]);
  };
  const deleteValueEnum = (enumIndex: number) => {
    const enumId = config.valueEnums[enumIndex]?.id;
    if (!enumId) return;
    const clearDimension = (dimension: DataSourceFieldDimension) => dimension.enumId === enumId
      ? { ...dimension, enumId: undefined }
      : dimension;
    onConfigChange({
      ...config,
      valueEnums: config.valueEnums.filter((_, index) => index !== enumIndex),
      valueEnumGroups: config.valueEnumGroups.map((group) => ({
        ...group,
        position: group.position > enumIndex ? group.position - 1 : group.position,
        itemIds: group.itemIds.filter((id) => id !== enumId)
      })),
      dataSources: config.dataSources.map((source) => ({
        ...source,
        fields: source.fields.map((field) => field.enumId === enumId ? { ...field, enumId: undefined } : field),
        fieldGroups: source.fieldGroups.map((group) => ({ ...group, dimensions: group.dimensions.map(clearDimension) }))
      })),
      lookups: config.lookups.map((lookup) => ({
        ...lookup,
        outputEnumId: lookup.outputEnumId === enumId ? undefined : lookup.outputEnumId,
        inputs: lookup.inputs.map((input) => input.enumId === enumId ? { ...input, enumId: undefined } : input)
      })),
      kpis: config.kpis.map((kpi) => ({ ...kpi, dimensions: kpi.dimensions.map(clearDimension) }))
    });
  };
  const addLookup = (insertionIndex = config.lookups.length, groupId?: string, shiftGroupsAtInsertion = true) => {
    const lookup: LookupDefinition = {
      id: createLocalId('lookup'),
      outputName: 'New lookup',
      outputExplanation: '',
      outputValueType: 'number',
      outputOptions: [],
      text: '',
      inputs: []
    };
    const index = Math.max(0, Math.min(insertionIndex, config.lookups.length));
    patchLookups(
      [...config.lookups.slice(0, index), lookup, ...config.lookups.slice(index)],
      config.lookupGroups.map((group) => ({
        ...group,
        position: shiftGroupsAtInsertion && group.position >= index && group.id !== groupId ? group.position + 1 : group.position,
        itemIds: group.id === groupId ? [...group.itemIds, lookup.id] : group.itemIds
      }))
    );
    setExpandedLookupIds((current) => [...new Set([...current, lookup.id])]);
  };
  const updateLookup = (lookupIndex: number, partial: Partial<LookupDefinition>) =>
    patchLookups(config.lookups.map((lookup, index) => index === lookupIndex ? { ...lookup, ...partial } : lookup));
  const duplicateLookup = (lookupIndex: number) => {
    const lookup = config.lookups[lookupIndex];
    if (!lookup) return;
    const duplicate: LookupDefinition = {
      ...lookup,
      id: createLocalId('lookup'),
      outputName: `${lookup.outputName || 'Untitled lookup'} copy`,
      inputs: lookup.inputs.map((input) => ({ ...input, id: createLocalId('lookup-input') }))
    };
    const containingGroup = config.lookupGroups.find((group) => group.itemIds.includes(lookup.id));
    patchLookups(
      [...config.lookups.slice(0, lookupIndex + 1), duplicate, ...config.lookups.slice(lookupIndex + 1)],
      config.lookupGroups.map((group) => {
        const memberIndex = group.itemIds.indexOf(lookup.id);
        return {
          ...group,
          position: group.position > lookupIndex ? group.position + 1 : group.position,
          itemIds: memberIndex < 0
            ? group.itemIds
            : [...group.itemIds.slice(0, memberIndex + 1), duplicate.id, ...group.itemIds.slice(memberIndex + 1)]
        };
      })
    );
    if (containingGroup) setExpandedLookupGroupIds((current) => [...new Set([...current, containingGroup.id])]);
    setExpandedLookupIds((current) => [...new Set([...current, duplicate.id])]);
  };
  const deleteLookup = (lookupIndex: number) => {
    const lookupId = config.lookups[lookupIndex]?.id;
    if (!lookupId) return;
    setExpandedLookupIds((current) => current.filter((id) => id !== lookupId));
    setLookupDetailsSourceIds((current) => current.filter((id) => id !== lookupId));
    onConfigChange({
      ...config,
      lookups: config.lookups.filter((_, index) => index !== lookupIndex),
      lookupGroups: config.lookupGroups.map((group) => ({
        ...group,
        position: group.position > lookupIndex ? group.position - 1 : group.position,
        itemIds: group.itemIds.filter((id) => id !== lookupId)
      })),
      kpis: config.kpis.map((kpi) => ({
        ...kpi,
        sources: kpi.sources.filter((source) => source.type !== 'lookup' || source.lookupId !== lookupId)
      }))
    });
  };
  const addVariable = (insertionIndex = config.variables.length, groupId?: string, shiftGroupsAtInsertion = true) => {
    const variable: VariableDefinition = {
      id: createLocalId('variable'),
      name: 'New variable',
      explanation: '',
      unit: ''
    };
    const index = Math.max(0, Math.min(insertionIndex, config.variables.length));
    patchVariables(
      [...config.variables.slice(0, index), variable, ...config.variables.slice(index)],
      config.variableGroups.map((group) => ({
        ...group,
        position: shiftGroupsAtInsertion && group.position >= index && group.id !== groupId ? group.position + 1 : group.position,
        itemIds: group.id === groupId ? [...group.itemIds, variable.id] : group.itemIds
      }))
    );
  };
  const updateVariable = (variableIndex: number, partial: Partial<VariableDefinition>) =>
    patchVariables(config.variables.map((variable, index) => index === variableIndex ? { ...variable, ...partial } : variable));
  const duplicateVariable = (variableIndex: number) => {
    const variable = config.variables[variableIndex];
    if (!variable) return;
    const duplicate: VariableDefinition = {
      ...variable,
      id: createLocalId('variable'),
      name: `${variable.name || 'Untitled variable'} copy`
    };
    const containingGroup = config.variableGroups.find((group) => group.itemIds.includes(variable.id));
    patchVariables(
      [...config.variables.slice(0, variableIndex + 1), duplicate, ...config.variables.slice(variableIndex + 1)],
      config.variableGroups.map((group) => {
        const memberIndex = group.itemIds.indexOf(variable.id);
        return {
          ...group,
          position: group.position > variableIndex ? group.position + 1 : group.position,
          itemIds: memberIndex < 0
            ? group.itemIds
            : [...group.itemIds.slice(0, memberIndex + 1), duplicate.id, ...group.itemIds.slice(memberIndex + 1)]
        };
      })
    );
    if (containingGroup) setExpandedVariableGroupIds((current) => [...new Set([...current, containingGroup.id])]);
  };
  const deleteVariable = (variableIndex: number) => {
    const variableId = config.variables[variableIndex]?.id;
    if (!variableId) return;
    onConfigChange({
      ...config,
      variables: config.variables.filter((_, index) => index !== variableIndex),
      variableGroups: config.variableGroups.map((group) => ({
        ...group,
        position: group.position > variableIndex ? group.position - 1 : group.position,
        itemIds: group.itemIds.filter((id) => id !== variableId)
      })),
      kpis: config.kpis.map((kpi) => ({
        ...kpi,
        sources: kpi.sources.filter((source) => source.type !== 'variable' || source.variableId !== variableId)
      }))
    });
  };
  const addLibraryGroup = (kind: 'lookup' | 'variable' | 'enum', position: number) => {
    const group: DataLibraryGroup = {
      id: createLocalId(`${kind}-group`),
      name: 'New group',
      itemIds: [],
      position
    };
    if (kind === 'lookup') {
      onConfigChange({ ...config, lookupGroups: [...config.lookupGroups, group] });
    } else if (kind === 'variable') {
      onConfigChange({ ...config, variableGroups: [...config.variableGroups, group] });
    } else {
      onConfigChange({ ...config, valueEnumGroups: [...config.valueEnumGroups, group] });
      setExpandedValueEnumGroupIds((current) => [...current, group.id]);
    }
  };
  const updateLibraryGroup = (kind: 'lookup' | 'variable' | 'enum', groupId: string, partial: Partial<DataLibraryGroup>) => {
    if (kind === 'lookup') {
      onConfigChange({
        ...config,
        lookupGroups: config.lookupGroups.map((group) => group.id === groupId ? { ...group, ...partial } : group)
      });
    } else if (kind === 'variable') {
      onConfigChange({
        ...config,
        variableGroups: config.variableGroups.map((group) => group.id === groupId ? { ...group, ...partial } : group)
      });
    } else {
      onConfigChange({
        ...config,
        valueEnumGroups: config.valueEnumGroups.map((group) => group.id === groupId ? { ...group, ...partial } : group)
      });
    }
  };
  const deleteLibraryGroup = (kind: 'lookup' | 'variable' | 'enum', groupId: string) => {
    if (kind === 'lookup') {
      setExpandedLookupGroupIds((current) => current.filter((id) => id !== groupId));
      onConfigChange({ ...config, lookupGroups: config.lookupGroups.filter((group) => group.id !== groupId) });
    } else if (kind === 'variable') {
      setExpandedVariableGroupIds((current) => current.filter((id) => id !== groupId));
      onConfigChange({ ...config, variableGroups: config.variableGroups.filter((group) => group.id !== groupId) });
    } else {
      setExpandedValueEnumGroupIds((current) => current.filter((id) => id !== groupId));
      onConfigChange({ ...config, valueEnumGroups: config.valueEnumGroups.filter((group) => group.id !== groupId) });
    }
  };
  const assignLibraryItemToGroup = (kind: 'lookup' | 'variable' | 'enum', itemId: string, groupId?: string) => {
    const groups = kind === 'lookup' ? config.lookupGroups : kind === 'variable' ? config.variableGroups : config.valueEnumGroups;
    const nextGroups = groups.map((group) => ({
      ...group,
      itemIds: group.id === groupId
        ? group.itemIds.includes(itemId) ? group.itemIds : [...group.itemIds, itemId]
        : group.itemIds.filter((id) => id !== itemId)
    }));
    if (kind === 'lookup') onConfigChange({ ...config, lookupGroups: nextGroups });
    else if (kind === 'variable') onConfigChange({ ...config, variableGroups: nextGroups });
    else onConfigChange({ ...config, valueEnumGroups: nextGroups });
  };
  const moveLibraryCollection = <T extends { id: string },>(
    items: T[],
    groups: DataLibraryGroup[],
    sourceIndex: number,
    targetIndex: number,
    position: DropPosition,
    groupId?: string,
    shiftGroupsAtTarget = true
  ) => {
    const nextItems = [...items];
    const itemToMove = nextItems[sourceIndex];
    if (!itemToMove) return { items, groups };
    const targetBoundary = targetIndex + (position === 'after' ? 1 : 0);
    const [moved] = nextItems.splice(sourceIndex, 1);
    let insertionIndex = targetBoundary;
    if (sourceIndex < insertionIndex) insertionIndex -= 1;
    nextItems.splice(Math.max(0, Math.min(insertionIndex, nextItems.length)), 0, moved);
    return {
      items: nextItems,
      groups: groups.map((group) => {
        const positionAfterRemoval = group.position > sourceIndex ? group.position - 1 : group.position;
        const nextPosition = shiftGroupsAtTarget && group.id !== groupId && group.position >= targetBoundary
          ? positionAfterRemoval + 1
          : positionAfterRemoval;
        return {
          ...group,
          position: nextPosition,
          itemIds: group.id === groupId
            ? group.itemIds.includes(moved.id) ? group.itemIds : [...group.itemIds, moved.id]
            : group.itemIds.filter((id) => id !== moved.id)
        };
      })
    };
  };
  const moveLibraryItem = (
    kind: 'lookup' | 'variable' | 'enum',
    targetIndex: number,
    position: DropPosition,
    groupId?: string,
    shiftGroupsAtTarget = true
  ) => {
    if (!libraryItemDrag || libraryItemDrag.kind !== kind) return;
    if (kind === 'lookup') {
      const result = moveLibraryCollection(
        config.lookups,
        config.lookupGroups,
        libraryItemDrag.itemIndex,
        targetIndex,
        position,
        groupId,
        shiftGroupsAtTarget
      );
      onConfigChange({ ...config, lookups: result.items, lookupGroups: result.groups });
    } else if (kind === 'variable') {
      const result = moveLibraryCollection(
        config.variables,
        config.variableGroups,
        libraryItemDrag.itemIndex,
        targetIndex,
        position,
        groupId,
        shiftGroupsAtTarget
      );
      onConfigChange({ ...config, variables: result.items, variableGroups: result.groups });
    } else {
      const result = moveLibraryCollection(
        config.valueEnums,
        config.valueEnumGroups,
        libraryItemDrag.itemIndex,
        targetIndex,
        position,
        groupId,
        shiftGroupsAtTarget
      );
      onConfigChange({ ...config, valueEnums: result.items, valueEnumGroups: result.groups });
    }
  };
  const addLookupInput = (lookupIndex: number, insertionIndex?: number) => {
    const lookup = config.lookups[lookupIndex];
    const index = Math.max(0, Math.min(insertionIndex ?? lookup.inputs.length, lookup.inputs.length));
    const input: LookupInput = {
      id: createLocalId('lookup-input'),
      representation: '',
      explanation: '',
      valueType: 'number',
      options: []
    };
    updateLookup(lookupIndex, { inputs: [...lookup.inputs.slice(0, index), input, ...lookup.inputs.slice(index)] });
  };
  const updateLookupInput = (lookupIndex: number, inputIndex: number, partial: Partial<LookupInput>) => {
    const lookup = config.lookups[lookupIndex];
    updateLookup(lookupIndex, { inputs: lookup.inputs.map((input, index) => index === inputIndex ? { ...input, ...partial } : input) });
  };
  const duplicateLookupInput = (lookupIndex: number, inputIndex: number) => {
    const lookup = config.lookups[lookupIndex];
    const input = lookup.inputs[inputIndex];
    if (!input) return;
    const duplicate = { ...input, id: createLocalId('lookup-input') };
    updateLookup(lookupIndex, { inputs: [...lookup.inputs.slice(0, inputIndex + 1), duplicate, ...lookup.inputs.slice(inputIndex + 1)] });
  };
  const deleteLookupInput = (lookupIndex: number, inputIndex: number) => {
    const lookup = config.lookups[lookupIndex];
    updateLookup(lookupIndex, { inputs: lookup.inputs.filter((_, index) => index !== inputIndex) });
  };
  const renderLookupEnumOptions = (
    options: string[],
    label: string,
    onChange: (options: string[]) => void,
    enumId?: string,
    onEnumChange?: (enumId?: string) => void
  ) => (
    <div className="lookup-enum-options">
      {onEnumChange ? <ValueEnumModeControl
        definitions={config.valueEnums}
        groups={config.valueEnumGroups}
        enumId={enumId}
        label={label}
        onEnumChange={onEnumChange}
        onViewDomain={(domainId) => onEditLibrarySource({ kind: 'domain', domainId })}
      /> : null}
      {!enumId ? <>
        <span className="lookup-enum-options-label">Custom options</span>
        <EnumOptionEditor options={options} label={`${label} domain`} onChange={onChange} required />
      </> : null}
    </div>
  );
  const relationFieldBaseName = (value: string) => value.trim().replace(/[^\p{L}\p{N}_]+/gu, '') || 'Table';
  const fallbackPrimaryKeyName = (source: DataSource) => `${relationFieldBaseName(source.name)}ID`;
  const collectionNameFromKey = (keyName: string) => {
    const normalized = relationFieldBaseName(keyName);
    return normalized.endsWith('s') ? normalized : `${normalized}s`;
  };
  const uniqueFieldName = (source: DataSource, preferred: string) => {
    const names = new Set(source.fields.map((field) => field.name.trim().toLocaleLowerCase()));
    if (!names.has(preferred.toLocaleLowerCase())) return preferred;
    let suffix = 2;
    while (names.has(`${preferred}${suffix}`.toLocaleLowerCase())) suffix += 1;
    return `${preferred}${suffix}`;
  };
  const removeRelations = (relationIds: Set<string>, removedDataSourceIds = new Set<string>()) => {
    const removedFieldKeys = new Set(config.dataSources.flatMap((source) => source.fields
      .filter((field) => field.generatedRelationId && relationIds.has(field.generatedRelationId))
      .map((field) => `${source.id}\u0000${field.id}`)));
    onConfigChange({
      ...config,
      tableRelations: config.tableRelations.filter((relation) => !relationIds.has(relation.id)),
      dataSources: config.dataSources
        .filter((source) => !removedDataSourceIds.has(source.id))
        .map((source) => {
          const fields = source.fields.filter((field) => !field.generatedRelationId || !relationIds.has(field.generatedRelationId));
          const fieldIds = new Set(fields.map((field) => field.id));
          return {
            ...source,
            fields,
            fieldGroups: source.fieldGroups.map((group) => ({ ...group, fieldIds: group.fieldIds.filter((id) => fieldIds.has(id)) }))
          };
        }),
      kpis: config.kpis.map((kpi) => ({
        ...kpi,
        sources: kpi.sources.filter((source) => source.type !== 'dataField' || (
          !removedDataSourceIds.has(source.dataSourceId) && !removedFieldKeys.has(`${source.dataSourceId}\u0000${source.fieldId}`)
        ))
      }))
    });
  };
  const deleteTableRelation = (relationId: string) => removeRelations(new Set([relationId]));
  const addTableRelation = () => {
    if (!relationEditor) return;
    const anchorId = relationEditor.sourceDataSourceId;
    const relatedId = relationEditor.targetDataSourceId;
    const sourceId = relationEditor.direction === 'one' ? anchorId : relatedId;
    const targetId = relationEditor.direction === 'one' ? relatedId : anchorId;
    if (!sourceId || !targetId || sourceId === targetId) return;
    const duplicate = config.tableRelations.some((relation) => relation.cardinality === relationEditor.cardinality && (
      relationEditor.cardinality !== 'oneToMany'
        ? (relation.sourceDataSourceId === sourceId && relation.targetDataSourceId === targetId) ||
          (relation.sourceDataSourceId === targetId && relation.targetDataSourceId === sourceId)
        : relation.sourceDataSourceId === sourceId && relation.targetDataSourceId === targetId
    ));
    if (duplicate) return;
    const workingSources = new Map(config.dataSources.map((source) => [source.id, source]));
    const ensurePrimaryKey = (dataSourceId: string) => {
      const current = workingSources.get(dataSourceId);
      if (!current) return undefined;
      const dimensionedFieldIds = new Set(current.fieldGroups.flatMap((group) => group.fieldIds));
      const existing = current.fields.find((field) => field.id === current.primaryKeyFieldId && !dimensionedFieldIds.has(field.id));
      if (existing) return existing;
      const reusable = current.fields.find((field) => !field.generatedRelationId && field.dataType === 'id' && !dimensionedFieldIds.has(field.id));
      if (reusable) {
        workingSources.set(current.id, { ...current, primaryKeyFieldId: reusable.id });
        return reusable;
      }
      const created: DataSourceField = {
        id: createLocalId('field'),
        name: uniqueFieldName(current, fallbackPrimaryKeyName(current)),
        meaning: `Primary key for ${current.name || 'this table'}`,
        dataType: 'id',
        valueUnit: '',
        options: []
      };
      workingSources.set(current.id, { ...current, primaryKeyFieldId: created.id, fields: [...current.fields, created] });
      return created;
    };
    const sourcePrimaryKey = ensurePrimaryKey(sourceId);
    if (!sourcePrimaryKey) return;
    if (relationEditor.cardinality !== 'oneToMany' && !ensurePrimaryKey(targetId)) return;
    const source = workingSources.get(sourceId);
    const target = workingSources.get(targetId);
    if (!source || !target) return;
    const relation: TableRelation = {
      id: createLocalId('relation'),
      sourceDataSourceId: sourceId,
      targetDataSourceId: targetId,
      cardinality: relationEditor.cardinality
    };
    const targetPrimaryKey = target.fields.find((field) => field.id === target.primaryKeyFieldId);
    const collectionFieldName = uniqueFieldName(source, collectionNameFromKey(targetPrimaryKey?.name || fallbackPrimaryKeyName(target)));
    const sourceKeyName = sourcePrimaryKey.name.trim() ? relationFieldBaseName(sourcePrimaryKey.name) : fallbackPrimaryKeyName(source);
    const foreignKeyFieldName = uniqueFieldName(target, sourceKeyName);
    if (relation.cardinality === 'oneToMany') {
      workingSources.set(source.id, { ...source, fields: [...source.fields, {
        id: createLocalId('field'),
        name: collectionFieldName,
        meaning: `Related ${target.name || 'table'} keys`,
        dataType: 'collection',
        collectionItemType: 'id',
        valueUnit: '',
        options: [],
        generatedRelationId: relation.id,
        generatedRelationRole: 'oneCollection'
      }] });
      workingSources.set(target.id, { ...target, fields: [...target.fields, {
        id: createLocalId('field'),
        name: foreignKeyFieldName,
        meaning: `ID of the related ${source.name || 'table'} record`,
        dataType: 'id',
        valueUnit: '',
        options: [],
        generatedRelationId: relation.id,
        generatedRelationRole: 'manyForeignKey'
      }] });
    }
    if (relation.cardinality === 'manyToMany') {
      const targetCollectionFieldName = uniqueFieldName(target, collectionNameFromKey(sourcePrimaryKey.name || fallbackPrimaryKeyName(source)));
      workingSources.set(source.id, { ...source, fields: [...source.fields, {
        id: createLocalId('field'),
        name: collectionFieldName,
        meaning: `Related ${target.name || 'table'} keys`,
        dataType: 'collection',
        collectionItemType: 'id',
        valueUnit: '',
        options: [],
        generatedRelationId: relation.id,
        generatedRelationRole: 'sourceCollection'
      }] });
      workingSources.set(target.id, { ...target, fields: [...target.fields, {
        id: createLocalId('field'),
        name: targetCollectionFieldName,
        meaning: `Related ${source.name || 'table'} keys`,
        dataType: 'collection',
        collectionItemType: 'id',
        valueUnit: '',
        options: [],
        generatedRelationId: relation.id,
        generatedRelationRole: 'targetCollection'
      }] });
    }
    const dataSources = config.dataSources.map((entry) => workingSources.get(entry.id) ?? entry);
    onConfigChange({ ...config, dataSources, tableRelations: [...config.tableRelations, relation] });
    setRelationEditor(null);
  };
  const addDataSource = (insertionIndex = config.dataSources.length) => {
    const source: DataSource = { id: createLocalId('source'), name: 'New data source', spatialUnit: '', fields: [], fieldGroups: [] };
    const index = Math.max(0, Math.min(insertionIndex, config.dataSources.length));
    patchDataSources([...config.dataSources.slice(0, index), source, ...config.dataSources.slice(index)]);
    setExpandedSourceIds((current) => [...new Set([...current, source.id])]);
  };
  const toggleDataSource = (sourceId: string) => {
    if (relationEditor?.sourceDataSourceId === sourceId) setRelationEditor(null);
    setExpandedSourceIds((current) => current.includes(sourceId) ? current.filter((id) => id !== sourceId) : [...current, sourceId]);
  };
  const duplicateDataSource = (sourceIndex: number) => {
    const source = config.dataSources[sourceIndex];
    if (!source) return;
    const copiedFields = source.fields.filter((field) => !field.generatedRelationId);
    const fieldIdMap = new Map(copiedFields.map((field) => [field.id, createLocalId('field')]));
    const duplicate: DataSource = {
      ...source,
      id: createLocalId('source'),
      name: `${source.name || 'Untitled data source'} copy`,
      primaryKeyFieldId: source.primaryKeyFieldId ? fieldIdMap.get(source.primaryKeyFieldId) : undefined,
      fields: copiedFields.map((field) => ({ ...field, id: fieldIdMap.get(field.id)!, options: [...field.options] })),
      fieldGroups: source.fieldGroups.map((group) => ({
        ...group,
        id: createLocalId('field-group'),
        dimensions: group.dimensions.map((dimension) => ({
          ...dimension,
          id: createLocalId('dimension'),
          options: [...dimension.options]
        })),
        fieldIds: group.fieldIds.flatMap((fieldId) => fieldIdMap.get(fieldId) ?? [])
      }))
    };
    patchDataSources([
      ...config.dataSources.slice(0, sourceIndex + 1),
      duplicate,
      ...config.dataSources.slice(sourceIndex + 1)
    ]);
    setExpandedSourceIds((current) => [...new Set([...current, duplicate.id])]);
  };
  const updateDataSource = (sourceIndex: number, partial: Partial<DataSource>) =>
    patchDataSources(config.dataSources.map((source, index) => index === sourceIndex ? { ...source, ...partial } : source));
  const moveDataSource = (targetIndex: number, position: DropPosition) => {
    if (sourceDragIndex === null) return;
    const dataSources = [...config.dataSources];
    const [moved] = dataSources.splice(sourceDragIndex, 1);
    if (!moved) return;
    let insertionIndex = targetIndex + (position === 'after' ? 1 : 0);
    if (sourceDragIndex < insertionIndex) insertionIndex -= 1;
    dataSources.splice(Math.max(0, Math.min(insertionIndex, dataSources.length)), 0, moved);
    patchDataSources(dataSources);
  };
  const deleteDataSource = (sourceIndex: number) => {
    const sourceId = config.dataSources[sourceIndex]?.id;
    if (!sourceId) return;
    setExpandedSourceIds((current) => current.filter((id) => id !== sourceId));
    const relationIds = new Set(config.tableRelations
      .filter((relation) => relation.sourceDataSourceId === sourceId || relation.targetDataSourceId === sourceId)
      .map((relation) => relation.id));
    removeRelations(relationIds, new Set([sourceId]));
  };
  const updateField = (sourceIndex: number, fieldIndex: number, partial: Partial<DataSourceField>) => {
    const source = config.dataSources[sourceIndex];
    const current = source.fields[fieldIndex];
    if (!current) return;
    const editablePartial = current.generatedRelationId
      ? { ...(partial.name !== undefined ? { name: partial.name } : {}), ...(partial.meaning !== undefined ? { meaning: partial.meaning } : {}) }
      : partial;
    const next = { ...current, ...editablePartial };
    if (partial.dataType) {
      if (partial.dataType === 'collection') {
        next.collectionItemType = current.dataType === 'enum'
          ? 'enum'
          : current.collectionItemType ?? 'number';
      } else {
        next.collectionItemType = undefined;
      }
      if (partial.dataType === 'enum' && current.enumId) {
        const definition = config.valueEnums.find((entry) => entry.id === current.enumId);
        if (definition) next.name = definition.name;
      }
      if (partial.dataType !== 'enum' && partial.dataType !== 'collection') {
        next.enumId = undefined;
        next.options = [];
      }
    }
    if (partial.collectionItemType && partial.collectionItemType !== 'enum') {
      next.enumId = undefined;
      next.options = [];
    }
    if (next.dataType !== 'number' && !(next.dataType === 'collection' && next.collectionItemType === 'number')) {
      next.valueUnit = '';
    }
    updateDataSource(sourceIndex, {
      fields: source.fields.map((field, index) => index === fieldIndex ? next : field)
    });
  };
  const setPrimaryKey = (sourceIndex: number, fieldIndex: number) => {
    const source = config.dataSources[sourceIndex];
    const field = source.fields[fieldIndex];
    const isDimensioned = source.fieldGroups.some((group) => group.fieldIds.includes(field?.id ?? ''));
    if (!field || field.generatedRelationId || isDimensioned) return;
    const nextPrimaryKeyFieldId = source.primaryKeyFieldId === field.id ? undefined : field.id;
    updateDataSource(sourceIndex, {
      primaryKeyFieldId: nextPrimaryKeyFieldId,
      fields: source.fields.map((entry) => entry.id === nextPrimaryKeyFieldId
        ? { ...entry, dataType: 'id', collectionItemType: undefined, valueUnit: '', options: [], enumId: undefined }
        : entry)
    });
  };
  const addField = (sourceIndex: number, insertionIndex?: number, groupId?: string, shiftGroupsAtPosition = false) => {
    const source = config.dataSources[sourceIndex];
    const index = Math.max(0, Math.min(insertionIndex ?? source.fields.length, source.fields.length));
    const field: DataSourceField = { id: createLocalId('field'), name: 'New field', meaning: '', dataType: 'number', valueUnit: '', options: [] };
    updateDataSource(sourceIndex, {
      fields: [...source.fields.slice(0, index), field, ...source.fields.slice(index)],
      fieldGroups: source.fieldGroups.map((group) => ({
        ...group,
        position: group.position > index || (shiftGroupsAtPosition && group.position === index && group.id !== groupId)
          ? group.position + 1
          : group.position,
        fieldIds: group.id === groupId ? [...group.fieldIds, field.id] : group.fieldIds
      }))
    });
  };
  const copyField = (sourceIndex: number, fieldIndex: number) => {
    const source = config.dataSources[sourceIndex];
    const field = source?.fields[fieldIndex];
    if (!source || !field) return;
    const duplicate = { ...field, id: createLocalId('field'), name: `${field.name || 'Untitled field'} copy`, options: [...field.options] };
    updateDataSource(sourceIndex, {
      fields: [...source.fields.slice(0, fieldIndex + 1), duplicate, ...source.fields.slice(fieldIndex + 1)],
      fieldGroups: source.fieldGroups.map((group) => {
        const memberIndex = group.fieldIds.indexOf(field.id);
        return {
          ...group,
          position: group.position > fieldIndex ? group.position + 1 : group.position,
          fieldIds: memberIndex < 0
            ? group.fieldIds
            : [...group.fieldIds.slice(0, memberIndex + 1), duplicate.id, ...group.fieldIds.slice(memberIndex + 1)]
        };
      })
    });
  };
  const addFieldGroup = (sourceIndex: number, position: number) => {
    const source = config.dataSources[sourceIndex];
    const groupId = createLocalId('field-group');
    updateDataSource(sourceIndex, {
      fieldGroups: [...source.fieldGroups, {
        id: groupId,
        dimensions: [],
        fieldIds: [],
        position: Math.max(0, Math.min(position, source.fields.length))
      }]
    });
    setCollapsedFieldGroupIds((current) => current.filter((id) => id !== groupId));
  };
  const updateFieldGroup = (sourceIndex: number, groupId: string, partial: Partial<DataSourceFieldGroup>) => {
    const source = config.dataSources[sourceIndex];
    updateDataSource(sourceIndex, {
      fieldGroups: source.fieldGroups.map((group) => group.id === groupId ? { ...group, ...partial } : group)
    });
  };
  const addFieldGroupDimension = (sourceIndex: number, groupId: string) => {
    const source = config.dataSources[sourceIndex];
    const group = source.fieldGroups.find((entry) => entry.id === groupId);
    if (!group) return;
    const existingNames = new Set(group.dimensions.map((dimension) => dimension.name.trim().toLocaleLowerCase()));
    let name = 'New dimension';
    let suffix = 2;
    while (existingNames.has(name.toLocaleLowerCase())) {
      name = `New dimension ${suffix}`;
      suffix += 1;
    }
    updateFieldGroup(sourceIndex, groupId, {
      dimensions: [...group.dimensions, { id: createLocalId('dimension'), name, options: [] }]
    });
  };
  const addFieldGroupEnumDimension = (sourceIndex: number, groupId: string, enumId: string) => {
    const source = config.dataSources[sourceIndex];
    const group = source.fieldGroups.find((entry) => entry.id === groupId);
    const definition = config.valueEnums.find((entry) => entry.id === enumId);
    if (!group || !definition || group.dimensions.some((dimension) => dimension.enumId === enumId)) return;
    updateFieldGroup(sourceIndex, groupId, {
      dimensions: [...group.dimensions, {
        id: createLocalId('dimension'),
        name: definition.name,
        options: [...definition.options],
        enumId: definition.id
      }]
    });
    setFieldGroupDomainPickerId(undefined);
  };
  const updateFieldGroupDimension = (sourceIndex: number, groupId: string, dimensionId: string, partial: Partial<DataSourceFieldDimension>) => {
    const source = config.dataSources[sourceIndex];
    const group = source.fieldGroups.find((entry) => entry.id === groupId);
    if (!group) return;
    updateFieldGroup(sourceIndex, groupId, {
      dimensions: group.dimensions.map((dimension) => dimension.id === dimensionId ? { ...dimension, ...partial } : dimension)
    });
  };
  const removeFieldGroupDimension = (sourceIndex: number, groupId: string, dimensionId: string) => {
    const source = config.dataSources[sourceIndex];
    const group = source.fieldGroups.find((entry) => entry.id === groupId);
    if (!group) return;
    updateFieldGroup(sourceIndex, groupId, { dimensions: group.dimensions.filter((dimension) => dimension.id !== dimensionId) });
  };
  const assignFieldToGroup = (sourceIndex: number, fieldId: string, groupId?: string) => {
    const source = config.dataSources[sourceIndex];
    if (groupId && source.primaryKeyFieldId === fieldId) return;
    updateDataSource(sourceIndex, {
      fieldGroups: source.fieldGroups.map((group) => ({
        ...group,
        fieldIds: group.id === groupId
          ? group.fieldIds.includes(fieldId) ? group.fieldIds : [...group.fieldIds, fieldId]
          : group.fieldIds.filter((id) => id !== fieldId)
      }))
    });
  };
  const deleteFieldGroup = (sourceIndex: number, groupId: string) => {
    const source = config.dataSources[sourceIndex];
    setCollapsedFieldGroupIds((current) => current.filter((id) => id !== groupId));
    setFieldGroupDomainPickerId((current) => current === groupId ? undefined : current);
    updateDataSource(sourceIndex, { fieldGroups: source.fieldGroups.filter((group) => group.id !== groupId) });
  };
  const moveField = (sourceIndex: number, targetIndex: number, position: DropPosition, groupId?: string, shiftGroupsAtTarget = true) => {
    if (!fieldDrag || fieldDrag.sourceIndex !== sourceIndex) return;
    const source = config.dataSources[sourceIndex];
    const fields = [...source.fields];
    const sourceFieldIndex = fieldDrag.fieldIndex;
    const fieldToMove = fields[sourceFieldIndex];
    if (!fieldToMove || (groupId && source.primaryKeyFieldId === fieldToMove.id)) return;
    const targetBoundary = targetIndex + (position === 'after' ? 1 : 0);
    const [moved] = fields.splice(sourceFieldIndex, 1);
    let insertionIndex = targetBoundary;
    if (sourceFieldIndex < insertionIndex) insertionIndex -= 1;
    fields.splice(Math.max(0, Math.min(insertionIndex, fields.length)), 0, moved);
    updateDataSource(sourceIndex, {
      fields,
      fieldGroups: source.fieldGroups.map((group) => {
        const positionAfterRemoval = group.position > sourceFieldIndex ? group.position - 1 : group.position;
        const nextPosition = shiftGroupsAtTarget && group.id !== groupId && group.position >= targetBoundary
          ? positionAfterRemoval + 1
          : positionAfterRemoval;
        return {
          ...group,
          position: nextPosition,
          fieldIds: group.id === groupId
            ? group.fieldIds.includes(moved.id) ? group.fieldIds : [...group.fieldIds, moved.id]
            : group.fieldIds.filter((id) => id !== moved.id)
        };
      })
    });
  };
  const deleteField = (sourceIndex: number, fieldIndex: number) => {
    const source = config.dataSources[sourceIndex];
    const field = source.fields[fieldIndex];
    const fieldId = field?.id;
    if (field?.generatedRelationId) {
      deleteTableRelation(field.generatedRelationId);
      return;
    }
    onConfigChange({
      ...config,
      dataSources: config.dataSources.map((entry, index) =>
        index === sourceIndex ? {
          ...entry,
          primaryKeyFieldId: entry.primaryKeyFieldId === fieldId ? undefined : entry.primaryKeyFieldId,
          fields: entry.fields.filter((_, index) => index !== fieldIndex),
          fieldGroups: entry.fieldGroups.map((group) => ({
            ...group,
            position: group.position > fieldIndex ? group.position - 1 : group.position,
            fieldIds: group.fieldIds.filter((id) => id !== fieldId)
          }))
        } : entry
      ),
      kpis: config.kpis.map((kpi) => ({
        ...kpi,
        sources: kpi.sources.filter((item) =>
          item.type !== 'dataField' || item.dataSourceId !== source.id || item.fieldId !== fieldId
        )
      }))
    });
  };
  const clearLibraryDrag = () => {
    setLibraryItemDrag(null);
    setLibraryItemDragOver(null);
    setLibraryGroupDragOver(null);
    setLibraryInsertDragOver(null);
  };
  const renderLibraryInsertActions = (
    kind: 'lookup' | 'variable' | 'enum',
    position: number,
    key: string,
    groupId?: string,
    shiftGroupsAtPosition = true
  ) => (
    <div
      className={`field-insert-actions library-insert-actions ${libraryInsertDragOver?.kind === kind && libraryInsertDragOver.key === key ? 'is-drag-over' : ''}`}
      key={key}
      onDragOver={(event) => {
        if (libraryItemDrag?.kind !== kind) return;
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = 'move';
        setLibraryItemDragOver(null);
        setLibraryGroupDragOver(null);
        setLibraryInsertDragOver({ kind, key });
      }}
      onDrop={(event) => {
        if (libraryItemDrag?.kind !== kind) return;
        event.preventDefault();
        event.stopPropagation();
        moveLibraryItem(kind, position, 'before', groupId, shiftGroupsAtPosition);
        clearLibraryDrag();
      }}
    >
      <button
        className="list-insert-divider"
        type="button"
        onClick={() => kind === 'lookup'
          ? addLookup(position, groupId, shiftGroupsAtPosition)
          : kind === 'variable'
            ? addVariable(position, groupId, shiftGroupsAtPosition)
            : addValueEnum(position, groupId, shiftGroupsAtPosition)}
      ><Plus size={11} aria-hidden="true" />Add {kind} here</button>
      <button
        className="list-insert-divider field-group-insert-divider"
        type="button"
        onClick={() => addLibraryGroup(kind, position)}
      ><Plus size={11} aria-hidden="true" />Add group</button>
    </div>
  );
  const renderLookupItem = (lookup: LookupDefinition, lookupIndex: number, groupId?: string) => (
    <div
      className={`library-item-shell ${libraryItemDragOver?.kind === 'lookup' && libraryItemDragOver.itemIndex === lookupIndex ? `is-drag-over-${libraryItemDragOver.position}` : ''} ${focusedEditRequest?.kind === 'lookup' && focusedEditRequest.lookupId === lookup.id ? 'is-library-edit-target' : ''}`}
      data-library-target={`lookup:${lookup.id}`}
      key={lookup.id}
      onDragOver={(event) => {
        if (libraryItemDrag?.kind !== 'lookup') return;
        event.preventDefault();
        event.stopPropagation();
        setLibraryInsertDragOver(null);
        const rect = event.currentTarget.getBoundingClientRect();
        setLibraryItemDragOver({
          kind: 'lookup',
          itemIndex: lookupIndex,
          position: event.clientY < rect.top + rect.height / 2 ? 'before' : 'after'
        });
        setLibraryGroupDragOver({ kind: 'lookup', groupId });
      }}
      onDrop={(event) => {
        if (libraryItemDrag?.kind !== 'lookup') return;
        event.preventDefault();
        event.stopPropagation();
        moveLibraryItem('lookup', lookupIndex, libraryItemDragOver?.position ?? 'before', groupId);
        clearLibraryDrag();
      }}
    >
      <button
        className="mini-icon-button drag-handle library-item-drag"
        type="button"
        draggable
        title="Drag to reorder or move into a group"
        aria-label={`Drag ${lookup.outputName || 'lookup'} to reorder or move into a group`}
        onDragStart={(event) => {
          setLibraryItemDrag({ kind: 'lookup', itemIndex: lookupIndex });
          event.dataTransfer.effectAllowed = 'move';
          event.dataTransfer.setData('text/plain', lookup.id);
        }}
        onDragEnd={clearLibraryDrag}
      ><GripVertical size={13} aria-hidden="true" /></button>
      <details className="lookup-definition" open={expandedLookupIds.includes(lookup.id)} onToggle={(event) => {
        const isOpen = event.currentTarget.open;
        setExpandedLookupIds((current) => isOpen ? [...new Set([...current, lookup.id])] : current.filter((id) => id !== lookup.id));
      }}>
        <summary>
          <BookOpen size={13} aria-hidden="true" />
          <label className="lookup-summary-title" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
            <span>Lookup Name</span>
            <span className="lookup-summary-title-main">
              <input
                disabled={Boolean(lookup.outputEnumId)}
                value={lookup.outputName}
                size={Math.min(36, Math.max(12, lookup.outputName.length || 'Untitled lookup'.length))}
                placeholder="Untitled lookup"
                aria-label="Lookup Name"
                onChange={(event) => updateLookup(lookupIndex, { outputName: event.target.value })}
              />
            </span>
          </label>
          <span className="lookup-summary-trailing">
            <small>{lookup.inputs.length} {lookup.inputs.length === 1 ? 'input' : 'inputs'}</small>
            <code>{lookupDefaultLatex(lookup)}</code>
            <span className="lookup-header-actions" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
              <button className="mini-icon-button" type="button" title="Copy lookup" aria-label={`Copy ${lookup.outputName.trim() || 'untitled lookup'}`} onClick={(event) => {
                event.preventDefault();
                duplicateLookup(lookupIndex);
              }}><Copy size={12} /></button>
              <button className="mini-icon-button danger" type="button" title="Delete lookup" aria-label={`Delete ${lookup.outputName.trim() || 'untitled lookup'}`} onClick={(event) => {
                event.preventDefault();
                deleteLookup(lookupIndex);
              }}><Trash2 size={12} /></button>
            </span>
            <ChevronDown size={12} aria-hidden="true" />
          </span>
        </summary>
        <div className="lookup-definition-body">
          <section className="lookup-output-section" aria-label="Lookup output">
            <div className="lookup-section-heading">
              <span><strong>Lookup output</strong><small>The value returned by this lookup</small></span>
            </div>
            <div className="lookup-output-fields">
              <label className="field"><span>Output type</span><select value={lookup.outputValueType} onChange={(event) => updateLookup(lookupIndex, { outputValueType: event.target.value as LookupValueType })}><option value="number">Number</option><option value="enum">Domain</option></select></label>
              <label className="field"><span>Output explanation</span><input value={lookup.outputExplanation} placeholder="What the lookup returns" onChange={(event) => updateLookup(lookupIndex, { outputExplanation: event.target.value })} /></label>
            </div>
            {lookup.outputValueType === 'enum' ? renderLookupEnumOptions(
              lookup.outputOptions,
              `${lookup.outputName || 'Lookup'} output`,
              (outputOptions) => updateLookup(lookupIndex, { outputOptions }),
              lookup.outputEnumId,
              (enumId) => {
                const definition = config.valueEnums.find((entry) => entry.id === enumId);
                updateLookup(lookupIndex, { outputEnumId: enumId, ...(definition ? { outputName: definition.name, outputOptions: [...definition.options] } : {}) });
              }
            ) : null}
          </section>
          <section className="lookup-inputs-section" aria-label="Lookup inputs">
            <div className="lookup-section-heading lookup-inputs-section-heading">
              <span><strong>Inputs</strong><small>Values used to find the output</small></span>
              <small className="lookup-section-count">{lookup.inputs.length}</small>
            </div>
            <div className="lookup-input-heading"><span>Input representation</span><span>Type</span><span>Explanation</span><span>Actions</span></div>
            {lookup.inputs.length === 0 ? <span className="empty-option">No input variables.</span> : null}
            {lookup.inputs.flatMap((input, inputIndex) => [
              <button className="list-insert-divider lookup-input-insert" type="button" key={`insert-lookup-input-${input.id}`} onClick={() => addLookupInput(lookupIndex, inputIndex)}><Plus size={10} aria-hidden="true" />Add input here</button>,
              <div className="lookup-input-card" key={input.id}>
                <div className="lookup-input-card-heading">Input {inputIndex + 1}</div>
                <div className="lookup-input-row">
                  <input disabled={Boolean(input.enumId)} value={input.representation} aria-label={`Input ${inputIndex + 1} representation`} placeholder="Short text" onChange={(event) => updateLookupInput(lookupIndex, inputIndex, { representation: event.target.value })} />
                  <select value={input.valueType} aria-label={`Input ${inputIndex + 1} value type`} onChange={(event) => updateLookupInput(lookupIndex, inputIndex, { valueType: event.target.value as LookupValueType })}><option value="number">Number</option><option value="enum">Domain</option></select>
                  <input value={input.explanation} aria-label={`Input ${inputIndex + 1} explanation`} placeholder="What this input represents" onChange={(event) => updateLookupInput(lookupIndex, inputIndex, { explanation: event.target.value })} />
                  <div className="lookup-definition-actions">
                    <button className="mini-icon-button" type="button" title="Copy input" aria-label={`Copy input ${inputIndex + 1}`} onClick={() => duplicateLookupInput(lookupIndex, inputIndex)}><Copy size={11} /></button>
                    <button className="mini-icon-button danger" type="button" title="Delete input" aria-label={`Delete input ${inputIndex + 1}`} onClick={() => deleteLookupInput(lookupIndex, inputIndex)}><Trash2 size={11} /></button>
                  </div>
                </div>
                {input.valueType === 'enum' ? renderLookupEnumOptions(
                  input.options,
                  input.representation || `Input ${inputIndex + 1}`,
                  (options) => updateLookupInput(lookupIndex, inputIndex, { options }),
                  input.enumId,
                  (enumId) => {
                    const definition = config.valueEnums.find((entry) => entry.id === enumId);
                    updateLookupInput(lookupIndex, inputIndex, { enumId, ...(definition ? { representation: definition.name, options: [...definition.options] } : {}) });
                  }
                ) : null}
              </div>
            ])}
            <button className="secondary-action tiny lookup-add-input" type="button" onClick={() => addLookupInput(lookupIndex)}><Plus size={11} /> Add input</button>
          </section>
          <div className="field lookup-details-field">
            <div className="lookup-details-heading">
              <span>Lookup details</span>
              <label className="lookup-details-mode">
                <span className={!lookupDetailsSourceIds.includes(lookup.id) ? 'is-active' : ''}>Rendered</span>
                <input
                  type="checkbox"
                  role="switch"
                  aria-label={`Show Markdown source for ${lookup.outputName.trim() || 'untitled lookup'}`}
                  checked={lookupDetailsSourceIds.includes(lookup.id)}
                  onChange={(event) => setLookupDetailsSourceIds((current) => event.target.checked
                    ? [...new Set([...current, lookup.id])]
                    : current.filter((id) => id !== lookup.id))}
                />
                <span className={lookupDetailsSourceIds.includes(lookup.id) ? 'is-active' : ''}>Source</span>
              </label>
            </div>
            {lookupDetailsSourceIds.includes(lookup.id) ? (
              <AutoGrowTextarea
                value={lookup.text}
                rows={3}
                aria-label={`Markdown source for ${lookup.outputName.trim() || 'untitled lookup'}`}
                placeholder="# Lookup details\n\nUse Markdown headings, lists, links, tables, and code."
                onValueChange={(text) => updateLookup(lookupIndex, { text })}
              />
            ) : (
              <MarkdownContent
                value={lookup.text}
                onTextEdit={(start, end, text) => updateLookup(lookupIndex, {
                  text: `${lookup.text.slice(0, start)}${text}${lookup.text.slice(end)}`
                })}
              />
            )}
          </div>
        </div>
      </details>
    </div>
  );
  const renderVariableItem = (variable: VariableDefinition, variableIndex: number, groupId?: string) => (
    <div
      className={`variable-row ${libraryItemDragOver?.kind === 'variable' && libraryItemDragOver.itemIndex === variableIndex ? `is-drag-over-${libraryItemDragOver.position}` : ''} ${focusedEditRequest?.kind === 'variable' && focusedEditRequest.variableId === variable.id ? 'is-library-edit-target' : ''}`}
      data-library-target={`variable:${variable.id}`}
      key={variable.id}
      onDragOver={(event) => {
        if (libraryItemDrag?.kind !== 'variable') return;
        event.preventDefault();
        event.stopPropagation();
        setLibraryInsertDragOver(null);
        const rect = event.currentTarget.getBoundingClientRect();
        setLibraryItemDragOver({
          kind: 'variable',
          itemIndex: variableIndex,
          position: event.clientY < rect.top + rect.height / 2 ? 'before' : 'after'
        });
        setLibraryGroupDragOver({ kind: 'variable', groupId });
      }}
      onDrop={(event) => {
        if (libraryItemDrag?.kind !== 'variable') return;
        event.preventDefault();
        event.stopPropagation();
        moveLibraryItem('variable', variableIndex, libraryItemDragOver?.position ?? 'before', groupId);
        clearLibraryDrag();
      }}
    >
      <button
        className="mini-icon-button drag-handle library-item-drag"
        type="button"
        draggable
        title="Drag to reorder or move into a group"
        aria-label={`Drag ${variable.name || 'variable'} to reorder or move into a group`}
        onDragStart={(event) => {
          setLibraryItemDrag({ kind: 'variable', itemIndex: variableIndex });
          event.dataTransfer.effectAllowed = 'move';
          event.dataTransfer.setData('text/plain', variable.id);
        }}
        onDragEnd={clearLibraryDrag}
      ><GripVertical size={13} aria-hidden="true" /></button>
      <input value={variable.name} aria-label="Variable name" placeholder="Variable name" onChange={(event) => updateVariable(variableIndex, { name: event.target.value })} />
      <input value={variable.explanation} aria-label="Variable explanation" placeholder="What this variable represents" onChange={(event) => updateVariable(variableIndex, { explanation: event.target.value })} />
      <input value={variable.unit} aria-label="Variable unit" placeholder="Unit" onChange={(event) => updateVariable(variableIndex, { unit: event.target.value })} />
      <div className="lookup-definition-actions">
        <button className="mini-icon-button" type="button" title="Copy variable" onClick={() => duplicateVariable(variableIndex)}><Copy size={11} /></button>
        <button className="mini-icon-button danger" type="button" title="Delete variable" onClick={() => deleteVariable(variableIndex)}><Trash2 size={11} /></button>
      </div>
    </div>
  );
  const renderLookupGroup = (group: DataLibraryGroup) => {
    const groupItems = config.lookups
      .map((lookup, lookupIndex) => ({ lookup, lookupIndex }))
      .filter(({ lookup }) => group.itemIds.includes(lookup.id));
    const expanded = expandedLookupGroupIds.includes(group.id);
    const groupDragPosition = libraryGroupDragOver?.kind === 'lookup' && libraryGroupDragOver.groupId === group.id
      ? libraryGroupDragOver.position
      : undefined;
    const groupIsDragTarget = libraryGroupDragOver?.kind === 'lookup' && libraryGroupDragOver.groupId === group.id;
    const lookupGroupDropPosition = (element: HTMLDivElement, clientY: number): DropPosition | undefined => {
      const rect = element.getBoundingClientRect();
      const edgeSize = Math.min(28, Math.max(10, rect.height * 0.2));
      if (clientY < rect.top + edgeSize) return 'before';
      if (clientY > rect.bottom - edgeSize) return 'after';
      return undefined;
    };
    return (
      <div
        className={`library-group ${groupIsDragTarget ? groupDragPosition ? `is-drag-over-${groupDragPosition}` : 'is-drag-over' : ''}`}
        key={group.id}
        onDragOver={(event) => {
          if (libraryItemDrag?.kind !== 'lookup') return;
          event.preventDefault();
          event.stopPropagation();
          event.dataTransfer.dropEffect = 'move';
          const position = lookupGroupDropPosition(event.currentTarget, event.clientY);
          setLibraryItemDragOver(null);
          setLibraryInsertDragOver(null);
          setLibraryGroupDragOver({ kind: 'lookup', groupId: group.id, position });
          if (!position) setExpandedLookupGroupIds((current) => [...new Set([...current, group.id])]);
        }}
        onDrop={(event) => {
          if (libraryItemDrag?.kind !== 'lookup') return;
          event.preventDefault();
          event.stopPropagation();
          const position = lookupGroupDropPosition(event.currentTarget, event.clientY);
          if (position === 'before') {
            moveLibraryItem('lookup', group.position, 'before', undefined, true);
          } else if (position === 'after') {
            moveLibraryItem('lookup', group.position, 'before', undefined, false);
          } else {
            const dragged = config.lookups[libraryItemDrag.itemIndex];
            if (dragged) assignLibraryItemToGroup('lookup', dragged.id, group.id);
          }
          clearLibraryDrag();
        }}
      >
        <button
          className="library-group-heading"
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpandedLookupGroupIds((current) => expanded ? current.filter((id) => id !== group.id) : [...current, group.id])}
        >
          <ChevronDown className={`lookup-library-chevron ${expanded ? 'is-expanded' : ''}`} size={12} aria-hidden="true" />
          <strong>{group.name.trim() || 'Untitled group'}</strong>
          <small>{group.itemIds.length} {group.itemIds.length === 1 ? 'lookup' : 'lookups'}</small>
        </button>
        {expanded ? <div className="library-group-body">
          <div className="library-group-settings">
            <label className="field"><span>Group name</span><input value={group.name} placeholder="Group name" onChange={(event) => updateLibraryGroup('lookup', group.id, { name: event.target.value })} /></label>
            <button className="mini-icon-button danger" type="button" title="Delete lookup group" onClick={() => deleteLibraryGroup('lookup', group.id)}><Trash2 size={12} /></button>
          </div>
          {groupItems.length === 0 ? <span className="library-group-drop-hint"><GripVertical size={12} aria-hidden="true" /> Drag lookups here</span> : null}
          {groupItems.flatMap(({ lookup, lookupIndex }) => [
            renderLibraryInsertActions('lookup', lookupIndex, `insert-group-lookup-${lookup.id}`, group.id),
            renderLookupItem(lookup, lookupIndex, group.id)
          ])}
          <div className="library-final-actions">
            <button className="secondary-action tiny library-group-add-item" type="button" onClick={() => addLookup(config.lookups.length, group.id)}><Plus size={11} /> Add lookup</button>
            <button className="secondary-action tiny" type="button" onClick={() => addLibraryGroup('lookup', group.position)}><Plus size={11} /> Add group</button>
          </div>
        </div> : null}
      </div>
    );
  };
  const renderVariableGroup = (group: DataLibraryGroup) => {
    const groupItems = config.variables
      .map((variable, variableIndex) => ({ variable, variableIndex }))
      .filter(({ variable }) => group.itemIds.includes(variable.id));
    const expanded = expandedVariableGroupIds.includes(group.id);
    return (
      <div
        className={`library-group is-variable ${libraryGroupDragOver?.kind === 'variable' && libraryGroupDragOver.groupId === group.id ? 'is-drag-over' : ''}`}
        key={group.id}
        onDragOver={(event) => {
          if (libraryItemDrag?.kind !== 'variable') return;
          event.preventDefault();
          event.stopPropagation();
          setLibraryItemDragOver(null);
          setLibraryInsertDragOver(null);
          setLibraryGroupDragOver({ kind: 'variable', groupId: group.id });
          setExpandedVariableGroupIds((current) => [...new Set([...current, group.id])]);
        }}
        onDrop={(event) => {
          if (libraryItemDrag?.kind !== 'variable') return;
          event.preventDefault();
          event.stopPropagation();
          const dragged = config.variables[libraryItemDrag.itemIndex];
          if (dragged) assignLibraryItemToGroup('variable', dragged.id, group.id);
          clearLibraryDrag();
        }}
      >
        <button
          className="library-group-heading"
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpandedVariableGroupIds((current) => expanded ? current.filter((id) => id !== group.id) : [...current, group.id])}
        >
          <ChevronDown className={`lookup-library-chevron ${expanded ? 'is-expanded' : ''}`} size={12} aria-hidden="true" />
          <strong>{group.name.trim() || 'Untitled group'}</strong>
          <small>{group.itemIds.length} {group.itemIds.length === 1 ? 'variable' : 'variables'}</small>
        </button>
        {expanded ? <div className="library-group-body">
          <div className="library-group-settings">
            <label className="field"><span>Group name</span><input value={group.name} placeholder="Group name" onChange={(event) => updateLibraryGroup('variable', group.id, { name: event.target.value })} /></label>
            <button className="mini-icon-button danger" type="button" title="Delete variable group" onClick={() => deleteLibraryGroup('variable', group.id)}><Trash2 size={12} /></button>
          </div>
          {groupItems.length === 0 ? <span className="library-group-drop-hint"><GripVertical size={12} aria-hidden="true" /> Drag variables here</span> : null}
          {groupItems.flatMap(({ variable, variableIndex }) => [
            renderLibraryInsertActions('variable', variableIndex, `insert-group-variable-${variable.id}`, group.id),
            renderVariableItem(variable, variableIndex, group.id)
          ])}
          <div className="library-final-actions">
            <button className="secondary-action tiny library-group-add-item" type="button" onClick={() => addVariable(config.variables.length, group.id)}><Plus size={11} /> Add variable</button>
            <button className="secondary-action tiny" type="button" onClick={() => addLibraryGroup('variable', group.position)}><Plus size={11} /> Add group</button>
          </div>
        </div> : null}
      </div>
    );
  };
  const renderValueEnumItem = (definition: ValueEnumDefinition, enumIndex: number, groupId?: string) => (
    <section
      className={`value-enum-row ${libraryItemDragOver?.kind === 'enum' && libraryItemDragOver.itemIndex === enumIndex ? `is-drag-over-${libraryItemDragOver.position}` : ''} ${focusedEditRequest?.kind === 'domain' && focusedEditRequest.domainId === definition.id ? 'is-library-edit-target' : ''}`}
      data-library-target={`domain:${definition.id}`}
      key={definition.id}
      onDragOver={(event) => {
        if (libraryItemDrag?.kind !== 'enum') return;
        event.preventDefault();
        event.stopPropagation();
        setLibraryInsertDragOver(null);
        const rect = event.currentTarget.getBoundingClientRect();
        setLibraryItemDragOver({ kind: 'enum', itemIndex: enumIndex, position: event.clientY < rect.top + rect.height / 2 ? 'before' : 'after' });
        setLibraryGroupDragOver({ kind: 'enum', groupId });
      }}
      onDrop={(event) => {
        if (libraryItemDrag?.kind !== 'enum') return;
        event.preventDefault();
        event.stopPropagation();
        moveLibraryItem('enum', enumIndex, libraryItemDragOver?.position ?? 'before', groupId);
        clearLibraryDrag();
      }}
    >
      <button
        className="mini-icon-button drag-handle library-item-drag"
        type="button"
        draggable
        title="Drag to reorder or move into a group"
        aria-label={`Drag ${definition.name || 'domain'} to reorder or move into a group`}
        onDragStart={(event) => {
          setLibraryItemDrag({ kind: 'enum', itemIndex: enumIndex });
          event.dataTransfer.effectAllowed = 'move';
          event.dataTransfer.setData('text/plain', definition.id);
        }}
        onDragEnd={clearLibraryDrag}
      ><GripVertical size={13} aria-hidden="true" /></button>
      <label className="field value-enum-name"><span>Domain name</span><input value={definition.name} placeholder="Domain name" onChange={(event) => updateValueEnum(enumIndex, { name: event.target.value })} /></label>
      <div className="field value-enum-options"><span>Options</span><EnumOptionEditor options={definition.options} label={definition.name || 'domain'} onChange={(options) => updateValueEnum(enumIndex, { options })} /></div>
      <div className="lookup-definition-actions">
        <button className="mini-icon-button" type="button" title="Copy domain" onClick={() => duplicateValueEnum(enumIndex)}><Copy size={11} /></button>
        <button className="mini-icon-button danger" type="button" title="Delete domain" onClick={() => deleteValueEnum(enumIndex)}><Trash2 size={11} /></button>
      </div>
    </section>
  );
  const renderValueEnumGroup = (group: DataLibraryGroup) => {
    const groupItems = config.valueEnums.map((definition, enumIndex) => ({ definition, enumIndex })).filter(({ definition }) => group.itemIds.includes(definition.id));
    const expanded = expandedValueEnumGroupIds.includes(group.id);
    const groupDragPosition = libraryGroupDragOver?.kind === 'enum' && libraryGroupDragOver.groupId === group.id ? libraryGroupDragOver.position : undefined;
    const groupDropPosition = (element: HTMLDivElement, clientY: number): DropPosition | undefined => {
      const rect = element.getBoundingClientRect();
      const edgeSize = Math.min(28, Math.max(10, rect.height * 0.2));
      if (clientY < rect.top + edgeSize) return 'before';
      if (clientY > rect.bottom - edgeSize) return 'after';
      return undefined;
    };
    return <div
      className={`library-group is-enum ${libraryGroupDragOver?.kind === 'enum' && libraryGroupDragOver.groupId === group.id ? groupDragPosition ? `is-drag-over-${groupDragPosition}` : 'is-drag-over' : ''}`}
      key={group.id}
      onDragOver={(event) => {
        if (libraryItemDrag?.kind !== 'enum') return;
        event.preventDefault();
        event.stopPropagation();
        const position = groupDropPosition(event.currentTarget, event.clientY);
        setLibraryItemDragOver(null);
        setLibraryInsertDragOver(null);
        setLibraryGroupDragOver({ kind: 'enum', groupId: group.id, position });
        if (!position) setExpandedValueEnumGroupIds((current) => [...new Set([...current, group.id])]);
      }}
      onDrop={(event) => {
        if (libraryItemDrag?.kind !== 'enum') return;
        event.preventDefault();
        event.stopPropagation();
        const position = groupDropPosition(event.currentTarget, event.clientY);
        if (position === 'before') moveLibraryItem('enum', group.position, 'before', undefined, true);
        else if (position === 'after') moveLibraryItem('enum', group.position, 'before', undefined, false);
        else {
          const dragged = config.valueEnums[libraryItemDrag.itemIndex];
          if (dragged) assignLibraryItemToGroup('enum', dragged.id, group.id);
        }
        clearLibraryDrag();
      }}
    >
      <button className="library-group-heading" type="button" aria-expanded={expanded} onClick={() => setExpandedValueEnumGroupIds((current) => expanded ? current.filter((id) => id !== group.id) : [...current, group.id])}>
        <ChevronDown className={`lookup-library-chevron ${expanded ? 'is-expanded' : ''}`} size={12} aria-hidden="true" />
        <strong>{group.name.trim() || 'Untitled group'}</strong>
        <small>{group.itemIds.length} {group.itemIds.length === 1 ? 'domain' : 'domains'}</small>
      </button>
      {expanded ? <div className="library-group-body">
        <div className="library-group-settings">
          <label className="field"><span>Group name</span><input value={group.name} placeholder="Group name" onChange={(event) => updateLibraryGroup('enum', group.id, { name: event.target.value })} /></label>
          <button className="mini-icon-button danger" type="button" title="Delete domain group" onClick={() => deleteLibraryGroup('enum', group.id)}><Trash2 size={12} /></button>
        </div>
        {groupItems.length === 0 ? <span className="library-group-drop-hint"><GripVertical size={12} aria-hidden="true" /> Drag domains here</span> : null}
        {groupItems.flatMap(({ definition, enumIndex }) => [
          renderLibraryInsertActions('enum', enumIndex, `insert-group-enum-${definition.id}`, group.id),
          renderValueEnumItem(definition, enumIndex, group.id)
        ])}
        <div className="library-final-actions">
          <button className="secondary-action tiny library-group-add-item" type="button" onClick={() => addValueEnum(config.valueEnums.length, group.id)}><Plus size={11} /> Add domain</button>
          <button className="secondary-action tiny" type="button" onClick={() => addLibraryGroup('enum', group.position)}><Plus size={11} /> Add group</button>
        </div>
      </div> : null}
    </div>;
  };
  const groupedLookupIds = new Set(config.lookupGroups.flatMap((group) => group.itemIds));
  const groupedVariableIds = new Set(config.variableGroups.flatMap((group) => group.itemIds));
  const groupedValueEnumIds = new Set(config.valueEnumGroups.flatMap((group) => group.itemIds));
  return (
    <div className="library-manager-control" ref={controlRef}>
      <div className="library-manager-tray" aria-label="Shared definition libraries">
        {([
          ['variables', 'Variables', VariableIcon],
          ['enums', 'Domains', ListFilter],
          ['lookups', 'Lookups', BookOpen],
          ['tables', 'Source Tables', Table2]
        ] as const).map(([section, label, Icon]) => <button
          className={`secondary-action small library-manager-trigger ${open && activeLibrarySection === section ? 'is-active' : ''}`}
          type="button"
          aria-label={label}
          aria-expanded={open && activeLibrarySection === section}
          title={label}
          key={section}
          onClick={() => {
            if (open && activeLibrarySection === section) {
              setOpen(false);
              return;
            }
            setActiveLibrarySection(section);
            setOpen(true);
          }}
        ><Icon size={14} aria-hidden="true" /><span className="library-manager-trigger-label">{label}</span></button>)}
      </div>
      {open && popoverPosition ? createPortal(
        <div
          className="data-source-popover"
          ref={popoverRef}
          role="dialog"
          aria-label="Variables, domains, lookups, and source tables"
          style={popoverPosition}
        >
          <div className="data-source-popover-heading">
            <div>
              <strong>Shared definitions</strong>
              <span>Define reusable variables, global domains, lookups, and source tables.</span>
            </div>
            <div className="data-source-library-actions">
              {activeLibrarySection === 'variables' ? <button className="primary-action tiny" type="button" onClick={() => addVariable()}><Plus size={12} /> Add variable</button> : null}
              {activeLibrarySection === 'enums' ? <button className="primary-action tiny" type="button" onClick={() => addValueEnum()}><Plus size={12} /> Add domain</button> : null}
              {activeLibrarySection === 'lookups' ? <button className="primary-action tiny" type="button" onClick={() => addLookup()}><Plus size={12} /> Add lookup</button> : null}
              {activeLibrarySection === 'tables' ? <button className="primary-action tiny" type="button" onClick={() => addDataSource()}><Plus size={12} /> Add source table</button> : null}
            </div>
          </div>
          <div className="data-source-list">
            {activeLibrarySection === 'lookups' ? <section className="lookup-library is-direct-library">
              <div
                className={`lookup-library-list library-ungrouped-dropzone ${libraryGroupDragOver?.kind === 'lookup' && libraryGroupDragOver.groupId === undefined ? 'is-drag-over' : ''}`}
                id="lookup-library-list"
                onDragOver={(event) => {
                  if (libraryItemDrag?.kind !== 'lookup') return;
                  event.preventDefault();
                  setLibraryItemDragOver(null);
                  setLibraryInsertDragOver(null);
                  setLibraryGroupDragOver({ kind: 'lookup' });
                }}
                onDrop={(event) => {
                  if (libraryItemDrag?.kind !== 'lookup') return;
                  event.preventDefault();
                  const dragged = config.lookups[libraryItemDrag.itemIndex];
                  if (dragged) assignLibraryItemToGroup('lookup', dragged.id);
                  clearLibraryDrag();
                }}
              >
                {config.lookups.length === 0 ? <span className="empty-option">No lookups defined.</span> : null}
                {config.lookups.flatMap((lookup, lookupIndex) => {
                  const groupsAtPosition = config.lookupGroups.filter((group) => group.position === lookupIndex);
                  const isUngrouped = !groupedLookupIds.has(lookup.id);
                  return [
                    ...(groupsAtPosition.length > 0
                      ? [renderLibraryInsertActions('lookup', lookupIndex, `before-lookup-groups-${lookup.id}`, undefined, true)]
                      : []),
                    ...groupsAtPosition.map(renderLookupGroup),
                    ...(isUngrouped ? [
                      ...(groupsAtPosition.length > 0
                        ? [renderLibraryInsertActions('lookup', lookupIndex, `after-lookup-groups-${lookup.id}`, undefined, false)]
                        : [renderLibraryInsertActions('lookup', lookupIndex, `insert-lookup-${lookup.id}`)]),
                      renderLookupItem(lookup, lookupIndex)
                    ] : [])
                  ];
                })}
                {config.lookupGroups.some((group) => group.position === config.lookups.length)
                  ? renderLibraryInsertActions('lookup', config.lookups.length, 'before-final-lookup-groups', undefined, true)
                  : null}
                {config.lookupGroups.filter((group) => group.position === config.lookups.length).map(renderLookupGroup)}
                {config.lookups.length > 0 || config.lookupGroups.length > 0
                  ? renderLibraryInsertActions('lookup', config.lookups.length, 'after-final-lookup-groups', undefined, false)
                  : null}
                <div className="library-final-actions">
                  <button className="secondary-action tiny" type="button" onClick={() => addLookup()}><Plus size={11} /> Add lookup</button>
                  <button className="secondary-action tiny" type="button" onClick={() => addLibraryGroup('lookup', config.lookups.length)}><Plus size={11} /> Add group</button>
                </div>
              </div>
            </section> : null}
            {activeLibrarySection === 'variables' ? <section className="variable-library is-direct-library">
              <div
                className={`variable-library-list library-ungrouped-dropzone ${libraryGroupDragOver?.kind === 'variable' && libraryGroupDragOver.groupId === undefined ? 'is-drag-over' : ''}`}
                id="variable-library-list"
                onDragOver={(event) => {
                  if (libraryItemDrag?.kind !== 'variable') return;
                  event.preventDefault();
                  setLibraryItemDragOver(null);
                  setLibraryInsertDragOver(null);
                  setLibraryGroupDragOver({ kind: 'variable' });
                }}
                onDrop={(event) => {
                  if (libraryItemDrag?.kind !== 'variable') return;
                  event.preventDefault();
                  const dragged = config.variables[libraryItemDrag.itemIndex];
                  if (dragged) assignLibraryItemToGroup('variable', dragged.id);
                  clearLibraryDrag();
                }}
              >
                {config.variables.length === 0 ? <span className="empty-option">No variables defined.</span> : (
                  <div className="variable-heading"><span /><span>Name</span><span>Explanation</span><span>Unit</span><span>Actions</span></div>
                )}
                {config.variables.flatMap((variable, variableIndex) => {
                  const groupsAtPosition = config.variableGroups.filter((group) => group.position === variableIndex);
                  const isUngrouped = !groupedVariableIds.has(variable.id);
                  return [
                    ...(groupsAtPosition.length > 0
                      ? [renderLibraryInsertActions('variable', variableIndex, `before-variable-groups-${variable.id}`, undefined, true)]
                      : []),
                    ...groupsAtPosition.map(renderVariableGroup),
                    ...(isUngrouped ? [
                      ...(groupsAtPosition.length > 0
                        ? [renderLibraryInsertActions('variable', variableIndex, `after-variable-groups-${variable.id}`, undefined, false)]
                        : [renderLibraryInsertActions('variable', variableIndex, `insert-variable-${variable.id}`)]),
                      renderVariableItem(variable, variableIndex)
                    ] : [])
                  ];
                })}
                {config.variableGroups.some((group) => group.position === config.variables.length)
                  ? renderLibraryInsertActions('variable', config.variables.length, 'before-final-variable-groups', undefined, true)
                  : null}
                {config.variableGroups.filter((group) => group.position === config.variables.length).map(renderVariableGroup)}
                {config.variables.length > 0 || config.variableGroups.length > 0
                  ? renderLibraryInsertActions('variable', config.variables.length, 'after-final-variable-groups', undefined, false)
                  : null}
                <div className="library-final-actions">
                  <button className="secondary-action tiny" type="button" onClick={() => addVariable()}><Plus size={11} /> Add variable</button>
                  <button className="secondary-action tiny" type="button" onClick={() => addLibraryGroup('variable', config.variables.length)}><Plus size={11} /> Add group</button>
                </div>
              </div>
            </section> : null}
            {activeLibrarySection === 'enums' ? <section className="value-enum-library library-ungrouped-dropzone" onDragOver={(event) => {
              if (libraryItemDrag?.kind !== 'enum') return;
              event.preventDefault();
              setLibraryItemDragOver(null);
              setLibraryInsertDragOver(null);
              setLibraryGroupDragOver({ kind: 'enum' });
            }} onDrop={(event) => {
              if (libraryItemDrag?.kind !== 'enum') return;
              event.preventDefault();
              const dragged = config.valueEnums[libraryItemDrag.itemIndex];
              if (dragged) assignLibraryItemToGroup('enum', dragged.id);
              clearLibraryDrag();
            }}>
              {config.valueEnums.length === 0 ? <span className="empty-option">No global domains defined.</span> : null}
              {config.valueEnums.flatMap((definition, enumIndex) => {
                const groupsAtPosition = config.valueEnumGroups.filter((group) => group.position === enumIndex);
                const isUngrouped = !groupedValueEnumIds.has(definition.id);
                return [
                  ...(groupsAtPosition.length > 0 ? [renderLibraryInsertActions('enum', enumIndex, `before-enum-groups-${definition.id}`, undefined, true)] : []),
                  ...groupsAtPosition.map(renderValueEnumGroup),
                  ...(isUngrouped ? [
                    ...(groupsAtPosition.length > 0 ? [renderLibraryInsertActions('enum', enumIndex, `after-enum-groups-${definition.id}`, undefined, false)] : [renderLibraryInsertActions('enum', enumIndex, `insert-enum-${definition.id}`)]),
                    renderValueEnumItem(definition, enumIndex)
                  ] : [])
                ];
              })}
              {config.valueEnumGroups.some((group) => group.position === config.valueEnums.length) ? renderLibraryInsertActions('enum', config.valueEnums.length, 'before-final-enum-groups', undefined, true) : null}
              {config.valueEnumGroups.filter((group) => group.position === config.valueEnums.length).map(renderValueEnumGroup)}
              {config.valueEnums.length > 0 || config.valueEnumGroups.length > 0
                ? renderLibraryInsertActions('enum', config.valueEnums.length, 'after-final-enum-groups', undefined, false)
                : null}
              <div className="library-final-actions">
                <button className="secondary-action tiny" type="button" onClick={() => addValueEnum()}><Plus size={11} /> Add domain</button>
                <button className="secondary-action tiny" type="button" onClick={() => addLibraryGroup('enum', config.valueEnums.length)}><Plus size={11} /> Add group</button>
              </div>
            </section> : null}
            {activeLibrarySection === 'tables' ? <div className="source-table-library">
            {config.dataSources.length === 0 ? <span className="empty-option">No source tables defined.</span> : null}
            {config.dataSources.map((source, sourceIndex) => {
              const expanded = expandedSourceIds.includes(source.id);
              const sourceRelations = config.tableRelations.filter((relation) => relation.sourceDataSourceId === source.id || relation.targetDataSourceId === source.id);
              const primaryKeyField = source.fields.find((field) => field.id === source.primaryKeyFieldId);
              const sourceRelationEditorOpen = relationEditor?.sourceDataSourceId === source.id;
              const draftRelationSourceId = relationEditor?.direction === 'many' ? relationEditor.targetDataSourceId : relationEditor?.sourceDataSourceId;
              const draftRelationTargetId = relationEditor?.direction === 'many' ? relationEditor.sourceDataSourceId : relationEditor?.targetDataSourceId;
              const relationDraftIsDuplicate = sourceRelationEditorOpen && relationEditor ? config.tableRelations.some((relation) => relation.cardinality === relationEditor.cardinality && (
                relationEditor.cardinality !== 'oneToMany'
                  ? (relation.sourceDataSourceId === draftRelationSourceId && relation.targetDataSourceId === draftRelationTargetId) ||
                    (relation.sourceDataSourceId === draftRelationTargetId && relation.targetDataSourceId === draftRelationSourceId)
                  : relation.sourceDataSourceId === draftRelationSourceId && relation.targetDataSourceId === draftRelationTargetId
              )) : false;
              const groupedFieldIds = new Set(source.fieldGroups.flatMap((group) => group.fieldIds));
              const fieldGroupPositions = new Set(source.fieldGroups.map((group) => group.position));
              const followsFieldGroup = (fieldIndex: number) => {
                for (let position = fieldIndex - 1; position >= 0; position -= 1) {
                  const precedingField = source.fields[position];
                  if (!precedingField) continue;
                  if (!groupedFieldIds.has(precedingField.id)) return false;
                  if (fieldGroupPositions.has(position)) return true;
                }
                return false;
              };
              const renderInsertControls = (
                position: number,
                groupId?: string,
                key = `insert-field-${position}`,
                isFieldGroupBoundary = false,
                shiftGroupsAtPosition = false
              ) => (
                <div
                  className={`field-insert-actions ${isFieldGroupBoundary ? 'is-field-group-boundary' : ''} ${fieldInsertDragOver?.sourceIndex === sourceIndex && fieldInsertDragOver.targetKey === key ? 'is-drag-over' : ''}`}
                  key={key}
                  onDragOver={(event) => {
                    if (fieldDrag?.sourceIndex !== sourceIndex) return;
                    event.preventDefault();
                    event.stopPropagation();
                    event.dataTransfer.dropEffect = 'move';
                    setFieldDragOver(null);
                    setFieldGroupDragOver(null);
                    setFieldInsertDragOver({ sourceIndex, targetKey: key });
                  }}
                  onDrop={(event) => {
                    if (fieldDrag?.sourceIndex !== sourceIndex) return;
                    event.preventDefault();
                    event.stopPropagation();
                    moveField(sourceIndex, position, 'before', groupId, shiftGroupsAtPosition);
                    setFieldDrag(null);
                    setFieldDragOver(null);
                    setFieldInsertDragOver(null);
                    setFieldGroupDragOver(null);
                  }}
                >
                  <button className="list-insert-divider field-insert-divider" type="button" onClick={() => addField(sourceIndex, position, groupId, shiftGroupsAtPosition)}><Plus size={11} aria-hidden="true" />Add field here</button>
                  <button className="list-insert-divider field-group-insert-divider" type="button" onClick={() => addFieldGroup(sourceIndex, position)}><Plus size={11} aria-hidden="true" />Add field group</button>
                </div>
              );
              const renderFieldRow = (field: DataSourceField, fieldIndex: number, groupId?: string) => {
                const isPrimaryKey = source.primaryKeyFieldId === field.id;
                const primaryKeyRelations = isPrimaryKey ? sourceRelations : [];
                const editorOpen = relationEditor?.sourceDataSourceId === source.id && relationEditor.anchor === 'primaryKey' && isPrimaryKey;
                const relationIsDuplicate = relationDraftIsDuplicate;
                return (
                <div
                  className={`data-source-field-row ${field.dataType === 'collection' ? 'is-collection' : ''} ${field.generatedRelationId ? 'is-relation-field' : ''} ${fieldDragOver?.sourceIndex === sourceIndex && fieldDragOver.fieldIndex === fieldIndex ? `is-drag-over-${fieldDragOver.position}` : ''} ${focusedEditRequest?.kind === 'dataField' && focusedEditRequest.fieldId === field.id ? 'is-library-edit-target' : ''}`}
                  data-library-target={`field:${field.id}`}
                  key={field.id}
                  onDragOver={(event) => {
                    if (fieldDrag?.sourceIndex !== sourceIndex) return;
                    event.preventDefault();
                    event.stopPropagation();
                    const rect = event.currentTarget.getBoundingClientRect();
                    setFieldInsertDragOver(null);
                    setFieldDragOver({ sourceIndex, fieldIndex, position: event.clientY < rect.top + rect.height / 2 ? 'before' : 'after' });
                    setFieldGroupDragOver({ sourceIndex, groupId });
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    moveField(sourceIndex, fieldIndex, fieldDragOver?.position ?? 'before', groupId);
                    setFieldDrag(null);
                    setFieldDragOver(null);
                    setFieldInsertDragOver(null);
                    setFieldGroupDragOver(null);
                  }}
                >
                  {field.generatedRelationId ? <span className="data-source-field-drag relation-field-marker" title="Generated by a table relation"><GitFork size={12} aria-hidden="true" /></span> : <button
                    className="mini-icon-button drag-handle data-source-field-drag"
                    type="button"
                    draggable
                    aria-label={`Drag ${field.name} to reorder or move into a dimensioned set`}
                    title="Drag to reorder or move into a dimensioned set"
                    onDragStart={(event) => {
                      setFieldDrag({ sourceIndex, fieldIndex });
                      setFieldInsertDragOver(null);
                      event.dataTransfer.effectAllowed = 'move';
                      event.dataTransfer.setData('text/plain', field.id);
                    }}
                    onDragEnd={() => {
                      setFieldDrag(null);
                      setFieldDragOver(null);
                      setFieldInsertDragOver(null);
                      setFieldGroupDragOver(null);
                    }}
                  ><GripVertical size={13} aria-hidden="true" /></button>}
                  <div className="primary-key-cell">
                    <label className="primary-key-check" title={groupId ? 'Dimensioned fields cannot be primary keys' : field.generatedRelationId ? 'Relationship fields cannot be primary keys' : isPrimaryKey && primaryKeyRelations.length ? 'Choose another primary key or remove this key’s relations first' : 'Use this field as the table primary key'}>
                      <input type="checkbox" checked={isPrimaryKey} disabled={Boolean(groupId || field.generatedRelationId || (isPrimaryKey && primaryKeyRelations.length))} aria-label={`${field.name || 'Field'} is primary key`} onChange={() => setPrimaryKey(sourceIndex, fieldIndex)} />
                      <KeyRound size={11} aria-hidden="true" />
                    </label>
                    {isPrimaryKey ? <button
                      className={`primary-key-relation-button ${primaryKeyRelations.length ? 'has-relations' : ''}`}
                      type="button"
                      disabled={config.dataSources.length < 2}
                      title={config.dataSources.length < 2 ? 'Add another table before creating a relation' : 'Add or manage table relations'}
                      aria-label={`Manage relations for ${field.name || 'primary key'}`}
                      onClick={() => setRelationEditor((current) => current?.sourceDataSourceId === source.id ? null : {
                        sourceDataSourceId: source.id,
                        targetDataSourceId: config.dataSources.find((entry) => entry.id !== source.id)?.id ?? '',
                        cardinality: 'oneToMany',
                        direction: 'one',
                        anchor: 'primaryKey'
                      })}
                    ><Link2 size={12} aria-hidden="true" />{primaryKeyRelations.length ? <span>{primaryKeyRelations.length}</span> : <Plus size={9} aria-hidden="true" />}</button> : null}
                    {editorOpen && relationEditor ? <div className="field-relation-popover">
                      <div className="field-relation-popover-heading"><span><Link2 size={13} aria-hidden="true" /><strong>Relate {field.name || 'primary key'}</strong></span><button className="mini-icon-button" type="button" title="Close" onClick={() => setRelationEditor(null)}><X size={12} /></button></div>
                      {primaryKeyRelations.length ? <div className="field-relation-existing">
                        {primaryKeyRelations.map((relation) => {
                          const otherId = relation.sourceDataSourceId === source.id ? relation.targetDataSourceId : relation.sourceDataSourceId;
                          const other = config.dataSources.find((entry) => entry.id === otherId);
                          const direction = relation.cardinality === 'oneToOne' ? '1:1' : relation.cardinality === 'manyToMany' ? 'N:N' : relation.sourceDataSourceId === source.id ? '1:N' : 'N:1';
                          return <div key={relation.id}><span><b>{direction}</b>{other?.name ?? 'Missing table'}</span><button className="mini-icon-button danger" type="button" title="Delete relation" onClick={() => deleteTableRelation(relation.id)}><Trash2 size={11} /></button></div>;
                        })}
                      </div> : null}
                      <label className="field"><span>Related table</span><select value={relationEditor.targetDataSourceId} onChange={(event) => setRelationEditor((current) => current ? { ...current, targetDataSourceId: event.target.value } : current)}>
                        {config.dataSources.filter((entry) => entry.id !== source.id).map((entry) => <option value={entry.id} key={entry.id}>{entry.name || 'Untitled table'}</option>)}
                      </select></label>
                      <div className="field-relation-cardinality has-four" aria-label="Relationship cardinality and direction">
                        <button className={relationEditor.cardinality === 'oneToOne' ? 'is-active' : ''} type="button" onClick={() => setRelationEditor((current) => current ? { ...current, cardinality: 'oneToOne', direction: 'one' } : current)}><b>1:1</b><span>One to one</span></button>
                        <button className={relationEditor.cardinality === 'oneToMany' && relationEditor.direction === 'one' ? 'is-active' : ''} type="button" onClick={() => setRelationEditor((current) => current ? { ...current, cardinality: 'oneToMany', direction: 'one' } : current)}><b>1:N</b><span>This table is one</span></button>
                        <button className={relationEditor.cardinality === 'oneToMany' && relationEditor.direction === 'many' ? 'is-active' : ''} type="button" onClick={() => setRelationEditor((current) => current ? { ...current, cardinality: 'oneToMany', direction: 'many' } : current)}><b>N:1</b><span>This table is many</span></button>
                        <button className={relationEditor.cardinality === 'manyToMany' ? 'is-active' : ''} type="button" onClick={() => setRelationEditor((current) => current ? { ...current, cardinality: 'manyToMany', direction: 'one' } : current)}><b>N:N</b><span>Many to many</span></button>
                      </div>
                      <small className="field-relation-note">Missing primary keys are filled from an existing ID field or a generated table ID. N:N adds a linked collection of the other table's IDs to both tables.</small>
                      <button className="primary-action tiny" type="button" disabled={!relationEditor.targetDataSourceId || relationIsDuplicate} onClick={addTableRelation}>{relationIsDuplicate ? 'Relation already exists' : 'Add relationship'}</button>
                    </div> : null}
                  </div>
                  <input disabled={field.dataType === 'enum' && Boolean(field.enumId)} value={field.name} aria-label="Field name" onChange={(event) => updateField(sourceIndex, fieldIndex, { name: event.target.value })} />
                  <select className="data-source-field-type" value={field.dataType} disabled={Boolean(field.generatedRelationId || source.primaryKeyFieldId === field.id)} aria-label="Field data type" onChange={(event) => updateField(sourceIndex, fieldIndex, { dataType: event.target.value as DataSourceFieldType })}>
                    {dataSourceFieldTypes.map((type) => <option value={type} key={type}>{dataSourceFieldTypeLabels[type]}</option>)}
                  </select>
                  {field.dataType === 'collection' ? <select
                    className="data-source-collection-item-type"
                    value={field.collectionItemType ?? 'number'}
                    disabled={Boolean(field.generatedRelationId)}
                    aria-label="Collection item data type"
                    title={field.generatedRelationId ? 'Relationship collections always contain IDs' : 'Type of each item in this collection'}
                    onChange={(event) => updateField(sourceIndex, fieldIndex, { collectionItemType: event.target.value as DataSourceCollectionItemType })}
                  >
                    {dataSourceCollectionItemTypes.map((type) => <option value={type} key={type}>{dataSourceCollectionItemTypeLabels[type]}</option>)}
                  </select> : null}
                  <input className={`data-source-field-meaning ${field.dataType === 'collection' ? '' : 'is-wide'}`} value={field.meaning} aria-label="Field meaning" placeholder="What the field represents" onChange={(event) => updateField(sourceIndex, fieldIndex, { meaning: event.target.value })} />
                  {field.dataType === 'number' || (field.dataType === 'collection' && field.collectionItemType === 'number')
                    ? <input value={field.valueUnit} aria-label="Field value unit" placeholder="mph, vehicles, %..." onChange={(event) => updateField(sourceIndex, fieldIndex, { valueUnit: event.target.value })} />
                    : <span className="data-source-field-unit-na" title="Units apply only to number values">—</span>}
                  <div className="data-source-field-actions">
                    {field.generatedRelationId ? <><span className="relation-field-badge">Linked</span><button className="mini-icon-button danger" type="button" title="Delete both linked fields and their relation" onClick={() => deleteField(sourceIndex, fieldIndex)}><Trash2 size={12} /></button></> : <><button
                      className="mini-icon-button"
                      type="button"
                      title="Copy field"
                      aria-label={`Copy ${field.name || 'field'}`}
                      onClick={() => copyField(sourceIndex, fieldIndex)}
                    ><Copy size={12} /></button>
                    <button
                      className="mini-icon-button danger"
                      type="button"
                      disabled={isPrimaryKey && primaryKeyRelations.length > 0}
                      title={isPrimaryKey && primaryKeyRelations.length ? 'Delete this key’s relations before deleting its primary key' : 'Delete field'}
                      onClick={() => deleteField(sourceIndex, fieldIndex)}
                    ><Trash2 size={12} /></button>
                    </>}
                  </div>
                  {field.dataType === 'enum' || (field.dataType === 'collection' && field.collectionItemType === 'enum') ? <div className="data-source-field-enum-options">
                    {renderLookupEnumOptions(
                      field.options,
                      field.dataType === 'collection' ? `${field.name || `Field ${fieldIndex + 1}`} items` : field.name || `Field ${fieldIndex + 1}`,
                      (options) => updateField(sourceIndex, fieldIndex, { options }),
                      field.enumId,
                      (enumId) => {
                        const definition = config.valueEnums.find((entry) => entry.id === enumId);
                        updateField(sourceIndex, fieldIndex, {
                          enumId,
                          ...(definition ? {
                            ...(field.dataType === 'enum' ? { name: definition.name } : {}),
                            options: [...definition.options]
                          } : {})
                        });
                      }
                    )}
                  </div> : null}
                </div>
                );
              };
              const renderFieldGroup = (group: DataSourceFieldGroup) => {
                const groupFields = source.fields
                  .map((field, fieldIndex) => ({ field, fieldIndex }))
                  .filter(({ field }) => group.fieldIds.includes(field.id));
                return (
                  <details
                    className={`data-source-field-group ${fieldGroupDragOver?.sourceIndex === sourceIndex && fieldGroupDragOver.groupId === group.id ? 'is-drag-over' : ''}`}
                    key={group.id}
                    open={!collapsedFieldGroupIds.includes(group.id)}
                    onDragOver={(event) => {
                      if (fieldDrag?.sourceIndex !== sourceIndex) return;
                      event.preventDefault();
                      event.stopPropagation();
                      setFieldInsertDragOver(null);
                      setFieldGroupDragOver({ sourceIndex, groupId: group.id });
                      setCollapsedFieldGroupIds((current) => current.filter((id) => id !== group.id));
                    }}
                    onDrop={(event) => {
                      if (fieldDrag?.sourceIndex !== sourceIndex) return;
                      event.preventDefault();
                      event.stopPropagation();
                      const draggedField = source.fields[fieldDrag.fieldIndex];
                      if (draggedField) assignFieldToGroup(sourceIndex, draggedField.id, group.id);
                      setFieldDrag(null);
                      setFieldDragOver(null);
                      setFieldInsertDragOver(null);
                      setFieldGroupDragOver(null);
                    }}
                    onToggle={(event) => {
                      const groupIsOpen = event.currentTarget.open;
                      setCollapsedFieldGroupIds((current) => groupIsOpen
                        ? current.filter((id) => id !== group.id)
                        : [...new Set([...current, group.id])]);
                    }}
                  >
                    <summary>
                      <span>Dimensioned fields</span>
                      <small>{group.fieldIds.length} {group.fieldIds.length === 1 ? 'field' : 'fields'}{group.dimensions.length ? ` by ${group.dimensions.map((dimension) => `${dimension.name || 'Untitled dimension'}: ${dimension.options.length ? dimension.options.join(', ') : 'no options'}`).join(' · ')}` : ' · add dimensions'}</small>
                      <ChevronDown size={12} aria-hidden="true" />
                    </summary>
                    <div className="data-source-field-group-body">
                      <div className="data-source-dimension-dropzone">
                        {groupFields.length === 0 ? <span><GripVertical size={12} aria-hidden="true" /> Drag fields here</span> : null}
                        {groupFields.flatMap(({ field, fieldIndex }) => [
                          renderInsertControls(fieldIndex, group.id, `group-${group.id}-insert-${field.id}`),
                          renderFieldRow(field, fieldIndex, group.id)
                        ])}
                        <div className="field-final-actions">
                          <button className="secondary-action tiny data-source-add-field" type="button" onClick={() => addField(sourceIndex, source.fields.length, group.id)}><Plus size={12} /> Add field</button>
                          <button className="secondary-action tiny" type="button" onClick={() => addFieldGroup(sourceIndex, group.position)}><Plus size={12} /> Add field group</button>
                        </div>
                      </div>
                      <div className="data-source-field-group-settings">
                        <div className="field-group-dimension-list">
                          {group.dimensions.map((dimension) => (
                            <div className={`field-group-dimension-row ${dimension.enumId ? 'is-global' : 'is-custom'}`} key={dimension.id}>
                              <label className="data-source-field-group-control">
                                <small>By:</small>
                                <input
                                  value={dimension.name}
                                  aria-label="Dimension name"
                                  placeholder="Mode"
                                  readOnly={Boolean(dimension.enumId)}
                                  title={dimension.enumId ? 'Managed in Domains' : undefined}
                                  onChange={(event) => updateFieldGroupDimension(sourceIndex, group.id, dimension.id, { name: event.target.value })}
                                />
                              </label>
                              <div className="data-source-field-group-control">
                                <small>Options:</small>
                                <div className="field-group-dimension-options">
                                  {dimension.enumId && dimension.options.length === 0 ? <span className="empty-option">No options defined</span> : <EnumOptionEditor
                                    options={dimension.options}
                                    label={`${dimension.name || 'dimension'} dimension`}
                                    disabled={Boolean(dimension.enumId)}
                                    onChange={(options) => updateFieldGroupDimension(sourceIndex, group.id, dimension.id, { options })}
                                  />}
                                </div>
                              </div>
                              {dimension.enumId
                                ? <ViewDomainButton domainId={dimension.enumId} domainName={dimension.name} onView={(domainId) => onEditLibrarySource({ kind: 'domain', domainId })} />
                                : <span className="field-group-dimension-action-spacer" aria-hidden="true" />}
                              <button className="mini-icon-button danger" type="button" title="Delete dimension" aria-label={`Delete ${dimension.name || 'dimension'}`} onClick={() => removeFieldGroupDimension(sourceIndex, group.id, dimension.id)}><Trash2 size={12} /></button>
                            </div>
                          ))}
                          <div className="dimension-add-actions">
                            <button className="secondary-action tiny" type="button" onClick={() => { setFieldGroupDomainPickerId(undefined); addFieldGroupDimension(sourceIndex, group.id); }}><Plus size={11} /> Add custom dimension</button>
                            <div className="global-domain-add-control">
                              <button className="secondary-action tiny" type="button" disabled={config.valueEnums.length === 0} aria-expanded={fieldGroupDomainPickerId === group.id} onClick={() => setFieldGroupDomainPickerId((current) => current === group.id ? undefined : group.id)}><Plus size={11} /> Add global domain</button>
                              {fieldGroupDomainPickerId === group.id ? <div className="global-domain-picker" role="menu">
                                <GroupedDomainPickerOptions
                                  definitions={config.valueEnums.filter((definition) => !group.dimensions.some((entry) => entry.enumId === definition.id))}
                                  groups={config.valueEnumGroups}
                                  onSelect={(domainId) => addFieldGroupEnumDimension(sourceIndex, group.id, domainId)}
                                />
                                {config.valueEnums.every((definition) => group.dimensions.some((entry) => entry.enumId === definition.id)) ? <span className="empty-option">All global domains are already used.</span> : null}
                              </div> : null}
                            </div>
                            <button className="secondary-action tiny dimensioned-field-set-delete" type="button" title="Delete dimensioned field set" onClick={() => deleteFieldGroup(sourceIndex, group.id)}><Trash2 size={11} /> Delete field set</button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </details>
                );
              };
              return [
                <button className="list-insert-divider" type="button" key={`insert-source-${source.id}`} onClick={() => addDataSource(sourceIndex)}><Plus size={11} aria-hidden="true" />Add source here</button>,
                <section
                  className={`data-source-card ${expanded ? 'is-expanded' : ''} ${sourceDragOver?.sourceIndex === sourceIndex ? `is-drag-over-${sourceDragOver.position}` : ''}`}
                  key={source.id}
                  onDragOver={(event) => {
                    if (sourceDragIndex === null) return;
                    event.preventDefault();
                    const rect = event.currentTarget.getBoundingClientRect();
                    setSourceDragOver({ sourceIndex, position: event.clientY < rect.top + rect.height / 2 ? 'before' : 'after' });
                  }}
                  onDrop={(event) => {
                    if (sourceDragIndex === null) return;
                    event.preventDefault();
                    const rect = event.currentTarget.getBoundingClientRect();
                    moveDataSource(sourceIndex, event.clientY < rect.top + rect.height / 2 ? 'before' : 'after');
                    setSourceDragIndex(null);
                    setSourceDragOver(null);
                  }}
                >
                  <div className="data-source-expander-heading">
                    <button
                      className="data-source-expander-toggle"
                      type="button"
                      aria-expanded={expanded}
                      aria-controls={`data-source-body-${source.id}`}
                      onClick={() => toggleDataSource(source.id)}
                    >
                      <ChevronDown className={`data-source-chevron ${expanded ? 'is-expanded' : ''}`} size={15} aria-hidden="true" />
                      <Table2 size={15} aria-hidden="true" />
                      <span className="data-source-expander-summary">
                        <strong>{source.name.trim() || 'Untitled data source'}</strong>
                        <span className="data-source-header-details">
                          <small>{source.spatialUnit.trim() || 'No spatial unit'} · {source.fields.length} {source.fields.length === 1 ? 'field' : 'fields'}</small>
                          {primaryKeyField ? <span className="data-source-primary-key-summary" title={`Primary key: ${primaryKeyField.name || 'Unnamed field'}`}><KeyRound size={9} aria-hidden="true" /><b>PK</b><span>{primaryKeyField.name || 'Unnamed field'}</span></span> : null}
                          {sourceRelations.length ? <span className="data-source-relation-summary">
                            {sourceRelations.map((relation) => {
                              const isSource = relation.sourceDataSourceId === source.id;
                              const otherId = isSource ? relation.targetDataSourceId : relation.sourceDataSourceId;
                              const other = config.dataSources.find((entry) => entry.id === otherId);
                              const cardinality = relation.cardinality === 'oneToOne' ? '1:1' : relation.cardinality === 'manyToMany' ? 'N:N' : isSource ? '1:N' : 'N:1';
                              const otherName = other?.name ?? 'Missing table';
                              return <span key={relation.id} title={`${cardinality} relationship with ${otherName}`}><Link2 size={9} aria-hidden="true" /><b>{cardinality}</b><span>{otherName}</span></span>;
                            })}
                          </span> : null}
                        </span>
                      </span>
                    </button>
                    <div className="data-source-expander-actions">
                      <button
                        className="mini-icon-button drag-handle data-source-drag"
                        type="button"
                        draggable
                        title="Drag to reorder tables"
                        aria-label={`Drag ${source.name || 'table'} to reorder tables`}
                        onDragStart={(event) => {
                          setSourceDragIndex(sourceIndex);
                          event.dataTransfer.effectAllowed = 'move';
                          event.dataTransfer.setData('text/plain', source.id);
                        }}
                        onDragEnd={() => {
                          setSourceDragIndex(null);
                          setSourceDragOver(null);
                        }}
                      ><GripVertical size={13} aria-hidden="true" /></button>
                      <button className="mini-icon-button" type="button" title="Copy data source" aria-label={`Copy ${source.name || 'data source'}`} onClick={() => duplicateDataSource(sourceIndex)}><Copy size={12} /></button>
                      <button className="mini-icon-button danger" type="button" title="Delete data source" aria-label={`Delete ${source.name || 'data source'}`} onClick={() => deleteDataSource(sourceIndex)}><Trash2 size={13} /></button>
                    </div>
                  </div>
                  {expanded ? (
                    <div className="data-source-expander-body" id={`data-source-body-${source.id}`}>
                      <div className="data-source-main-fields">
                        <label className="field"><span>Name</span><input value={source.name} onChange={(event) => updateDataSource(sourceIndex, { name: event.target.value })} /></label>
                        <label className="field"><span>Spatial unit</span><select value={source.spatialUnit} onChange={(event) => updateDataSource(sourceIndex, { spatialUnit: event.target.value as DataSource['spatialUnit'] })}>
                          <option value="">None</option>
                          {spatialUnitOptions.map((unit) => <option value={unit} key={unit}>{unit}</option>)}
                        </select></label>
                      </div>
                      <div
                        className={`data-source-ungrouped-fields ${fieldGroupDragOver?.sourceIndex === sourceIndex && fieldGroupDragOver.groupId === undefined ? 'is-drag-over' : ''}`}
                        onDragOver={(event) => {
                          if (fieldDrag?.sourceIndex !== sourceIndex) return;
                          event.preventDefault();
                          setFieldInsertDragOver(null);
                          setFieldGroupDragOver({ sourceIndex });
                        }}
                        onDrop={(event) => {
                          if (fieldDrag?.sourceIndex !== sourceIndex) return;
                          event.preventDefault();
                          const draggedField = source.fields[fieldDrag.fieldIndex];
                          if (draggedField) assignFieldToGroup(sourceIndex, draggedField.id);
                          setFieldDrag(null);
                          setFieldDragOver(null);
                          setFieldInsertDragOver(null);
                          setFieldGroupDragOver(null);
                        }}
                      >
                        <div className="data-source-field-heading"><span /><span>PK</span><span>Fields without dimensions</span><span>Type</span><span className="data-source-field-meaning-heading">Meaning</span><span>Unit</span><span>Actions</span></div>
                        {source.fields.length === 0 ? <span className="empty-option">No fields in this data source.</span> : null}
                        {source.fields.length > 0 && groupedFieldIds.size === source.fields.length ? <span className="data-source-ungroup-drop-hint">Drag a field here to remove it from a dimensioned set.</span> : null}
                        {source.fields.flatMap((field, fieldIndex) => {
                          const groupsAtPosition = source.fieldGroups.filter((group) => group.position === fieldIndex);
                          const isUngrouped = !groupedFieldIds.has(field.id);
                          const followsDimensionedGroup = isUngrouped && groupsAtPosition.length === 0 && followsFieldGroup(fieldIndex);
                          return [
                            ...((isUngrouped || groupsAtPosition.length > 0)
                              ? [renderInsertControls(
                                  fieldIndex,
                                  undefined,
                                  `top-insert-${field.id}`,
                                  groupsAtPosition.length > 0 || followsDimensionedGroup,
                                  groupsAtPosition.length > 0
                                )]
                              : []),
                            ...groupsAtPosition.map(renderFieldGroup),
                            ...(isUngrouped && groupsAtPosition.length > 0
                              ? [renderInsertControls(fieldIndex, undefined, `after-groups-insert-${field.id}`, true)]
                              : []),
                            ...(isUngrouped ? [renderFieldRow(field, fieldIndex)] : [])
                          ];
                        })}
                        {source.fieldGroups.some((group) => group.position === source.fields.length)
                          ? renderInsertControls(source.fields.length, undefined, `top-insert-final-groups-${source.id}`, true, true)
                          : null}
                        {source.fieldGroups.filter((group) => group.position === source.fields.length).map(renderFieldGroup)}
                        <div className="field-final-actions">
                          <button className="secondary-action tiny data-source-add-field" type="button" onClick={() => addField(sourceIndex)}><Plus size={12} /> Add field</button>
                          <button className="secondary-action tiny" type="button" onClick={() => addFieldGroup(sourceIndex, source.fields.length)}><Plus size={12} /> Add field group</button>
                          <div className="table-relation-add-control">
                            <button
                              className="secondary-action tiny"
                              type="button"
                              disabled={config.dataSources.length < 2}
                              title={config.dataSources.length < 2 ? 'Add another table before creating a relationship' : 'Add a relationship involving this table'}
                              onClick={() => setRelationEditor((current) => current?.sourceDataSourceId === source.id && current.anchor === 'table' ? null : {
                                sourceDataSourceId: source.id,
                                targetDataSourceId: config.dataSources.find((entry) => entry.id !== source.id)?.id ?? '',
                                cardinality: 'oneToMany',
                                direction: 'one',
                                anchor: 'table'
                              })}
                            ><Link2 size={11} /> Add relationship</button>
                            {sourceRelationEditorOpen && relationEditor?.anchor === 'table' ? <div className="field-relation-popover table-relation-popover">
                              <div className="field-relation-popover-heading"><span><Link2 size={13} aria-hidden="true" /><strong>Relate {source.name || 'this table'}</strong></span><button className="mini-icon-button" type="button" title="Close" onClick={() => setRelationEditor(null)}><X size={12} /></button></div>
                              {sourceRelations.length ? <div className="field-relation-existing">
                                {sourceRelations.map((relation) => {
                                  const otherId = relation.sourceDataSourceId === source.id ? relation.targetDataSourceId : relation.sourceDataSourceId;
                                  const other = config.dataSources.find((entry) => entry.id === otherId);
                                  const direction = relation.cardinality === 'oneToOne' ? '1:1' : relation.cardinality === 'manyToMany' ? 'N:N' : relation.sourceDataSourceId === source.id ? '1:N' : 'N:1';
                                  return <div key={relation.id}><span><b>{direction}</b>{other?.name ?? 'Missing table'}</span><button className="mini-icon-button danger" type="button" title="Delete relation" onClick={() => deleteTableRelation(relation.id)}><Trash2 size={11} /></button></div>;
                                })}
                              </div> : null}
                              <label className="field"><span>Related table</span><select value={relationEditor.targetDataSourceId} onChange={(event) => setRelationEditor((current) => current ? { ...current, targetDataSourceId: event.target.value } : current)}>
                                {config.dataSources.filter((entry) => entry.id !== source.id).map((entry) => <option value={entry.id} key={entry.id}>{entry.name || 'Untitled table'}</option>)}
                              </select></label>
                              <div className="field-relation-cardinality has-four" aria-label="Relationship cardinality and direction">
                                <button className={relationEditor.cardinality === 'oneToOne' ? 'is-active' : ''} type="button" onClick={() => setRelationEditor((current) => current ? { ...current, cardinality: 'oneToOne', direction: 'one' } : current)}><b>1:1</b><span>One to one</span></button>
                                <button className={relationEditor.cardinality === 'oneToMany' && relationEditor.direction === 'one' ? 'is-active' : ''} type="button" onClick={() => setRelationEditor((current) => current ? { ...current, cardinality: 'oneToMany', direction: 'one' } : current)}><b>1:N</b><span>This table is one</span></button>
                                <button className={relationEditor.cardinality === 'oneToMany' && relationEditor.direction === 'many' ? 'is-active' : ''} type="button" onClick={() => setRelationEditor((current) => current ? { ...current, cardinality: 'oneToMany', direction: 'many' } : current)}><b>N:1</b><span>This table is many</span></button>
                                <button className={relationEditor.cardinality === 'manyToMany' ? 'is-active' : ''} type="button" onClick={() => setRelationEditor((current) => current ? { ...current, cardinality: 'manyToMany', direction: 'one' } : current)}><b>N:N</b><span>Many to many</span></button>
                              </div>
                              <small className="field-relation-note">Missing primary keys are filled from an existing ID field or a generated table ID. N:N adds a linked collection of the other table's IDs to both tables.</small>
                              <button className="primary-action tiny" type="button" disabled={!relationEditor.targetDataSourceId || relationDraftIsDuplicate} onClick={addTableRelation}>{relationDraftIsDuplicate ? 'Relation already exists' : 'Add relationship'}</button>
                            </div> : null}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </section>
              ];
            })}
            </div> : null}
          </div>
        </div>,
        document.body
      ) : null}
    </div>
  );
}

function KpiSourceGroupedSummary({
  config,
  kpi,
  onSourceClick,
  highlightedSourceId
}: {
  config: KpiPoolConfig;
  kpi: KpiMetric;
  onSourceClick: (sourceId: string) => void;
  highlightedSourceId?: string;
}) {
  const dataGroups = selectedDataSourceGroups(config, kpi);
  const prerequisiteKpis = kpi.sources.flatMap((source) =>
    source.type === 'kpi' ? [{ source, kpi: config.kpis.find((entry) => entry.id === source.kpiId) }] : []
  );
  const customSources = kpi.sources.filter((source) => source.type === 'custom');
  const lookupSources = kpi.sources.flatMap((source) => source.type === 'lookup'
    ? [{ source, lookup: config.lookups.find((lookup) => lookup.id === source.lookupId) }]
    : []
  );
  const variableSources = kpi.sources.flatMap((source) => source.type === 'variable'
    ? [{ source, variable: config.variables.find((variable) => variable.id === source.variableId) }]
    : []
  );
  const sourceSummaryItemClassName = (sourceId: string) =>
    `source-summary-item${highlightedSourceId === sourceId ? ' is-kpi-source-highlighted' : ''}`;

  return (
    <span className="kpi-source-summary">
      {dataGroups.map(({ dataSource, items }) => (
        <span className="source-summary-group" key={dataSource.id}>
          <span className="source-summary-heading"><Table2 size={12} aria-hidden="true" /><span>{spatiallyScaledTableLabel(dataSource.name, dataSource.spatialUnit)}</span></span>
          <span className="source-summary-items">{items.map(({ source, field }) => {
            const dimensionLabel = fieldGroupDimensionLabel(dataSource.fieldGroups.find((group) => group.fieldIds.includes(field.id)));
            return <span className={sourceSummaryItemClassName(source.id)} data-kpi-source-id={source.id} key={source.id} title={sourceItemTooltip(config, source)} onClick={(event) => { event.stopPropagation(); onSourceClick(source.id); }}>{dimensionedSourceLabel(field.name, dimensionLabel)}</span>;
          })}</span>
        </span>
      ))}
      {prerequisiteKpis.length ? (
        <span className="source-summary-group">
          <span className="source-summary-heading"><Gauge size={12} aria-hidden="true" /><span>Prerequisite KPIs</span></span>
          <span className="source-summary-items">{prerequisiteKpis.map(({ source, kpi: prerequisite }) => {
            const dimensionLabel = prerequisite?.dimensions.map((dimension) => dimension.name.trim()).filter(Boolean).join(', ') ?? '';
            return <span className={sourceSummaryItemClassName(source.id)} data-kpi-source-id={source.id} key={source.id} onClick={(event) => { event.stopPropagation(); onSourceClick(source.id); }}>{dimensionedSourceLabel(prerequisite?.name ?? 'Missing KPI', dimensionLabel)}</span>;
          })}</span>
        </span>
      ) : null}
      {lookupSources.length ? (
        <span className="source-summary-group">
          <span className="source-summary-heading"><BookOpen size={12} aria-hidden="true" /><span>Lookups</span></span>
          <span className="source-summary-items">{lookupSources.map(({ source, lookup }) => <span className={sourceSummaryItemClassName(source.id)} data-kpi-source-id={source.id} key={source.id} title={sourceItemTooltip(config, source)} onClick={(event) => { event.stopPropagation(); onSourceClick(source.id); }}>{lookup?.outputName ?? 'Missing lookup'}</span>)}</span>
        </span>
      ) : null}
      {variableSources.length ? (
        <span className="source-summary-group">
          <span className="source-summary-heading"><VariableIcon size={12} aria-hidden="true" /><span>Variables</span></span>
          <span className="source-summary-items">{variableSources.map(({ source, variable }) => <span className={sourceSummaryItemClassName(source.id)} data-kpi-source-id={source.id} key={source.id} title={sourceItemTooltip(config, source)} onClick={(event) => { event.stopPropagation(); onSourceClick(source.id); }}>{variable?.name ?? 'Missing variable'}</span>)}</span>
        </span>
      ) : null}
      {customSources.length ? (
        <span className="source-summary-group">
          <span className="source-summary-heading"><Pencil size={12} aria-hidden="true" /><span>Custom sources</span></span>
          <span className="source-summary-items">{customSources.map((source) => <span className={sourceSummaryItemClassName(source.id)} data-kpi-source-id={source.id} key={source.id} onClick={(event) => { event.stopPropagation(); onSourceClick(source.id); }}>{source.name}</span>)}</span>
        </span>
      ) : null}
    </span>
  );
}

const isLatexIdentifierCharacter = (value: string | undefined) => Boolean(value && /[\p{L}\p{N}]/u.test(value));

const hasLatexReplacementBoundaries = (expression: string, token: string, index: number) => {
  const previous = index > 0 ? expression[index - 1] : undefined;
  const nextIndex = index + token.length;
  const next = nextIndex < expression.length ? expression[nextIndex] : undefined;
  return !(isLatexIdentifierCharacter(token[0]) && isLatexIdentifierCharacter(previous)) &&
    !(isLatexIdentifierCharacter(token[token.length - 1]) && isLatexIdentifierCharacter(next));
};

const replaceLatexOccurrences = (
  expression: string,
  previousToken: string,
  nextToken: string,
  requiresFollowingParenthesis = false
) => {
  if (!previousToken.trim() || previousToken === nextToken || !expression.includes(previousToken)) return expression;
  let searchIndex = 0;
  let cursor = 0;
  let updated = '';
  while (searchIndex < expression.length) {
    const matchIndex = expression.indexOf(previousToken, searchIndex);
    if (matchIndex < 0) break;
    const hasBoundaries = hasLatexReplacementBoundaries(expression, previousToken, matchIndex);
    const followedByParenthesis = !requiresFollowingParenthesis || /^\s*\(/.test(expression.slice(matchIndex + previousToken.length));
    if (!hasBoundaries || !followedByParenthesis) {
      searchIndex = matchIndex + 1;
      continue;
    }
    updated += expression.slice(cursor, matchIndex);
    updated += nextToken;
    cursor = matchIndex + previousToken.length;
    searchIndex = cursor;
  }
  return cursor ? `${updated}${expression.slice(cursor)}` : expression;
};

type KpiSourceFormulaUpdates = Pick<KpiMetric, 'description' | 'spatialScales'>;

const replaceKpiSourceLatex = (
  kpi: KpiMetric,
  source: KpiSourceItem,
  previousLatex: string,
  nextLatex: string
): KpiSourceFormulaUpdates => {
  const previousLookupParenthesis = source.type === 'lookup' ? previousLatex.indexOf('(') : -1;
  const nextLookupParenthesis = source.type === 'lookup' ? nextLatex.indexOf('(') : -1;
  const previousToken = previousLookupParenthesis > 0
    ? previousLatex.slice(0, previousLookupParenthesis).trimEnd()
    : previousLatex;
  const nextToken = previousLookupParenthesis > 0
    ? (nextLookupParenthesis > 0 ? nextLatex.slice(0, nextLookupParenthesis).trimEnd() : nextLatex.trim())
    : nextLatex;
  const replaceExpression = (expression: string) =>
    replaceLatexOccurrences(expression, previousToken, nextToken, previousLookupParenthesis > 0);
  const description = {
    ...kpi.description,
    formulas: kpi.description.formulas.map((group) => ({
      ...group,
      items: group.items.map((formulaItem) => {
        const leftExpression = replaceExpression(formulaItem.leftExpression);
        const rightExpression = replaceExpression(formulaItem.rightExpression);
        return {
          ...formulaItem,
          leftExpression,
          rightExpression,
          formula: leftExpression ? `${leftExpression} = ${rightExpression}` : rightExpression,
          terms: formulaItem.terms.map((term) => ({ ...term, term: replaceExpression(term.term) }))
        };
      })
    }))
  };
  const spatialScales = Object.fromEntries(spatialScaleKeys.map((scale) => {
    const scaleValue = kpi.spatialScales[scale];
    const rightExpression = replaceExpression(scaleValue.rightExpression);
    return [scale, {
      ...scaleValue,
      leftExpression: '',
      rightExpression,
      formula: rightExpression
    }];
  })) as KpiMetric['spatialScales'];
  return { description, spatialScales };
};

function KpiSourceEditor({
  config,
  kpi,
  onChange,
  onEditLibrarySource,
  transientHighlightedSource,
  compact = false
}: {
  config: KpiPoolConfig;
  kpi: KpiMetric;
  onChange: (sources: KpiSourceItem[], formulaUpdates?: KpiSourceFormulaUpdates) => void;
  onEditLibrarySource: (target: SourceLibraryEditTarget) => void;
  transientHighlightedSource?: FormulaSourceHighlight;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pickerScope, setPickerScope] = useState('');
  const [query, setQuery] = useState('');
  const [customName, setCustomName] = useState('');
  const [customLatex, setCustomLatex] = useState('');
  const [expandedPickerGroupKeys, setExpandedPickerGroupKeys] = useState<string[]>([]);
  const [highlightedSource, setHighlightedSource] = useState<{ sourceId: string; requestId: number }>();
  const controlRef = useCloseOnOutsideClick<HTMLDivElement>(open, () => setOpen(false));
  const highlightSource = (sourceId: string) => {
    setHighlightedSource((current) => ({ sourceId, requestId: (current?.requestId ?? 0) + 1 }));
    setOpen(true);
  };
  useEffect(() => {
    if (!highlightedSource) return undefined;
    const requestId = highlightedSource.requestId;
    const timeout = window.setTimeout(() => {
      setHighlightedSource((current) => current?.requestId === requestId ? undefined : current);
    }, transientSourceHighlightDurationMs);
    return () => window.clearTimeout(timeout);
  }, [highlightedSource?.requestId]);
  useEffect(() => {
    if (!open || !highlightedSource) return undefined;
    const frame = window.requestAnimationFrame(() => {
      const target = [...(controlRef.current?.querySelectorAll<HTMLElement>('[data-kpi-source-id]') ?? [])]
        .find((element) => element.dataset.kpiSourceId === highlightedSource.sourceId);
      target?.scrollIntoView({ block: 'nearest' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [highlightedSource, open]);
  useEffect(() => {
    if (!compact || !transientHighlightedSource) return undefined;
    const frame = window.requestAnimationFrame(() => {
      const scroller = controlRef.current?.querySelector<HTMLElement>(':scope > .cell-enum-trigger');
      const target = [...(scroller?.querySelectorAll<HTMLElement>('[data-kpi-source-id]') ?? [])]
        .find((element) => element.dataset.kpiSourceId === transientHighlightedSource.sourceId);
      if (!scroller || !target) return;

      const scrollerRect = scroller.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const isFullyVisible = targetRect.top >= scrollerRect.top && targetRect.bottom <= scrollerRect.bottom;
      if (isFullyVisible) return;

      scroller.scrollTo({
        top: scroller.scrollTop + targetRect.top + targetRect.height / 2 - scrollerRect.top - scrollerRect.height / 2,
        behavior: 'smooth'
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [compact, transientHighlightedSource?.requestId]);
  const transientHighlightedSourceId = transientHighlightedSource?.sourceId;
  const normalizedQuery = normalize(query);
  const toggleDataField = (dataSourceId: string, fieldId: string) => {
    const sameField = (item: KpiSourceItem) => item.type === 'dataField' && item.dataSourceId === dataSourceId && item.fieldId === fieldId;
    const existing = kpi.sources.find(sameField);
    const dataSource = config.dataSources.find((source) => source.id === dataSourceId);
    const field = dataSource?.fields.find((entry) => entry.id === fieldId);
    const group = dataSource?.fieldGroups.find((entry) => entry.fieldIds.includes(fieldId));
    if (existing) {
      onChange(kpi.sources.filter((item) => item.id !== existing.id));
      return;
    }
    onChange([...kpi.sources, {
          id: createLocalId('kpi-source'),
          type: 'dataField',
          dataSourceId,
          fieldId,
          latex: sourceFieldDefaultLatex(field ?? { name: '', dataType: 'text' }, dataSource?.spatialUnit ?? '', group?.dimensions)
        }]);
  };
  const toggleKpi = (kpiId: string) => {
    const existing = kpi.sources.find((item) => item.type === 'kpi' && item.kpiId === kpiId);
    onChange(existing
      ? kpi.sources.filter((item) => item.id !== existing.id)
      : [...kpi.sources, { id: createLocalId('kpi-source'), type: 'kpi', kpiId, latex: '' }]);
  };
  const toggleLookup = (lookupId: string) => {
    const existing = kpi.sources.find((item) => item.type === 'lookup' && item.lookupId === lookupId);
    const lookup = config.lookups.find((entry) => entry.id === lookupId);
    if (!lookup) return;
    onChange(existing
      ? kpi.sources.filter((item) => item.id !== existing.id)
      : [...kpi.sources, { id: createLocalId('kpi-source'), type: 'lookup', lookupId, latex: lookupDefaultLatex(lookup) }]);
  };
  const toggleVariable = (variableId: string) => {
    const existing = kpi.sources.find((item) => item.type === 'variable' && item.variableId === variableId);
    const variable = config.variables.find((entry) => entry.id === variableId);
    if (!variable) return;
    onChange(existing
      ? kpi.sources.filter((item) => item.id !== existing.id)
      : [...kpi.sources, { id: createLocalId('kpi-source'), type: 'variable', variableId, latex: variableDefaultLatex(variable) }]);
  };
  const updateItem = (id: string, partial: Partial<KpiSourceItem>) => {
    const currentItem = kpi.sources.find((item) => item.id === id);
    const sources = kpi.sources.map((item) => item.id === id ? { ...item, ...partial } as KpiSourceItem : item);
    if (currentItem && partial.latex !== undefined && partial.latex !== currentItem.latex) {
      onChange(sources, replaceKpiSourceLatex(kpi, currentItem, currentItem.latex, partial.latex));
      return;
    }
    onChange(sources);
  };
  const selectedDataSource = pickerScope.startsWith('data:')
    ? config.dataSources.find((source) => source.id === pickerScope.slice(5))
    : undefined;
  const visibleFields = selectedDataSource?.fields.filter((field) =>
    !normalizedQuery || normalize(`${field.name} ${field.dataType} ${field.meaning} ${field.valueUnit} ${field.options.join(' ')}`).includes(normalizedQuery)
  ) ?? [];
  const visibleKpis = config.kpis.filter((entry) =>
    entry.id !== kpi.id && (!normalizedQuery || normalize(`${entry.name} ${entry.description.overview}`).includes(normalizedQuery))
  );
  const lookupMatchesQuery = (lookup: LookupDefinition) =>
    !normalizedQuery || normalize(`${lookup.outputName} ${lookup.outputExplanation} ${lookup.outputValueType} ${lookup.outputOptions.join(' ')} ${lookup.text} ${lookup.inputs.map((input) => `${input.representation} ${input.explanation} ${input.valueType} ${input.options.join(' ')}`).join(' ')}`).includes(normalizedQuery);
  const variableMatchesQuery = (variable: VariableDefinition) =>
    !normalizedQuery || normalize(`${variable.name} ${variable.explanation} ${variable.unit}`).includes(normalizedQuery);
  const visibleLookups = config.lookups.filter(lookupMatchesQuery);
  const visibleVariables = config.variables.filter(variableMatchesQuery);
  const visibleLookupIds = new Set(visibleLookups.map((lookup) => lookup.id));
  const visibleVariableIds = new Set(visibleVariables.map((variable) => variable.id));
  const groupedPickerLookupIds = new Set(config.lookupGroups.flatMap((group) => group.itemIds));
  const groupedPickerVariableIds = new Set(config.variableGroups.flatMap((group) => group.itemIds));
  const hasVisibleLookupChoices = config.lookups.some((lookup) => {
    const group = config.lookupGroups.find((entry) => entry.itemIds.includes(lookup.id));
    return lookupMatchesQuery(lookup) || Boolean(normalizedQuery && group && normalize(group.name).includes(normalizedQuery));
  });
  const hasVisibleVariableChoices = config.variables.some((variable) => {
    const group = config.variableGroups.find((entry) => entry.itemIds.includes(variable.id));
    return variableMatchesQuery(variable) || Boolean(normalizedQuery && group && normalize(group.name).includes(normalizedQuery));
  });
  const addCustomSource = () => {
    if (!customName.trim()) return;
    onChange([...kpi.sources, { id: createLocalId('kpi-source'), type: 'custom', name: customName.trim(), latex: customLatex }]);
    setCustomName('');
    setCustomLatex('');
  };
  const selectedDataGroups = selectedDataSourceGroups(config, kpi);
  const selectedKpiSources = kpi.sources.filter((source) => source.type === 'kpi');
  const selectedLookupSources = kpi.sources.filter((source) => source.type === 'lookup');
  const selectedVariableSources = kpi.sources.filter((source) => source.type === 'variable');
  const selectedCustomSources = kpi.sources.filter((source) => source.type === 'custom');
  const editSelectedSource = (item: KpiSourceItem, button: HTMLButtonElement) => {
    if (item.type === 'dataField') {
      setOpen(false);
      onEditLibrarySource({ kind: 'dataField', dataSourceId: item.dataSourceId, fieldId: item.fieldId });
      return;
    }
    if (item.type === 'lookup') {
      setOpen(false);
      onEditLibrarySource({ kind: 'lookup', lookupId: item.lookupId });
      return;
    }
    if (item.type === 'variable') {
      setOpen(false);
      onEditLibrarySource({ kind: 'variable', variableId: item.variableId });
      return;
    }
    if (item.type === 'kpi') {
      setPickerScope('kpis');
      setQuery(config.kpis.find((entry) => entry.id === item.kpiId)?.name ?? '');
      return;
    }
    button.closest('.selected-source-row')?.querySelector<HTMLInputElement>('input')?.focus();
  };
  const renderSelectedSourceRow = (item: KpiSourceItem, label: string) => {
    const isCollection = item.type === 'dataField' && config.dataSources
      .find((source) => source.id === item.dataSourceId)?.fields
      .find((field) => field.id === item.fieldId)?.dataType === 'collection';
    return (
    <div
      className={`selected-source-row ${item.type === 'custom' ? 'is-custom' : ''} ${isCollection ? 'is-collection' : ''} ${item.type === 'lookup' ? 'is-lookup' : ''} ${highlightedSource?.sourceId === item.id || transientHighlightedSourceId === item.id ? 'is-kpi-source-highlighted' : ''}`}
      data-kpi-source-id={item.id}
      key={item.id}
      onClick={(event) => {
        if ((event.target as HTMLElement).closest('button, input')) return;
        highlightSource(item.id);
      }}
    >
      {item.type === 'custom'
        ? <DebouncedInput value={item.name} aria-label="Custom source name" onValueChange={(name) => updateItem(item.id, { name })} />
        : <span title={sourceItemTooltip(config, item)}>{label}</span>}
      <DebouncedInput className="latex-code-editor" value={item.latex} placeholder="LaTeX symbol" aria-label={`LaTeX for ${sourceItemLabel(config, item)}`} onValueChange={(latex) => updateItem(item.id, { latex })} />
      <span className="source-latex-preview">{item.latex.trim() ? <InlineMath math={item.latex} errorColor="#b42318" /> : '—'}</span>
      <button className="mini-icon-button edit-source-button" type="button" title="View or edit source" aria-label={`View or edit source ${label}`} onClick={(event) => editSelectedSource(item, event.currentTarget)}><Eye size={12} /></button>
      <button className="mini-icon-button danger" type="button" title="Remove source" aria-label={`Remove source ${label}`} onClick={() => onChange(kpi.sources.filter((entry) => entry.id !== item.id))}><Trash2 size={12} /></button>
    </div>
    );
  };
  const togglePickerGroup = (groupKey: string) => {
    setExpandedPickerGroupKeys((current) => current.includes(groupKey)
      ? current.filter((key) => key !== groupKey)
      : [...current, groupKey]);
  };
  const renderLookupChoice = (lookup: LookupDefinition) => (
    <label className="source-choice-row" key={lookup.id}>
      <input type="checkbox" checked={kpi.sources.some((item) => item.type === 'lookup' && item.lookupId === lookup.id)} onChange={() => toggleLookup(lookup.id)} />
      <span><strong>{lookup.outputName}</strong><small>{lookup.outputValueType === 'enum' ? 'Domain output' : 'Number output'}{lookup.outputExplanation ? ` · ${lookup.outputExplanation}` : ''}{lookup.inputs.length ? ` · ${lookup.inputs.length} ${lookup.inputs.length === 1 ? 'input' : 'inputs'}` : ''}</small></span>
    </label>
  );
  const renderVariableChoice = (variable: VariableDefinition) => (
    <label className="source-choice-row" key={variable.id}>
      <input type="checkbox" checked={kpi.sources.some((item) => item.type === 'variable' && item.variableId === variable.id)} onChange={() => toggleVariable(variable.id)} />
      <span><strong>{variable.name}</strong><small>{variable.explanation}{variable.unit ? ` · ${variable.unit}` : ''}</small></span>
    </label>
  );
  const renderLookupPickerGroup = (group: DataLibraryGroup) => {
    const groupKey = `lookup:${group.id}`;
    const groupNameMatches = Boolean(normalizedQuery && normalize(group.name).includes(normalizedQuery));
    const groupItems = config.lookups.filter((lookup) =>
      group.itemIds.includes(lookup.id) && (groupNameMatches || visibleLookupIds.has(lookup.id))
    );
    if (normalizedQuery && !groupNameMatches && groupItems.length === 0) return null;
    const expanded = Boolean(normalizedQuery) || expandedPickerGroupKeys.includes(groupKey);
    return (
      <section className="source-choice-library-group is-lookup" key={groupKey}>
        <button className="source-choice-library-group-heading" type="button" aria-expanded={expanded} onClick={() => togglePickerGroup(groupKey)}>
          <ChevronDown className={`lookup-library-chevron ${expanded ? 'is-expanded' : ''}`} size={12} aria-hidden="true" />
          <BookOpen size={12} aria-hidden="true" />
          <strong>{group.name.trim() || 'Untitled group'}</strong>
          <small>{group.itemIds.length}</small>
        </button>
        {expanded ? <div className="source-choice-library-group-body">
          {groupItems.length ? groupItems.map(renderLookupChoice) : <span className="empty-option">No matching lookups in this group.</span>}
        </div> : null}
      </section>
    );
  };
  const renderVariablePickerGroup = (group: DataLibraryGroup) => {
    const groupKey = `variable:${group.id}`;
    const groupNameMatches = Boolean(normalizedQuery && normalize(group.name).includes(normalizedQuery));
    const groupItems = config.variables.filter((variable) =>
      group.itemIds.includes(variable.id) && (groupNameMatches || visibleVariableIds.has(variable.id))
    );
    if (normalizedQuery && !groupNameMatches && groupItems.length === 0) return null;
    const expanded = Boolean(normalizedQuery) || expandedPickerGroupKeys.includes(groupKey);
    return (
      <section className="source-choice-library-group is-variable" key={groupKey}>
        <button className="source-choice-library-group-heading" type="button" aria-expanded={expanded} onClick={() => togglePickerGroup(groupKey)}>
          <ChevronDown className={`lookup-library-chevron ${expanded ? 'is-expanded' : ''}`} size={12} aria-hidden="true" />
          <VariableIcon size={12} aria-hidden="true" />
          <strong>{group.name.trim() || 'Untitled group'}</strong>
          <small>{group.itemIds.length}</small>
        </button>
        {expanded ? <div className="source-choice-library-group-body">
          {groupItems.length ? groupItems.map(renderVariableChoice) : <span className="empty-option">No matching variables in this group.</span>}
        </div> : null}
      </section>
    );
  };
  return (
    <div className={`kpi-source-control ${compact ? 'is-compact' : ''}`} ref={controlRef}>
      <button className="cell-enum-trigger" type="button" onClick={() => setOpen((value) => !value)}>
        {kpi.sources.length ? <KpiSourceGroupedSummary config={config} kpi={kpi} onSourceClick={highlightSource} highlightedSourceId={transientHighlightedSourceId} /> : <span className="muted-dash">Select sources...</span>}
        <ChevronDown size={13} className={open ? 'rotate' : ''} />
      </button>
      {open ? (
        <div className="kpi-source-popover">
          <div className="popover-title">KPI sources</div>
          <section className="selected-source-section">
            <div className="popover-title">Selected sources</div>
            {kpi.sources.length ? (
              <div className="selected-source-list">
                {selectedDataGroups.map(({ dataSource, items }) => (
                  <section className="selected-source-group" key={dataSource.id}>
                    <div className="selected-source-group-heading"><Table2 size={13} aria-hidden="true" /><span>{spatiallyScaledTableLabel(dataSource.name, dataSource.spatialUnit)}</span></div>
                    {items.map(({ source, field }) => {
                      const dimensionLabel = fieldGroupDimensionLabel(dataSource.fieldGroups.find((group) => group.fieldIds.includes(field.id)));
                      return renderSelectedSourceRow(source, dimensionedSourceLabel(field.name, dimensionLabel));
                    })}
                  </section>
                ))}
                {selectedKpiSources.length ? (
                  <section className="selected-source-group">
                    <div className="selected-source-group-heading"><Gauge size={13} aria-hidden="true" /><span>Prerequisite KPIs</span></div>
                    {selectedKpiSources.map((source) => renderSelectedSourceRow(source, sourceItemLabel(config, source)))}
                  </section>
                ) : null}
                {selectedLookupSources.length ? (
                  <section className="selected-source-group">
                    <div className="selected-source-group-heading"><BookOpen size={13} aria-hidden="true" /><span>Lookups</span></div>
                    {selectedLookupSources.map((source) => renderSelectedSourceRow(source, config.lookups.find((lookup) => lookup.id === source.lookupId)?.outputName ?? 'Missing lookup'))}
                  </section>
                ) : null}
                {selectedVariableSources.length ? (
                  <section className="selected-source-group is-variable">
                    <div className="selected-source-group-heading"><VariableIcon size={13} aria-hidden="true" /><span>Variables</span></div>
                    {selectedVariableSources.map((source) => renderSelectedSourceRow(source, config.variables.find((variable) => variable.id === source.variableId)?.name ?? 'Missing variable'))}
                  </section>
                ) : null}
                {selectedCustomSources.length ? (
                  <section className="selected-source-group">
                    <div className="selected-source-group-heading"><Pencil size={13} aria-hidden="true" /><span>Custom sources</span></div>
                    {selectedCustomSources.map((source) => renderSelectedSourceRow(source, source.name))}
                  </section>
                ) : null}
              </div>
            ) : <span className="selected-source-empty">No sources selected. Open a picker below to add one.</span>}
          </section>
          <div className="popover-title source-picker-title">Add sources</div>
          <div className="source-scope-buttons" aria-label="Add source from">
            <button className={pickerScope === 'kpis' ? 'is-active' : ''} type="button" aria-expanded={pickerScope === 'kpis'} onClick={() => { setPickerScope((current) => current === 'kpis' ? '' : 'kpis'); setQuery(''); }}><Gauge size={12} aria-hidden="true" />Other KPIs<ChevronDown size={11} className={pickerScope === 'kpis' ? 'rotate' : ''} /></button>
            <button className={pickerScope === 'lookups' ? 'is-active' : ''} type="button" aria-expanded={pickerScope === 'lookups'} onClick={() => { setPickerScope((current) => current === 'lookups' ? '' : 'lookups'); setQuery(''); }}><BookOpen size={12} aria-hidden="true" />Lookups<ChevronDown size={11} className={pickerScope === 'lookups' ? 'rotate' : ''} /></button>
            <button className={pickerScope === 'variables' ? 'is-active' : ''} type="button" aria-expanded={pickerScope === 'variables'} onClick={() => { setPickerScope((current) => current === 'variables' ? '' : 'variables'); setQuery(''); }}><VariableIcon size={12} aria-hidden="true" />Variables<ChevronDown size={11} className={pickerScope === 'variables' ? 'rotate' : ''} /></button>
            {config.dataSources.map((source) => (
              <button className={`source-table-button ${pickerScope === `data:${source.id}` ? 'is-active' : ''}`} type="button" aria-expanded={pickerScope === `data:${source.id}`} key={source.id} onClick={() => { setPickerScope((current) => current === `data:${source.id}` ? '' : `data:${source.id}`); setQuery(''); }}><Table2 size={12} aria-hidden="true" /><span>{source.name}</span><ChevronDown size={11} className={pickerScope === `data:${source.id}` ? 'rotate' : ''} /></button>
            ))}
            <button className={pickerScope === 'custom' ? 'is-active' : ''} type="button" aria-expanded={pickerScope === 'custom'} onClick={() => { setPickerScope((current) => current === 'custom' ? '' : 'custom'); setQuery(''); }}><Pencil size={12} aria-hidden="true" />Custom source<ChevronDown size={11} className={pickerScope === 'custom' ? 'rotate' : ''} /></button>
          </div>
          {pickerScope === 'kpis' || pickerScope === 'lookups' || pickerScope === 'variables' || selectedDataSource ? (
            <label className="popover-search"><Search size={13} /><input value={query} autoFocus placeholder={pickerScope === 'kpis' ? 'Search KPIs…' : pickerScope === 'lookups' ? 'Search lookups…' : pickerScope === 'variables' ? 'Search variables…' : 'Search fields…'} onChange={(event) => setQuery(event.target.value)} /></label>
          ) : null}
          {pickerScope === 'kpis' ? (
            <fieldset className="source-scope-panel">
              <legend>Other KPIs</legend>
              {visibleKpis.length === 0 ? <span className="empty-option">No matching KPIs.</span> : null}
              {visibleKpis.map((entry) => (
                <label className="source-choice-row" key={entry.id}>
                  <input type="checkbox" checked={kpi.sources.some((item) => item.type === 'kpi' && item.kpiId === entry.id)} onChange={() => toggleKpi(entry.id)} />
                  <span><strong>{entry.name}</strong><small>{entry.description.overview}</small></span>
                </label>
              ))}
            </fieldset>
          ) : null}
          {pickerScope === 'lookups' ? (
            <fieldset className="source-scope-panel">
              <legend>Lookups</legend>
              {!hasVisibleLookupChoices ? <span className="empty-option">No matching lookups.</span> : null}
              {config.lookups.flatMap((lookup, lookupIndex) => {
                const groupsAtPosition = config.lookupGroups.filter((group) => group.position === lookupIndex);
                return [
                  ...groupsAtPosition.map(renderLookupPickerGroup),
                  ...(!groupedPickerLookupIds.has(lookup.id) && visibleLookupIds.has(lookup.id) ? [renderLookupChoice(lookup)] : [])
                ];
              })}
              {config.lookupGroups.filter((group) => group.position === config.lookups.length).map(renderLookupPickerGroup)}
            </fieldset>
          ) : null}
          {pickerScope === 'variables' ? (
            <fieldset className="source-scope-panel">
              <legend>Variables</legend>
              {!hasVisibleVariableChoices ? <span className="empty-option">No matching variables.</span> : null}
              {config.variables.flatMap((variable, variableIndex) => {
                const groupsAtPosition = config.variableGroups.filter((group) => group.position === variableIndex);
                return [
                  ...groupsAtPosition.map(renderVariablePickerGroup),
                  ...(!groupedPickerVariableIds.has(variable.id) && visibleVariableIds.has(variable.id) ? [renderVariableChoice(variable)] : [])
                ];
              })}
              {config.variableGroups.filter((group) => group.position === config.variables.length).map(renderVariablePickerGroup)}
            </fieldset>
          ) : null}
          {selectedDataSource ? (
            <fieldset className="source-scope-panel">
              <legend>{selectedDataSource.name}{selectedDataSource.spatialUnit ? ` · ${selectedDataSource.spatialUnit}` : ''}</legend>
              {visibleFields.length === 0 ? <span className="empty-option">No matching fields.</span> : null}
              {visibleFields.map((field) => {
                const group = selectedDataSource.fieldGroups.find((entry) => entry.fieldIds.includes(field.id));
                const dimensionLabel = fieldGroupDimensionLabel(group);
                return (
                  <label className={`source-choice-row ${field.dataType === 'collection' ? 'is-collection' : ''}`} key={field.id}>
                    <input type="checkbox" checked={kpi.sources.some((item) => item.type === 'dataField' && item.dataSourceId === selectedDataSource.id && item.fieldId === field.id)} onChange={() => toggleDataField(selectedDataSource.id, field.id)} />
                    <span><strong>{dimensionedSourceLabel(field.name, dimensionLabel)}</strong><small>{dataSourceFieldTypeLabels[field.dataType]}{field.dataType === 'enum' && field.options.length ? ` · Options: ${field.options.join(', ')}` : ''}{field.meaning ? ` · ${field.meaning}` : ''}{field.valueUnit ? ` · ${field.valueUnit}` : ''}</small></span>
                  </label>
                );
              })}
            </fieldset>
          ) : null}
          {pickerScope === 'custom' ? (
            <section className="custom-source-panel">
              <label className="field"><span>Name</span><input value={customName} autoFocus placeholder="Source name" onChange={(event) => setCustomName(event.target.value)} /></label>
              <label className="field"><span>LaTeX expression</span><input className="latex-code-editor" value={customLatex} placeholder="x_{custom}" onChange={(event) => setCustomLatex(event.target.value)} /></label>
              <span className="source-latex-preview">{customLatex.trim() ? <InlineMath math={customLatex} errorColor="#b42318" /> : 'Preview'}</span>
              <button className="primary-action tiny" type="button" disabled={!customName.trim()} onClick={addCustomSource}><Plus size={12} /> Add custom source</button>
            </section>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function FormulaExpressionEditor({ config, kpi, item, priorItems, onChange, rightOnly = false, spatialScale }: { config: KpiPoolConfig; kpi: KpiMetric; item: KpiFormulaItem; priorItems: KpiFormulaItem[]; onChange: (partial: Partial<KpiFormulaItem>) => void; rightOnly?: boolean; spatialScale?: SpatialScaleKey }) {
  const leftRef = useRef<HTMLTextAreaElement | null>(null);
  const rightRef = useRef<HTMLTextAreaElement | null>(null);
  const paletteOptionsRef = useRef<HTMLDivElement | null>(null);
  const [leftExpression, setLeftExpression] = useState(item.leftExpression);
  const [rightExpression, setRightExpression] = useState(item.rightExpression);
  const [activeSide, setActiveSide] = useState<'left' | 'right'>('right');
  const [paletteExpanded, setPaletteExpanded] = useState(false);
  const [paletteHasMore, setPaletteHasMore] = useState(false);
  const commitTimeoutRef = useRef<number | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const paletteRef = useCloseOnOutsideClick<HTMLDivElement>(paletteExpanded, () => setPaletteExpanded(false));
  useEffect(() => {
    setLeftExpression(item.leftExpression);
    setRightExpression(item.rightExpression);
  }, [item.leftExpression, item.rightExpression]);
  useEffect(() => {
    const textareas = [leftRef.current, rightRef.current].filter((textarea): textarea is HTMLTextAreaElement => Boolean(textarea));
    const resize = () => textareas.forEach((textarea) => {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    });
    resize();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize);
    textareas.forEach((textarea) => observer?.observe(textarea.parentElement ?? textarea));
    window.addEventListener('resize', resize);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', resize);
    };
  }, [leftExpression, rightExpression]);
  const updateSides = (leftExpression: string, rightExpression: string) => onChangeRef.current({
    leftExpression: rightOnly ? '' : leftExpression,
    rightExpression,
    formula: rightOnly ? rightExpression : leftExpression ? `${leftExpression} = ${rightExpression}` : rightExpression
  });
  const clearPendingCommit = () => {
    if (commitTimeoutRef.current !== null) {
      window.clearTimeout(commitTimeoutRef.current);
      commitTimeoutRef.current = null;
    }
  };
  const commitSides = (nextLeft = leftExpression, nextRight = rightExpression) => {
    clearPendingCommit();
    updateSides(nextLeft, nextRight);
  };
  const scheduleCommit = (nextLeft: string, nextRight: string) => {
    clearPendingCommit();
    commitTimeoutRef.current = window.setTimeout(() => commitSides(nextLeft, nextRight), textInputDebounceMs);
  };
  useEffect(() => () => clearPendingCommit(), []);
  const insertLatex = (latex: string) => {
    if (!latex.trim()) return;
    const insertionSide = rightOnly ? 'right' : activeSide;
    const target = insertionSide === 'left' ? leftRef.current : rightRef.current;
    const value = insertionSide === 'left' ? leftExpression : rightExpression;
    const start = target?.selectionStart ?? value.length;
    const end = target?.selectionEnd ?? start;
    const next = `${value.slice(0, start)}${latex}${value.slice(end)}`;
    if (insertionSide === 'left') {
      setLeftExpression(next);
      scheduleCommit(next, rightExpression);
    } else {
      setRightExpression(next);
      scheduleCommit(leftExpression, next);
    }
    requestAnimationFrame(() => { target?.focus(); target?.setSelectionRange(start + latex.length, start + latex.length); });
  };
  const sourceFieldShortcuts = kpi.sources.filter((source) => source.type !== 'lookup' && source.type !== 'variable');
  const lookupShortcuts = kpi.sources.filter((source) => source.type === 'lookup');
  const variableShortcuts = kpi.sources.filter((source) => source.type === 'variable');
  const insertableResults = priorItems.filter((prior) => prior.tag.trim() && prior.leftExpression.trim());
  const lastFormulaItem = priorItems.slice().reverse().find((prior) => prior.formula.trim() || prior.leftExpression.trim());
  const basicUnitScale = spatialScaleKeys.find((scale) => kpi.spatialScales[scale].applicable && kpi.spatialScales[scale].isBasicUnit);
  const aggregationShortcut = spatialScale
    ? `\\sum_{${basicUnitScale ? latexIdentifier(spatialScaleLabels[basicUnitScale]) : ''} \\in ${latexIdentifier(spatialScaleLabels[spatialScale])}}`
    : '';
  const collectionDomains = useMemo(() => formulaCollectionDomains(config, kpi), [config, kpi]);
  const dimensionShortcuts = useMemo(() => {
    const shortcuts = new Map<string, { latex: string; label: string; kind: 'Dimension' | 'Option' | 'Set' }>();
    formulaDimensions(config, kpi).forEach((dimension) => {
        const dimensionLatex = latexIdentifier(dimension.name);
        if (!dimensionLatex) return;
        shortcuts.set(`dimension:${dimensionLatex}`, {
          latex: dimensionLatex,
          label: `Dimension: ${dimension.name}`,
          kind: 'Dimension'
        });
        const optionLatex = dimension.options.map((option) => ({ option, latex: latexIdentifier(option) })).filter((option) => option.latex);
        optionLatex.forEach(({ option, latex }) => shortcuts.set(`option:${dimensionLatex}:${latex}`, {
          latex,
          label: `${dimension.name} option: ${option}`,
          kind: 'Option'
        }));
        if (optionLatex.length) {
          const membershipLatex = `${dimensionLatex} \\in \\{${optionLatex.map((option) => option.latex).join(', ')}\\}`;
          shortcuts.set(`set:${membershipLatex}`, {
            latex: membershipLatex,
            label: `${dimension.name} and all of its options`,
            kind: 'Set'
          });
        }
    });
    collectionDomains.forEach((domain) => {
      domain.options
        .map((option) => ({ option, latex: latexIdentifier(option) }))
        .filter((option) => option.latex)
        .forEach(({ option, latex }) => shortcuts.set(`collection-domain-option:${domain.key}:${latex}`, {
          latex,
          label: `${domain.name} option: ${option}`,
          kind: 'Option'
        }));
    });
    return [...shortcuts.values()];
  }, [collectionDomains, config, kpi]);
  useLayoutEffect(() => {
    const container = paletteOptionsRef.current;
    if (!container || paletteExpanded) return undefined;
    const measure = () => {
      setPaletteHasMore(container.scrollWidth > container.clientWidth + 1);
    };
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(container.parentElement ?? container);
    window.addEventListener('resize', measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [config, dimensionShortcuts, insertableResults, kpi.sources, paletteExpanded, spatialScale]);
  return (
    <div className="formula-expression-workbench">
      <div className={`formula-side-editors ${rightOnly ? 'is-right-only' : ''}`}>
        {!rightOnly ? <>
          <label className="field"><textarea ref={leftRef} className="latex-code-editor" rows={1} value={leftExpression} placeholder="v_{avg}" aria-label="Left side result LaTeX" onFocus={() => setActiveSide('left')} onChange={(event) => { const next = event.target.value; setLeftExpression(next); scheduleCommit(next, rightExpression); }} onBlur={() => commitSides()} /></label>
          <span className="formula-equals">=</span>
        </> : null}
        <label className="field"><textarea ref={rightRef} className="latex-code-editor" rows={1} value={rightExpression} placeholder="\frac{\sum_i x_i}{n}" aria-label="Right side calculation LaTeX" onFocus={() => setActiveSide('right')} onChange={(event) => { const next = event.target.value; setRightExpression(next); scheduleCommit(leftExpression, next); }} onBlur={() => commitSides()} /></label>
      </div>
      <div className={`formula-source-palette ${paletteExpanded ? 'has-open-dropdown' : ''}`} ref={paletteRef}>
        <div className="formula-source-palette-heading">
          <span>{rightOnly ? 'Insert into formula' : `Insert into ${activeSide === 'left' ? 'left' : 'right'} side`}</span>
          {paletteHasMore ? (
            <button className="formula-palette-toggle" type="button" aria-expanded={paletteExpanded} onClick={() => setPaletteExpanded((value) => !value)}>
              {paletteExpanded ? 'Close' : 'More'}
              <ChevronDown size={12} className={paletteExpanded ? 'rotate' : ''} aria-hidden="true" />
            </button>
          ) : null}
        </div>
        <div className="formula-source-options-slot">
          <div
            className={`formula-source-options ${paletteExpanded ? 'is-expanded' : ''}`}
            ref={paletteOptionsRef}
          >
          {spatialScale ? <section className="formula-shortcut-group is-priority">
            <span className="formula-shortcut-group-label">Scale formula</span>
            <div className="formula-shortcut-group-options">
              <button className="formula-scale-insert" type="button" title={`Sum from ${basicUnitScale ? spatialScaleLabels[basicUnitScale] : 'an unspecified basic unit'} into ${spatialScaleLabels[spatialScale]}`} onClick={() => insertLatex(aggregationShortcut)}>
                <span className="formula-shortcut-kind">Sum</span>
                <InlineMath math={aggregationShortcut} errorColor="#b42318" />
              </button>
              {lastFormulaItem ? <button className="formula-result-insert" type="button" disabled={!lastFormulaItem.leftExpression.trim()} title={lastFormulaItem.leftExpression.trim() ? `Last formula result: ${lastFormulaItem.tag}` : 'The last formula has no left term'} onClick={() => insertLatex(lastFormulaItem.leftExpression)}>
                <span>{lastFormulaItem.tag.trim() || 'Last formula'}</span>
                {lastFormulaItem.leftExpression.trim() ? <InlineMath math={lastFormulaItem.leftExpression} errorColor="#b42318" /> : 'No left term'}
              </button> : null}
              <button className="formula-scale-insert" type="button" title={`Spatial scale: ${spatialScaleLabels[spatialScale]}`} onClick={() => insertLatex(spatialScaleLabels[spatialScale])}>
                <span className="formula-shortcut-kind">Scale</span>
                <InlineMath math={spatialScaleLabels[spatialScale]} errorColor="#b42318" />
              </button>
            </div>
          </section> : null}
          {sourceFieldShortcuts.length ? <section className="formula-shortcut-group">
            <span className="formula-shortcut-group-label">Source fields</span>
            <div className="formula-shortcut-group-options">
              {sourceFieldShortcuts.map((source) => {
                const isCollection = source.type === 'dataField' && config.dataSources.find((dataSource) => dataSource.id === source.dataSourceId)?.fields.find((field) => field.id === source.fieldId)?.dataType === 'collection';
                return <button className={isCollection ? 'formula-collection-insert' : 'formula-source-insert'} type="button" disabled={!source.latex.trim()} title={sourceItemLabel(config, source)} key={source.id} onClick={() => insertLatex(source.latex)}>
                {source.latex.trim() ? <InlineMath math={source.latex} errorColor="#b42318" /> : sourceItemLabel(config, source)}
              </button>;
              })}
            </div>
          </section> : null}
          {dimensionShortcuts.length ? <section className="formula-shortcut-group">
            <span className="formula-shortcut-group-label">{collectionDomains.some((domain) => domain.options.some((option) => latexIdentifier(option))) ? 'Dimensions & domain options' : 'Dimensions'}</span>
            <div className="formula-shortcut-group-options">
              {dimensionShortcuts.map((shortcut) => <button className="formula-dimension-insert" type="button" title={shortcut.label} key={`${shortcut.kind}:${shortcut.latex}`} onClick={() => insertLatex(shortcut.latex)}>
                <span className="formula-shortcut-kind">{shortcut.kind}</span>
                <InlineMath math={shortcut.latex} errorColor="#b42318" />
              </button>)}
            </div>
          </section> : null}
          {lookupShortcuts.length ? <section className="formula-shortcut-group">
            <span className="formula-shortcut-group-label">Source lookups</span>
            <div className="formula-shortcut-group-options">
              {lookupShortcuts.map((source) => <button className="formula-lookup-insert" type="button" disabled={!source.latex.trim()} title={sourceItemLabel(config, source)} key={source.id} onClick={() => insertLatex(source.latex)}>
                {source.latex.trim() ? <InlineMath math={source.latex} errorColor="#b42318" /> : sourceItemLabel(config, source)}
              </button>)}
            </div>
          </section> : null}
          {variableShortcuts.length ? <section className="formula-shortcut-group">
            <span className="formula-shortcut-group-label">Source variables</span>
            <div className="formula-shortcut-group-options">
              {variableShortcuts.map((source) => <button className="formula-variable-insert" type="button" disabled={!source.latex.trim()} title={sourceItemLabel(config, source)} key={source.id} onClick={() => insertLatex(source.latex)}>
                {source.latex.trim() ? <InlineMath math={source.latex} errorColor="#b42318" /> : sourceItemLabel(config, source)}
              </button>)}
            </div>
          </section> : null}
          {insertableResults.some((prior) => !spatialScale || prior !== lastFormulaItem) ? <section className="formula-shortcut-group">
            <span className="formula-shortcut-group-label">Previous items</span>
            <div className="formula-shortcut-group-options">
              {insertableResults.map((prior, index) => spatialScale && prior === lastFormulaItem ? null : <button className="formula-result-insert" type="button" title={`Formula result: ${prior.tag}`} key={`${prior.tag}-${index}`} onClick={() => insertLatex(prior.leftExpression)}>
                <span>{prior.tag}</span>
                <InlineMath math={prior.leftExpression} errorColor="#b42318" />
              </button>)}
            </div>
          </section> : null}
            <section className="formula-shortcut-group">
              <span className="formula-shortcut-group-label">Spatial-scale keywords</span>
              <div className="formula-shortcut-group-options">
                {spatialScaleKeys.map((scale) => spatialScale === scale ? null : <button className="formula-scale-insert" type="button" title={`Spatial scale: ${spatialScaleLabels[scale]}`} key={scale} onClick={() => insertLatex(spatialScaleLabels[scale])}>
                  <InlineMath math={spatialScaleLabels[scale]} errorColor="#b42318" />
                </button>)}
                {['Zone', ...genericSpatialUnits].map((keyword) => <button className="formula-scale-insert" type="button" title={`Generic spatial unit: ${keyword}`} key={keyword} onClick={() => insertLatex(keyword)}>
                  <InlineMath math={keyword} errorColor="#b42318" />
                </button>)}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

type FormulaSemanticToken = {
  latex: string;
  matchLatex?: string;
  requiresFollowingParenthesis?: boolean;
  kind: 'source' | 'collection' | 'lookup' | 'variable' | 'result' | 'dimension' | 'scale';
  prominent?: boolean;
  label: string;
  target?: FormulaSemanticTarget;
  originFormulaIndex?: number;
};

type IndexedFormulaSemanticToken = FormulaSemanticToken & { index: number };
type DecoratedFormula = { decorated: string; tokens: IndexedFormulaSemanticToken[] };
type FormulaTokenMatch = { index: number; latex: string };

const formulaDecorationCache = new Map<string, DecoratedFormula>();
const formulaHtmlCache = new Map<string, string>();
const formulaTokenValidityCache = new Map<string, boolean>();
const formulaTokenMatchCache = new Map<string, Map<string, boolean>>();
const formulaCacheLimit = 500;

const cacheFormulaResult = <T,>(cache: Map<string, T>, key: string, value: T) => {
  if (cache.size >= formulaCacheLimit) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey !== undefined) cache.delete(oldestKey);
  }
  cache.set(key, value);
  return value;
};

const spatialScaleFormulaKeywords = [...spatialScaleKeys.map((scale) => spatialScaleLabels[scale]), 'Zone', ...genericSpatialUnits];

const allowFormulaSemanticClass = (context: TrustContext) => context.command === '\\htmlClass';

const isFormulaIdentifierCharacter = (value: string | undefined) => Boolean(value && /[\p{L}\p{N}]/u.test(value));

const hasFormulaTokenBoundaries = (formula: string, token: string, index: number) => {
  const previous = index > 0 ? formula[index - 1] : undefined;
  const nextIndex = index + token.length;
  const next = nextIndex < formula.length ? formula[nextIndex] : undefined;
  return !(isFormulaIdentifierCharacter(token[0]) && isFormulaIdentifierCharacter(previous)) &&
    !(isFormulaIdentifierCharacter(token[token.length - 1]) && isFormulaIdentifierCharacter(next));
};

const qualifiedFormulaTokenPrefix = (token: FormulaSemanticToken) => {
  if ((token.kind !== 'source' && token.kind !== 'collection') || token.requiresFollowingParenthesis) return undefined;
  const matchLatex = token.matchLatex ?? token.latex;
  if (!matchLatex.endsWith('}')) return undefined;
  let depth = 0;
  for (let index = matchLatex.length - 1; index >= 0; index -= 1) {
    if (matchLatex[index] === '}') depth += 1;
    if (matchLatex[index] !== '{') continue;
    depth -= 1;
    if (depth === 0) {
      return matchLatex[index - 1] === '_' ? matchLatex.slice(0, -1) : undefined;
    }
  }
  return undefined;
};

const qualifiedFormulaTokenMatch = (formula: string, prefix: string, index: number) => {
  if (formula[index + prefix.length] !== '|') return undefined;
  let depth = 1;
  for (let cursor = index + prefix.length + 1; cursor < formula.length; cursor += 1) {
    if (formula[cursor] === '{') depth += 1;
    if (formula[cursor] !== '}') continue;
    depth -= 1;
    if (depth === 0) return formula.slice(index, cursor + 1);
  }
  return undefined;
};

const findFormulaToken = (formula: string, token: FormulaSemanticToken, startIndex: number): FormulaTokenMatch | undefined => {
  const matchLatex = token.matchLatex ?? token.latex;
  const qualifiedPrefix = qualifiedFormulaTokenPrefix(token);
  let index = startIndex;
  while (index < formula.length) {
    const exactIndex = formula.indexOf(matchLatex, index);
    const qualifiedIndex = qualifiedPrefix ? formula.indexOf(`${qualifiedPrefix}|`, index) : -1;
    const nextIndex = exactIndex < 0
      ? qualifiedIndex
      : qualifiedIndex < 0
        ? exactIndex
        : Math.min(exactIndex, qualifiedIndex);
    if (nextIndex < 0) return undefined;
    const matchedLatex = nextIndex === qualifiedIndex && qualifiedPrefix
      ? qualifiedFormulaTokenMatch(formula, qualifiedPrefix, nextIndex)
      : matchLatex;
    if (!matchedLatex) {
      index = nextIndex + 1;
      continue;
    }
    const hasBoundaries = hasFormulaTokenBoundaries(formula, matchedLatex, nextIndex);
    const followedByParenthesis = !token.requiresFollowingParenthesis || /^\s*\(/.test(formula.slice(nextIndex + matchLatex.length));
    if (hasBoundaries && followedByParenthesis) return { index: nextIndex, latex: matchedLatex };
    index = nextIndex + 1;
  }
  return undefined;
};

const formulaContainsToken = (formula: string, token: FormulaSemanticToken) => {
  let matchesByToken = formulaTokenMatchCache.get(formula);
  if (!matchesByToken) {
    if (formulaTokenMatchCache.size >= formulaCacheLimit) {
      const oldestFormula = formulaTokenMatchCache.keys().next().value;
      if (oldestFormula !== undefined) formulaTokenMatchCache.delete(oldestFormula);
    }
    matchesByToken = new Map<string, boolean>();
    formulaTokenMatchCache.set(formula, matchesByToken);
  }
  const tokenKey = JSON.stringify([
    token.kind,
    token.matchLatex ?? token.latex,
    Boolean(token.requiresFollowingParenthesis)
  ]);
  const cached = matchesByToken.get(tokenKey);
  if (cached !== undefined) return cached;
  const matches = Boolean(findFormulaToken(formula, token, 0));
  matchesByToken.set(tokenKey, matches);
  return matches;
};

const splitFormulaAtSafeCommas = (formula: string) => {
  if (/\\left|\\right/.test(formula)) return [formula];
  const segments: string[] = [];
  let segment = '';
  let braceDepth = 0;
  for (let index = 0; index < formula.length; index += 1) {
    const character = formula[index];
    if (character === '\\') {
      segment += character;
      if (index + 1 < formula.length) {
        segment += formula[index + 1];
        index += 1;
      }
      continue;
    }
    if (character === '{') braceDepth += 1;
    if (character === '}') braceDepth = Math.max(0, braceDepth - 1);
    segment += character;
    if ((character === ',' || character === '(') && braceDepth === 0) {
      segments.push(segment);
      segment = '';
    }
  }
  if (segment) segments.push(segment);
  return segments;
};

const decorateFormulaTokens = (formula: string, tokens: FormulaSemanticToken[]): DecoratedFormula => {
  const tokenMatchLatex = (token: FormulaSemanticToken) => token.matchLatex ?? token.latex;
  const tokenClassNames = (token: FormulaSemanticToken & { index: number }) => [
    'formula-semantic-token',
    `formula-${token.kind}-token`,
    token.prominent ? 'formula-final-result-token' : '',
    `formula-token-${token.index}`
  ].filter(Boolean).join(' ');
  const uniqueTokens = [...new Map(tokens.filter((token) => tokenMatchLatex(token).trim()).map((token) => [tokenMatchLatex(token), token])).values()]
    .map((token, index) => ({ ...token, index }))
    .sort((left, right) => tokenMatchLatex(right).length - tokenMatchLatex(left).length);
  const matchingTokens = uniqueTokens.filter((token) => formulaContainsToken(formula, token));
  const cacheKey = JSON.stringify([formula, matchingTokens]);
  const cached = formulaDecorationCache.get(cacheKey);
  if (cached) return cached;
  const buildDecoratedFormula = (activeTokens: typeof uniqueTokens) => {
    const safeBreakIndexes = new Set<number>();
    let braceDepth = 0;
    for (let index = 0; index < formula.length; index += 1) {
      const character = formula[index];
      if (character === '\\') {
        index += 1;
        continue;
      }
      if (character === '{') braceDepth += 1;
      if (character === '}') braceDepth = Math.max(0, braceDepth - 1);
      if (
        (character === ',' || character === '(') &&
        braceDepth === 0 &&
        !/^\s*\\allowbreak\b/.test(formula.slice(index + 1))
      ) {
        safeBreakIndexes.add(index);
      }
    }
    const formulaRangeWithSafeBreaks = (start: number, end: number) => {
      let value = '';
      for (let index = start; index < end; index += 1) {
        value += formula[index];
        if (safeBreakIndexes.has(index)) value += ' \\allowbreak ';
      }
      return value;
    };
    const decorateNestedSemanticTokens = (parentLatex: string, parentToken: typeof uniqueTokens[number]) => {
      const nestedTokens = activeTokens.filter((token) =>
        token.index !== parentToken.index && (token.kind === 'dimension' || token.kind === 'scale')
      );
      const qualifiedPrefix = qualifiedFormulaTokenPrefix(parentToken);
      const nestedSearchLatex = qualifiedPrefix && parentLatex[qualifiedPrefix.length] === '|'
        ? parentLatex.slice(0, qualifiedPrefix.length)
        : parentLatex;
      let nestedCursor = 0;
      let decoratedParent = '';
      while (nestedCursor < nestedSearchLatex.length) {
        let nestedMatch: typeof uniqueTokens[number] | undefined;
        let nestedOccurrence: FormulaTokenMatch | undefined;
        for (const token of nestedTokens) {
          const occurrence = findFormulaToken(nestedSearchLatex, token, nestedCursor);
          if (occurrence && (!nestedOccurrence || occurrence.index < nestedOccurrence.index || (occurrence.index === nestedOccurrence.index && occurrence.latex.length > nestedOccurrence.latex.length))) {
            nestedMatch = token;
            nestedOccurrence = occurrence;
          }
        }
        if (!nestedMatch || !nestedOccurrence) {
          decoratedParent += nestedSearchLatex.slice(nestedCursor);
          break;
        }
        decoratedParent += nestedSearchLatex.slice(nestedCursor, nestedOccurrence.index);
        const nestedLatex = nestedOccurrence.latex;
        decoratedParent += `\\htmlClass{${tokenClassNames(nestedMatch)}}{${nestedLatex}}`;
        nestedCursor = nestedOccurrence.index + nestedLatex.length;
      }
      return `${decoratedParent || nestedSearchLatex}${parentLatex.slice(nestedSearchLatex.length)}`;
    };
    let cursor = 0;
    let decorated = '';
    while (cursor < formula.length) {
      let match: (FormulaSemanticToken & { index: number }) | undefined;
      let occurrence: FormulaTokenMatch | undefined;
      for (const token of activeTokens) {
        const tokenOccurrence = findFormulaToken(formula, token, cursor);
        if (tokenOccurrence && (!occurrence || tokenOccurrence.index < occurrence.index || (tokenOccurrence.index === occurrence.index && tokenOccurrence.latex.length > occurrence.latex.length))) {
          match = token;
          occurrence = tokenOccurrence;
        }
      }
      if (!match || !occurrence) {
        decorated += formulaRangeWithSafeBreaks(cursor, formula.length);
        break;
      }
      decorated += formulaRangeWithSafeBreaks(cursor, occurrence.index);
      const matchedLatex = occurrence.latex;
      const decoratedMatch = match.kind === 'result' || match.kind === 'source' || match.kind === 'collection'
        ? decorateNestedSemanticTokens(matchedLatex, match)
        : matchedLatex;
      const precedingFormula = formula.slice(0, occurrence.index).trimEnd();
      const shouldBreakBeforeToken = (
        match.kind === 'source' ||
        match.kind === 'collection' ||
        match.kind === 'lookup' ||
        match.kind === 'variable'
      ) && precedingFormula.length > 0 && !/[=+\-*/,(]$/.test(precedingFormula);
      if (shouldBreakBeforeToken) decorated += ' \\allowbreak ';
      decorated += splitFormulaAtSafeCommas(decoratedMatch)
        .map((segment) => `\\htmlClass{${tokenClassNames(match)}}{${segment}}`)
        .join(' \\allowbreak ');
      cursor = occurrence.index + matchedLatex.length;
    }
    return decorated;
  };
  const rendersSafely = (candidateFormula: string) => {
    try {
      katex.renderToString(candidateFormula, {
        displayMode: true,
        output: 'html',
        throwOnError: true,
        strict: 'ignore',
        trust: allowFormulaSemanticClass
      });
      return true;
    } catch {
      return false;
    }
  };
  const individuallyValidTokens = matchingTokens.filter((token) => {
    const tokenLatex = tokenMatchLatex(token);
    const cacheKey = JSON.stringify([token.kind, token.prominent, tokenLatex]);
    const cached = formulaTokenValidityCache.get(cacheKey);
    if (cached !== undefined) return cached;
    return cacheFormulaResult(
      formulaTokenValidityCache,
      cacheKey,
      rendersSafely(`\\htmlClass{${tokenClassNames(token)}}{${tokenLatex}}`)
    );
  });
  const fullyDecoratedFormula = buildDecoratedFormula(individuallyValidTokens);
  // renderFormulaHtml performs the authoritative KaTeX parse and falls back to
  // the undecorated formula. Parsing the full expression here as well doubled
  // the dominant cost whenever a source token changed.
  return cacheFormulaResult(formulaDecorationCache, cacheKey, {
    decorated: fullyDecoratedFormula || formula,
    tokens: individuallyValidTokens
  });
};

const renderFormulaHtml = (formula: string, decorated: string, inline: boolean) => {
  const cacheKey = JSON.stringify([formula, decorated, inline]);
  const cached = formulaHtmlCache.get(cacheKey);
  if (cached !== undefined) return cached;
  let rendered: string;
  try {
    rendered = katex.renderToString(decorated, {
      displayMode: !inline,
      errorColor: '#b42318',
      output: 'html',
      throwOnError: true,
      strict: 'ignore',
      trust: allowFormulaSemanticClass
    });
  } catch {
    rendered = katex.renderToString(formula, {
      displayMode: !inline,
      errorColor: '#b42318',
      output: 'html',
      throwOnError: false
    });
  }
  return cacheFormulaResult(formulaHtmlCache, cacheKey, rendered);
};

type FormulaItemCatalog = {
  items: KpiFormulaItem[];
  indexByItem: Map<KpiFormulaItem, number>;
  finalItem?: KpiFormulaItem;
};

const formulaItemCatalogCache = new WeakMap<KpiMetric, FormulaItemCatalog>();

const formulaItemCatalog = (kpi: KpiMetric) => {
  const cached = formulaItemCatalogCache.get(kpi);
  if (cached) return cached;
  const items = kpi.description.formulas.flatMap((group) => group.items);
  const value = {
    items,
    indexByItem: new Map(items.map((item, index) => [item, index])),
    finalItem: items.slice().reverse().find((item) => item.formula.trim() || item.leftExpression.trim())
  };
  formulaItemCatalogCache.set(kpi, value);
  return value;
};

function InteractiveFormulaPreview({
  config: currentConfig,
  kpi: currentKpi,
  item: currentItem,
  inline = false,
  highlightedFormulaIndex,
  onSemanticTarget
}: {
  config: KpiPoolConfig;
  kpi: KpiMetric;
  item: KpiFormulaItem;
  inline?: boolean;
  highlightedFormulaIndex?: number;
  onSemanticTarget?: (target: FormulaSemanticTarget) => void;
}) {
  const previewRef = useRef<HTMLDivElement | null>(null);
  const previewInput = useMemo(
    () => ({ config: currentConfig, kpi: currentKpi, item: currentItem }),
    [currentConfig, currentItem, currentKpi]
  );
  const { config, kpi, item } = useDeferredValue(previewInput);
  const dimensionTokens = useMemo(() => formulaDimensions(config, kpi).flatMap((dimension): FormulaSemanticToken[] => [
      {
        latex: latexIdentifier(dimension.name),
        kind: 'dimension',
        label: `Dimension: ${dimension.name}`
      },
      ...dimension.options.map((option) => ({
        latex: latexIdentifier(option),
        kind: 'dimension' as const,
        label: `${dimension.name} option: ${option}`
      }))
    ]), [config, kpi]);
  const collectionDomainTokens = useMemo(() => formulaCollectionDomains(config, kpi).flatMap((domain): FormulaSemanticToken[] =>
    domain.options.flatMap((option) => {
      const latex = latexIdentifier(option);
      return latex ? [{
        latex,
        kind: 'dimension' as const,
        label: `${domain.name} option: ${option}`
      }] : [];
    })
  ), [config, kpi]);
  const referencedKpiNames = JSON.stringify(kpi.sources
    .filter((source) => source.type === 'kpi')
    .map((source) => {
      const referencedKpi = config.kpis.find((entry) => entry.id === source.kpiId);
      return [source.kpiId, referencedKpi?.name ?? 'Missing KPI', referencedKpi?.dimensions ?? []];
    }));
  const sourceTokens = useMemo(() => kpi.sources.map((source): FormulaSemanticToken => {
    const lookupOpenParenthesis = source.type === 'lookup' ? source.latex.indexOf('(') : -1;
    const fieldType = source.type === 'dataField'
      ? config.dataSources.find((dataSource) => dataSource.id === source.dataSourceId)?.fields.find((field) => field.id === source.fieldId)?.dataType
      : undefined;
    return {
      latex: source.latex,
      matchLatex: lookupOpenParenthesis > 0 ? source.latex.slice(0, lookupOpenParenthesis).trimEnd() : undefined,
      requiresFollowingParenthesis: lookupOpenParenthesis > 0,
      kind: source.type === 'variable' ? 'variable' : source.type === 'lookup' ? 'lookup' : fieldType === 'collection' ? 'collection' : 'source',
      label: `Source: ${sourceItemTooltip(config, source)}`,
      target: { kind: 'source', sourceId: source.id }
    };
  }), [config.dataSources, config.lookups, config.variables, kpi.sources, referencedKpiNames]);
  const itemCatalog = formulaItemCatalog(kpi);
  const regularFormulaItems = itemCatalog.items;
  const finalFormulaItem = itemCatalog.finalItem;
  const currentFormulaIndex = itemCatalog.indexByItem.get(item) ?? -1;
  const priorItems = currentFormulaIndex >= 0 ? regularFormulaItems.slice(0, currentFormulaIndex) : regularFormulaItems;
  const priorItemsKey = JSON.stringify(priorItems.map((prior) => [itemCatalog.indexByItem.get(prior), prior.leftExpression, prior.tag]));
  const priorItemTokens = useMemo(() => priorItems.map((prior): FormulaSemanticToken => {
    const formulaIndex = itemCatalog.indexByItem.get(prior) ?? -1;
    return {
      latex: prior.leftExpression,
      kind: 'result',
      prominent: prior === finalFormulaItem,
      label: `Previous formula: ${prior.tag || 'Untitled formula'}`,
      target: formulaIndex >= 0 ? { kind: 'formula', formulaIndex } : undefined
    };
  }), [finalFormulaItem, priorItemsKey]);
  const semantic = useMemo(
    () => decorateFormulaTokens(item.formula, [
      ...sourceTokens,
      ...dimensionTokens,
      ...collectionDomainTokens,
      ...spatialScaleFormulaKeywords.map((keyword) => ({
        latex: keyword,
        kind: 'scale' as const,
        label: `Spatial scale: ${keyword}`
      })),
      ...priorItemTokens,
      {
        latex: item.leftExpression,
        kind: 'result' as const,
        prominent: item === finalFormulaItem,
        label: `Formula tag: ${item.tag.trim() || 'Untitled formula'}`,
        originFormulaIndex: currentFormulaIndex >= 0 ? currentFormulaIndex : undefined
      }
    ]),
    [collectionDomainTokens, currentFormulaIndex, dimensionTokens, finalFormulaItem, item, item.formula, item.leftExpression, item.tag, priorItemTokens, sourceTokens]
  );
  const renderedHtml = useMemo(
    () => renderFormulaHtml(item.formula, semantic.decorated, inline),
    [inline, item.formula, semantic.decorated]
  );

  useEffect(() => {
    const container = previewRef.current;
    const renderedFormula = container?.querySelector<HTMLElement>('.katex-html');
    if (!container || !renderedFormula) return undefined;

    renderedFormula.classList.remove('has-formula-continuation-indent');
    renderedFormula.style.removeProperty('--formula-continuation-indent');

    const leftExpression = item.leftExpression.trim();
    if (!leftExpression || !item.rightExpression.trim()) return undefined;

    const leftTemplate = document.createElement('template');
    leftTemplate.innerHTML = renderFormulaHtml(leftExpression, leftExpression, true);
    const leftEqualsCount = [...leftTemplate.content.querySelectorAll<HTMLElement>('.mrel')]
      .filter((element) => element.textContent?.trim() === '=').length;
    const connector = [...renderedFormula.querySelectorAll<HTMLElement>('.mrel')]
      .filter((element) => element.textContent?.trim() === '=')[leftEqualsCount];
    const connectorBase = connector?.closest<HTMLElement>('.base');
    if (!connectorBase) return undefined;

    let active = true;
    let frame: number | null = null;
    const measure = () => {
      if (!active) return;
      frame = null;
      const formulaRect = renderedFormula.getBoundingClientRect();
      const connectorRect = connectorBase.getBoundingClientRect();
      const rootFontSize = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      const indentationCap = Math.min(container.clientWidth * 0.28, rootFontSize * 10);
      const indentation = Math.max(0, Math.min(connectorRect.right - formulaRect.left, indentationCap));
      const nextIndentation = `${Math.round(indentation * 10) / 10}px`;
      if (renderedFormula.style.getPropertyValue('--formula-continuation-indent') !== nextIndentation) {
        renderedFormula.style.setProperty('--formula-continuation-indent', nextIndentation);
      }
      renderedFormula.classList.toggle('has-formula-continuation-indent', indentation > 0);
    };

    const scheduleMeasure = () => {
      if (!active || frame !== null) return;
      frame = window.requestAnimationFrame(measure);
    };

    scheduleMeasure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(scheduleMeasure);
    observer?.observe(container);
    void document.fonts?.ready.then(scheduleMeasure);

    return () => {
      active = false;
      if (frame !== null) window.cancelAnimationFrame(frame);
      observer?.disconnect();
      renderedFormula.classList.remove('has-formula-continuation-indent');
      renderedFormula.style.removeProperty('--formula-continuation-indent');
    };
  }, [item.leftExpression, item.rightExpression, renderedHtml]);

  useEffect(() => {
    const container = previewRef.current;
    if (!container) return;
    const cleanups: Array<() => void> = [];
    container.querySelectorAll<HTMLElement>('.is-formula-origin-highlighted').forEach((element) => {
      element.classList.remove('is-formula-origin-highlighted');
    });
    semantic.tokens.forEach((token) => {
      const elements = [...container.querySelectorAll<HTMLElement>(`.formula-token-${token.index}`)];
      if (highlightedFormulaIndex !== undefined && token.originFormulaIndex === highlightedFormulaIndex) {
        elements[0]?.classList.add('is-formula-origin-highlighted');
      }
      elements.forEach((element) => {
        element.title = token.label;
        element.tabIndex = 0;
        if (!token.target || !onSemanticTarget) return;
        element.classList.add('is-actionable');
        element.setAttribute('role', 'button');
        const activate = (event: Event) => {
          event.stopPropagation();
          onSemanticTarget(token.target!);
        };
        const handleKeyDown = (event: KeyboardEvent) => {
          if (event.key !== 'Enter' && event.key !== ' ') return;
          event.preventDefault();
          activate(event);
        };
        element.addEventListener('click', activate, true);
        element.addEventListener('keydown', handleKeyDown);
        cleanups.push(() => {
          element.removeEventListener('click', activate, true);
          element.removeEventListener('keydown', handleKeyDown);
        });
      });
    });
    return () => cleanups.forEach((cleanup) => cleanup());
  }, [highlightedFormulaIndex, onSemanticTarget, semantic]);

  if (inline) {
    return <div className="interactive-inline-formula" ref={previewRef} role="math" aria-label={item.formula} dangerouslySetInnerHTML={{ __html: renderedHtml }} />;
  }

  return (
    <section className="formula-preview compact interactive-formula-preview" ref={previewRef} role="math" aria-label={item.formula}>
      {item.formula.trim() ? (
        <div className="formula-render-wrap">
          <div className="katex-custom-block" dangerouslySetInnerHTML={{ __html: renderedHtml }} />
        </div>
      ) : <span className="subtle-text">Formula preview</span>}
    </section>
  );
}

function RowUseCaseGroupChip({
  availableUseCases,
  entry,
  userGroupLabel,
  onToggleUseCase
}: {
  availableUseCases: { id: string; label: string; description?: string; userGroup?: string }[];
  entry: KpiUserGroupUseCase;
  userGroupLabel: string;
  onToggleUseCase: (useCase: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const controlRef = useCloseOnOutsideClick<HTMLDivElement>(open, () => setOpen(false));

  return (
    <div className="use-case-group-chip-control" ref={controlRef}>
      <button className="use-case-group-chip" type="button" onClick={() => setOpen((next) => !next)}>
        <span>{userGroupLabel}</span>
        <strong>{entry.useCases.length}</strong>
      </button>
      {open ? (
        <div className="cell-enum-popover use-case-chip-popover">
          <div className="popover-title">{userGroupLabel} use cases</div>
          {availableUseCases.length === 0 ? <span className="empty-option">No use cases defined.</span> : null}
          {availableUseCases.map((useCase) => (
            <label className="check-row" key={useCase.id}>
              <input
                type="checkbox"
                checked={entry.useCases.includes(useCase.id)}
                onChange={() => onToggleUseCase(useCase.id)}
              />
              <span>{useCase.label}</span>
            </label>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function RowUseCaseSelect({
  config,
  entries,
  onChange
}: {
  config: KpiPoolConfig;
  entries: KpiUserGroupUseCase[];
  onChange: (next: KpiUserGroupUseCase[]) => void;
}) {
  const [groupPickerOpen, setGroupPickerOpen] = useState(false);
  const groupPickerRef = useCloseOnOutsideClick<HTMLDivElement>(groupPickerOpen, () => setGroupPickerOpen(false));
  const selectedUserGroups = entries.map((entry) => entry.userGroup);

  const setUserGroups = (nextUserGroups: string[]) => {
    onChange(
      nextUserGroups.map((userGroup) => {
        const existing = entries.find((entry) => entry.userGroup === userGroup);
        return existing ?? { userGroup, useCases: [] };
      })
    );
  };

  const setUseCases = (userGroup: string, useCases: string[]) => {
    onChange(entries.map((entry) => (entry.userGroup === userGroup ? { ...entry, useCases } : entry)));
  };

  const toggleUserGroup = (userGroup: string) => {
    setUserGroups(
      selectedUserGroups.includes(userGroup)
        ? selectedUserGroups.filter((id) => id !== userGroup)
        : [...selectedUserGroups, userGroup]
    );
  };

  const toggleUseCase = (entry: KpiUserGroupUseCase, useCase: string) => {
    setUseCases(
      entry.userGroup,
      entry.useCases.includes(useCase) ? entry.useCases.filter((id) => id !== useCase) : [...entry.useCases, useCase]
    );
  };

  return (
    <div className="grouped-use-case-control">
      <div className="use-case-chip-list">
        {entries.map((entry) => {
          const userGroup = config.enums.userGroup.find((option) => option.id === entry.userGroup);
          const availableUseCases = config.enums.useCase.filter((option) => option.userGroup === entry.userGroup);
          return (
            <RowUseCaseGroupChip
              availableUseCases={availableUseCases}
              entry={entry}
              key={entry.userGroup}
              userGroupLabel={userGroup?.label ?? 'User group'}
              onToggleUseCase={(useCase) => toggleUseCase(entry, useCase)}
            />
          );
        })}
        <div className="use-case-group-picker-control" ref={groupPickerRef}>
          <button
            className="use-case-add-group-button"
            type="button"
            aria-label="Edit user groups for row"
            title="Edit user groups"
            onClick={() => setGroupPickerOpen((next) => !next)}
          >
            <Plus size={12} aria-hidden="true" />
          </button>
          {groupPickerOpen ? (
            <div className="cell-enum-popover use-case-group-picker-popover">
              <div className="popover-title">User groups</div>
              {config.enums.userGroup.length === 0 ? <span className="empty-option">No user groups defined.</span> : null}
              {config.enums.userGroup.map((userGroup) => (
                <label className="check-row" key={userGroup.id}>
                  <input
                    type="checkbox"
                    checked={selectedUserGroups.includes(userGroup.id)}
                    onChange={() => toggleUserGroup(userGroup.id)}
                  />
                  <span>{userGroup.label}</span>
                </label>
              ))}
            </div>
          ) : null}
        </div>
        {entries.length === 0 ? <span className="subtle-text use-case-empty">Select user groups.</span> : null}
      </div>
    </div>
  );
}

function RowPerformanceAreaSelect({
  config,
  kpi,
  filters,
  assignment,
  onChange
}: {
  config: KpiPoolConfig;
  kpi: KpiMetric;
  filters: ColumnFilters;
  assignment?: UseCaseAssignment;
  onChange: (next: KpiMetric) => void;
}) {
  const targetUseCases = targetPerformanceAreaUseCases(config, kpi, filters, assignment);
  const options = performanceAreaOptionsForUseCases(config, targetUseCases);
  const selected = dedupePerformanceAreaIdsByLabel(config, scopedPerformanceAreas(kpi, targetUseCases, !assignment));
  return (
    <RowEnumSelect
      config={config}
      category="performanceArea"
      selected={selected}
      options={options}
      onChange={(performanceAreas) => onChange(setPerformanceAreasForUseCases(config, kpi, targetUseCases, performanceAreas))}
    />
  );
}

function SpatialScaleMatrix({
  config,
  kpi,
  onChange,
  onSemanticTarget
}: {
  config: KpiPoolConfig;
  kpi: KpiMetric;
  onChange: (next: KpiMetric['spatialScales']) => void;
  onSemanticTarget: (target: FormulaSemanticTarget) => void;
}) {
  const normalFormulaItems = kpi.description.formulas.flatMap((group) => group.items);
  const updateScale = (scale: SpatialScaleKey, partial: Partial<KpiMetric['spatialScales'][SpatialScaleKey]>) =>
    onChange({
      ...kpi.spatialScales,
      [scale]: { ...kpi.spatialScales[scale], ...partial }
    });

  return (
    <section className="spatial-scale-formula-panel">
      <div className="spatial-scale-panel-heading">
        <strong>Spatial scale formulae</strong>
        <span>Define how the KPI is calculated at each applicable scale.</span>
      </div>
      {spatialScaleKeys.map((scale) => {
        const scaleValue = kpi.spatialScales[scale];
        const item = spatialScaleFormulaItem(scale, scaleValue);
        return (
          <section className={`spatial-scale-formula-card ${scaleValue.applicable ? 'is-applicable' : ''} ${scaleValue.applicable && !scaleValue.isBasicUnit ? 'has-formula' : ''}`} key={scale}>
            <div className="spatial-scale-card-heading">
              <strong>{spatialScaleLabels[scale]}</strong>
              <label className="spatial-scale-check">
                <input
                  type="checkbox"
                  checked={scaleValue.applicable}
                  onChange={(event) => updateScale(scale, {
                    applicable: event.target.checked,
                    isBasicUnit: event.target.checked ? scaleValue.isBasicUnit : false
                  })}
                />
                <span>Applicable</span>
              </label>
              <label className="spatial-scale-check">
                <input
                  type="checkbox"
                  checked={scaleValue.isBasicUnit}
                  disabled={!scaleValue.applicable}
                  onChange={(event) => updateScale(scale, event.target.checked
                    ? { isBasicUnit: true, formula: '', leftExpression: '', rightExpression: '' }
                    : { isBasicUnit: false })}
                />
                <span>Basic unit</span>
              </label>
            </div>
            {scaleValue.applicable && !scaleValue.isBasicUnit ? (
              <div className="spatial-scale-formula-body">
                <FormulaExpressionEditor
                  config={config}
                  kpi={kpi}
                  item={item}
                  priorItems={normalFormulaItems}
                  rightOnly
                  spatialScale={scale}
                  onChange={(partial) => updateScale(scale, {
                    formula: partial.formula ?? scaleValue.formula,
                    leftExpression: '',
                    rightExpression: partial.rightExpression ?? scaleValue.rightExpression
                  })}
                />
                <InteractiveFormulaPreview config={config} kpi={kpi} item={item} onSemanticTarget={onSemanticTarget} />
                <details className="formula-explanations spatial-scale-explanation">
                  <summary title="Show aggregation explanation"><Info size={13} aria-hidden="true" /><span>Aggregation explanation</span></summary>
                  <label className="field">
                    <span>Explanation</span>
                    <DebouncedTextarea
                      rows={2}
                      value={scaleValue.aggregationMethod}
                      placeholder="Explain the aggregation method, assumptions, or interpretation..."
                      onValueChange={(aggregationMethod) => updateScale(scale, { aggregationMethod })}
                    />
                  </label>
                </details>
              </div>
            ) : null}
          </section>
        );
      })}
    </section>
  );
}

function ExpandedKpiEditor({
  config,
  kpi,
  onChange,
  onEditLibrarySource,
  onSemanticTarget,
  transientHighlightedSource
}: {
  config: KpiPoolConfig;
  kpi: KpiMetric;
  onChange: (next: KpiMetric) => void;
  onEditLibrarySource: (target: SourceLibraryEditTarget) => void;
  onSemanticTarget: (target: FormulaSemanticTarget) => void;
  transientHighlightedSource?: FormulaSourceHighlight;
}) {
  const patch = (partial: Partial<KpiMetric>) => onChange({ ...kpi, ...partial });
  const [formulaDrag, setFormulaDrag] = useState<{ groupIndex: number; itemIndex: number } | null>(null);
  const [formulaDragOver, setFormulaDragOver] = useState<{
    groupIndex: number;
    itemIndex: number;
    position: DropPosition;
  } | null>(null);
  const [formulaGroupDrag, setFormulaGroupDrag] = useState<number | null>(null);
  const [formulaGroupDragOver, setFormulaGroupDragOver] = useState<{ groupIndex: number; position: DropPosition } | null>(null);
  const [collapsedFormulaGroupIndexes, setCollapsedFormulaGroupIndexes] = useState<number[]>([]);
  const [activeExpandedPanel, setActiveExpandedPanel] = useState<'formulae' | 'sources' | 'scales'>('formulae');
  const handleSemanticTarget = useCallback((target: FormulaSemanticTarget) => {
    if (target.kind === 'source') setActiveExpandedPanel('sources');
    onSemanticTarget(target);
  }, [onSemanticTarget]);
  const updateFormulaGroups = (updater: (groups: KpiFormulaGroup[]) => KpiFormulaGroup[]) => {
    patch({
      description: {
        ...kpi.description,
        formulas: updater(kpi.description.formulas)
      }
    });
  };

  const updateFormulaGroup = (groupIndex: number, partial: Partial<KpiFormulaGroup>) => {
    updateFormulaGroups((groups) => groups.map((group, index) => (index === groupIndex ? { ...group, ...partial } : group)));
  };

  const updateFormulaItem = (groupIndex: number, itemIndex: number, partial: Partial<KpiFormulaItem>) => {
    updateFormulaGroups((groups) =>
      groups.map((group, index) =>
        index === groupIndex
          ? {
              ...group,
              items: group.items.map((item, formulaIndex) => (formulaIndex === itemIndex ? { ...item, ...partial } : item))
            }
          : group
      )
    );
  };

  const addFormulaGroup = (insertionIndex = kpi.description.formulas.length) => {
    updateFormulaGroups((groups) => {
      const index = Math.max(0, Math.min(insertionIndex, groups.length));
      setCollapsedFormulaGroupIndexes((current) => current.map((collapsedIndex) =>
        collapsedIndex >= index ? collapsedIndex + 1 : collapsedIndex
      ));
      return [...groups.slice(0, index), createBlankFormulaGroup(groups.length), ...groups.slice(index)];
    });
  };

  const deleteFormulaGroup = (groupIndex: number) => {
    setCollapsedFormulaGroupIndexes((current) => current
      .filter((collapsedIndex) => collapsedIndex !== groupIndex)
      .map((collapsedIndex) => collapsedIndex > groupIndex ? collapsedIndex - 1 : collapsedIndex));
    updateFormulaGroups((groups) => groups.filter((_, index) => index !== groupIndex));
  };

  const moveFormulaGroup = (sourceIndex: number, targetIndex: number, position: DropPosition) => {
    updateFormulaGroups((groups) => {
      if (sourceIndex === targetIndex || !groups[sourceIndex] || !groups[targetIndex]) {
        return groups;
      }

      const nextGroups = [...groups];
      const [moved] = nextGroups.splice(sourceIndex, 1);
      let insertionIndex = targetIndex + (position === 'after' ? 1 : 0);
      if (sourceIndex < insertionIndex) {
        insertionIndex -= 1;
      }
      insertionIndex = Math.max(0, Math.min(insertionIndex, nextGroups.length));
      nextGroups.splice(insertionIndex, 0, moved);
      setCollapsedFormulaGroupIndexes((current) => {
        const originalIndexes = groups.map((_, index) => index);
        const [movedOriginalIndex] = originalIndexes.splice(sourceIndex, 1);
        originalIndexes.splice(insertionIndex, 0, movedOriginalIndex);
        return originalIndexes.flatMap((originalIndex, index) => current.includes(originalIndex) ? [index] : []);
      });
      return nextGroups;
    });
  };

  const addFormulaItem = (groupIndex: number, insertionIndex?: number) => {
    updateFormulaGroups((groups) =>
      groups.map((group, index) => {
        if (index !== groupIndex) return group;
        const targetIndex = Math.max(0, Math.min(insertionIndex ?? group.items.length, group.items.length));
        return {
          ...group,
          items: [...group.items.slice(0, targetIndex), createBlankFormulaItem(group.items.length), ...group.items.slice(targetIndex)]
        };
      })
    );
  };

  const deleteFormulaItem = (groupIndex: number, itemIndex: number) => {
    updateFormulaGroups((groups) =>
      groups.map((group, index) =>
        index === groupIndex ? { ...group, items: group.items.filter((_, formulaIndex) => formulaIndex !== itemIndex) } : group
      )
    );
  };

  const updateFormulaTerm = (
    groupIndex: number,
    itemIndex: number,
    termIndex: number,
    partial: Partial<KpiFormulaTerm>
  ) => {
    updateFormulaGroups((groups) =>
      groups.map((group, index) =>
        index === groupIndex
          ? {
              ...group,
              items: group.items.map((item, formulaIndex) =>
                formulaIndex === itemIndex
                  ? {
                      ...item,
                      terms: item.terms.map((term, currentTermIndex) =>
                        currentTermIndex === termIndex ? { ...term, ...partial } : term
                      )
                    }
                  : item
              )
            }
          : group
      )
    );
  };

  const addFormulaTerm = (groupIndex: number, itemIndex: number) => {
    updateFormulaItem(groupIndex, itemIndex, {
      terms: [...kpi.description.formulas[groupIndex].items[itemIndex].terms, createBlankFormulaTerm()]
    });
  };

  const deleteFormulaTerm = (groupIndex: number, itemIndex: number, termIndex: number) => {
    updateFormulaItem(groupIndex, itemIndex, {
      terms: kpi.description.formulas[groupIndex].items[itemIndex].terms.filter((_, index) => index !== termIndex)
    });
  };

  const moveFormulaItem = (
    source: { groupIndex: number; itemIndex: number },
    target: { groupIndex: number; itemIndex: number; position: DropPosition }
  ) => {
    updateFormulaGroups((groups) => {
      const nextGroups = groups.map((group) => ({ ...group, items: [...group.items] }));
      const sourceGroup = nextGroups[source.groupIndex];
      const targetGroup = nextGroups[target.groupIndex];
      if (!sourceGroup || !targetGroup || !sourceGroup.items[source.itemIndex]) {
        return groups;
      }

      const [moved] = sourceGroup.items.splice(source.itemIndex, 1);
      let insertionIndex = target.itemIndex + (target.position === 'after' ? 1 : 0);
      if (source.groupIndex === target.groupIndex && source.itemIndex < insertionIndex) {
        insertionIndex -= 1;
      }
      insertionIndex = Math.max(0, Math.min(insertionIndex, targetGroup.items.length));
      targetGroup.items.splice(insertionIndex, 0, moved);
      return nextGroups;
    });
  };

  const dropFormulaItem = (groupIndex: number, itemIndex: number, position: DropPosition) => {
    if (formulaDrag) {
      moveFormulaItem(formulaDrag, { groupIndex, itemIndex, position });
    }
    setFormulaDrag(null);
    setFormulaDragOver(null);
  };

  const dropFormulaGroup = (groupIndex: number, position: DropPosition) => {
    if (formulaGroupDrag !== null) {
      moveFormulaGroup(formulaGroupDrag, groupIndex, position);
    }
    setFormulaGroupDrag(null);
    setFormulaGroupDragOver(null);
  };
  const allFormulaItems = kpi.description.formulas.flatMap((group) => group.items);
  const hasFormula = allFormulaItems.some((item) => item.formula.trim());

  return (
    <div className="expanded-editor">
      <div className="expanded-editor-tabs" role="tablist" aria-label="Expanded KPI editor sections">
        <button
          className={activeExpandedPanel === 'formulae' ? 'is-active' : ''}
          type="button"
          role="tab"
          aria-selected={activeExpandedPanel === 'formulae'}
          aria-controls={`formulae-panel-${kpi.id}`}
          onClick={() => setActiveExpandedPanel('formulae')}
        >
          Formulae
        </button>
        <button
          className={activeExpandedPanel === 'sources' ? 'is-active' : ''}
          type="button"
          role="tab"
          aria-selected={activeExpandedPanel === 'sources'}
          aria-controls={`sources-panel-${kpi.id}`}
          onClick={() => setActiveExpandedPanel('sources')}
        >
          Sources
        </button>
        <button
          className={activeExpandedPanel === 'scales' ? 'is-active' : ''}
          type="button"
          role="tab"
          aria-selected={activeExpandedPanel === 'scales'}
          aria-controls={`scales-panel-${kpi.id}`}
          onClick={() => setActiveExpandedPanel('scales')}
        >
          Spatial Scales
        </button>
      </div>
      <section className="expanded-section wide formulae-expanded-column">
        <label className="field expanded-independent expanded-overview">
          <span>Full overview</span>
          <DebouncedTextarea
            rows={2}
            value={kpi.description.overview}
            onValueChange={(overview) =>
              patch({
                description: {
                  ...kpi.description,
                  overview
                }
              })
            }
          />
        </label>
        <section
          className={`formula-items-panel expanded-tab-panel formulae-tab-panel ${activeExpandedPanel === 'formulae' ? 'is-active' : 'is-inactive'}`}
          id={`formulae-panel-${kpi.id}`}
          role="tabpanel"
        >
          <div className="formula-items-heading">
            <span>Formula groups</span>
          </div>
          {!hasFormula ? (
            <label className="field formula-comment-field">
              <span>Comment when no formula is required</span>
              <DebouncedTextarea
                rows={2}
                value={kpi.description.formulaComment}
                placeholder="Direct from source, reported value, analyst input…"
                onValueChange={(formulaComment) => patch({
                  description: { ...kpi.description, formulaComment }
                })}
              />
            </label>
          ) : null}
          {kpi.description.formulas.length === 0 ? <span className="subtle-text">No formula groups.</span> : null}
          {kpi.description.formulas.flatMap((group, groupIndex) => {
            const isFormulaGroupExpanded = !collapsedFormulaGroupIndexes.includes(groupIndex);
            const formulaGroupContentId = `formula-group-content-${kpi.id}-${groupIndex}`;
            return [
            <button className="list-insert-divider formula-group-insert-divider" type="button" key={`insert-formula-group-${groupIndex}`} onClick={() => addFormulaGroup(groupIndex)}><Plus size={11} aria-hidden="true" />Add group here</button>,
            <section
              className={`formula-group-editor ${isFormulaGroupExpanded ? '' : 'is-collapsed'} ${
                formulaGroupDragOver?.groupIndex === groupIndex && formulaGroupDragOver.position === 'before'
                  ? 'drag-over-before'
                  : ''
              } ${
                formulaGroupDragOver?.groupIndex === groupIndex && formulaGroupDragOver.position === 'after'
                  ? 'drag-over-after'
                  : ''
              }`}
              key={`formula-group-${groupIndex}`}
              onDragOver={(event) => {
                event.preventDefault();
                if (formulaGroupDrag !== null) {
                  const rect = event.currentTarget.getBoundingClientRect();
                  const position: DropPosition = event.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
                  setFormulaGroupDragOver({ groupIndex, position });
                  return;
                }
                setFormulaDragOver({ groupIndex, itemIndex: group.items.length, position: 'before' });
              }}
              onDrop={(event) => {
                event.preventDefault();
                if (formulaGroupDrag !== null) {
                  const rect = event.currentTarget.getBoundingClientRect();
                  const position: DropPosition = event.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
                  dropFormulaGroup(groupIndex, position);
                  return;
                }
                dropFormulaItem(groupIndex, group.items.length, 'before');
              }}
            >
              <div className="formula-group-header">
                <button
                  className="mini-icon-button formula-group-collapse-button"
                  type="button"
                  aria-expanded={isFormulaGroupExpanded}
                  aria-controls={formulaGroupContentId}
                  aria-label={`${isFormulaGroupExpanded ? 'Collapse' : 'Expand'} formula group ${groupIndex + 1}`}
                  title={`${isFormulaGroupExpanded ? 'Collapse' : 'Expand'} formula group`}
                  onClick={() => setCollapsedFormulaGroupIndexes((current) => current.includes(groupIndex)
                    ? current.filter((index) => index !== groupIndex)
                    : [...current, groupIndex])}
                >
                  <ChevronDown size={13} aria-hidden="true" className={isFormulaGroupExpanded ? 'rotate' : ''} />
                </button>
                <button
                  className="mini-icon-button drag-handle formula-group-drag-handle"
                  type="button"
                  aria-label={`Drag formula group ${groupIndex + 1}`}
                  title="Drag formula group"
                  draggable
                  onDragStart={(event) => {
                    setFormulaGroupDrag(groupIndex);
                    setFormulaGroupDragOver({ groupIndex, position: 'before' });
                    event.dataTransfer.effectAllowed = 'move';
                    event.dataTransfer.setData('text/plain', `group:${groupIndex}`);
                  }}
                  onDragEnd={() => {
                    setFormulaGroupDrag(null);
                    setFormulaGroupDragOver(null);
                  }}
                >
                  <GripVertical size={13} aria-hidden="true" />
                </button>
                <label className="formula-group-name-field">
                  <DebouncedInput
                    className={group.name.trim() ? '' : 'is-empty'}
                    value={group.name}
                    placeholder="Optional group name"
                    aria-label={`Formula group ${groupIndex + 1} name`}
                    onValueChange={(name) => updateFormulaGroup(groupIndex, { name })}
                  />
                </label>
                <button
                  className="mini-icon-button danger"
                  type="button"
                  aria-label={`Delete formula group ${groupIndex + 1}`}
                  title="Delete formula group"
                  onClick={() => deleteFormulaGroup(groupIndex)}
                >
                  <Trash2 size={13} aria-hidden="true" />
                </button>
              </div>
              <div className="formula-group-content" id={formulaGroupContentId} hidden={!isFormulaGroupExpanded}>
              {group.items.length === 0 ? <span className="subtle-text">No formulae in this group.</span> : null}
              {group.items.map((item, itemIndex) => {
                const currentFormulaIndex = kpi.description.formulas
                  .slice(0, groupIndex)
                  .reduce((sum, entry) => sum + entry.items.length, 0) + itemIndex;
                const isDragBefore =
                  formulaDragOver?.groupIndex === groupIndex &&
                  formulaDragOver.itemIndex === itemIndex &&
                  formulaDragOver.position === 'before';
                const isDragAfter =
                  formulaDragOver?.groupIndex === groupIndex &&
                  formulaDragOver.itemIndex === itemIndex &&
                  formulaDragOver.position === 'after';
                return [
                  <button className="list-insert-divider formula-item-insert-divider" type="button" key={`insert-formula-${groupIndex}-${itemIndex}`} onClick={() => addFormulaItem(groupIndex, itemIndex)}><Plus size={11} aria-hidden="true" />Add formula here</button>,
                  <section
                    className={`formula-item-editor ${isDragBefore ? 'drag-over-before' : ''} ${
                      isDragAfter ? 'drag-over-after' : ''
                    }`}
                    key={`formula-item-${groupIndex}-${itemIndex}`}
                    onDragOver={(event) => {
                      if (formulaGroupDrag !== null) {
                        return;
                      }
                      event.preventDefault();
                      event.stopPropagation();
                      const rect = event.currentTarget.getBoundingClientRect();
                      const position: DropPosition = event.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
                      setFormulaDragOver({ groupIndex, itemIndex, position });
                    }}
                    onDrop={(event) => {
                      if (formulaGroupDrag !== null) {
                        return;
                      }
                      event.preventDefault();
                      event.stopPropagation();
                      const rect = event.currentTarget.getBoundingClientRect();
                      const position: DropPosition = event.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
                      dropFormulaItem(groupIndex, itemIndex, position);
                    }}
                  >
                    <div className="formula-item-main-row">
                      <button
                        className="mini-icon-button drag-handle formula-drag-handle"
                        type="button"
                        aria-label={`Drag formula ${itemIndex + 1}`}
                        title="Drag formula"
                        draggable
                        onDragStart={(event) => {
                          setFormulaDrag({ groupIndex, itemIndex });
                          event.dataTransfer.effectAllowed = 'move';
                          event.dataTransfer.setData('text/plain', `${groupIndex}:${itemIndex}`);
                        }}
                        onDragEnd={() => {
                          setFormulaDrag(null);
                          setFormulaDragOver(null);
                        }}
                      >
                        <GripVertical size={13} aria-hidden="true" />
                      </button>
                      <label className="field formula-tag-field">
                        <DebouncedInput
                          value={item.tag}
                          placeholder={`Formula ${itemIndex + 1}`}
                          aria-label={`Formula ${itemIndex + 1} tag`}
                          onValueChange={(tag) => updateFormulaItem(groupIndex, itemIndex, { tag })}
                        />
                      </label>
                      <FormulaExpressionEditor
                        config={config}
                        kpi={kpi}
                        item={item}
                        priorItems={allFormulaItems.slice(0, currentFormulaIndex)}
                        onChange={(partial) => updateFormulaItem(groupIndex, itemIndex, partial)}
                      />
                      <InteractiveFormulaPreview
                        config={config}
                        kpi={kpi}
                        item={item}
                        onSemanticTarget={handleSemanticTarget}
                      />
                      <button
                        className="mini-icon-button danger"
                        type="button"
                        aria-label={`Delete formula item ${itemIndex + 1}`}
                        title="Delete formula item"
                        onClick={() => deleteFormulaItem(groupIndex, itemIndex)}
                      >
                        <Trash2 size={13} aria-hidden="true" />
                      </button>
                    </div>
                    <details className="formula-explanations">
                      <summary title="Show optional explanations"><Info size={13} aria-hidden="true" /><span>Optional explanations</span></summary>
                      <div className="formula-explanation-row">
                        <label className="field general-explanation-field">
                          <span>General Explanation</span>
                          <DebouncedTextarea rows={2} value={item.generalExplanation} placeholder="Overall meaning or interpretation..." onValueChange={(generalExplanation) => updateFormulaItem(groupIndex, itemIndex, { generalExplanation })} />
                        </label>
                        <section className="term-explanation-panel">
                          <div className="formula-preview-title">Term-wise Explanation</div>
                        {item.terms.map((term, termIndex) => (
                          <div className="term-explanation-row" key={`formula-term-${groupIndex}-${itemIndex}-${termIndex}`}>
                            <DebouncedInput
                              className="latex-code-editor"
                              value={term.term}
                              placeholder="x_i"
                              aria-label={`Term ${termIndex + 1} LaTeX`}
                              onValueChange={(termValue) => updateFormulaTerm(groupIndex, itemIndex, termIndex, { term: termValue })}
                            />
                            <span className="term-preview">
                              {term.term.trim() ? <InlineMath math={term.term} errorColor="#b42318" /> : <span className="muted-dash">Term</span>}
                            </span>
                            <DebouncedInput
                              value={term.explanation}
                              placeholder="Meaning..."
                              aria-label={`Term ${termIndex + 1} explanation`}
                              onValueChange={(explanation) =>
                                updateFormulaTerm(groupIndex, itemIndex, termIndex, { explanation })
                              }
                            />
                            <button
                              className="mini-icon-button danger"
                              type="button"
                              aria-label={`Delete term ${termIndex + 1}`}
                              title="Delete term"
                              onClick={() => deleteFormulaTerm(groupIndex, itemIndex, termIndex)}
                            >
                              <Trash2 size={12} aria-hidden="true" />
                            </button>
                          </div>
                        ))}
                          <button className="secondary-action tiny formula-add-button" type="button" onClick={() => addFormulaTerm(groupIndex, itemIndex)}><Plus size={12} aria-hidden="true" />Add term</button>
                        </section>
                      </div>
                    </details>
                  </section>
                ];
              })}
              <button className="secondary-action tiny formula-add-button" type="button" onClick={() => addFormulaItem(groupIndex)}>
                <Plus size={12} aria-hidden="true" />
                Add formula
              </button>
              </div>
            </section>
            ];
          })}
          <button className="secondary-action tiny formula-add-button" type="button" onClick={() => addFormulaGroup()}>
            <Plus size={12} aria-hidden="true" />
            Add group
          </button>
        </section>
      </section>

      <section className="expanded-section source-and-scale-section scales-expanded-column">
        <div
          className={`field expanded-sources expanded-tab-panel sources-tab-panel ${activeExpandedPanel === 'sources' ? 'is-active' : 'is-inactive'}`}
          id={`sources-panel-${kpi.id}`}
          role="tabpanel"
        >
          <span>Sources</span>
          <KpiSourceEditor config={config} kpi={kpi} transientHighlightedSource={transientHighlightedSource} onEditLibrarySource={onEditLibrarySource} onChange={(sources, formulaUpdates) => patch({ sources, ...(formulaUpdates ?? {}) })} />
        </div>
        <div
          className={`expanded-tab-panel spatial-scales-tab-panel ${activeExpandedPanel === 'scales' ? 'is-active' : 'is-inactive'}`}
          id={`scales-panel-${kpi.id}`}
          role="tabpanel"
        >
          <SpatialScaleMatrix config={config} kpi={kpi} onSemanticTarget={handleSemanticTarget} onChange={(spatialScales) => patch({ spatialScales })} />
        </div>
      </section>
    </div>
  );
}

function KpiDimensionControl({
  config,
  kpi,
  open,
  onOpenChange,
  onViewDomain,
  onChange
}: {
  config: KpiPoolConfig;
  kpi: KpiMetric;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onViewDomain: (domainId: string) => void;
  onChange: (dimensions: DataSourceFieldDimension[]) => void;
}) {
  const [domainPickerOpen, setDomainPickerOpen] = useState(false);
  const [domainPickerPosition, setDomainPickerPosition] = useState<{ top?: number; bottom?: number; left: number; width: number; maxHeight: number }>();
  const domainPickerButtonRef = useRef<HTMLButtonElement | null>(null);
  const domainPickerRef = useRef<HTMLDivElement | null>(null);
  const controlRef = useCloseOnOutsideClick<HTMLDivElement>(open, () => onOpenChange(false), domainPickerRef);
  const popoverId = `kpi-dimension-popover-${kpi.id}`;
  useEffect(() => {
    if (!open) setDomainPickerOpen(false);
  }, [open]);
  useLayoutEffect(() => {
    if (!domainPickerOpen) {
      setDomainPickerPosition(undefined);
      return undefined;
    }
    const updatePosition = () => {
      const anchor = domainPickerButtonRef.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      const width = Math.min(310, window.innerWidth - 24);
      const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12));
      const spaceBelow = window.innerHeight - rect.bottom - 8;
      const spaceAbove = rect.top - 8;
      const opensAbove = spaceBelow < 180 && spaceAbove > spaceBelow;
      const availableHeight = Math.max(100, (opensAbove ? spaceAbove : spaceBelow) - 4);
      const maxHeight = Math.min(260, availableHeight);
      setDomainPickerPosition(opensAbove
        ? { bottom: window.innerHeight - rect.top + 4, left, width, maxHeight }
        : { top: rect.bottom + 4, left, width, maxHeight });
    };
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [domainPickerOpen]);
  const addDimension = () => {
    const existingNames = new Set(kpi.dimensions.map((dimension) => dimension.name.trim().toLocaleLowerCase()));
    let name = 'New dimension';
    let suffix = 2;
    while (existingNames.has(name.toLocaleLowerCase())) {
      name = `New dimension ${suffix}`;
      suffix += 1;
    }
    onChange([...kpi.dimensions, { id: createLocalId('kpi-dimension'), name, options: [] }]);
  };
  const addEnumDimension = (enumId: string) => {
    const definition = config.valueEnums.find((entry) => entry.id === enumId);
    if (!definition || kpi.dimensions.some((dimension) => dimension.enumId === enumId)) return;
    onChange([...kpi.dimensions, {
      id: createLocalId('kpi-dimension'),
      name: definition.name,
      options: [...definition.options],
      enumId: definition.id
    }]);
    setDomainPickerOpen(false);
  };
  const updateDimension = (id: string, partial: Partial<DataSourceFieldDimension>) => {
    onChange(kpi.dimensions.map((dimension) => dimension.id === id ? { ...dimension, ...partial } : dimension));
  };
  const removeDimension = (id: string) => {
    onChange(kpi.dimensions.filter((dimension) => dimension.id !== id));
  };

  return (
    <div className="kpi-dimension-control" ref={controlRef}>
      <button
        className={`mini-icon-button kpi-dimension-trigger ${kpi.dimensions.length ? 'is-active' : ''}`}
        type="button"
        aria-label={`Manage dimensions for ${kpi.name}`}
        aria-controls={popoverId}
        aria-expanded={open}
        title="Manage KPI dimensions"
        onClick={() => onOpenChange(!open)}
      >
        <Settings2 size={13} aria-hidden="true" />
        {kpi.dimensions.length ? <span>{kpi.dimensions.length}</span> : null}
      </button>
      {open ? (
        <div className="kpi-dimension-popover" id={popoverId} role="dialog" aria-label={`Dimensions for ${kpi.name}`}>
          <div className="popover-title">Dimensions</div>
          <div className="kpi-dimension-list">
            {kpi.dimensions.length === 0 ? <span className="empty-option">This KPI has no dimensions.</span> : null}
            {kpi.dimensions.map((dimension) => (
              <section className={`kpi-dimension-row ${dimension.enumId ? 'is-global' : 'is-custom'}`} key={dimension.id}>
                <div className="kpi-dimension-heading">
                  {dimension.enumId ? <div className="global-domain-definition">
                    <small>Global domain</small>
                    <strong>{dimension.name || 'Untitled domain'}</strong>
                    <span>{dimension.options.length ? dimension.options.join(', ') : 'No options defined'}</span>
                    <ViewDomainButton domainId={dimension.enumId} domainName={dimension.name} onView={onViewDomain} />
                  </div> : <DebouncedInput
                    value={dimension.name}
                    aria-label="Dimension name"
                    placeholder="Dimension name"
                    onValueChange={(name) => updateDimension(dimension.id, { name })}
                  />}
                  <button className="mini-icon-button danger" type="button" title="Delete dimension" aria-label={`Delete ${dimension.name || 'dimension'}`} onClick={() => removeDimension(dimension.id)}><Trash2 size={12} /></button>
                </div>
                {!dimension.enumId ? <div className="kpi-dimension-options">
                  <EnumOptionEditor
                    options={dimension.options}
                    label={`${dimension.name || 'dimension'} dimension`}
                    onChange={(options) => updateDimension(dimension.id, { options })}
                  />
                </div> : null}
              </section>
            ))}
          </div>
          <div className="dimension-add-actions kpi-dimension-add-actions">
            <button className="primary-action tiny" type="button" onClick={() => { setDomainPickerOpen(false); addDimension(); }}><Plus size={11} /> Add custom dimension</button>
            <div className="global-domain-add-control global-domain-dropdown-wrapper">
              <button ref={domainPickerButtonRef} className="secondary-action tiny" type="button" disabled={config.valueEnums.length === 0} aria-expanded={domainPickerOpen} onClick={() => setDomainPickerOpen((current) => !current)}><Plus size={11} /> Add global domain</button>
              {domainPickerOpen && domainPickerPosition ? createPortal(<div
                className="global-domain-picker is-floating"
                ref={domainPickerRef}
                role="menu"
                style={domainPickerPosition}
              >
                <GroupedDomainPickerOptions
                  definitions={config.valueEnums.filter((definition) => !kpi.dimensions.some((dimension) => dimension.enumId === definition.id))}
                  groups={config.valueEnumGroups}
                  onSelect={addEnumDimension}
                />
                {config.valueEnums.every((definition) => kpi.dimensions.some((dimension) => dimension.enumId === definition.id)) ? <span className="empty-option">All global domains are already used.</span> : null}
              </div>, document.body) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function KpiRow({
  config,
  kpi,
  filters,
  expanded,
  compactRowRef,
  expandedRowRef,
  dragPosition,
  visibleEnumCategories,
  tableColumnCount,
  tableViewportWidth,
  useCaseAssignment,
  sortingActive,
  onExpand,
  onChange,
  onDelete,
  onDuplicate,
  onDragHandleMouseDown,
  onInsertBefore,
  onEditLibrarySource
}: {
  config: KpiPoolConfig;
  kpi: KpiMetric;
  filters: ColumnFilters;
  expanded: boolean;
  compactRowRef?: (node: HTMLTableRowElement | null) => void;
  expandedRowRef?: (node: HTMLTableRowElement | null) => void;
  dragPosition?: DropPosition;
  visibleEnumCategories: KpiEnumCategoryKey[];
  tableColumnCount: number;
  tableViewportWidth: number;
  useCaseAssignment?: UseCaseAssignment;
  sortingActive: boolean;
  onExpand: (id: string) => void;
  onChange: (next: KpiMetric) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDragHandleMouseDown: (id: string, event: React.MouseEvent<HTMLButtonElement>) => void;
  onInsertBefore: (id: string) => void;
  onEditLibrarySource: (target: SourceLibraryEditTarget) => void;
}) {
  const patch = (partial: Partial<KpiMetric>) => onChange({ ...kpi, ...partial });
  const stopRowToggle = (event: React.SyntheticEvent) => event.stopPropagation();
  const [dimensionControlOpen, setDimensionControlOpen] = useState(false);
  const [semanticHighlight, setSemanticHighlight] = useState<{ target: FormulaSemanticTarget; requestId: number }>();
  const highlightSemanticTarget = useCallback((target: FormulaSemanticTarget) => {
    setSemanticHighlight((current) => ({ target, requestId: (current?.requestId ?? 0) + 1 }));
  }, []);
  useEffect(() => {
    if (!semanticHighlight) return undefined;
    const requestId = semanticHighlight.requestId;
    const timeout = window.setTimeout(() => {
      setSemanticHighlight((current) => current?.requestId === requestId ? undefined : current);
    }, transientSourceHighlightDurationMs);
    return () => window.clearTimeout(timeout);
  }, [semanticHighlight?.requestId]);
  const highlightedSource = semanticHighlight?.target.kind === 'source'
    ? { sourceId: semanticHighlight.target.sourceId, requestId: semanticHighlight.requestId }
    : undefined;
  const highlightedFormulaIndex = semanticHighlight?.target.kind === 'formula' ? semanticHighlight.target.formulaIndex : undefined;
  const isUseCaseAssigned = hasUseCaseAssignment(kpi, useCaseAssignment);
  const focusedNote = useCaseNote(kpi, useCaseAssignment);
  const toggleUseCaseAssignment = () => {
    if (!useCaseAssignment) {
      return;
    }

    onChange(setUseCaseAssignment(kpi, useCaseAssignment, !isUseCaseAssigned));
  };
  const rowClass = [
    expanded ? 'selected-row compact-row' : 'compact-row',
    dragPosition === 'before' ? 'drag-over-before' : '',
    dragPosition === 'after' ? 'drag-over-after' : '',
    useCaseAssignment && isUseCaseAssigned ? 'use-case-assigned-row' : ''
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <>
      <tr
        className={rowClass}
        data-kpi-id={kpi.id}
        ref={compactRowRef}
        onClick={(event) => {
          if (isRowBackgroundClick(event)) onExpand(kpi.id);
        }}
      >
        <td>
          <div className="name-description-cell">
            <div className="name-cell">
              <button className="kpi-insert-before" type="button" title="Insert KPI here" aria-label={`Insert KPI before ${kpi.name}`} onClick={(event) => { event.stopPropagation(); onInsertBefore(kpi.id); }}><Plus size={11} aria-hidden="true" /><span>Add KPI</span></button>
              <button
                className="expand-button"
                type="button"
                aria-label={expanded ? 'Collapse row' : 'Expand row'}
                onClick={(event) => {
                  event.stopPropagation();
                  onExpand(kpi.id);
                }}
              >
                <ChevronDown size={14} aria-hidden="true" className={expanded ? 'rotate' : ''} />
              </button>
              <div className="kpi-name-main">
                <AutoGrowTextarea
                  className="inline-textarea strong-input"
                  rows={1}
                  value={kpi.name}
                  aria-label={`${kpi.name} name`}
                  preventLineBreaks
                  onClick={stopRowToggle}
                  onValueChange={(name) => patch({ name })}
                />
                {kpi.dimensions.length ? (
                  <span className="kpi-dimension-line" title={kpi.dimensions.map((dimension) => `${dimension.name}: ${dimension.options.length ? dimension.options.join(', ') : 'no options'}`).join('\n')}>
                    <span className="kpi-dimension-by">by</span>
                    <button
                      className="kpi-dimension-summary"
                      type="button"
                      aria-label={`Manage dimensions for ${kpi.name}`}
                      aria-controls={`kpi-dimension-popover-${kpi.id}`}
                      aria-expanded={dimensionControlOpen}
                      onClick={(event) => {
                        event.stopPropagation();
                        setDimensionControlOpen(true);
                      }}
                    >
                      {kpi.dimensions.map((dimension) => <span key={dimension.id}>{dimension.name || 'Untitled'}{dimension.options.length ? ` (${dimension.options.length})` : ''}</span>)}
                    </button>
                  </span>
                ) : null}
              </div>
              <KpiDimensionControl
                config={config}
                kpi={kpi}
                open={dimensionControlOpen}
                onOpenChange={setDimensionControlOpen}
                onViewDomain={(domainId) => onEditLibrarySource({ kind: 'domain', domainId })}
                onChange={(dimensions) => patch({ dimensions })}
              />
            </div>
            <AutoGrowTextarea
              className="inline-textarea description-input"
              rows={2}
              value={kpi.description.overview}
              placeholder="Overview"
              aria-label={`${kpi.name} description`}
              onClick={stopRowToggle}
              onValueChange={(overview) =>
                patch({
                  description: {
                    ...kpi.description,
                    overview
                  }
                })
              }
            />
          </div>
        </td>
        <td>
          <KpiSourceEditor config={config} kpi={kpi} compact transientHighlightedSource={highlightedSource} onEditLibrarySource={onEditLibrarySource} onChange={(sources, formulaUpdates) => patch({ sources, ...(formulaUpdates ?? {}) })} />
        </td>
        <td>
          <FormulaDisplay config={config} kpi={kpi} highlightedFormulaIndex={highlightedFormulaIndex} onSemanticTarget={highlightSemanticTarget} />
        </td>
        <td>
          <SpatialScaleBadges config={config} kpi={kpi} onSemanticTarget={highlightSemanticTarget} />
        </td>
        {visibleEnumCategories.map((category) => (
          <td key={category}>
            <RowEnumSelect
              config={config}
              category={category}
              selected={kpi[category]}
              onChange={(next) => patch({ [category]: next } as Partial<KpiMetric>)}
            />
          </td>
        ))}
        <td>
          <RowPerformanceAreaSelect
            config={config}
            kpi={kpi}
            filters={filters}
            assignment={useCaseAssignment}
            onChange={onChange}
          />
        </td>
        <td>
          {useCaseAssignment ? (
            <div className="focused-use-case-cell">
              <div className="use-case-assignment-control">
                <span className={`assignment-state ${isUseCaseAssigned ? 'is-assigned' : 'is-unassigned'}`}>
                  {isUseCaseAssigned ? 'Included' : 'Not Included'}
                </span>
                <button
                  className={`assignment-action ${isUseCaseAssigned ? 'remove' : 'add'}`}
                  type="button"
                  aria-label={isUseCaseAssigned ? 'Exclude from focused use case' : 'Include in focused use case'}
                  title={isUseCaseAssigned ? 'Exclude from focused use case' : 'Include in focused use case'}
                  onClick={toggleUseCaseAssignment}
                >
                  {isUseCaseAssigned ? <X size={14} aria-hidden="true" /> : <Plus size={14} aria-hidden="true" />}
                </button>
              </div>
              <AutoGrowTextarea
                className="inline-textarea use-case-note-textarea"
                rows={2}
                value={focusedNote}
                placeholder="Notes for this use case..."
                aria-label={`${kpi.name} notes for focused use case`}
                onValueChange={(note) => onChange(setUseCaseNote(kpi, useCaseAssignment, note))}
              />
            </div>
          ) : (
            <RowUseCaseSelect
              config={config}
              entries={kpi.userGroupUseCases}
              onChange={(userGroupUseCases) => {
                patch({
                  userGroupUseCases
                });
              }}
            />
          )}
        </td>
        <td>
          <div className="timestamp-actions-cell">
            <time className="last-modified" dateTime={kpi.lastModified} title={kpi.lastModified}>
              {formatLastModified(kpi.lastModified)}
            </time>
            <div className="row-actions" onClick={stopRowToggle}>
              <button
                className="mini-icon-button drag-handle"
                type="button"
                aria-label={`Drag ${kpi.name} to reorder`}
                title={sortingActive ? 'Clear sort to reorder' : 'Drag to reorder'}
                disabled={sortingActive}
                onMouseDown={(event) => onDragHandleMouseDown(kpi.id, event)}
              >
                <GripVertical size={14} aria-hidden="true" />
              </button>
              <button
                className="mini-icon-button"
                type="button"
                aria-label={`Duplicate ${kpi.name}`}
                title="Duplicate KPI"
                onClick={() => onDuplicate(kpi.id)}
              >
                <Copy size={13} aria-hidden="true" />
              </button>
              <button
                className="mini-icon-button danger"
                type="button"
                aria-label={`Delete ${kpi.name}`}
                title="Delete KPI"
                onClick={() => onDelete(kpi.id)}
              >
                <Trash2 size={13} aria-hidden="true" />
              </button>
            </div>
          </div>
        </td>
      </tr>
      {expanded ? (
        <tr className="expanded-row" ref={expandedRowRef}>
          <td colSpan={tableColumnCount}>
            <div className="expanded-row-viewport" style={{ width: tableViewportWidth || '100%' }}>
              <ExpandedKpiEditor
                config={config}
                kpi={kpi}
                onChange={onChange}
                onEditLibrarySource={onEditLibrarySource}
                onSemanticTarget={highlightSemanticTarget}
                transientHighlightedSource={highlightedSource}
              />
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}

const MemoizedKpiRow = memo(KpiRow);

function MeasuredKpiRow({
  onHeightChange,
  ...props
}: ComponentProps<typeof KpiRow> & {
  onHeightChange: (id: string, expanded: boolean, height: number) => void;
}) {
  const compactRef = useRef<HTMLTableRowElement | null>(null);
  const expandedRef = useRef<HTMLTableRowElement | null>(null);
  const setCompactRef = useCallback((node: HTMLTableRowElement | null) => {
    compactRef.current = node;
  }, []);
  const setExpandedRef = useCallback((node: HTMLTableRowElement | null) => {
    expandedRef.current = node;
  }, []);
  const measure = useCallback(() => {
    const compactHeight = compactRef.current?.getBoundingClientRect().height ?? 0;
    const expandedHeight = expandedRef.current?.getBoundingClientRect().height ?? 0;
    const height = Math.max(1, Math.ceil(compactHeight + expandedHeight));
    onHeightChange(props.kpi.id, props.expanded, height);
  }, [onHeightChange, props.expanded, props.kpi.id]);

  useLayoutEffect(() => {
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    if (compactRef.current) {
      observer?.observe(compactRef.current);
    }
    if (expandedRef.current) {
      observer?.observe(expandedRef.current);
    }

    return () => observer?.disconnect();
  }, [measure, props.expanded]);

  return (
    <MemoizedKpiRow
      {...props}
      compactRowRef={setCompactRef}
      expandedRowRef={setExpandedRef}
    />
  );
}

type KpiCatalogChangeSummary = {
  affectsEveryRow: boolean;
  changedKpiIds: Set<string>;
};

const kpiCatalogChangeCache = new WeakMap<KpiPoolConfig, WeakMap<KpiPoolConfig, KpiCatalogChangeSummary>>();

const summarizeKpiCatalogChanges = (previous: KpiPoolConfig, next: KpiPoolConfig): KpiCatalogChangeSummary => {
  let summariesByNext = kpiCatalogChangeCache.get(previous);
  const cached = summariesByNext?.get(next);
  if (cached) return cached;

  const changedKpiIds = new Set<string>();
  let affectsEveryRow = previous.kpis.length !== next.kpis.length;
  if (!affectsEveryRow) {
    const previousById = new Map(previous.kpis.map((kpi) => [kpi.id, kpi]));
    for (let index = 0; index < next.kpis.length; index += 1) {
      const nextKpi = next.kpis[index];
      if (previous.kpis[index]?.id !== nextKpi.id) {
        affectsEveryRow = true;
        break;
      }

      const previousKpi = previousById.get(nextKpi.id);
      if (!previousKpi) {
        affectsEveryRow = true;
        break;
      }
      if (
        previousKpi.name !== nextKpi.name ||
        previousKpi.description.overview !== nextKpi.description.overview ||
        !sameStructuredValue(previousKpi.dimensions, nextKpi.dimensions)
      ) changedKpiIds.add(nextKpi.id);
    }
  }

  const summary = { affectsEveryRow, changedKpiIds };
  summariesByNext ??= new WeakMap<KpiPoolConfig, KpiCatalogChangeSummary>();
  summariesByNext.set(next, summary);
  kpiCatalogChangeCache.set(previous, summariesByNext);
  return summary;
};

const kpiCatalogChangeAffectsRow = (previous: KpiPoolConfig, next: KpiPoolConfig, rowKpiId: string) => {
  if (
    previous.enums !== next.enums ||
    previous.dataSources !== next.dataSources ||
    previous.lookups !== next.lookups ||
    previous.lookupGroups !== next.lookupGroups ||
    previous.variables !== next.variables ||
    previous.variableGroups !== next.variableGroups
  ) return true;
  if (previous.kpis === next.kpis) return false;

  const summary = summarizeKpiCatalogChanges(previous, next);
  return summary.affectsEveryRow || summary.changedKpiIds.size > (summary.changedKpiIds.has(rowKpiId) ? 1 : 0);
};

const sameMeasuredKpiRowProps = (
  previous: ComponentProps<typeof MeasuredKpiRow>,
  next: ComponentProps<typeof MeasuredKpiRow>
) =>
  previous.kpi === next.kpi &&
  previous.filters === next.filters &&
  previous.expanded === next.expanded &&
  previous.dragPosition === next.dragPosition &&
  previous.visibleEnumCategories === next.visibleEnumCategories &&
  previous.tableColumnCount === next.tableColumnCount &&
  previous.tableViewportWidth === next.tableViewportWidth &&
  previous.useCaseAssignment === next.useCaseAssignment &&
  previous.sortingActive === next.sortingActive &&
  previous.onHeightChange === next.onHeightChange &&
  !kpiCatalogChangeAffectsRow(previous.config, next.config, next.kpi.id);

const MemoizedMeasuredKpiRow = memo(MeasuredKpiRow, sameMeasuredKpiRowProps);

function KpiTable({
  config,
  kpis,
  filters,
  expandedIds,
  onFiltersChange,
  onConfigChange,
  onToggleExpanded,
  onKpiChange,
  onDelete,
  onDuplicate,
  onReorder,
  onAddKpi,
  onEditLibrarySource,
  focusedAssignment,
  performanceAreaSort,
  onPerformanceAreaSortChange
}: {
  config: KpiPoolConfig;
  kpis: KpiMetric[];
  filters: ColumnFilters;
  expandedIds: string[];
  onFiltersChange: (next: ColumnFilters) => void;
  onConfigChange: (next: KpiPoolConfig) => void;
  onToggleExpanded: (id: string) => void;
  onKpiChange: (next: KpiMetric) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onReorder: (sourceId: string, targetId: string, position: DropPosition) => void;
  onAddKpi: (beforeKpiId?: string) => void;
  onEditLibrarySource: (target: SourceLibraryEditTarget) => void;
  focusedAssignment?: UseCaseAssignment;
  performanceAreaSort: PerformanceAreaSortOrder;
  onPerformanceAreaSortChange: (next: PerformanceAreaSortOrder) => void;
}) {
  const [columnWidths, setColumnWidths] = useState(initialColumnWidths);
  const [hiddenEnumColumns, setHiddenEnumColumns] = useState<KpiEnumCategoryKey[]>(defaultHiddenEnumColumns);
  const [resizingColumn, setResizingColumn] = useState<number | null>(null);
  const [dragState, setDragState] = useState<{ sourceId: string; overId?: string; position?: DropPosition } | null>(null);
  const dragSessionRef = useRef<{ sourceId: string; overId?: string; position?: DropPosition } | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const scrollFrameRequestRef = useRef<number | null>(null);
  const [scrollFrame, setScrollFrame] = useState({ top: 0, height: 0, width: 0 });
  const [rowHeights, setRowHeights] = useState<Map<string, number>>(() => new Map());
  const stableOnToggleExpanded = useStableCallback(onToggleExpanded);
  const stableOnKpiChange = useStableCallback(onKpiChange);
  const stableOnDelete = useStableCallback(onDelete);
  const stableOnDuplicate = useStableCallback(onDuplicate);
  const stableOnReorder = useStableCallback(onReorder);
  const stableOnAddKpi = useStableCallback(onAddKpi);
  const visibleEnumCategories = useMemo(
    () => categoryFields.filter((category) => !hiddenEnumColumns.includes(category)),
    [hiddenEnumColumns]
  );
  const visibleColumnIndices = useMemo(
    () => [
      0,
      2,
      3,
      4,
      ...visibleEnumCategories.map((category) => 5 + categoryFields.indexOf(category)),
      7,
      8,
      9
    ],
    [visibleEnumCategories]
  );
  const tableColumnCount = visibleColumnIndices.length;
  const tableWidth = useMemo(
    () => visibleColumnIndices.reduce((sum, index) => sum + columnWidths[index], 0),
    [columnWidths, visibleColumnIndices]
  );
  const minimumTableWidth = useMemo(
    () => visibleColumnIndices.reduce((sum, index) => sum + minColumnWidths[index], 0),
    [visibleColumnIndices]
  );
  const fittedColumnWidths = useMemo(() => {
    const availableWidth = scrollFrame.width;
    if (!availableWidth || availableWidth >= tableWidth) {
      return visibleColumnIndices.map((index) => columnWidths[index]);
    }

    if (availableWidth <= minimumTableWidth) {
      return visibleColumnIndices.map((index) => minColumnWidths[index]);
    }

    const shrinkableWidth = tableWidth - minimumTableWidth;
    const shrinkRatio = shrinkableWidth > 0 ? (tableWidth - availableWidth) / shrinkableWidth : 0;
    return visibleColumnIndices.map((index) => {
      const preferredWidth = columnWidths[index];
      const minimumWidth = minColumnWidths[index];
      return preferredWidth - (preferredWidth - minimumWidth) * shrinkRatio;
    });
  }, [columnWidths, minimumTableWidth, scrollFrame.width, tableWidth, visibleColumnIndices]);
  const expandedIdSet = useMemo(() => new Set(expandedIds), [expandedIds]);
  const rowScopeFilters = useMemo(
    () => ({
      ...emptyFilters(),
      userGroups: filters.userGroups,
      useCases: filters.useCases
    }),
    [filters.userGroups, filters.useCases]
  );
  const rowHeightFor = useCallback(
    (kpi: KpiMetric) => {
      const expanded = expandedIdSet.has(kpi.id);
      return rowHeights.get(rowHeightKey(kpi.id, expanded)) ?? (expanded ? estimatedExpandedRowHeight : estimatedCollapsedRowHeight);
    },
    [expandedIdSet, rowHeights]
  );
  const virtualRows = useMemo(() => {
    let totalHeight = 0;
    let startIndex = 0;
    let endIndex = kpis.length;
    let topPadding = 0;
    const lowerBound = Math.max(0, scrollFrame.top - virtualOverscanPixels);
    const upperBound = scrollFrame.top + Math.max(scrollFrame.height, 1) + virtualOverscanPixels;

    for (let index = 0; index < kpis.length; index += 1) {
      const height = rowHeightFor(kpis[index]);
      const rowTop = totalHeight;
      const rowBottom = rowTop + height;
      if (rowBottom < lowerBound) {
        startIndex = index + 1;
        topPadding = rowBottom;
      }
      if (rowTop <= upperBound) {
        endIndex = index + 1;
      }
      totalHeight = rowBottom;
    }

    const visible = kpis.slice(startIndex, Math.max(startIndex, endIndex));
    const visibleHeight = visible.reduce((sum, kpi) => sum + rowHeightFor(kpi), 0);
    return {
      startIndex,
      visible,
      topPadding,
      bottomPadding: Math.max(0, totalHeight - topPadding - visibleHeight)
    };
  }, [kpis, rowHeightFor, scrollFrame]);

  const updateScrollFrame = useCallback(() => {
    const element = scrollRef.current;
    if (!element) {
      return;
    }

    setScrollFrame((current) => {
      const next = { top: element.scrollTop, height: element.clientHeight, width: element.clientWidth };
      return current.top === next.top && current.height === next.height && current.width === next.width ? current : next;
    });
  }, []);

  const scheduleScrollFrameUpdate = useCallback(() => {
    if (scrollFrameRequestRef.current !== null) return;
    scrollFrameRequestRef.current = window.requestAnimationFrame(() => {
      scrollFrameRequestRef.current = null;
      updateScrollFrame();
    });
  }, [updateScrollFrame]);

  const handleRowHeightChange = useCallback((id: string, expanded: boolean, height: number) => {
    setRowHeights((current) => {
      const key = rowHeightKey(id, expanded);
      if (Math.abs((current.get(key) ?? 0) - height) < 1) {
        return current;
      }

      const next = new Map(current);
      next.set(key, height);
      return next;
    });
  }, []);

  useLayoutEffect(() => {
    updateScrollFrame();
    const element = scrollRef.current;
    if (!element || typeof ResizeObserver === 'undefined') {
      return undefined;
    }

    const observer = new ResizeObserver(updateScrollFrame);
    observer.observe(element);
    return () => observer.disconnect();
  }, [updateScrollFrame]);

  useEffect(() => () => {
    if (scrollFrameRequestRef.current !== null) {
      window.cancelAnimationFrame(scrollFrameRequestRef.current);
    }
  }, []);

  useLayoutEffect(() => {
    updateScrollFrame();
  }, [kpis.length, updateScrollFrame]);

  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (element && scrollFrame.width >= minimumTableWidth && element.scrollLeft !== 0) {
      element.scrollLeft = 0;
    }
  }, [minimumTableWidth, scrollFrame.width]);

  useEffect(() => {
    const validIds = new Set(kpis.map((kpi) => kpi.id));
    setRowHeights((current) => {
      let changed = false;
      const next = new Map<string, number>();
      for (const [key, height] of current) {
        const id = key.endsWith(':expanded') ? key.slice(0, -9) : key.endsWith(':collapsed') ? key.slice(0, -10) : key;
        if (validIds.has(id)) {
          next.set(key, height);
        } else {
          changed = true;
        }
      }

      return changed ? next : current;
    });
  }, [kpis]);

  const startColumnResize = (index: number, event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();

    const startX = event.clientX;
    const startWidth = columnWidths[index];
    setResizingColumn(index);
    document.body.classList.add('column-resizing');

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const nextWidth = Math.max(minColumnWidths[index], startWidth + moveEvent.clientX - startX);
      setColumnWidths((current) => current.map((width, widthIndex) => (widthIndex === index ? nextWidth : width)));
    };

    const stopResize = () => {
      setResizingColumn(null);
      document.body.classList.remove('column-resizing');
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', stopResize);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', stopResize);
  };

  const resizeHandle = (index: number, label: string) => (
    <button
      className="column-resize-handle"
      type="button"
      aria-label={`Resize ${label} column`}
      title={`Resize ${label} column`}
      onMouseDown={(event) => startColumnResize(index, event)}
    />
  );

  const headerClass = (index: number) => (resizingColumn === index ? 'is-resizing' : undefined);
  const toggleEnumColumn = (category: KpiEnumCategoryKey) => {
    setHiddenEnumColumns((current) =>
      current.includes(category) ? current.filter((entry) => entry !== category) : [...current, category]
    );
  };
  const togglePerformanceAreaSort = () => {
    onPerformanceAreaSortChange(performanceAreaSort === undefined ? 'asc' : performanceAreaSort === 'asc' ? 'desc' : undefined);
  };
  const performanceAreaScopeUseCases = useMemo(() => {
    if (focusedAssignment) {
      return [focusedAssignment.useCase];
    }

    if (filters.useCases.length > 0) {
      return filters.useCases;
    }

    if (filters.userGroups.length > 0) {
      return config.enums.useCase
        .filter((option) => option.userGroup && filters.userGroups.includes(option.userGroup))
        .map((option) => option.id);
    }

    return [];
  }, [config.enums.useCase, filters.userGroups, filters.useCases, focusedAssignment]);
  const performanceAreaUseCaseOptions = useMemo(
    () => {
      const userGroupLabels = new Map(config.enums.userGroup.map((option) => [option.id, option.label]));
      const useCases = performanceAreaScopeUseCases.length
        ? config.enums.useCase.filter((option) => performanceAreaScopeUseCases.includes(option.id))
        : config.enums.useCase;
      return useCases.map((option) => ({
        ...option,
        label: `${userGroupLabels.get(option.userGroup ?? '') ?? 'Unassigned'} / ${option.label}`
      }));
    },
    [config.enums.useCase, config.enums.userGroup, performanceAreaScopeUseCases]
  );
  const performanceAreaHeaderOptions = useMemo(
    () => performanceAreaOptionsForUseCases(config, performanceAreaScopeUseCases),
    [config, performanceAreaScopeUseCases]
  );
  const performanceAreaManagerOptions = useMemo(
    () =>
      performanceAreaScopeUseCases.length
        ? config.enums.performanceArea.filter(
            (option) => option.useCase && performanceAreaScopeUseCases.includes(option.useCase)
          )
        : config.enums.performanceArea,
    [config.enums.performanceArea, performanceAreaScopeUseCases]
  );
  const performanceAreaFilterIds = useMemo(
    () => new Set(performanceAreaHeaderOptions.map((option) => option.id)),
    [performanceAreaHeaderOptions]
  );

  useEffect(() => {
    const nextPerformanceAreaFilter = filters.enums.performanceArea.filter((id) => performanceAreaFilterIds.has(id));
    if (nextPerformanceAreaFilter.length !== filters.enums.performanceArea.length) {
      onFiltersChange({
        ...filters,
        enums: {
          ...filters.enums,
          performanceArea: nextPerformanceAreaFilter
        }
      });
    }
  }, [filters, onFiltersChange, performanceAreaFilterIds]);

  const startRowDrag = useCallback((kpiId: string, event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();

    const initialState = { sourceId: kpiId };
    dragSessionRef.current = initialState;
    setDragState(initialState);
    document.body.classList.add('row-dragging');

    const updateTargetFromPoint = (clientX: number, clientY: number) => {
      const targetRow = document.elementFromPoint(clientX, clientY)?.closest<HTMLTableRowElement>('tr.compact-row[data-kpi-id]');
      const targetId = targetRow?.dataset.kpiId;
      if (!targetRow || !targetId || targetId === kpiId) {
        dragSessionRef.current = initialState;
        setDragState(initialState);
        return;
      }

      const rect = targetRow.getBoundingClientRect();
      const position: DropPosition = clientY < rect.top + rect.height / 2 ? 'before' : 'after';
      const nextState = { sourceId: kpiId, overId: targetId, position };
      dragSessionRef.current = nextState;
      setDragState(nextState);
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      moveEvent.preventDefault();
      const scroller = scrollRef.current;
      if (scroller) {
        const rect = scroller.getBoundingClientRect();
        if (moveEvent.clientY < rect.top + rowDragAutoScrollEdge) {
          scroller.scrollTop = Math.max(0, scroller.scrollTop - rowDragAutoScrollStep);
        } else if (moveEvent.clientY > rect.bottom - rowDragAutoScrollEdge) {
          scroller.scrollTop += rowDragAutoScrollStep;
        }
      }
      updateTargetFromPoint(moveEvent.clientX, moveEvent.clientY);
    };

    const stopRowDrag = () => {
      const finalState = dragSessionRef.current;
      if (finalState?.overId && finalState.sourceId !== finalState.overId) {
        stableOnReorder(finalState.sourceId, finalState.overId, finalState.position ?? 'before');
      }

      dragSessionRef.current = null;
      setDragState(null);
      document.body.classList.remove('row-dragging');
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', stopRowDrag);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', stopRowDrag);
  }, [stableOnReorder]);

  return (
    <section className="table-panel">
      <div
        className={`table-scroll ${scrollFrame.width >= minimumTableWidth ? 'columns-fit' : 'columns-overflow'}`}
        ref={scrollRef}
        onScroll={scheduleScrollFrameUpdate}
      >
        <table className="kpi-table" style={{ width: '100%', minWidth: minimumTableWidth }}>
          <colgroup>
            {visibleColumnIndices.map((index, visibleIndex) => (
              <col key={index} style={{ width: fittedColumnWidths[visibleIndex] }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th className={headerClass(0)}>
                <TextHeaderFilter
                  label="Name / Description"
                  value={filters.name || filters.description}
                  placeholder="Search name or description..."
                  onChange={(name) => onFiltersChange({ ...filters, name, description: '' })}
                />
                {resizeHandle(0, 'Name and description')}
              </th>
              <th className={headerClass(2)}>
                <TextHeaderFilter label="Source" value={filters.prerequisite} placeholder="Search sources..." onChange={(prerequisite) => onFiltersChange({ ...filters, prerequisite })} />
                {resizeHandle(2, 'Source')}
              </th>
              <th className={headerClass(3)}>
                <TextHeaderFilter
                  label="Formula"
                  value={filters.formula}
                  placeholder="Search formula..."
                  onChange={(formula) => onFiltersChange({ ...filters, formula })}
                />
                {resizeHandle(3, 'Formula')}
              </th>
              <th className={headerClass(4)}>
                <ScaleHeaderFilter value={filters.scales} onChange={(scales) => onFiltersChange({ ...filters, scales })} />
                {resizeHandle(4, 'Spatial Scales')}
              </th>
              {visibleEnumCategories.map((category) => {
                const columnIndex = 5 + categoryFields.indexOf(category);
                return (
                <th className={headerClass(columnIndex)} key={category}>
                  <EnumHeader
                    config={config}
                    category={category}
                    filter={filters.enums[category]}
                    onFilterChange={(selected) =>
                      onFiltersChange({
                        ...filters,
                        enums: {
                          ...filters.enums,
                          [category]: selected
                        }
                      })
                    }
                    onConfigChange={onConfigChange}
                  />
                  {resizeHandle(columnIndex, enumCategoryLabels[category])}
                </th>
              );
              })}
              <th className={headerClass(7)}>
                <div className="sortable-header-control">
                  <EnumHeader
                    config={config}
                    category="performanceArea"
                    filter={filters.enums.performanceArea}
                    onFilterChange={(performanceArea) =>
                      onFiltersChange({
                        ...filters,
                        enums: {
                          ...filters.enums,
                          performanceArea
                        }
                      })
                    }
                    onConfigChange={onConfigChange}
                    filterOptions={performanceAreaHeaderOptions}
                    manageOptions={performanceAreaManagerOptions}
                    performanceAreaUseCaseOptions={performanceAreaUseCaseOptions}
                  />
                  <button
                    className={`mini-icon-button sort-toggle ${performanceAreaSort ? 'is-active' : ''}`}
                    type="button"
                    aria-label={
                      performanceAreaSort === 'asc'
                        ? 'Sort performance areas descending'
                        : performanceAreaSort === 'desc'
                          ? 'Clear performance area sort'
                          : 'Sort performance areas ascending'
                    }
                    title={
                      performanceAreaSort === 'asc'
                        ? 'Performance Area: A-Z using smallest label'
                        : performanceAreaSort === 'desc'
                          ? 'Performance Area: Z-A using largest label'
                          : 'Sort Performance Area'
                    }
                    onClick={togglePerformanceAreaSort}
                  >
                    {performanceAreaSort === 'desc' ? <SortDesc size={13} aria-hidden="true" /> : <SortAsc size={13} aria-hidden="true" />}
                  </button>
                </div>
                {resizeHandle(7, enumCategoryLabels.performanceArea)}
              </th>
              <th className={headerClass(8)}>
                <UseCaseHeader
                  config={config}
                  userGroupFilter={filters.userGroups}
                  useCaseFilter={filters.useCases}
                  onUserGroupFilterChange={(userGroups) => onFiltersChange({ ...filters, userGroups })}
                  onUseCaseFilterChange={(useCases) => onFiltersChange({ ...filters, useCases })}
                  onConfigChange={onConfigChange}
                />
                {resizeHandle(8, 'User Group / Use Case')}
              </th>
              <th className={headerClass(9)}>
                <div className="last-modified-header">
                  <div className="header-title timestamp-header-title">Last Modified</div>
                </div>
                {resizeHandle(9, 'Last Modified')}
              </th>
            </tr>
          </thead>
          <tbody>
            {virtualRows.topPadding > 0 ? (
              <tr className="virtual-spacer-row" aria-hidden="true">
                <td colSpan={tableColumnCount} style={{ height: virtualRows.topPadding }} />
              </tr>
            ) : null}
            {kpis.length === 0 ? (
              <tr>
                <td colSpan={tableColumnCount} className="empty-table">
                  No KPIs match the current header filters.
                </td>
              </tr>
            ) : null}
            {virtualRows.visible.map((kpi) => (
              <MemoizedMeasuredKpiRow
                key={kpi.id}
                config={config}
                kpi={kpi}
                filters={rowScopeFilters}
                expanded={expandedIdSet.has(kpi.id)}
                dragPosition={dragState?.overId === kpi.id ? dragState.position : undefined}
                visibleEnumCategories={visibleEnumCategories}
                tableColumnCount={tableColumnCount}
                tableViewportWidth={scrollFrame.width}
                useCaseAssignment={focusedAssignment}
                sortingActive={Boolean(performanceAreaSort)}
                onExpand={stableOnToggleExpanded}
                onChange={stableOnKpiChange}
                onDelete={stableOnDelete}
                onDuplicate={stableOnDuplicate}
                onInsertBefore={stableOnAddKpi}
                onDragHandleMouseDown={startRowDrag}
                onEditLibrarySource={onEditLibrarySource}
                onHeightChange={handleRowHeightChange}
              />
            ))}
            {virtualRows.bottomPadding > 0 ? (
              <tr className="virtual-spacer-row" aria-hidden="true">
                <td colSpan={tableColumnCount} style={{ height: virtualRows.bottomPadding }} />
              </tr>
            ) : null}
            <tr className="add-kpi-row">
              <td colSpan={tableColumnCount}>
                <button className="secondary-action small" type="button" onClick={() => onAddKpi()}>
                  <Plus size={15} aria-hidden="true" />
                  Add KPI
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

type SaveState = 'idle' | 'loading' | 'saving' | 'saved' | 'error';

function EditorApp({
  initialConfig,
  initialWarnings,
  initialEtag,
  initialRemoteExists,
  hostedSecret,
  exportedSnapshot,
  onAuthorizationLost
}: {
  initialConfig: KpiPoolConfig;
  initialWarnings: string[];
  initialEtag: string | null;
  initialRemoteExists: boolean;
  hostedSecret?: string;
  exportedSnapshot: boolean;
  onAuthorizationLost?: () => void;
}) {
  const [config, setConfig] = useState(initialConfig);
  const [warnings, setWarnings] = useState(initialWarnings);
  const [etag, setEtag] = useState(initialEtag);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(!initialRemoteExists && !exportedSnapshot);
  const [saveNotice, setSaveNotice] = useState(
    exportedSnapshot
      ? 'Offline snapshot: hosted JSON saving is disabled.'
      : initialRemoteExists
        ? 'Connected to hosted JSON.'
        : 'The hosted JSON is empty. Save to initialize it.'
  );
  const [filters, setFilters] = useState(emptyFilters);
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const [pinnedFilterIds, setPinnedFilterIds] = useState<string[]>([]);
  const [examineAssignment, setExamineAssignment] = useState<UseCaseAssignment | undefined>(() => validDefaultFocus(initialConfig, initialConfig.defaultFocus));
  const [focusedAssignment, setFocusedAssignment] = useState<UseCaseAssignment | undefined>(() => validDefaultFocus(initialConfig, initialConfig.defaultFocus));
  const [hideOutsideFocusedGroup, setHideOutsideFocusedGroup] = useState(true);
  const [performanceAreaSort, setPerformanceAreaSort] = useState<PerformanceAreaSortOrder>();
  const [sourceLibraryEditRequest, setSourceLibraryEditRequest] = useState<SourceLibraryEditRequest>();
  const editLibrarySource = useCallback((target: SourceLibraryEditTarget) => {
    setSourceLibraryEditRequest((current) => ({ ...target, requestId: (current?.requestId ?? 0) + 1 }));
  }, []);
  const baselineKpisRef = useRef(new Map(initialConfig.kpis.map((kpi) => [kpi.id, kpi])));
  const lastSyncedKpiIdsRef = useRef(
    new Set(initialRemoteExists ? initialConfig.kpis.map((kpi) => kpi.id) : [])
  );
  const lastSyncedDataSourceIdsRef = useRef(
    new Set(initialRemoteExists ? initialConfig.dataSources.map((source) => source.id) : [])
  );
  const lastSyncedRelationIdsRef = useRef(
    new Set(initialRemoteExists ? initialConfig.tableRelations.map((relation) => relation.id) : [])
  );
  const lastSyncedLookupIdsRef = useRef(
    new Set(initialRemoteExists ? initialConfig.lookups.map((lookup) => lookup.id) : [])
  );
  const lastSyncedConfigRef = useRef<KpiPoolConfig | undefined>(
    initialRemoteExists ? initialConfig : undefined
  );
  const indexesCacheRef = useRef<{ config: KpiPoolConfig; indexes: AppIndexes }>();
  const configRef = useRef(config);
  configRef.current = config;

  const commitConfig = useCallback((action: KpiPoolConfig | ((current: KpiPoolConfig) => KpiPoolConfig)) => {
    setHasUnsavedChanges(true);
    setConfig((current) => {
      const candidateConfig = typeof action === 'function' ? action(current) : action;
      // Several catalog operations intentionally walk every entry to synchronize
      // linked domains. Restore structural sharing for entries that the walk did
      // not actually change so memoized KPI rows do not all re-render.
      const next = {
        ...candidateConfig,
        valueEnums: preserveUnchangedEntries(current.valueEnums, candidateConfig.valueEnums),
        valueEnumGroups: preserveUnchangedEntries(current.valueEnumGroups, candidateConfig.valueEnumGroups),
        dataSources: preserveUnchangedEntries(current.dataSources, candidateConfig.dataSources),
        tableRelations: preserveUnchangedEntries(current.tableRelations, candidateConfig.tableRelations),
        lookups: preserveUnchangedEntries(current.lookups, candidateConfig.lookups),
        lookupGroups: preserveUnchangedEntries(current.lookupGroups, candidateConfig.lookupGroups),
        variables: preserveUnchangedEntries(current.variables, candidateConfig.variables),
        variableGroups: preserveUnchangedEntries(current.variableGroups, candidateConfig.variableGroups)
      };
      const currentById = new Map(current.kpis.map((kpi) => [kpi.id, kpi]));
      const nextIds = new Set(next.kpis.map((kpi) => kpi.id));
      const kpis = next.kpis.map((candidate) => {
        const previous = currentById.get(candidate.id);
        if (!previous) {
          const created = Number.isFinite(Date.parse(candidate.lastModified))
            ? candidate
            : { ...candidate, lastModified: nextEditTimestamp() };
          baselineKpisRef.current.set(created.id, created);
          return created;
        }

        if (previous === candidate) {
          return previous;
        }

        if (sameKpiMaterial(previous, candidate)) {
          return previous;
        }

        const baseline = baselineKpisRef.current.get(candidate.id);
        if (baseline && sameKpiMaterial(baseline, candidate)) {
          return { ...candidate, lastModified: baseline.lastModified };
        }

        return { ...candidate, lastModified: nextEditTimestamp(previous.lastModified) };
      });

      for (const id of baselineKpisRef.current.keys()) {
        if (!nextIds.has(id)) {
          baselineKpisRef.current.delete(id);
        }
      }

      return { ...next, kpis };
    });
  }, []);

  const indexes = useMemo(() => {
    const previous = indexesCacheRef.current;
    const next = buildAppIndexes(config, previous?.config, previous?.indexes);
    indexesCacheRef.current = { config, indexes: next };
    return next;
  }, [config]);
  const deferredFilters = useDeferredValue(filters);
  const pinnedFilterIdSet = useMemo(() => new Set(pinnedFilterIds), [pinnedFilterIds]);
  const filterMatchCacheRef = useRef<{
    filters: ColumnFilters;
    focusedAssignment?: UseCaseAssignment;
    ids: Set<string>;
  }>();
  const activeDeferredFilterCount = activeFilterCount(deferredFilters);
  let filterMatchIds: Set<string> | undefined;
  if (activeDeferredFilterCount > 0) {
    const cached = filterMatchCacheRef.current;
    if (cached?.filters === deferredFilters && cached.focusedAssignment === focusedAssignment) {
      filterMatchIds = cached.ids;
    } else {
      const compiledFilters = compileFilters(deferredFilters, indexes);
      filterMatchIds = new Set(
        config.kpis
          .filter((kpi) => matchesFilters(indexes, kpi, compiledFilters, pinnedFilterIdSet, focusedAssignment))
          .map((kpi) => kpi.id)
      );
      filterMatchCacheRef.current = { filters: deferredFilters, focusedAssignment, ids: filterMatchIds };
    }
  }
  const filteredKpis = useMemo(
    () =>
      config.kpis.filter(
        (kpi) =>
          (!filterMatchIds || filterMatchIds.has(kpi.id) || pinnedFilterIdSet.has(kpi.id)) &&
          (!focusedAssignment || !hideOutsideFocusedGroup || hasUseCaseAssignment(kpi, focusedAssignment))
      ),
    [config.kpis, filterMatchIds, focusedAssignment, hideOutsideFocusedGroup, pinnedFilterIdSet]
  );
  const visibleKpis = useMemo(() => {
    if (!performanceAreaSort) {
      return filteredKpis;
    }

    return [...filteredKpis].sort((left, right) => {
      const leftKey = performanceAreaSortKey(config, left, deferredFilters, focusedAssignment, performanceAreaSort);
      const rightKey = performanceAreaSortKey(config, right, deferredFilters, focusedAssignment, performanceAreaSort);
      const result = leftKey.localeCompare(rightKey, undefined, { sensitivity: 'base', numeric: true });
      return performanceAreaSort === 'asc' ? result : -result;
    });
  }, [config, deferredFilters, filteredKpis, focusedAssignment, performanceAreaSort]);
  const filterCount = activeFilterCount(filters);

  const setConfigAndRepairExpansion = (next: KpiPoolConfig) => {
    const validFocus = validDefaultFocus(next, next.defaultFocus);
    const normalizedNext = {
      ...next,
      defaultFocus: validFocus
    };
    commitConfig(normalizedNext);
    const validIds = new Set(normalizedNext.kpis.map((kpi) => kpi.id));
    setExpandedIds((current) => current.filter((id) => validIds.has(id)));
    setPinnedFilterIds((current) => current.filter((id) => validIds.has(id)));
    setFocusedAssignment((current) => (current && validDefaultFocus(normalizedNext, current) ? current : validFocus));
    setExamineAssignment((current) => (current && validDefaultFocus(normalizedNext, current) ? current : validFocus));
  };

  const updateFilters = (next: ColumnFilters) => {
    setPinnedFilterIds([]);
    setFilters(next);
  };

  const enterUseCaseFocus = (assignment: UseCaseAssignment) => {
    setFocusedAssignment(assignment);
    commitConfig((current) => ({
      ...current,
      defaultFocus: assignment
    }));
    updateFilters({
      ...filters,
      userGroups: [],
      useCases: []
    });
  };

  const exitUseCaseFocus = () => {
    setFocusedAssignment(undefined);
    commitConfig((current) => ({
      ...current,
      defaultFocus: undefined
    }));
  };

  const addKpi = (beforeKpiId?: string) => {
    const defaultUserGroup =
      filters.useCases.length > 0 && filters.userGroups.length === 0 && config.enums.userGroup.length === 0
        ? createEnumOption('Unspecified User Group')
        : undefined;
    const configForNewKpi = defaultUserGroup
      ? {
          ...config,
          enums: {
            ...config.enums,
            userGroup: [defaultUserGroup]
          }
        }
      : config;
    const matchingKpi = createKpiMatchingFilters(filters, configForNewKpi);
    const kpi = focusedAssignment ? setUseCaseAssignment(matchingKpi, focusedAssignment, true) : matchingKpi;
    const insertionIndex = beforeKpiId
      ? Math.max(0, configForNewKpi.kpis.findIndex((entry) => entry.id === beforeKpiId))
      : configForNewKpi.kpis.length;
    commitConfig({
      ...configForNewKpi,
      kpis: [...configForNewKpi.kpis.slice(0, insertionIndex), kpi, ...configForNewKpi.kpis.slice(insertionIndex)]
    });
    setExpandedIds((current) => [...new Set([...current, kpi.id])]);
    if (filterCount > 0) {
      setPinnedFilterIds((current) => [...new Set([...current, kpi.id])]);
    }
  };

  const toggleExpanded = (id: string) => {
    setExpandedIds((current) => (current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]));
  };

  const collapseAllRows = () => {
    setExpandedIds([]);
  };

  const deleteKpi = (kpiId: string) => {
    const kpi = config.kpis.find((entry) => entry.id === kpiId);
    if (!window.confirm(`Delete "${kpi?.name ?? 'this KPI'}"?`)) {
      return;
    }

    setConfigAndRepairExpansion({
      ...config,
      kpis: config.kpis
        .filter((entry) => entry.id !== kpiId)
        .map((entry) => ({
          ...entry,
          sources: entry.sources.filter((source) => source.type !== 'kpi' || source.kpiId !== kpiId),
          prerequisite: {
            ...entry.prerequisite,
            kpis: entry.prerequisite.kpis.filter((id) => id !== kpiId)
          }
        }))
    });
  };

  const duplicateKpi = (kpiId: string) => {
    const sourceIndex = config.kpis.findIndex((entry) => entry.id === kpiId);
    const source = config.kpis[sourceIndex];
    if (!source) {
      return;
    }

    const duplicate = duplicateKpiMetric(source, focusedAssignment);
    commitConfig({
      ...config,
      kpis: [...config.kpis.slice(0, sourceIndex + 1), duplicate, ...config.kpis.slice(sourceIndex + 1)]
    });
    setExpandedIds((current) => [...new Set([...current, duplicate.id])]);
    if (filterCount > 0) {
      setPinnedFilterIds((current) => [...new Set([...current, duplicate.id])]);
    }
  };

  const reorderKpi = (sourceId: string, targetId: string, position: DropPosition) => {
    if (sourceId === targetId) {
      return;
    }

    commitConfig((current) => {
      const sourceIndex = current.kpis.findIndex((entry) => entry.id === sourceId);
      if (sourceIndex < 0 || !current.kpis.some((entry) => entry.id === targetId)) {
        return current;
      }

      const nextKpis = [...current.kpis];
      const [moved] = nextKpis.splice(sourceIndex, 1);
      const targetIndex = nextKpis.findIndex((entry) => entry.id === targetId);
      if (targetIndex < 0) {
        return current;
      }

      nextKpis.splice(position === 'after' ? targetIndex + 1 : targetIndex, 0, moved);
      return {
        ...current,
        kpis: nextKpis
      };
    });
  };

  const updateKpiFromRow = useCallback((next: KpiMetric) => {
    const previous = configRef.current.kpis.find((entry) => entry.id === next.id);
    if (
      (filters.name.trim() || filters.description.trim()) &&
      previous &&
      (previous.name !== next.name || previous.description.overview !== next.description.overview)
    ) {
      setPinnedFilterIds((current) => [...new Set([...current, next.id])]);
    }

    commitConfig((current) => updateKpi(current, next.id, () => next));
  }, [commitConfig, filters.description, filters.name]);

  const replaceWithRemoteConfig = (result: RemoteConfigResult, notice: string) => {
    const repaired = repairConfig(result.config);
    baselineKpisRef.current = new Map(repaired.config.kpis.map((kpi) => [kpi.id, kpi]));
    lastSyncedKpiIdsRef.current = new Set(repaired.config.kpis.map((kpi) => kpi.id));
    lastSyncedDataSourceIdsRef.current = new Set(repaired.config.dataSources.map((source) => source.id));
    lastSyncedRelationIdsRef.current = new Set(repaired.config.tableRelations.map((relation) => relation.id));
    lastSyncedLookupIdsRef.current = new Set(repaired.config.lookups.map((lookup) => lookup.id));
    lastSyncedConfigRef.current = repaired.config;
    setConfig(repaired.config);
    setHasUnsavedChanges(false);
    setEtag(result.etag);
    setWarnings([...repaired.warnings, ...(result.warnings ?? [])]);
    const validIds = new Set(repaired.config.kpis.map((kpi) => kpi.id));
    setPinnedFilterIds((current) => current.filter((id) => validIds.has(id)));
    setExpandedIds((current) => current.filter((id) => validIds.has(id)));
    setExamineAssignment((current) => (current && validDefaultFocus(repaired.config, current) ? current : undefined));
    setFocusedAssignment((current) => (current && validDefaultFocus(repaired.config, current) ? current : undefined));
    setSaveState('saved');
    setSaveNotice(notice);
  };

  const handleRemoteFailure = (error: unknown, fallback: string) => {
    if (error instanceof RemoteConfigError && error.status === 401) {
      onAuthorizationLost?.();
      return;
    }
    setSaveState('error');
    setSaveNotice(error instanceof Error ? error.message : fallback);
  };

  const saveToHostedJson = async () => {
    if (exportedSnapshot || !hostedSecret) {
      return;
    }

    setSaveState('saving');
    setSaveNotice('Reading and merging with the hosted JSON...');
    try {
      const currentKpiIds = new Set(config.kpis.map((kpi) => kpi.id));
      const deletedKpiIds = [...lastSyncedKpiIdsRef.current].filter((id) => !currentKpiIds.has(id));
      const currentDataSourceIds = new Set(config.dataSources.map((source) => source.id));
      const deletedDataSourceIds = [...lastSyncedDataSourceIdsRef.current].filter(
        (id) => !currentDataSourceIds.has(id)
      );
      const currentRelationIds = new Set(config.tableRelations.map((relation) => relation.id));
      const deletedRelationIds = [...lastSyncedRelationIdsRef.current].filter(
        (id) => !currentRelationIds.has(id)
      );
      const currentLookupIds = new Set(config.lookups.map((lookup) => lookup.id));
      const deletedLookupIds = [...lastSyncedLookupIdsRef.current].filter(
        (id) => !currentLookupIds.has(id)
      );
      const result = await syncRemoteConfig(
        hostedSecret,
        config,
        lastSyncedConfigRef.current,
        etag,
        deletedKpiIds,
        deletedDataSourceIds,
        deletedRelationIds,
        deletedLookupIds
      );
      replaceWithRemoteConfig(
        result,
        result.mergedAfterRemoteChange
          ? 'Saved after merging changes made by another editor.'
          : 'Saved to hosted JSON.'
      );
    } catch (error) {
      handleRemoteFailure(error, 'The hosted JSON could not be saved.');
    }
  };

  const forceSaveToHostedJson = async () => {
    if (exportedSnapshot || !hostedSecret) {
      return;
    }
    if (
      !window.confirm(
        'Force Save replaces the complete hosted JSON, including deletions. Continue?'
      )
    ) {
      return;
    }

    setSaveState('saving');
    setSaveNotice('Replacing the hosted JSON...');
    try {
      const result = await forceRemoteConfig(hostedSecret, config, etag);
      replaceWithRemoteConfig(result, 'Hosted JSON was force-replaced.');
    } catch (error) {
      if (
        error instanceof RemoteConfigError &&
        error.conflict &&
        window.confirm(
          'Another editor saved a newer version. Overwrite that newer hosted JSON anyway? This cannot be merged automatically.'
        )
      ) {
        try {
          const result = await forceRemoteConfig(hostedSecret, config, etag, true);
          replaceWithRemoteConfig(result, 'A newer hosted JSON was explicitly overwritten.');
          return;
        } catch (overrideError) {
          handleRemoteFailure(overrideError, 'The hosted JSON could not be force-replaced.');
          return;
        }
      }
      handleRemoteFailure(error, 'The hosted JSON could not be force-replaced.');
    }
  };

  const refreshFromHostedJson = async () => {
    if (exportedSnapshot || !hostedSecret) {
      return;
    }
    if (hasUnsavedChanges && !window.confirm('Discard local changes and reload the hosted JSON?')) {
      return;
    }

    setSaveState('loading');
    setSaveNotice('Reloading hosted JSON...');
    try {
      const result = await loadRemoteConfig(hostedSecret);
      replaceWithRemoteConfig(result, 'Reloaded from hosted JSON.');
    } catch (error) {
      handleRemoteFailure(error, 'The hosted JSON could not be reloaded.');
    }
  };

  const importHtml = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }

    try {
      const parsed = readConfigFromHtml(await file.text());
      const repaired = repairConfig(parsed);
      const merged = mergeImportedConfig(config, repaired.config);
      const normalizedMerged = repairConfig(merged.config);
      const incomingById = new Map(normalizedMerged.config.kpis.map((kpi) => [kpi.id, kpi]));
      const nextBaselines = new Map(baselineKpisRef.current);
      for (const id of merged.importedKpiIds) {
        const importedKpi = incomingById.get(id);
        if (importedKpi) {
          nextBaselines.set(id, importedKpi);
        }
      }
      for (const kpi of normalizedMerged.config.kpis) {
        if (!nextBaselines.has(kpi.id)) {
          nextBaselines.set(kpi.id, kpi);
        }
      }
      baselineKpisRef.current = nextBaselines;
      setConfig(normalizedMerged.config);
      setHasUnsavedChanges(true);
      setWarnings([
        ...repaired.warnings,
        ...normalizedMerged.warnings,
        ...(merged.enumConflicts > 0
          ? [`${merged.enumConflicts} imported domain option${merged.enumConflicts === 1 ? '' : 's'} had an existing ID with different content; the current option was kept.`]
          : []),
        ...(merged.valueEnumConflicts > 0
          ? [`${merged.valueEnumConflicts} imported global domain${merged.valueEnumConflicts === 1 ? '' : 's'} had an existing ID with different content; the current definition was kept and linked uses were synchronized.`]
          : []),
        ...(merged.dataSourceConflicts > 0
          ? [`${merged.dataSourceConflicts} imported data source${merged.dataSourceConflicts === 1 ? '' : 's'} had an existing ID with different content; the current definition was kept.`]
          : []),
        ...(merged.lookupConflicts > 0
          ? [`${merged.lookupConflicts} imported lookup${merged.lookupConflicts === 1 ? '' : 's'} had an existing ID with different content; the current definition was kept.`]
          : []),
        ...(merged.variableConflicts > 0
          ? [`${merged.variableConflicts} imported variable${merged.variableConflicts === 1 ? '' : 's'} had an existing ID with different content; the current definition was kept.`]
          : [])
      ]);
    } catch (err) {
      setWarnings([`Could not import "${file.name}". ${err instanceof Error ? err.message : 'The file was not a valid KPI Library HTML file.'}`]);
    }
  };

  const exportHtml = () => {
    const output = prepareForExport(config);
    baselineKpisRef.current = new Map(output.kpis.map((kpi) => [kpi.id, kpi]));
    downloadFile(`${configFileStem(output.title)}.html`, buildExportHtml(output), 'text/html;charset=utf-8');
  };

  const exportJson = () => {
    const output = buildSystematicJsonExport(config, visibleKpis);
    downloadFile(
      `${configFileStem(config.title)}-filtered-kpis.json`,
      JSON.stringify(output, null, 2),
      'application/json;charset=utf-8'
    );
  };

  const saveBusy = saveState === 'saving' || saveState === 'loading';
  const remoteActionTitle = exportedSnapshot
    ? 'This exported HTML is an offline snapshot and cannot write to the hosted JSON.'
    : undefined;

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="topbar-row topbar-primary-row">
          <div className="title-block">
            <FileJson size={22} aria-hidden="true" />
            <label className="title-editor">
              <span>Library title</span>
              <DebouncedInput value={config.title} onValueChange={(title) => commitConfig({ ...configRef.current, title })} />
            </label>
          </div>
          <div className="topbar-actions topbar-actions-right">
            <span
              className={`persistence-status ${saveState === 'error' ? 'error' : ''} ${hasUnsavedChanges ? 'dirty' : ''}`}
              title={saveNotice}
            >
              <Cloud size={14} aria-hidden="true" />
              {exportedSnapshot
                ? 'Offline snapshot'
                : saveBusy
                  ? saveState === 'loading'
                    ? 'Loading...'
                    : 'Saving...'
                  : saveState === 'error'
                    ? 'Save failed'
                    : hasUnsavedChanges
                      ? 'Unsaved changes'
                      : 'Hosted JSON current'}
            </span>
            <span className="result-count">
              {visibleKpis.length} of {config.kpis.length} KPIs
              {filterCount ? ` | ${filterCount} filters` : ''}
              {performanceAreaSort ? ` | performance area ${performanceAreaSort === 'asc' ? 'A-Z' : 'Z-A'}` : ''}
            </span>
            <button
              className="secondary-action small"
              type="button"
              onClick={refreshFromHostedJson}
              disabled={exportedSnapshot || saveBusy}
              title={remoteActionTitle ?? 'Discard local changes and reload the hosted JSON'}
            >
              <RefreshCw size={15} aria-hidden="true" />
              Refresh
            </button>
            <button
              className="primary-action small"
              type="button"
              onClick={saveToHostedJson}
              disabled={exportedSnapshot || saveBusy || !hasUnsavedChanges}
              title={remoteActionTitle ?? 'Merge changes while preserving every deletion made in this editor'}
            >
              <Save size={15} aria-hidden="true" />
              Save
            </button>
            <button
              className="secondary-action small danger-action"
              type="button"
              onClick={forceSaveToHostedJson}
              disabled={exportedSnapshot || saveBusy}
              title={remoteActionTitle ?? 'Replace the complete hosted JSON, including deletions'}
            >
              Force Save
            </button>
            <label className="secondary-action small file-action">
              <Upload size={15} aria-hidden="true" />
              Import HTML
              <input className="hidden-file" type="file" accept="text/html,.html,.htm" onChange={importHtml} />
            </label>
            <button
              className="secondary-action small"
              type="button"
              onClick={exportJson}
              title={`Export the ${visibleKpis.length} currently filtered KPI${visibleKpis.length === 1 ? '' : 's'} as JSON`}
            >
              <FileJson size={15} aria-hidden="true" />
              Export as JSON
            </button>
            <button className="primary-action small" type="button" onClick={exportHtml}>
              <Download size={15} aria-hidden="true" />
              Export HTML
            </button>
          </div>
        </div>
        <div className="topbar-row topbar-secondary-row">
          <div className="topbar-focus-and-library">
          <UseCaseFocusController
            config={config}
            examineAssignment={examineAssignment}
            focusAssignment={focusedAssignment}
            hideUnassigned={hideOutsideFocusedGroup}
            onExamineAssignmentChange={setExamineAssignment}
            onEnterFocus={enterUseCaseFocus}
            onExitFocus={exitUseCaseFocus}
            onHideUnassignedChange={setHideOutsideFocusedGroup}
          />
          <DataSourceHeader
            config={config}
            onConfigChange={setConfigAndRepairExpansion}
            editRequest={sourceLibraryEditRequest}
            onEditLibrarySource={editLibrarySource}
          />
          </div>
          <div className="topbar-actions topbar-actions-right">
            <button className="secondary-action small" type="button" onClick={() => updateFilters(emptyFilters())} disabled={!filterCount}>
              <X size={14} aria-hidden="true" />
              Clear filters
            </button>
            <button className="secondary-action small" type="button" onClick={collapseAllRows} disabled={expandedIds.length === 0}>
              <ChevronsUp size={15} aria-hidden="true" />
              Collapse all
            </button>
          </div>
        </div>
      </header>

      {saveState === 'error' ? (
        <div className="save-error-bar" role="alert">
          <strong>Hosted JSON was not updated.</strong> {saveNotice} Your local edits remain unsaved.
        </div>
      ) : null}

      <WarningBar warnings={warnings} onDismiss={() => setWarnings([])} />

      <section className="workspace table-workspace">
        <KpiTable
          config={config}
          kpis={visibleKpis}
          filters={filters}
          expandedIds={expandedIds}
          onFiltersChange={updateFilters}
          onConfigChange={setConfigAndRepairExpansion}
          onToggleExpanded={toggleExpanded}
          onKpiChange={updateKpiFromRow}
          onDelete={deleteKpi}
          onDuplicate={duplicateKpi}
          onReorder={reorderKpi}
          onAddKpi={addKpi}
          onEditLibrarySource={editLibrarySource}
          focusedAssignment={focusedAssignment}
          performanceAreaSort={performanceAreaSort}
          onPerformanceAreaSortChange={setPerformanceAreaSort}
        />
      </section>
    </main>
  );
}

type HostedAppState =
  | { kind: 'loading' }
  | { kind: 'locked'; error?: string }
  | { kind: 'ready'; secret: string; result: RemoteConfigResult };

function HostedUnlock({
  loading,
  error,
  onUnlock
}: {
  loading: boolean;
  error?: string;
  onUnlock: (secret: string) => Promise<void>;
}) {
  const [secret, setSecret] = useState('');

  return (
    <main className="connection-screen">
      <form
        className="connection-panel"
        onSubmit={(event) => {
          event.preventDefault();
          if (secret) {
            void onUnlock(secret);
          }
        }}
      >
        <Cloud size={28} aria-hidden="true" />
        <div>
          <h1>KPI Library Manager</h1>
          <p>Enter the shared library secret to load the hosted JSON.</p>
        </div>
        <label>
          <span>Library secret</span>
          <input
            type="password"
            value={secret}
            onChange={(event) => setSecret(event.target.value)}
            autoComplete="current-password"
            autoFocus
            disabled={loading}
          />
        </label>
        {error ? <p className="connection-error" role="alert">{error}</p> : null}
        <button className="primary-action" type="submit" disabled={!secret || loading}>
          {loading ? 'Loading...' : 'Open library'}
        </button>
        <p className="connection-note">The secret is retained only for this browser session.</p>
      </form>
    </main>
  );
}

export function App() {
  const [embeddedLoadState] = useState<LoadState>(() => readEmbeddedConfig());
  const [exportedSnapshot] = useState(() => document.documentElement.getAttribute(EXPORTED_SNAPSHOT_ATTRIBUTE) === 'true');
  const [hostedState, setHostedState] = useState<HostedAppState>({ kind: 'loading' });
  const [unlockLoading, setUnlockLoading] = useState(false);

  useEffect(() => {
    if (exportedSnapshot) {
      return;
    }

    const storedSecret = window.sessionStorage.getItem(LIBRARY_SECRET_SESSION_KEY);
    if (!storedSecret) {
      setHostedState({ kind: 'locked' });
      return;
    }

    let active = true;
    loadRemoteConfig(storedSecret)
      .then((result) => {
        if (active) {
          setHostedState({ kind: 'ready', secret: storedSecret, result });
        }
      })
      .catch((error) => {
        if (!active) {
          return;
        }
        if (error instanceof RemoteConfigError && error.status === 401) {
          window.sessionStorage.removeItem(LIBRARY_SECRET_SESSION_KEY);
        }
        setHostedState({ kind: 'locked', error: error instanceof Error ? error.message : 'The hosted JSON could not be loaded.' });
      });

    return () => {
      active = false;
    };
  }, [exportedSnapshot]);

  const unlock = async (secret: string) => {
    setUnlockLoading(true);
    try {
      const result = await loadRemoteConfig(secret);
      window.sessionStorage.setItem(LIBRARY_SECRET_SESSION_KEY, secret);
      setHostedState({ kind: 'ready', secret, result });
    } catch (error) {
      window.sessionStorage.removeItem(LIBRARY_SECRET_SESSION_KEY);
      setHostedState({ kind: 'locked', error: error instanceof Error ? error.message : 'The hosted JSON could not be loaded.' });
    } finally {
      setUnlockLoading(false);
    }
  };

  if (exportedSnapshot) {
    return (
      <EditorApp
        initialConfig={embeddedLoadState.config}
        initialWarnings={embeddedLoadState.warnings}
        initialEtag={null}
        initialRemoteExists
        exportedSnapshot
      />
    );
  }

  if (hostedState.kind === 'loading') {
    return (
      <main className="connection-screen">
        <div className="connection-panel loading-panel">
          <Cloud size={28} aria-hidden="true" />
          <h1>KPI Library Manager</h1>
          <p>Connecting to the hosted JSON...</p>
        </div>
      </main>
    );
  }

  if (hostedState.kind === 'locked') {
    return <HostedUnlock loading={unlockLoading} error={hostedState.error} onUnlock={unlock} />;
  }

  return (
    <EditorApp
      initialConfig={hostedState.result.config}
      initialWarnings={hostedState.result.warnings ?? []}
      initialEtag={hostedState.result.etag}
      initialRemoteExists={hostedState.result.exists !== false}
      hostedSecret={hostedState.secret}
      exportedSnapshot={false}
      onAuthorizationLost={() => {
        window.sessionStorage.removeItem(LIBRARY_SECRET_SESSION_KEY);
        setHostedState({ kind: 'locked', error: 'Library access expired. Enter the shared secret again.' });
      }}
    />
  );
}
