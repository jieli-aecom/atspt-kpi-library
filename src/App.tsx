import { memo, useCallback, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentProps } from 'react';
import { BlockMath, InlineMath } from 'react-katex';
import katex, { type TrustContext } from 'katex';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  BookOpen,
  Check,
  ChevronDown,
  ChevronsDown,
  ChevronsUp,
  Columns3,
  Copy,
  Cloud,
  Database,
  Download,
  FileJson,
  GripVertical,
  Gauge,
  Info,
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
  type EnumOption,
  type EnumCategoryKey,
  type DataSource,
  type DataSourceField,
  type DataSourceFieldDimension,
  type DataSourceFieldGroup,
  type LookupDefinition,
  type LookupInput,
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

type UseCaseAssignment = {
  userGroup: string;
  useCase: string;
};

const validDefaultFocus = (config: KpiPoolConfig, focus?: KpiDefaultFocus): UseCaseAssignment | undefined =>
  focus && config.enums.useCase.some((option) => option.id === focus.useCase && option.userGroup === focus.userGroup)
    ? { userGroup: focus.userGroup, useCase: focus.useCase }
    : undefined;

const categoryFields: KpiEnumCategoryKey[] = [];

const initialColumnWidths = [170, 145, 185, 334, 251, 115, 120, 135, 180, 138];
const minColumnWidths = [150, 115, 145, 240, 180, 100, 105, 110, 145, 118];
const defaultHiddenEnumColumns: KpiEnumCategoryKey[] = ['previousApplication', 'federalRequirement'];
const estimatedCollapsedRowHeight = 78;
const estimatedExpandedRowHeight = 960;
const virtualOverscanPixels = 760;
const rowDragAutoScrollEdge = 52;
const rowDragAutoScrollStep = 18;
const rowHeightKey = (id: string, expanded: boolean) => `${id}:${expanded ? 'expanded' : 'collapsed'}`;

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
  const sourceCatalogsStable = previousConfig?.dataSources === config.dataSources && previousConfig.lookups === config.lookups;
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

function useCloseOnOutsideClick<T extends HTMLElement>(open: boolean, onClose: () => void) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && ref.current?.contains(target)) {
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
  }, [open, onClose]);

  return ref;
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

const kpiMaterialJson = (kpi: KpiMetric) => {
  const { lastModified: _lastModified, ...material } = kpi;
  return JSON.stringify(material);
};

const sameKpiMaterial = (left: KpiMetric, right: KpiMetric) => kpiMaterialJson(left) === kpiMaterialJson(right);

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

const duplicateKpiMetric = (kpi: KpiMetric): KpiMetric => ({
  id: createBlankKpi().id,
  lastModified: new Date().toISOString(),
  name: `${kpi.name || 'Untitled KPI'} Copy`,
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
  performanceArea: [...kpi.performanceArea],
  performanceAreasByUseCase: kpi.performanceAreasByUseCase.map((entry) => ({
    useCase: entry.useCase,
    performanceAreas: [...entry.performanceAreas]
  })),
  notesByUseCase: kpi.notesByUseCase.map((entry) => ({
    useCase: entry.useCase,
    note: entry.note
  })),
  userGroupUseCases: kpi.userGroupUseCases.map((entry) => ({
    userGroup: entry.userGroup,
    useCases: [...entry.useCases]
  }))
});

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
                      title="Delete enum option"
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
    <section className="topbar-focus-controller" aria-label="Use case focus controller">
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

function SpatialScaleBadges({ config, kpi }: { config: KpiPoolConfig; kpi: KpiMetric }) {
  const normalFormulaItems = kpi.description.formulas.flatMap((group) => group.items);
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
            <InteractiveFormulaPreview config={config} kpi={kpi} item={item} priorItems={normalFormulaItems} inline />
          </div>
        );
      })}
    </div>
  );
}

function FormulaDisplay({ config, kpi }: { config: KpiPoolConfig; kpi: KpiMetric }) {
  const formulas = kpi.description.formulas;
  const comment = kpi.description.formulaComment;
  const allFormulaItems = formulas.flatMap((group) => group.items);
  const hasFormula = formulas.some((group) => group.items.some((item) => item.formula.trim()));
  const displayRef = useRef<HTMLDivElement | null>(null);
  const [hasVisibleOverflow, setHasVisibleOverflow] = useState(false);

  useLayoutEffect(() => {
    const element = displayRef.current;
    if (!element) return undefined;
    let active = true;

    const measure = () => {
      if (!active) return;
      const containerRect = element.getBoundingClientRect();
      const paddingBottom = Number.parseFloat(getComputedStyle(element).paddingBottom) || 0;
      const visibleContentBottom = Array.from(element.children).reduce(
        (bottom, child) => Math.max(bottom, child.getBoundingClientRect().bottom - containerRect.top + element.scrollTop),
        0
      );
      const nextHasVisibleOverflow = visibleContentBottom > element.clientHeight - paddingBottom + 1;
      setHasVisibleOverflow((current) => (current === nextHasVisibleOverflow ? current : nextHasVisibleOverflow));
    };

    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(element);
    Array.from(element.children).forEach((child) => observer?.observe(child));
    void document.fonts?.ready.then(measure);

    return () => {
      active = false;
      observer?.disconnect();
    };
  }, [comment, formulas, hasFormula]);

  const displayClassName = `formula-display${hasVisibleOverflow ? ' has-visible-overflow' : ''}`;
  if (!hasFormula) {
    return (
      <div className={`${displayClassName} formula-comment-display`} ref={displayRef}>
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
    <div className={displayClassName} ref={displayRef}>
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
                        priorItems={allFormulaItems.slice(0, allFormulaItems.indexOf(item))}
                        inline
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
};

function AutoGrowTextarea({ value, onValueChange, preventLineBreaks = false, ...props }: AutoGrowTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

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
  }, [value]);

  return (
    <textarea
      {...props}
      ref={textareaRef}
      value={value}
      onChange={(event) => onValueChange(event.target.value)}
      onKeyDown={(event) => {
        if (preventLineBreaks && event.key === 'Enter') {
          event.preventDefault();
        }
        props.onKeyDown?.(event);
      }}
    />
  );
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

const sourceItemLabel = (config: KpiPoolConfig, item: KpiSourceItem) => {
  if (item.type === 'custom') {
    return item.name || 'Untitled custom source';
  }
  if (item.type === 'kpi') {
    return config.kpis.find((kpi) => kpi.id === item.kpiId)?.name ?? 'Missing KPI';
  }
  if (item.type === 'lookup') {
    return config.lookups.find((lookup) => lookup.id === item.lookupId)?.outputName ?? 'Missing lookup';
  }
  const source = config.dataSources.find((entry) => entry.id === item.dataSourceId);
  const field = source?.fields.find((entry) => entry.id === item.fieldId);
  const group = source?.fieldGroups.find((entry) => entry.fieldIds.includes(item.fieldId));
  const dimensionNames = group?.dimensions.map((dimension) => dimension.name.trim()).filter(Boolean) ?? [];
  const dimensionLabel = dimensionNames.length ? ` [${dimensionNames.join(', ')}]` : '';
  return `${source?.name ?? 'Missing source'} / ${field?.name ?? 'Missing field'}${dimensionLabel}`;
};

const sourceItemTooltip = (config: KpiPoolConfig, item: KpiSourceItem) => {
  const label = sourceItemLabel(config, item);
  if (item.type === 'lookup') {
    const explanation = config.lookups.find((lookup) => lookup.id === item.lookupId)?.outputExplanation.trim();
    return explanation ? `${label}\n${explanation}` : label;
  }
  if (item.type !== 'dataField') return label;
  const source = config.dataSources.find((entry) => entry.id === item.dataSourceId);
  const meaning = source?.fields.find((entry) => entry.id === item.fieldId)?.meaning.trim();
  return meaning ? `${label}\n${meaning}` : label;
};

const lookupDefaultLatex = (lookup: LookupDefinition) => {
  const name = lookup.outputName.trim().replace(/\s+/g, '\\ ') || 'Lookup';
  return `${name}(${','.repeat(Math.max(0, lookup.inputs.length - 1))})`;
};

const selectedDataSourceGroups = (config: KpiPoolConfig, kpi: KpiMetric) =>
  config.dataSources.flatMap((dataSource) => {
    const items = kpi.sources.flatMap((source) => {
      if (source.type !== 'dataField' || source.dataSourceId !== dataSource.id) return [];
      const field = dataSource.fields.find((entry) => entry.id === source.fieldId);
      return field ? [{ source, field }] : [];
    });
    return items.length ? [{ dataSource, items }] : [];
  });

const latexIdentifier = (value: string) => value.trim().replace(/\s+/g, '\\ ');

const sourceFieldDefaultLatex = (fieldName: string, spatialUnit: string, dimensions: DataSourceFieldDimension[] = []) => {
  const field = latexIdentifier(fieldName);
  const spatial = latexIdentifier(spatialUnit);
  const dimensionTags = dimensions.map((dimension) => latexIdentifier(dimension.name)).filter(Boolean);
  const subscript = [...dimensionTags, spatial].filter(Boolean).join(', ');
  return subscript ? `${field}_{${subscript}}` : field;
};

const fieldGroupDimensionLabel = (group?: DataSourceFieldGroup) =>
  group?.dimensions.map((dimension) => dimension.name.trim()).filter(Boolean).join(', ') ?? '';

function DataSourceHeader({
  config,
  filter,
  onFilterChange,
  onConfigChange
}: {
  config: KpiPoolConfig;
  filter: string;
  onFilterChange: (value: string) => void;
  onConfigChange: (next: KpiPoolConfig) => void;
}) {
  const [open, setOpen] = useState(false);
  const [expandedSourceIds, setExpandedSourceIds] = useState<string[]>([]);
  const [collapsedFieldGroupIds, setCollapsedFieldGroupIds] = useState<string[]>([]);
  const [expandedLookupIds, setExpandedLookupIds] = useState<string[]>([]);
  const [lookupsExpanded, setLookupsExpanded] = useState(false);
  const [fieldGroupDimensionDrafts, setFieldGroupDimensionDrafts] = useState<Record<string, string>>({});
  const [dimensionOptionDrafts, setDimensionOptionDrafts] = useState<Record<string, string>>({});
  const controlRef = useRef<HTMLDivElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [sourceDragIndex, setSourceDragIndex] = useState<number | null>(null);
  const [sourceDragOver, setSourceDragOver] = useState<{ sourceIndex: number; position: DropPosition } | null>(null);
  const [fieldDrag, setFieldDrag] = useState<{ sourceIndex: number; fieldIndex: number } | null>(null);
  const [fieldDragOver, setFieldDragOver] = useState<{ sourceIndex: number; fieldIndex: number; position: DropPosition } | null>(null);
  const [fieldInsertDragOver, setFieldInsertDragOver] = useState<{ sourceIndex: number; targetKey: string } | null>(null);
  const [fieldGroupDragOver, setFieldGroupDragOver] = useState<{ sourceIndex: number; groupId?: string } | null>(null);
  const [popoverPosition, setPopoverPosition] = useState<{ top: number; left: number; width: number; maxHeight: number }>();
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
      setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);
  const patchDataSources = (dataSources: DataSource[]) => {
    onConfigChange({ ...config, dataSources });
  };
  const patchLookups = (lookups: LookupDefinition[]) => onConfigChange({ ...config, lookups });
  const addLookup = (insertionIndex = config.lookups.length) => {
    const lookup: LookupDefinition = {
      id: createLocalId('lookup'),
      outputName: 'New lookup',
      outputExplanation: '',
      inputs: []
    };
    const index = Math.max(0, Math.min(insertionIndex, config.lookups.length));
    patchLookups([...config.lookups.slice(0, index), lookup, ...config.lookups.slice(index)]);
    setLookupsExpanded(true);
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
    patchLookups([...config.lookups.slice(0, lookupIndex + 1), duplicate, ...config.lookups.slice(lookupIndex + 1)]);
    setExpandedLookupIds((current) => [...new Set([...current, duplicate.id])]);
  };
  const deleteLookup = (lookupIndex: number) => {
    const lookupId = config.lookups[lookupIndex]?.id;
    if (!lookupId) return;
    setExpandedLookupIds((current) => current.filter((id) => id !== lookupId));
    onConfigChange({
      ...config,
      lookups: config.lookups.filter((_, index) => index !== lookupIndex),
      kpis: config.kpis.map((kpi) => ({
        ...kpi,
        sources: kpi.sources.filter((source) => source.type !== 'lookup' || source.lookupId !== lookupId)
      }))
    });
  };
  const addLookupInput = (lookupIndex: number, insertionIndex?: number) => {
    const lookup = config.lookups[lookupIndex];
    const index = Math.max(0, Math.min(insertionIndex ?? lookup.inputs.length, lookup.inputs.length));
    const input: LookupInput = { id: createLocalId('lookup-input'), representation: '', explanation: '' };
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
  const addDataSource = (insertionIndex = config.dataSources.length) => {
    const source: DataSource = { id: createLocalId('source'), name: 'New data source', spatialUnit: '', fields: [], fieldGroups: [] };
    const index = Math.max(0, Math.min(insertionIndex, config.dataSources.length));
    patchDataSources([...config.dataSources.slice(0, index), source, ...config.dataSources.slice(index)]);
    setExpandedSourceIds((current) => [...new Set([...current, source.id])]);
  };
  const toggleDataSource = (sourceId: string) =>
    setExpandedSourceIds((current) => current.includes(sourceId) ? current.filter((id) => id !== sourceId) : [...current, sourceId]);
  const duplicateDataSource = (sourceIndex: number) => {
    const source = config.dataSources[sourceIndex];
    if (!source) return;
    const fieldIdMap = new Map(source.fields.map((field) => [field.id, createLocalId('field')]));
    const duplicate: DataSource = {
      ...source,
      id: createLocalId('source'),
      name: `${source.name || 'Untitled data source'} copy`,
      fields: source.fields.map((field) => ({ ...field, id: fieldIdMap.get(field.id)! })),
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
    onConfigChange({
      ...config,
      dataSources: config.dataSources.filter((_, index) => index !== sourceIndex),
      kpis: config.kpis.map((kpi) => ({
        ...kpi,
        sources: kpi.sources.filter((source) => source.type !== 'dataField' || source.dataSourceId !== sourceId)
      }))
    });
  };
  const updateField = (sourceIndex: number, fieldIndex: number, partial: Partial<DataSourceField>) => {
    const source = config.dataSources[sourceIndex];
    updateDataSource(sourceIndex, {
      fields: source.fields.map((field, index) => index === fieldIndex ? { ...field, ...partial } : field)
    });
  };
  const addField = (sourceIndex: number, insertionIndex?: number, groupId?: string, shiftGroupsAtPosition = false) => {
    const source = config.dataSources[sourceIndex];
    const index = Math.max(0, Math.min(insertionIndex ?? source.fields.length, source.fields.length));
    const field = { id: createLocalId('field'), name: 'New field', meaning: '', valueUnit: '' };
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
    const duplicate = { ...field, id: createLocalId('field'), name: `${field.name || 'Untitled field'} copy` };
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
    const value = (fieldGroupDimensionDrafts[groupId] ?? '').trim();
    if (!value) return;
    const source = config.dataSources[sourceIndex];
    const group = source.fieldGroups.find((entry) => entry.id === groupId);
    if (!group) return;
    if (!group.dimensions.some((dimension) => dimension.name.toLocaleLowerCase() === value.toLocaleLowerCase())) {
      updateFieldGroup(sourceIndex, groupId, {
        dimensions: [...group.dimensions, { id: createLocalId('dimension'), name: value, options: [] }]
      });
    }
    setFieldGroupDimensionDrafts((current) => ({ ...current, [groupId]: '' }));
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
    setDimensionOptionDrafts((current) => {
      const { [dimensionId]: _removedDraft, ...remaining } = current;
      return remaining;
    });
  };
  const addDimensionOption = (sourceIndex: number, groupId: string, dimensionId: string) => {
    const value = (dimensionOptionDrafts[dimensionId] ?? '').trim();
    if (!value) return;
    const source = config.dataSources[sourceIndex];
    const group = source.fieldGroups.find((entry) => entry.id === groupId);
    const dimension = group?.dimensions.find((entry) => entry.id === dimensionId);
    if (!dimension) return;
    if (!dimension.options.some((option) => option.toLocaleLowerCase() === value.toLocaleLowerCase())) {
      updateFieldGroupDimension(sourceIndex, groupId, dimensionId, { options: [...dimension.options, value] });
    }
    setDimensionOptionDrafts((current) => ({ ...current, [dimensionId]: '' }));
  };
  const removeDimensionOption = (sourceIndex: number, groupId: string, dimensionId: string, option: string) => {
    const source = config.dataSources[sourceIndex];
    const group = source.fieldGroups.find((entry) => entry.id === groupId);
    const dimension = group?.dimensions.find((entry) => entry.id === dimensionId);
    if (!dimension) return;
    updateFieldGroupDimension(sourceIndex, groupId, dimensionId, {
      options: dimension.options.filter((entry) => entry !== option)
    });
  };
  const assignFieldToGroup = (sourceIndex: number, fieldId: string, groupId?: string) => {
    const source = config.dataSources[sourceIndex];
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
    setFieldGroupDimensionDrafts((current) => {
      const { [groupId]: _removedDraft, ...remaining } = current;
      return remaining;
    });
    const removedDimensionIds = new Set(source.fieldGroups.find((group) => group.id === groupId)?.dimensions.map((dimension) => dimension.id) ?? []);
    setDimensionOptionDrafts((current) => Object.fromEntries(
      Object.entries(current).filter(([dimensionId]) => !removedDimensionIds.has(dimensionId))
    ));
    updateDataSource(sourceIndex, { fieldGroups: source.fieldGroups.filter((group) => group.id !== groupId) });
  };
  const moveField = (sourceIndex: number, targetIndex: number, position: DropPosition, groupId?: string, shiftGroupsAtTarget = true) => {
    if (!fieldDrag || fieldDrag.sourceIndex !== sourceIndex) return;
    const source = config.dataSources[sourceIndex];
    const fields = [...source.fields];
    const sourceFieldIndex = fieldDrag.fieldIndex;
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
    const fieldId = source.fields[fieldIndex]?.id;
    onConfigChange({
      ...config,
      dataSources: config.dataSources.map((entry, index) =>
        index === sourceIndex ? {
          ...entry,
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

  return (
    <div className="source-header-control" ref={controlRef}>
      <div className="header-title">
        <span>Source</span>
        <strong>{config.dataSources.length + config.lookups.length}</strong>
        <button className="mini-icon-button" type="button" title="Manage data sources" aria-label="Manage data sources" onClick={() => setOpen((value) => !value)}>
          <Database size={13} aria-hidden="true" />
        </button>
      </div>
      <label className="header-search">
        <Search size={13} aria-hidden="true" />
        <input value={filter} placeholder="Search sources..." onChange={(event) => onFilterChange(event.target.value)} />
      </label>
      {open && popoverPosition ? createPortal(
        <div
          className="data-source-popover"
          ref={popoverRef}
          role="dialog"
          aria-label="Data source library"
          style={popoverPosition}
        >
          <div className="data-source-popover-heading">
            <div>
              <strong>Data source library</strong>
              <span>Define table sources, fields, and reusable lookups.</span>
            </div>
            <div className="data-source-library-actions">
              <button className="secondary-action tiny" type="button" onClick={() => addLookup()}><Plus size={12} /> Add lookup</button>
              <button className="primary-action tiny" type="button" onClick={() => addDataSource()}><Plus size={12} /> Add table source</button>
            </div>
          </div>
          <div className="data-source-list">
            <section className="lookup-library">
              <div className="lookup-library-heading">
                <button
                  className="lookup-library-toggle"
                  type="button"
                  aria-expanded={lookupsExpanded}
                  aria-controls="lookup-library-list"
                  onClick={() => setLookupsExpanded((value) => !value)}
                >
                  <ChevronDown className={`lookup-library-chevron ${lookupsExpanded ? 'is-expanded' : ''}`} size={13} aria-hidden="true" />
                  <BookOpen size={14} aria-hidden="true" />
                  <strong>Lookups</strong>
                  <small>{config.lookups.length}</small>
                </button>
                <button className="secondary-action tiny" type="button" onClick={() => addLookup()}><Plus size={11} /> Add lookup</button>
              </div>
              {lookupsExpanded ? <div className="lookup-library-list" id="lookup-library-list">
                {config.lookups.length === 0 ? <span className="empty-option">No lookups defined.</span> : null}
                {config.lookups.flatMap((lookup, lookupIndex) => [
                  <button className="list-insert-divider" type="button" key={`insert-lookup-${lookup.id}`} onClick={() => addLookup(lookupIndex)}><Plus size={11} aria-hidden="true" />Add lookup here</button>,
                  <details className="lookup-definition" key={lookup.id} open={expandedLookupIds.includes(lookup.id)} onToggle={(event) => {
                    const isOpen = event.currentTarget.open;
                    setExpandedLookupIds((current) => isOpen ? [...new Set([...current, lookup.id])] : current.filter((id) => id !== lookup.id));
                  }}>
                    <summary>
                      <BookOpen size={13} aria-hidden="true" />
                      <span><strong>{lookup.outputName.trim() || 'Untitled lookup'}</strong><small>{lookup.inputs.length} {lookup.inputs.length === 1 ? 'input' : 'inputs'}</small></span>
                      <code>{lookupDefaultLatex(lookup)}</code>
                      <ChevronDown size={12} aria-hidden="true" />
                    </summary>
                    <div className="lookup-definition-body">
                      <div className="lookup-output-fields">
                        <label className="field"><span>Output name</span><input value={lookup.outputName} onChange={(event) => updateLookup(lookupIndex, { outputName: event.target.value })} /></label>
                        <label className="field"><span>Output explanation</span><input value={lookup.outputExplanation} placeholder="What the lookup returns" onChange={(event) => updateLookup(lookupIndex, { outputExplanation: event.target.value })} /></label>
                        <div className="lookup-definition-actions">
                          <button className="mini-icon-button" type="button" title="Copy lookup" onClick={() => duplicateLookup(lookupIndex)}><Copy size={12} /></button>
                          <button className="mini-icon-button danger" type="button" title="Delete lookup" onClick={() => deleteLookup(lookupIndex)}><Trash2 size={12} /></button>
                        </div>
                      </div>
                      <div className="lookup-input-heading"><span>Input representation</span><span>Explanation</span><span>Actions</span></div>
                      {lookup.inputs.length === 0 ? <span className="empty-option">No input variables.</span> : null}
                      {lookup.inputs.flatMap((input, inputIndex) => [
                        <button className="list-insert-divider lookup-input-insert" type="button" key={`insert-lookup-input-${input.id}`} onClick={() => addLookupInput(lookupIndex, inputIndex)}><Plus size={10} aria-hidden="true" />Add input here</button>,
                        <div className="lookup-input-row" key={input.id}>
                          <input value={input.representation} aria-label="Input variable representation" placeholder="Short text" onChange={(event) => updateLookupInput(lookupIndex, inputIndex, { representation: event.target.value })} />
                          <input value={input.explanation} aria-label="Input variable explanation" placeholder="What this input represents" onChange={(event) => updateLookupInput(lookupIndex, inputIndex, { explanation: event.target.value })} />
                          <div className="lookup-definition-actions">
                            <button className="mini-icon-button" type="button" title="Copy input" onClick={() => duplicateLookupInput(lookupIndex, inputIndex)}><Copy size={11} /></button>
                            <button className="mini-icon-button danger" type="button" title="Delete input" onClick={() => deleteLookupInput(lookupIndex, inputIndex)}><Trash2 size={11} /></button>
                          </div>
                        </div>
                      ])}
                      <button className="secondary-action tiny lookup-add-input" type="button" onClick={() => addLookupInput(lookupIndex)}><Plus size={11} /> Add input</button>
                    </div>
                  </details>
                ])}
              </div> : null}
            </section>
            {config.dataSources.length === 0 ? <span className="empty-option">No data sources defined.</span> : null}
            {config.dataSources.map((source, sourceIndex) => {
              const expanded = expandedSourceIds.includes(source.id);
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
              const renderFieldRow = (field: DataSourceField, fieldIndex: number, groupId?: string) => (
                <div
                  className={`data-source-field-row ${fieldDragOver?.sourceIndex === sourceIndex && fieldDragOver.fieldIndex === fieldIndex ? `is-drag-over-${fieldDragOver.position}` : ''}`}
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
                  <button
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
                  ><GripVertical size={13} aria-hidden="true" /></button>
                  <input value={field.name} aria-label="Field name" onChange={(event) => updateField(sourceIndex, fieldIndex, { name: event.target.value })} />
                  <input value={field.meaning} aria-label="Field meaning" placeholder="What the field represents" onChange={(event) => updateField(sourceIndex, fieldIndex, { meaning: event.target.value })} />
                  <input value={field.valueUnit} aria-label="Field value unit" placeholder="mph, vehicles, %..." onChange={(event) => updateField(sourceIndex, fieldIndex, { valueUnit: event.target.value })} />
                  <div className="data-source-field-actions">
                    <button
                      className="mini-icon-button"
                      type="button"
                      title="Copy field"
                      aria-label={`Copy ${field.name || 'field'}`}
                      onClick={() => copyField(sourceIndex, fieldIndex)}
                    ><Copy size={12} /></button>
                    <button className="mini-icon-button danger" type="button" title="Delete field" onClick={() => deleteField(sourceIndex, fieldIndex)}><Trash2 size={12} /></button>
                  </div>
                </div>
              );
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
                      <small>{group.fieldIds.length} {group.fieldIds.length === 1 ? 'field' : 'fields'} · {group.dimensions.length ? group.dimensions.map((dimension) => `${dimension.name || 'Untitled dimension'}: ${dimension.options.length ? dimension.options.join(', ') : 'no options'}`).join(' · ') : 'add dimensions'}</small>
                      <ChevronDown size={12} aria-hidden="true" />
                    </summary>
                    <div className="data-source-field-group-body">
                      <div className="data-source-field-group-settings">
                        <div className="field-group-dimension-list">
                          {group.dimensions.map((dimension) => (
                            <div className="field-group-dimension-row" key={dimension.id}>
                              <label className="data-source-field-group-control">
                                <small>Dimension name used in the subscript</small>
                                <input value={dimension.name} aria-label="Dimension name" placeholder="Mode" onChange={(event) => updateFieldGroupDimension(sourceIndex, group.id, dimension.id, { name: event.target.value })} />
                              </label>
                              <div className="data-source-field-group-control">
                                <small>Dimension options (library and formula shortcuts)</small>
                                <div className="field-group-dimension-options">
                                  {dimension.options.map((option) => (
                                    <span className="field-group-dimension-chip" key={option}>
                                      <span>{option}</span>
                                      <button type="button" title={`Remove ${option}`} aria-label={`Remove dimension option ${option}`} onClick={() => removeDimensionOption(sourceIndex, group.id, dimension.id, option)}><X size={10} /></button>
                                    </span>
                                  ))}
                                  <span className="field-group-dimension-adder">
                                    <input
                                      value={dimensionOptionDrafts[dimension.id] ?? ''}
                                      aria-label={`New option for ${dimension.name || 'dimension'}`}
                                      placeholder="Add option"
                                      onChange={(event) => setDimensionOptionDrafts((current) => ({ ...current, [dimension.id]: event.target.value }))}
                                      onKeyDown={(event) => {
                                        if (event.key !== 'Enter') return;
                                        event.preventDefault();
                                        addDimensionOption(sourceIndex, group.id, dimension.id);
                                      }}
                                    />
                                    <button type="button" title="Add dimension option" aria-label="Add dimension option" disabled={!(dimensionOptionDrafts[dimension.id] ?? '').trim()} onClick={() => addDimensionOption(sourceIndex, group.id, dimension.id)}><Plus size={11} /></button>
                                  </span>
                                </div>
                              </div>
                              <button className="mini-icon-button danger" type="button" title="Delete dimension" aria-label={`Delete ${dimension.name || 'dimension'}`} onClick={() => removeFieldGroupDimension(sourceIndex, group.id, dimension.id)}><Trash2 size={12} /></button>
                            </div>
                          ))}
                          <div className="field-group-dimension-add">
                            <input
                              value={fieldGroupDimensionDrafts[group.id] ?? ''}
                              aria-label="New dimension name"
                              placeholder="Mode, distance band, cost band..."
                              onChange={(event) => setFieldGroupDimensionDrafts((current) => ({ ...current, [group.id]: event.target.value }))}
                              onKeyDown={(event) => {
                                if (event.key !== 'Enter') return;
                                event.preventDefault();
                                addFieldGroupDimension(sourceIndex, group.id);
                              }}
                            />
                            <button className="secondary-action tiny" type="button" disabled={!(fieldGroupDimensionDrafts[group.id] ?? '').trim()} onClick={() => addFieldGroupDimension(sourceIndex, group.id)}><Plus size={11} /> Add dimension</button>
                          </div>
                        </div>
                        <button className="mini-icon-button danger" type="button" title="Delete dimensioned field set" aria-label="Delete dimensioned field set" onClick={() => deleteFieldGroup(sourceIndex, group.id)}><Trash2 size={12} /></button>
                      </div>
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
                        <small>{source.spatialUnit.trim() || 'No spatial unit'} · {source.fields.length} {source.fields.length === 1 ? 'field' : 'fields'}</small>
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
                        <label className="field"><span>Spatial unit</span><input value={source.spatialUnit} placeholder="Link, parcel, station..." onChange={(event) => updateDataSource(sourceIndex, { spatialUnit: event.target.value })} /></label>
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
                        <div className="data-source-field-heading"><span /><span>Fields without dimensions</span><span>Meaning</span><span>Value unit</span><span>Actions</span></div>
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
                        </div>
                      </div>
                    </div>
                  ) : null}
                </section>
              ];
            })}
          </div>
        </div>,
        document.body
      ) : null}
    </div>
  );
}

function KpiSourceGroupedSummary({ config, kpi }: { config: KpiPoolConfig; kpi: KpiMetric }) {
  const dataGroups = selectedDataSourceGroups(config, kpi);
  const prerequisiteKpis = kpi.sources.flatMap((source) =>
    source.type === 'kpi' ? [{ source, kpi: config.kpis.find((entry) => entry.id === source.kpiId) }] : []
  );
  const customSources = kpi.sources.filter((source) => source.type === 'custom');
  const lookupSources = kpi.sources.flatMap((source) => source.type === 'lookup'
    ? [{ source, lookup: config.lookups.find((lookup) => lookup.id === source.lookupId) }]
    : []
  );

  return (
    <span className="kpi-source-summary">
      {dataGroups.map(({ dataSource, items }) => (
        <span className="source-summary-group" key={dataSource.id}>
          <span className="source-summary-heading"><Table2 size={12} aria-hidden="true" /><span>{dataSource.name}</span></span>
          <span className="source-summary-items">{items.map(({ source, field }) => {
            const dimensionLabel = fieldGroupDimensionLabel(dataSource.fieldGroups.find((group) => group.fieldIds.includes(field.id)));
            return <span className="source-summary-item" key={source.id} title={sourceItemTooltip(config, source)}>{field.name}{dimensionLabel ? ` [${dimensionLabel}]` : ''}</span>;
          })}</span>
        </span>
      ))}
      {prerequisiteKpis.length ? (
        <span className="source-summary-group">
          <span className="source-summary-heading"><Gauge size={12} aria-hidden="true" /><span>Prerequisite KPIs</span></span>
          <span className="source-summary-items">{prerequisiteKpis.map(({ source, kpi: prerequisite }) => <span className="source-summary-item" key={source.id}>{prerequisite?.name ?? 'Missing KPI'}</span>)}</span>
        </span>
      ) : null}
      {lookupSources.length ? (
        <span className="source-summary-group">
          <span className="source-summary-heading"><BookOpen size={12} aria-hidden="true" /><span>Lookups</span></span>
          <span className="source-summary-items">{lookupSources.map(({ source, lookup }) => <span className="source-summary-item" key={source.id} title={sourceItemTooltip(config, source)}>{lookup?.outputName ?? 'Missing lookup'}</span>)}</span>
        </span>
      ) : null}
      {customSources.length ? (
        <span className="source-summary-group">
          <span className="source-summary-heading"><Pencil size={12} aria-hidden="true" /><span>Custom sources</span></span>
          <span className="source-summary-items">{customSources.map((source) => <span className="source-summary-item" key={source.id}>{source.name}</span>)}</span>
        </span>
      ) : null}
    </span>
  );
}

function KpiSourceEditor({ config, kpi, onChange, compact = false }: { config: KpiPoolConfig; kpi: KpiMetric; onChange: (sources: KpiSourceItem[]) => void; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [pickerScope, setPickerScope] = useState('');
  const [query, setQuery] = useState('');
  const [customName, setCustomName] = useState('');
  const [customLatex, setCustomLatex] = useState('');
  const controlRef = useCloseOnOutsideClick<HTMLDivElement>(open, () => setOpen(false));
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
          latex: sourceFieldDefaultLatex(field?.name ?? '', dataSource?.spatialUnit ?? '', group?.dimensions)
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
  const updateItem = (id: string, partial: Partial<KpiSourceItem>) =>
    onChange(kpi.sources.map((item) => item.id === id ? { ...item, ...partial } as KpiSourceItem : item));
  const selectedDataSource = pickerScope.startsWith('data:')
    ? config.dataSources.find((source) => source.id === pickerScope.slice(5))
    : undefined;
  const visibleFields = selectedDataSource?.fields.filter((field) =>
    !normalizedQuery || normalize(`${field.name} ${field.meaning} ${field.valueUnit}`).includes(normalizedQuery)
  ) ?? [];
  const visibleKpis = config.kpis.filter((entry) =>
    entry.id !== kpi.id && (!normalizedQuery || normalize(`${entry.name} ${entry.description.overview}`).includes(normalizedQuery))
  );
  const visibleLookups = config.lookups.filter((lookup) =>
    !normalizedQuery || normalize(`${lookup.outputName} ${lookup.outputExplanation} ${lookup.inputs.map((input) => `${input.representation} ${input.explanation}`).join(' ')}`).includes(normalizedQuery)
  );
  const addCustomSource = () => {
    if (!customName.trim()) return;
    onChange([...kpi.sources, { id: createLocalId('kpi-source'), type: 'custom', name: customName.trim(), latex: customLatex }]);
    setCustomName('');
    setCustomLatex('');
  };
  const selectedDataGroups = selectedDataSourceGroups(config, kpi);
  const selectedKpiSources = kpi.sources.filter((source) => source.type === 'kpi');
  const selectedLookupSources = kpi.sources.filter((source) => source.type === 'lookup');
  const selectedCustomSources = kpi.sources.filter((source) => source.type === 'custom');
  const renderSelectedSourceRow = (item: KpiSourceItem, label: string) => (
    <div className={`selected-source-row ${item.type === 'custom' ? 'is-custom' : ''}`} key={item.id}>
      {item.type === 'custom'
        ? <input value={item.name} aria-label="Custom source name" onChange={(event) => updateItem(item.id, { name: event.target.value })} />
        : <span title={sourceItemTooltip(config, item)}>{label}</span>}
      <input className="latex-code-editor" value={item.latex} placeholder="LaTeX symbol" aria-label={`LaTeX for ${sourceItemLabel(config, item)}`} onChange={(event) => updateItem(item.id, { latex: event.target.value })} />
      <span className="source-latex-preview">{item.latex.trim() ? <InlineMath math={item.latex} errorColor="#b42318" /> : '—'}</span>
      <button className="mini-icon-button danger" type="button" title="Remove source" onClick={() => onChange(kpi.sources.filter((entry) => entry.id !== item.id))}><Trash2 size={12} /></button>
    </div>
  );
  return (
    <div className={`kpi-source-control ${compact ? 'is-compact' : ''}`} ref={controlRef}>
      <button className="cell-enum-trigger" type="button" onClick={() => setOpen((value) => !value)}>
        {kpi.sources.length ? <KpiSourceGroupedSummary config={config} kpi={kpi} /> : <span className="muted-dash">Select sources...</span>}
        <ChevronDown size={13} className={open ? 'rotate' : ''} />
      </button>
      {open ? (
        <div className="kpi-source-popover">
          <div className="popover-title">KPI sources</div>
          <div className="source-scope-buttons" aria-label="Add source from">
            <button className={pickerScope === 'kpis' ? 'is-active' : ''} type="button" onClick={() => { setPickerScope('kpis'); setQuery(''); }}><Gauge size={12} aria-hidden="true" />Other KPIs</button>
            <button className={pickerScope === 'lookups' ? 'is-active' : ''} type="button" onClick={() => { setPickerScope('lookups'); setQuery(''); }}><BookOpen size={12} aria-hidden="true" />Lookups</button>
            {config.dataSources.map((source) => (
              <button className={pickerScope === `data:${source.id}` ? 'is-active' : ''} type="button" key={source.id} onClick={() => { setPickerScope(`data:${source.id}`); setQuery(''); }}><Table2 size={12} aria-hidden="true" />{source.name}</button>
            ))}
            <button className={pickerScope === 'custom' ? 'is-active' : ''} type="button" onClick={() => { setPickerScope('custom'); setQuery(''); }}><Pencil size={12} aria-hidden="true" />Custom source</button>
          </div>
          {pickerScope === 'kpis' || pickerScope === 'lookups' || selectedDataSource ? (
            <label className="popover-search"><Search size={13} /><input value={query} autoFocus placeholder={pickerScope === 'kpis' ? 'Search KPIs…' : pickerScope === 'lookups' ? 'Search lookups…' : 'Search fields…'} onChange={(event) => setQuery(event.target.value)} /></label>
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
              {visibleLookups.length === 0 ? <span className="empty-option">No matching lookups.</span> : null}
              {visibleLookups.map((lookup) => (
                <label className="source-choice-row" key={lookup.id}>
                  <input type="checkbox" checked={kpi.sources.some((item) => item.type === 'lookup' && item.lookupId === lookup.id)} onChange={() => toggleLookup(lookup.id)} />
                  <span><strong>{lookup.outputName}</strong><small>{lookup.outputExplanation}{lookup.inputs.length ? ` · ${lookup.inputs.length} ${lookup.inputs.length === 1 ? 'input' : 'inputs'}` : ''}</small></span>
                </label>
              ))}
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
                  <label className="source-choice-row" key={field.id}>
                    <input type="checkbox" checked={kpi.sources.some((item) => item.type === 'dataField' && item.dataSourceId === selectedDataSource.id && item.fieldId === field.id)} onChange={() => toggleDataField(selectedDataSource.id, field.id)} />
                    <span><strong>{field.name}</strong><small>{field.meaning}{field.valueUnit ? ` · ${field.valueUnit}` : ''}{dimensionLabel ? ` · Dimensions: ${dimensionLabel}` : ''}</small></span>
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
          {kpi.sources.length ? (
            <section className="selected-source-section">
              <div className="popover-title">Selected sources</div>
              <div className="selected-source-list">
                {selectedDataGroups.map(({ dataSource, items }) => (
                  <section className="selected-source-group" key={dataSource.id}>
                    <div className="selected-source-group-heading"><Table2 size={13} aria-hidden="true" /><span>{dataSource.name}</span></div>
                    {items.map(({ source, field }) => {
                      const dimensionLabel = fieldGroupDimensionLabel(dataSource.fieldGroups.find((group) => group.fieldIds.includes(field.id)));
                      return renderSelectedSourceRow(source, `${field.name}${dimensionLabel ? ` [${dimensionLabel}]` : ''}`);
                    })}
                  </section>
                ))}
                {selectedKpiSources.length ? (
                  <section className="selected-source-group">
                    <div className="selected-source-group-heading"><Gauge size={13} aria-hidden="true" /><span>Prerequisite KPIs</span></div>
                    {selectedKpiSources.map((source) => renderSelectedSourceRow(source, config.kpis.find((entry) => entry.id === source.kpiId)?.name ?? 'Missing KPI'))}
                  </section>
                ) : null}
                {selectedLookupSources.length ? (
                  <section className="selected-source-group">
                    <div className="selected-source-group-heading"><BookOpen size={13} aria-hidden="true" /><span>Lookups</span></div>
                    {selectedLookupSources.map((source) => renderSelectedSourceRow(source, config.lookups.find((lookup) => lookup.id === source.lookupId)?.outputName ?? 'Missing lookup'))}
                  </section>
                ) : null}
                {selectedCustomSources.length ? (
                  <section className="selected-source-group">
                    <div className="selected-source-group-heading"><Pencil size={13} aria-hidden="true" /><span>Custom sources</span></div>
                    {selectedCustomSources.map((source) => renderSelectedSourceRow(source, source.name))}
                  </section>
                ) : null}
              </div>
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
  const [activeSide, setActiveSide] = useState<'left' | 'right'>('right');
  const [paletteExpanded, setPaletteExpanded] = useState(false);
  const [paletteHasMore, setPaletteHasMore] = useState(false);
  const [paletteRowHeight, setPaletteRowHeight] = useState(31);
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
  }, [item.leftExpression, item.rightExpression]);
  const updateSides = (leftExpression: string, rightExpression: string) => onChange({
    leftExpression: rightOnly ? '' : leftExpression,
    rightExpression,
    formula: rightOnly ? rightExpression : leftExpression ? `${leftExpression} = ${rightExpression}` : rightExpression
  });
  const insertLatex = (latex: string) => {
    if (!latex.trim()) return;
    const insertionSide = rightOnly ? 'right' : activeSide;
    const target = insertionSide === 'left' ? leftRef.current : rightRef.current;
    const value = insertionSide === 'left' ? item.leftExpression : item.rightExpression;
    const start = target?.selectionStart ?? value.length;
    const end = target?.selectionEnd ?? start;
    const next = `${value.slice(0, start)}${latex}${value.slice(end)}`;
    updateSides(insertionSide === 'left' ? next : item.leftExpression, insertionSide === 'right' ? next : item.rightExpression);
    requestAnimationFrame(() => { target?.focus(); target?.setSelectionRange(start + latex.length, start + latex.length); });
  };
  const insertableSources = kpi.sources.filter((source) => source.latex.trim());
  const insertableResults = priorItems.filter((prior) => prior.tag.trim() && prior.leftExpression.trim());
  const lastFormulaItem = priorItems[priorItems.length - 1];
  const dimensionShortcuts = useMemo(() => {
    const shortcuts = new Map<string, { latex: string; label: string; kind: 'Dimension' | 'Option' | 'Set' }>();
    kpi.sources.forEach((source) => {
      if (source.type !== 'dataField') return;
      const dataSource = config.dataSources.find((entry) => entry.id === source.dataSourceId);
      const group = dataSource?.fieldGroups.find((entry) => entry.fieldIds.includes(source.fieldId));
      group?.dimensions.forEach((dimension) => {
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
    });
    return [...shortcuts.values()];
  }, [config.dataSources, kpi.sources]);
  useLayoutEffect(() => {
    const container = paletteOptionsRef.current;
    if (!container) return undefined;
    const measure = () => {
      const children = Array.from(container.children).filter((child): child is HTMLElement => child instanceof HTMLElement);
      if (!children.length) {
        setPaletteHasMore(false);
        setPaletteRowHeight(31);
        return;
      }
      const firstTop = children[0].offsetTop;
      const firstRow = children.filter((child) => Math.abs(child.offsetTop - firstTop) <= 2);
      const rowBottom = Math.max(...firstRow.map((child) => child.offsetTop + child.offsetHeight));
      setPaletteRowHeight(Math.max(27, rowBottom - firstTop));
      setPaletteHasMore(children.some((child) => child.offsetTop > firstTop + 2));
    };
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(container.parentElement ?? container);
    window.addEventListener('resize', measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [config, insertableResults, kpi.sources]);
  return (
    <div className="formula-expression-workbench">
      <div className={`formula-side-editors ${rightOnly ? 'is-right-only' : ''}`}>
        {!rightOnly ? <>
          <label className="field"><textarea ref={leftRef} className="latex-code-editor" rows={1} value={item.leftExpression} placeholder="v_{avg}" aria-label="Left side result LaTeX" onFocus={() => setActiveSide('left')} onChange={(event) => updateSides(event.target.value, item.rightExpression)} /></label>
          <span className="formula-equals">=</span>
        </> : null}
        <label className="field"><textarea ref={rightRef} className="latex-code-editor" rows={1} value={item.rightExpression} placeholder="\frac{\sum_i x_i}{n}" aria-label="Right side calculation LaTeX" onFocus={() => setActiveSide('right')} onChange={(event) => updateSides(item.leftExpression, event.target.value)} /></label>
      </div>
      <div className="formula-source-palette">
        <div className="formula-source-palette-heading">
          <span>{rightOnly ? 'Insert into formula' : `Insert into ${activeSide === 'left' ? 'left' : 'right'} side`}</span>
          {paletteHasMore ? (
            <button className="formula-palette-toggle" type="button" aria-expanded={paletteExpanded} onClick={() => setPaletteExpanded((value) => !value)}>
              {paletteExpanded ? 'One row' : 'More'}
              <ChevronDown size={12} className={paletteExpanded ? 'rotate' : ''} aria-hidden="true" />
            </button>
          ) : null}
        </div>
        <div
          className={`formula-source-options ${paletteExpanded ? 'is-expanded' : ''}`}
          ref={paletteOptionsRef}
          style={{ maxHeight: paletteExpanded ? 'none' : paletteRowHeight }}
        >
          {spatialScale ? (
            <button className="formula-scale-insert" type="button" title={`Spatial scale: ${spatialScaleLabels[spatialScale]}`} onClick={() => insertLatex(spatialScaleLabels[spatialScale])}>
              <span>Scale</span>
              <InlineMath math={spatialScaleLabels[spatialScale]} errorColor="#b42318" />
            </button>
          ) : null}
          {spatialScale && lastFormulaItem ? (
            <button className="formula-result-insert" type="button" disabled={!lastFormulaItem.leftExpression.trim()} title={lastFormulaItem.leftExpression.trim() ? `Last formula result: ${lastFormulaItem.tag}` : 'The last formula has no left term'} onClick={() => insertLatex(lastFormulaItem.leftExpression)}>
              <span>{lastFormulaItem.tag.trim() || 'Last formula'}</span>
              {lastFormulaItem.leftExpression.trim() ? <InlineMath math={lastFormulaItem.leftExpression} errorColor="#b42318" /> : 'No left term'}
            </button>
          ) : null}
          {insertableResults.map((prior, index) => (
            spatialScale && prior === lastFormulaItem ? null :
            <button className="formula-result-insert" type="button" title={`Formula result: ${prior.tag}`} key={`${prior.tag}-${index}`} onClick={() => insertLatex(prior.leftExpression)}>
              <span>{prior.tag}</span>
              <InlineMath math={prior.leftExpression} errorColor="#b42318" />
            </button>
          ))}
          {kpi.sources.map((source) => (
            <button className="formula-source-insert" type="button" disabled={!source.latex.trim()} title={sourceItemLabel(config, source)} key={source.id} onClick={() => insertLatex(source.latex)}>
              {source.latex.trim() ? <InlineMath math={source.latex} errorColor="#b42318" /> : sourceItemLabel(config, source)}
            </button>
          ))}
          {dimensionShortcuts.map((shortcut) => (
            <button className="formula-dimension-insert" type="button" title={shortcut.label} key={`${shortcut.kind}:${shortcut.latex}`} onClick={() => insertLatex(shortcut.latex)}>
              <span>{shortcut.kind}</span>
              <InlineMath math={shortcut.latex} errorColor="#b42318" />
            </button>
          ))}
          {insertableSources.length === 0 && dimensionShortcuts.length === 0 && insertableResults.length === 0 && !spatialScale ? <span className="empty-option">No insertable sources, dimensions, or formula results.</span> : null}
        </div>
      </div>
    </div>
  );
}

type FormulaSemanticToken = {
  latex: string;
  matchLatex?: string;
  requiresFollowingParenthesis?: boolean;
  kind: 'source' | 'result' | 'dimension' | 'scale';
  label: string;
};

type IndexedFormulaSemanticToken = FormulaSemanticToken & { index: number };
type DecoratedFormula = { decorated: string; tokens: IndexedFormulaSemanticToken[] };

const formulaDecorationCache = new Map<string, DecoratedFormula>();
const formulaHtmlCache = new Map<string, string>();
const formulaCacheLimit = 500;

const cacheFormulaResult = <T,>(cache: Map<string, T>, key: string, value: T) => {
  if (cache.size >= formulaCacheLimit) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey !== undefined) cache.delete(oldestKey);
  }
  cache.set(key, value);
  return value;
};

const spatialScaleFormulaKeywords = [...spatialScaleKeys.map((scale) => spatialScaleLabels[scale]), 'Zone'];

const allowFormulaSemanticClass = (context: TrustContext) => context.command === '\\htmlClass';

const isFormulaIdentifierCharacter = (value: string | undefined) => Boolean(value && /[\p{L}\p{N}]/u.test(value));

const hasFormulaTokenBoundaries = (formula: string, token: string, index: number) => {
  const previous = index > 0 ? formula[index - 1] : undefined;
  const nextIndex = index + token.length;
  const next = nextIndex < formula.length ? formula[nextIndex] : undefined;
  return !(isFormulaIdentifierCharacter(token[0]) && isFormulaIdentifierCharacter(previous)) &&
    !(isFormulaIdentifierCharacter(token[token.length - 1]) && isFormulaIdentifierCharacter(next));
};

const findFormulaToken = (formula: string, token: FormulaSemanticToken, startIndex: number) => {
  const matchLatex = token.matchLatex ?? token.latex;
  let index = formula.indexOf(matchLatex, startIndex);
  while (index >= 0) {
    const hasBoundaries = hasFormulaTokenBoundaries(formula, matchLatex, index);
    const followedByParenthesis = !token.requiresFollowingParenthesis || /^\s*\(/.test(formula.slice(index + matchLatex.length));
    if (hasBoundaries && followedByParenthesis) return index;
    index = formula.indexOf(matchLatex, index + 1);
  }
  return -1;
};

const decorateFormulaTokens = (formula: string, tokens: FormulaSemanticToken[]): DecoratedFormula => {
  const tokenMatchLatex = (token: FormulaSemanticToken) => token.matchLatex ?? token.latex;
  const uniqueTokens = [...new Map(tokens.filter((token) => tokenMatchLatex(token).trim()).map((token) => [tokenMatchLatex(token), token])).values()]
    .map((token, index) => ({ ...token, index }))
    .sort((left, right) => tokenMatchLatex(right).length - tokenMatchLatex(left).length);
  const matchingTokens = uniqueTokens.filter((token) => findFormulaToken(formula, token, 0) >= 0);
  const cacheKey = JSON.stringify([formula, matchingTokens]);
  const cached = formulaDecorationCache.get(cacheKey);
  if (cached) return cached;
  const buildDecoratedFormula = (activeTokens: typeof uniqueTokens) => {
    let cursor = 0;
    let decorated = '';
    while (cursor < formula.length) {
      let match: (FormulaSemanticToken & { index: number }) | undefined;
      let matchIndex = -1;
      for (const token of activeTokens) {
        const index = findFormulaToken(formula, token, cursor);
        const matchLength = tokenMatchLatex(token).length;
        if (index >= 0 && (matchIndex < 0 || index < matchIndex || (index === matchIndex && matchLength > (match ? tokenMatchLatex(match).length : 0)))) {
          match = token;
          matchIndex = index;
        }
      }
      if (!match || matchIndex < 0) {
        decorated += formula.slice(cursor);
        break;
      }
      decorated += formula.slice(cursor, matchIndex);
      const matchedLatex = tokenMatchLatex(match);
      decorated += `\\htmlClass{formula-semantic-token formula-${match.kind}-token formula-token-${match.index}}{${matchedLatex}}`;
      cursor = matchIndex + matchedLatex.length;
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
  const individuallyValidTokens = matchingTokens.filter((token) =>
    rendersSafely(`\\htmlClass{formula-semantic-token formula-${token.kind}-token formula-token-${token.index}}{${tokenMatchLatex(token)}}`)
  );
  const fullyDecoratedFormula = buildDecoratedFormula(individuallyValidTokens);
  if (rendersSafely(fullyDecoratedFormula)) {
    return cacheFormulaResult(formulaDecorationCache, cacheKey, { decorated: fullyDecoratedFormula || formula, tokens: individuallyValidTokens });
  }

  const validTokens: typeof uniqueTokens = [];
  for (const token of individuallyValidTokens) {
    const candidateTokens = [...validTokens, token];
    const candidateFormula = buildDecoratedFormula(candidateTokens);
    if (rendersSafely(candidateFormula)) {
      validTokens.push(token);
    }
  }
  return cacheFormulaResult(formulaDecorationCache, cacheKey, { decorated: buildDecoratedFormula(validTokens) || formula, tokens: validTokens });
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

function InteractiveFormulaPreview({ config, kpi, item, priorItems, inline = false }: { config: KpiPoolConfig; kpi: KpiMetric; item: KpiFormulaItem; priorItems: KpiFormulaItem[]; inline?: boolean }) {
  const previewRef = useRef<HTMLDivElement | null>(null);
  const dimensionTokens = useMemo(() => kpi.sources.flatMap((source): FormulaSemanticToken[] => {
    if (source.type !== 'dataField') return [];
    const dataSource = config.dataSources.find((entry) => entry.id === source.dataSourceId);
    const group = dataSource?.fieldGroups.find((entry) => entry.fieldIds.includes(source.fieldId));
    return group?.dimensions.flatMap((dimension): FormulaSemanticToken[] => [
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
    ]) ?? [];
  }), [config.dataSources, kpi.sources]);
  const referencedKpiNames = JSON.stringify(kpi.sources
    .filter((source) => source.type === 'kpi')
    .map((source) => [source.kpiId, config.kpis.find((entry) => entry.id === source.kpiId)?.name ?? 'Missing KPI']));
  const sourceTokens = useMemo(() => kpi.sources.map((source): FormulaSemanticToken => {
    const lookupOpenParenthesis = source.type === 'lookup' ? source.latex.indexOf('(') : -1;
    return {
      latex: source.latex,
      matchLatex: lookupOpenParenthesis > 0 ? source.latex.slice(0, lookupOpenParenthesis).trimEnd() : undefined,
      requiresFollowingParenthesis: lookupOpenParenthesis > 0,
      kind: 'source',
      label: `Source: ${sourceItemTooltip(config, source)}`
    };
  }), [config.dataSources, config.lookups, kpi.sources, referencedKpiNames]);
  const priorItemsKey = JSON.stringify(priorItems.map((prior) => [prior.leftExpression, prior.tag]));
  const priorItemTokens = useMemo(() => priorItems.map((prior): FormulaSemanticToken => ({
    latex: prior.leftExpression,
    kind: 'result',
    label: `Previous formula: ${prior.tag || 'Untitled formula'}`
  })), [priorItemsKey]);
  const semantic = useMemo(
    () => decorateFormulaTokens(item.formula, [
      ...dimensionTokens,
      ...priorItemTokens,
      ...sourceTokens,
      ...spatialScaleFormulaKeywords.map((keyword) => ({
        latex: keyword,
        kind: 'scale' as const,
        label: `Spatial scale: ${keyword}`
      })),
      { latex: item.leftExpression, kind: 'result' as const, label: `Formula tag: ${item.tag.trim() || 'Untitled formula'}` }
    ]),
    [dimensionTokens, item.formula, item.leftExpression, item.tag, priorItemTokens, sourceTokens]
  );
  const renderedHtml = useMemo(
    () => renderFormulaHtml(item.formula, semantic.decorated, inline),
    [inline, item.formula, semantic.decorated]
  );

  useEffect(() => {
    const container = previewRef.current;
    if (!container) return;
    semantic.tokens.forEach((token) => {
      container.querySelectorAll<HTMLElement>(`.formula-token-${token.index}`).forEach((element) => {
        element.title = token.label;
        element.tabIndex = 0;
      });
    });
  }, [semantic]);

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
  onChange
}: {
  config: KpiPoolConfig;
  kpi: KpiMetric;
  onChange: (next: KpiMetric['spatialScales']) => void;
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
                <InteractiveFormulaPreview config={config} kpi={kpi} item={item} priorItems={normalFormulaItems} />
                <details className="formula-explanations spatial-scale-explanation">
                  <summary title="Show aggregation explanation"><Info size={13} aria-hidden="true" /><span>Aggregation explanation</span></summary>
                  <label className="field">
                    <span>Explanation</span>
                    <textarea
                      rows={2}
                      value={scaleValue.aggregationMethod}
                      placeholder="Explain the aggregation method, assumptions, or interpretation..."
                      onChange={(event) => updateScale(scale, { aggregationMethod: event.target.value })}
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
  onChange
}: {
  config: KpiPoolConfig;
  kpi: KpiMetric;
  onChange: (next: KpiMetric) => void;
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
  const [activeExpandedPanel, setActiveExpandedPanel] = useState<'formulae' | 'scales'>('formulae');
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
      return [...groups.slice(0, index), createBlankFormulaGroup(groups.length), ...groups.slice(index)];
    });
  };

  const deleteFormulaGroup = (groupIndex: number) => {
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
      nextGroups.splice(Math.max(0, Math.min(insertionIndex, nextGroups.length)), 0, moved);
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
          <textarea
            rows={2}
            value={kpi.description.overview}
            onChange={(event) =>
              patch({
                description: {
                  ...kpi.description,
                  overview: event.target.value
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
              <textarea
                rows={2}
                value={kpi.description.formulaComment}
                placeholder="Direct from source, reported value, analyst input…"
                onChange={(event) => patch({
                  description: { ...kpi.description, formulaComment: event.target.value }
                })}
              />
            </label>
          ) : null}
          {kpi.description.formulas.length === 0 ? <span className="subtle-text">No formula groups.</span> : null}
          {kpi.description.formulas.flatMap((group, groupIndex) => [
            <button className="list-insert-divider formula-group-insert-divider" type="button" key={`insert-formula-group-${groupIndex}`} onClick={() => addFormulaGroup(groupIndex)}><Plus size={11} aria-hidden="true" />Add group here</button>,
            <section
              className={`formula-group-editor ${
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
                  <input
                    className={group.name.trim() ? '' : 'is-empty'}
                    value={group.name}
                    placeholder="Optional group name"
                    aria-label={`Formula group ${groupIndex + 1} name`}
                    onChange={(event) => updateFormulaGroup(groupIndex, { name: event.target.value })}
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
                        <input
                          value={item.tag}
                          placeholder={`Formula ${itemIndex + 1}`}
                          aria-label={`Formula ${itemIndex + 1} tag`}
                          onChange={(event) => updateFormulaItem(groupIndex, itemIndex, { tag: event.target.value })}
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
                        priorItems={allFormulaItems.slice(0, currentFormulaIndex)}
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
                          <textarea rows={2} value={item.generalExplanation} placeholder="Overall meaning or interpretation..." onChange={(event) => updateFormulaItem(groupIndex, itemIndex, { generalExplanation: event.target.value })} />
                        </label>
                        <section className="term-explanation-panel">
                          <div className="formula-preview-title">Term-wise Explanation</div>
                        {item.terms.map((term, termIndex) => (
                          <div className="term-explanation-row" key={`formula-term-${groupIndex}-${itemIndex}-${termIndex}`}>
                            <input
                              className="latex-code-editor"
                              value={term.term}
                              placeholder="x_i"
                              aria-label={`Term ${termIndex + 1} LaTeX`}
                              onChange={(event) => updateFormulaTerm(groupIndex, itemIndex, termIndex, { term: event.target.value })}
                            />
                            <span className="term-preview">
                              {term.term.trim() ? <InlineMath math={term.term} errorColor="#b42318" /> : <span className="muted-dash">Term</span>}
                            </span>
                            <input
                              value={term.explanation}
                              placeholder="Meaning..."
                              aria-label={`Term ${termIndex + 1} explanation`}
                              onChange={(event) =>
                                updateFormulaTerm(groupIndex, itemIndex, termIndex, { explanation: event.target.value })
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
            </section>
          ])}
          <button className="secondary-action tiny formula-add-button" type="button" onClick={() => addFormulaGroup()}>
            <Plus size={12} aria-hidden="true" />
            Add group
          </button>
        </section>
      </section>

      <section className="expanded-section source-and-scale-section scales-expanded-column">
        <div className="field expanded-independent expanded-sources">
          <span>Sources</span>
          <KpiSourceEditor config={config} kpi={kpi} onChange={(sources) => patch({ sources })} />
        </div>
        <div
          className={`expanded-tab-panel spatial-scales-tab-panel ${activeExpandedPanel === 'scales' ? 'is-active' : 'is-inactive'}`}
          id={`scales-panel-${kpi.id}`}
          role="tabpanel"
        >
          <SpatialScaleMatrix config={config} kpi={kpi} onChange={(spatialScales) => patch({ spatialScales })} />
        </div>
      </section>
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
  onInsertBefore
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
}) {
  const patch = (partial: Partial<KpiMetric>) => onChange({ ...kpi, ...partial });
  const stopRowToggle = (event: React.SyntheticEvent) => event.stopPropagation();
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
      <tr className={rowClass} data-kpi-id={kpi.id} ref={compactRowRef}>
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
              <AutoGrowTextarea
                className="inline-textarea strong-input"
                rows={1}
                value={kpi.name}
                aria-label={`${kpi.name} name`}
                preventLineBreaks
                onClick={stopRowToggle}
                onValueChange={(name) => patch({ name })}
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
          <div onClick={stopRowToggle}>
            <KpiSourceEditor config={config} kpi={kpi} compact onChange={(sources) => patch({ sources })} />
          </div>
        </td>
        <td>
          <FormulaDisplay config={config} kpi={kpi} />
        </td>
        <td>
          <SpatialScaleBadges config={config} kpi={kpi} />
        </td>
        {visibleEnumCategories.map((category) => (
          <td key={category} onClick={stopRowToggle}>
            <RowEnumSelect
              config={config}
              category={category}
              selected={kpi[category]}
              onChange={(next) => patch({ [category]: next } as Partial<KpiMetric>)}
            />
          </td>
        ))}
        <td onClick={stopRowToggle}>
          <RowPerformanceAreaSelect
            config={config}
            kpi={kpi}
            filters={filters}
            assignment={useCaseAssignment}
            onChange={onChange}
          />
        </td>
        <td onClick={stopRowToggle}>
          {useCaseAssignment ? (
            <div className="focused-use-case-cell">
              <div className="use-case-assignment-control">
                <span className={`assignment-state ${isUseCaseAssigned ? 'is-assigned' : 'is-unassigned'}`}>
                  {isUseCaseAssigned ? 'Included' : 'Not Included'}
                </span>
                <button
                  className={`assignment-action ${isUseCaseAssigned ? 'remove' : 'add'}`}
                  type="button"
                  onClick={toggleUseCaseAssignment}
                >
                  {isUseCaseAssigned ? <X size={12} aria-hidden="true" /> : <Plus size={12} aria-hidden="true" />}
                  {isUseCaseAssigned ? 'Exclude' : 'Include'}
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
              <ExpandedKpiEditor config={config} kpi={kpi} onChange={onChange} />
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

const MemoizedMeasuredKpiRow = memo(MeasuredKpiRow);

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
        onReorder(finalState.sourceId, finalState.overId, finalState.position ?? 'before');
      }

      dragSessionRef.current = null;
      setDragState(null);
      document.body.classList.remove('row-dragging');
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', stopRowDrag);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', stopRowDrag);
  }, [onReorder]);

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
                <DataSourceHeader config={config} filter={filters.prerequisite} onFilterChange={(prerequisite) => onFiltersChange({ ...filters, prerequisite })} onConfigChange={onConfigChange} />
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
                onExpand={onToggleExpanded}
                onChange={onKpiChange}
                onDelete={onDelete}
                onDuplicate={onDuplicate}
                onInsertBefore={onAddKpi}
                onDragHandleMouseDown={startRowDrag}
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
  const [saveNotice, setSaveNotice] = useState(
    exportedSnapshot
      ? 'Offline snapshot: hosted JSON saving is disabled.'
      : initialRemoteExists
        ? 'Connected to hosted JSON.'
        : 'The hosted JSON is empty. Save to initialize it.'
  );
  const [filters, setFilters] = useState(emptyFilters);
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const [pinnedNameFilterIds, setPinnedNameFilterIds] = useState<string[]>([]);
  const [examineAssignment, setExamineAssignment] = useState<UseCaseAssignment | undefined>(() => validDefaultFocus(initialConfig, initialConfig.defaultFocus));
  const [focusedAssignment, setFocusedAssignment] = useState<UseCaseAssignment | undefined>(() => validDefaultFocus(initialConfig, initialConfig.defaultFocus));
  const [hideOutsideFocusedGroup, setHideOutsideFocusedGroup] = useState(true);
  const [performanceAreaSort, setPerformanceAreaSort] = useState<PerformanceAreaSortOrder>();
  const baselineKpisRef = useRef(new Map(initialConfig.kpis.map((kpi) => [kpi.id, kpi])));
  const lastSyncedKpiIdsRef = useRef(
    new Set(initialRemoteExists ? initialConfig.kpis.map((kpi) => kpi.id) : [])
  );
  const lastSavedConfigRef = useRef(
    initialRemoteExists || exportedSnapshot ? JSON.stringify(initialConfig) : ''
  );
  const indexesCacheRef = useRef<{ config: KpiPoolConfig; indexes: AppIndexes }>();
  const serializedConfig = useMemo(() => JSON.stringify(config), [config]);
  const hasUnsavedChanges = serializedConfig !== lastSavedConfigRef.current;

  const commitConfig = useCallback((action: KpiPoolConfig | ((current: KpiPoolConfig) => KpiPoolConfig)) => {
    setConfig((current) => {
      const next = typeof action === 'function' ? action(current) : action;
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
          return candidate.lastModified === previous.lastModified
            ? candidate
            : { ...candidate, lastModified: previous.lastModified };
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
  const compiledFilters = useMemo(() => compileFilters(deferredFilters, indexes), [deferredFilters, indexes]);
  const pinnedNameFilterIdSet = useMemo(() => new Set(pinnedNameFilterIds), [pinnedNameFilterIds]);
  const filteredKpis = useMemo(
    () =>
      config.kpis.filter(
        (kpi) =>
          matchesFilters(indexes, kpi, compiledFilters, pinnedNameFilterIdSet, focusedAssignment) &&
          (!focusedAssignment || !hideOutsideFocusedGroup || hasUseCaseAssignment(kpi, focusedAssignment))
      ),
    [compiledFilters, config.kpis, focusedAssignment, hideOutsideFocusedGroup, indexes, pinnedNameFilterIdSet]
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
    setPinnedNameFilterIds((current) => current.filter((id) => validIds.has(id)));
    setFocusedAssignment((current) => (current && validDefaultFocus(normalizedNext, current) ? current : validFocus));
    setExamineAssignment((current) => (current && validDefaultFocus(normalizedNext, current) ? current : validFocus));
  };

  const updateFilters = (next: ColumnFilters) => {
    if (next.name !== filters.name || next.description !== filters.description) {
      setPinnedNameFilterIds([]);
    }
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
    if (filters.name.trim()) {
      setPinnedNameFilterIds((current) => [...new Set([...current, kpi.id])]);
    }
  };

  const toggleExpanded = (id: string) => {
    setExpandedIds((current) => (current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]));
  };

  const expandAllRows = () => {
    setExpandedIds((current) => [...new Set([...current, ...visibleKpis.map((kpi) => kpi.id)])]);
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

    const duplicate = duplicateKpiMetric(source);
    commitConfig({
      ...config,
      kpis: [...config.kpis.slice(0, sourceIndex + 1), duplicate, ...config.kpis.slice(sourceIndex + 1)]
    });
    setExpandedIds((current) => [...new Set([...current, duplicate.id])]);
    if (filters.name.trim()) {
      setPinnedNameFilterIds((current) => [...new Set([...current, duplicate.id])]);
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

  const updateKpiFromRow = (next: KpiMetric) => {
    const previous = config.kpis.find((entry) => entry.id === next.id);
    if (
      (filters.name.trim() || filters.description.trim()) &&
      previous &&
      (previous.name !== next.name || previous.description.overview !== next.description.overview)
    ) {
      setPinnedNameFilterIds((current) => [...new Set([...current, next.id])]);
    }

    commitConfig((current) => updateKpi(current, next.id, () => next));
  };

  const replaceWithRemoteConfig = (result: RemoteConfigResult, notice: string) => {
    const repaired = repairConfig(result.config);
    baselineKpisRef.current = new Map(repaired.config.kpis.map((kpi) => [kpi.id, kpi]));
    lastSyncedKpiIdsRef.current = new Set(repaired.config.kpis.map((kpi) => kpi.id));
    lastSavedConfigRef.current = JSON.stringify(repaired.config);
    setConfig(repaired.config);
    setEtag(result.etag);
    setWarnings([...repaired.warnings, ...(result.warnings ?? [])]);
    const validIds = new Set(repaired.config.kpis.map((kpi) => kpi.id));
    setPinnedNameFilterIds((current) => current.filter((id) => validIds.has(id)));
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
      const result = await syncRemoteConfig(hostedSecret, config, etag, deletedKpiIds);
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
      const incomingById = new Map(repaired.config.kpis.map((kpi) => [kpi.id, kpi]));
      const nextBaselines = new Map(baselineKpisRef.current);
      for (const id of merged.importedKpiIds) {
        const importedKpi = incomingById.get(id);
        if (importedKpi) {
          nextBaselines.set(id, importedKpi);
        }
      }
      for (const kpi of merged.config.kpis) {
        if (!nextBaselines.has(kpi.id)) {
          nextBaselines.set(kpi.id, kpi);
        }
      }
      baselineKpisRef.current = nextBaselines;
      setConfig(merged.config);
      setWarnings([
        ...repaired.warnings,
        ...(merged.enumConflicts > 0
          ? [`${merged.enumConflicts} imported enum option${merged.enumConflicts === 1 ? '' : 's'} had an existing ID with different content; the current option was kept.`]
          : []),
        ...(merged.dataSourceConflicts > 0
          ? [`${merged.dataSourceConflicts} imported data source${merged.dataSourceConflicts === 1 ? '' : 's'} had an existing ID with different content; the current definition was kept.`]
          : []),
        ...(merged.lookupConflicts > 0
          ? [`${merged.lookupConflicts} imported lookup${merged.lookupConflicts === 1 ? '' : 's'} had an existing ID with different content; the current definition was kept.`]
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
              <input value={config.title} onChange={(event) => commitConfig({ ...config, title: event.target.value })} />
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
              title={remoteActionTitle ?? 'Add or update records and apply your KPI deletions'}
            >
              <Save size={15} aria-hidden="true" />
              Save to JSON
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
            <button className="primary-action small" type="button" onClick={exportHtml}>
              <Download size={15} aria-hidden="true" />
              Export HTML
            </button>
          </div>
        </div>
        <div className="topbar-row topbar-secondary-row">
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
          <div className="topbar-actions topbar-actions-right">
            <button className="secondary-action small" type="button" onClick={() => updateFilters(emptyFilters())} disabled={!filterCount}>
              <X size={14} aria-hidden="true" />
              Clear filters
            </button>
            <button className="secondary-action small" type="button" onClick={expandAllRows} disabled={visibleKpis.length === 0}>
              <ChevronsDown size={15} aria-hidden="true" />
              Expand all
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
