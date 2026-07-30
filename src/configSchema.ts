import { z } from 'zod';
import {
  CURRENT_SCHEMA_VERSION,
  enumCategoryKeys,
  type EnumCategoryKey,
  type EnumDefinitions,
  type EnumOption,
  type DataSource,
  type DataSourceField,
  type DataSourceFieldDimension,
  dataSourceFieldTypes,
  type DataSourceFieldType,
  type DataSourceFieldGroup,
  type TableRelation,
  type LookupDefinition,
  type LookupInput,
  type VariableDefinition,
  type KpiFormulaGroup,
  type KpiFormulaItem,
  type KpiMetric,
  type KpiSourceItem,
  type KpiPoolConfig,
  type KpiDefaultFocus,
  type KpiUseCaseNote,
  type KpiUseCasePerformanceArea,
  type KpiUserGroupUseCase,
  type RepairResult,
  isSpatialUnit,
  spatialScaleLabels,
  spatialScaleKeys,
  spatialUnitOptions,
  type SpatialUnit,
  type SpatialScaleConfig
} from './types.js';

const enumOptionSchema = z.object({
  id: z.string().min(1),
  label: z.string(),
  description: z.string().optional(),
  userGroup: z.string().optional(),
  useCase: z.string().optional()
});

const spatialScaleSchema = z.object({
  applicable: z.boolean(),
  isBasicUnit: z.boolean(),
  aggregationMethod: z.string(),
  formula: z.string(),
  leftExpression: z.string(),
  rightExpression: z.string()
});

const formulaTermSchema = z.object({
  term: z.string(),
  explanation: z.string()
});

const formulaItemSchema = z.object({
  tag: z.string(),
  formula: z.string(),
  leftExpression: z.string(),
  rightExpression: z.string(),
  generalExplanation: z.string(),
  terms: z.array(formulaTermSchema)
});

const dataSourceFieldSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  meaning: z.string(),
  dataType: z.enum(dataSourceFieldTypes),
  valueUnit: z.string(),
  generatedRelationId: z.string().min(1).optional(),
  generatedRelationRole: z.enum(['oneCollection', 'manyForeignKey', 'sourceCollection', 'targetCollection']).optional()
});

const dataSourceFieldDimensionSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  options: z.array(z.string())
});

const dataSourceSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  spatialUnit: z.custom<SpatialUnit>(isSpatialUnit, {
    message: `Spatial unit must be blank or one of: ${spatialUnitOptions.join(', ')}`
  }),
  primaryKeyFieldId: z.string().min(1).optional(),
  fields: z.array(dataSourceFieldSchema),
  fieldGroups: z.array(z.object({
    id: z.string().min(1),
    dimensions: z.array(dataSourceFieldDimensionSchema),
    fieldIds: z.array(z.string()),
    position: z.number().int().nonnegative()
  }))
});

const tableRelationSchema = z.object({
  id: z.string().min(1),
  sourceDataSourceId: z.string().min(1),
  targetDataSourceId: z.string().min(1),
  cardinality: z.enum(['oneToOne', 'oneToMany', 'manyToMany'])
});

const lookupSchema = z.object({
  id: z.string().min(1),
  outputName: z.string(),
  outputExplanation: z.string(),
  inputs: z.array(z.object({
    id: z.string().min(1),
    representation: z.string(),
    explanation: z.string()
  }))
});

const variableSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  explanation: z.string(),
  unit: z.string()
});

const kpiSourceItemSchema = z.discriminatedUnion('type', [
  z.object({
    id: z.string().min(1),
    type: z.literal('dataField'),
    dataSourceId: z.string().min(1),
    fieldId: z.string().min(1),
    latex: z.string()
  }),
  z.object({
    id: z.string().min(1),
    type: z.literal('kpi'),
    kpiId: z.string().min(1),
    latex: z.string()
  }),
  z.object({
    id: z.string().min(1),
    type: z.literal('lookup'),
    lookupId: z.string().min(1),
    latex: z.string()
  }),
  z.object({
    id: z.string().min(1),
    type: z.literal('variable'),
    variableId: z.string().min(1),
    latex: z.string()
  }),
  z.object({
    id: z.string().min(1),
    type: z.literal('custom'),
    name: z.string(),
    latex: z.string()
  })
]);

const formulaGroupSchema = z.object({
  name: z.string(),
  items: z.array(formulaItemSchema)
});

const userGroupUseCaseSchema = z.object({
  userGroup: z.string(),
  useCases: z.array(z.string())
});

const useCasePerformanceAreaSchema = z.object({
  useCase: z.string(),
  performanceAreas: z.array(z.string())
});

const useCaseNoteSchema = z.object({
  useCase: z.string(),
  note: z.string()
});

const defaultFocusSchema = z.object({
  userGroup: z.string(),
  useCase: z.string()
});

const kpiSchema = z.object({
  id: z.string().min(1),
  lastModified: z.string().datetime(),
  name: z.string(),
  dimensions: z.array(dataSourceFieldDimensionSchema),
  sources: z.array(kpiSourceItemSchema),
  description: z.object({
    overview: z.string(),
    formulaComment: z.string(),
    formulas: z.array(formulaGroupSchema)
  }),
  prerequisite: z.object({
    modules: z.array(z.string()),
    kpis: z.array(z.string()),
    values: z.string()
  }),
  spatialScales: z.object({
    link: spatialScaleSchema,
    cell: spatialScaleSchema,
    project: spatialScaleSchema,
    taz: spatialScaleSchema,
    corridor: spatialScaleSchema,
    subRegion: spatialScaleSchema,
    region: spatialScaleSchema
  }),
  previousApplication: z.array(z.string()),
  federalRequirement: z.array(z.string()),
  performanceArea: z.array(z.string()),
  performanceAreasByUseCase: z.array(useCasePerformanceAreaSchema),
  notesByUseCase: z.array(useCaseNoteSchema),
  userGroupUseCases: z.array(userGroupUseCaseSchema)
});

export const kpiPoolConfigSchema = z.object({
  schemaVersion: z.literal(CURRENT_SCHEMA_VERSION),
  title: z.string(),
  updatedAt: z.string().optional(),
  defaultFocus: defaultFocusSchema.optional(),
  enums: z.object({
    prerequisiteModule: z.array(enumOptionSchema),
    userGroup: z.array(enumOptionSchema),
    previousApplication: z.array(enumOptionSchema),
    federalRequirement: z.array(enumOptionSchema),
    performanceArea: z.array(enumOptionSchema),
    useCase: z.array(enumOptionSchema)
  }),
  dataSources: z.array(dataSourceSchema),
  tableRelations: z.array(tableRelationSchema),
  lookups: z.array(lookupSchema),
  variables: z.array(variableSchema),
  kpis: z.array(kpiSchema)
});

const isStringArray = (value: unknown): value is string[] => Array.isArray(value) && value.every((item) => typeof item === 'string');

const isCurrentEnumOption = (value: unknown): value is EnumOption =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  typeof value.label === 'string' &&
  (value.description === undefined || typeof value.description === 'string') &&
  (value.userGroup === undefined || typeof value.userGroup === 'string') &&
  (value.useCase === undefined || typeof value.useCase === 'string');

const isCurrentFormulaGroup = (value: unknown): value is KpiFormulaGroup =>
  isRecord(value) &&
  typeof value.name === 'string' &&
  Array.isArray(value.items) &&
  value.items.every(
    (item) =>
      isRecord(item) &&
      typeof item.tag === 'string' &&
      typeof item.formula === 'string' &&
      typeof item.leftExpression === 'string' &&
      typeof item.rightExpression === 'string' &&
      typeof item.generalExplanation === 'string' &&
      Array.isArray(item.terms) &&
      item.terms.every(
        (term) => isRecord(term) && typeof term.term === 'string' && typeof term.explanation === 'string'
      )
  );

const isCurrentSpatialScaleConfig = (value: unknown): value is SpatialScaleConfig =>
  isRecord(value) &&
  typeof value.applicable === 'boolean' &&
  typeof value.isBasicUnit === 'boolean' &&
  typeof value.aggregationMethod === 'string' &&
  typeof value.formula === 'string' &&
  typeof value.leftExpression === 'string' &&
  typeof value.rightExpression === 'string' &&
  !value.leftExpression &&
  value.formula === value.rightExpression &&
  (!value.isBasicUnit || (!value.formula && !value.rightExpression));

const isCurrentSpatialScales = (value: unknown): value is KpiMetric['spatialScales'] =>
  isRecord(value) && spatialScaleKeys.every((scale) => isCurrentSpatialScaleConfig(value[scale]));

const isCurrentUseCaseGroup = (value: unknown): value is KpiUserGroupUseCase =>
  isRecord(value) && typeof value.userGroup === 'string' && isStringArray(value.useCases);

const isCurrentUseCasePerformanceArea = (value: unknown): value is KpiUseCasePerformanceArea =>
  isRecord(value) && typeof value.useCase === 'string' && isStringArray(value.performanceAreas);

const isCurrentUseCaseNote = (value: unknown): value is KpiUseCaseNote =>
  isRecord(value) && typeof value.useCase === 'string' && typeof value.note === 'string';

const isCurrentKpiMetricShape = (value: unknown): value is KpiMetric =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  typeof value.lastModified === 'string' &&
  Number.isFinite(Date.parse(value.lastModified)) &&
  typeof value.name === 'string' &&
  Array.isArray(value.dimensions) &&
  value.dimensions.every((dimension) =>
    isRecord(dimension) &&
    typeof dimension.id === 'string' &&
    typeof dimension.name === 'string' &&
    isStringArray(dimension.options)
  ) &&
  Array.isArray(value.sources) &&
  value.sources.every(
    (source) =>
      isRecord(source) &&
      typeof source.id === 'string' &&
      typeof source.latex === 'string' &&
      ((source.type === 'dataField' && typeof source.dataSourceId === 'string' && typeof source.fieldId === 'string' && source.version === undefined) ||
        (source.type === 'kpi' && typeof source.kpiId === 'string') ||
        (source.type === 'lookup' && typeof source.lookupId === 'string') ||
        (source.type === 'variable' && typeof source.variableId === 'string') ||
        (source.type === 'custom' && typeof source.name === 'string'))
  ) &&
  isRecord(value.description) &&
  typeof value.description.overview === 'string' &&
  typeof value.description.formulaComment === 'string' &&
  Array.isArray(value.description.formulas) &&
  value.description.formulas.every(isCurrentFormulaGroup) &&
  isRecord(value.prerequisite) &&
  isStringArray(value.prerequisite.modules) &&
  isStringArray(value.prerequisite.kpis) &&
  typeof value.prerequisite.values === 'string' &&
  isCurrentSpatialScales(value.spatialScales) &&
  isStringArray(value.previousApplication) &&
  isStringArray(value.federalRequirement) &&
  isStringArray(value.performanceArea) &&
  Array.isArray(value.performanceAreasByUseCase) &&
  value.performanceAreasByUseCase.every(isCurrentUseCasePerformanceArea) &&
  Array.isArray(value.notesByUseCase) &&
  value.notesByUseCase.every(isCurrentUseCaseNote) &&
  Array.isArray(value.userGroupUseCases) &&
  value.userGroupUseCases.every(isCurrentUseCaseGroup);

const hasDuplicate = (values: string[]) => new Set(values).size !== values.length;

const isCurrentKpiPoolConfig = (input: unknown): input is KpiPoolConfig => {
  if (
    !isRecord(input) ||
    input.schemaVersion !== CURRENT_SCHEMA_VERSION ||
    typeof input.title !== 'string' ||
    (input.updatedAt !== undefined && typeof input.updatedAt !== 'string') ||
    !isRecord(input.enums) ||
    !Array.isArray(input.dataSources) ||
    !Array.isArray(input.tableRelations) ||
    !Array.isArray(input.lookups) ||
    !Array.isArray(input.variables) ||
    !Array.isArray(input.kpis)
  ) {
    return false;
  }

  const enums = input.enums as Record<string, unknown>;
  if (!enumCategoryKeys.every((category) => Array.isArray(enums[category]) && (enums[category] as unknown[]).every(isCurrentEnumOption))) {
    return false;
  }

  const typedEnums = enums as EnumDefinitions;
  const dataSources = input.dataSources as unknown[];
  if (
    !dataSources.every(
      (source) =>
        isRecord(source) &&
        typeof source.id === 'string' &&
        typeof source.name === 'string' &&
        isSpatialUnit(source.spatialUnit) &&
        (source.primaryKeyFieldId === undefined || typeof source.primaryKeyFieldId === 'string') &&
        Array.isArray(source.fields) &&
        Array.isArray(source.fieldGroups) &&
        source.fieldGroups.every(
          (group) =>
            isRecord(group) &&
            typeof group.id === 'string' &&
            Array.isArray(group.dimensions) &&
            group.dimensions.every((dimension) =>
              isRecord(dimension) &&
              typeof dimension.id === 'string' &&
              typeof dimension.name === 'string' &&
              isStringArray(dimension.options)
            ) &&
            isStringArray(group.fieldIds) &&
            typeof group.position === 'number' &&
            Number.isInteger(group.position) &&
            group.position >= 0 &&
            group.position <= (source.fields as unknown[]).length
        ) &&
        source.fields.every(
          (field) =>
            isRecord(field) &&
            typeof field.id === 'string' &&
            typeof field.name === 'string' &&
            typeof field.meaning === 'string' &&
            dataSourceFieldTypes.some((type) => type === field.dataType) &&
            typeof field.valueUnit === 'string' &&
            (field.dataType === 'number' || !field.valueUnit) &&
            (field.generatedRelationId === undefined || typeof field.generatedRelationId === 'string') &&
            (field.generatedRelationRole === undefined ||
              field.generatedRelationRole === 'oneCollection' ||
              field.generatedRelationRole === 'manyForeignKey' ||
              field.generatedRelationRole === 'sourceCollection' ||
              field.generatedRelationRole === 'targetCollection')
        )
    )
  ) {
    return false;
  }
  const lookups = input.lookups as unknown[];
  if (
    !lookups.every((lookup) =>
      isRecord(lookup) &&
      typeof lookup.id === 'string' &&
      typeof lookup.outputName === 'string' &&
      typeof lookup.outputExplanation === 'string' &&
      Array.isArray(lookup.inputs) &&
      lookup.inputs.every((entry) =>
        isRecord(entry) &&
        typeof entry.id === 'string' &&
        typeof entry.representation === 'string' &&
        typeof entry.explanation === 'string'
      )
    )
  ) {
    return false;
  }
  const variables = input.variables as unknown[];
  if (
    !variables.every((variable) =>
      isRecord(variable) &&
      typeof variable.id === 'string' &&
      typeof variable.name === 'string' &&
      typeof variable.explanation === 'string' &&
      typeof variable.unit === 'string'
    )
  ) {
    return false;
  }
  const enumIdSets = Object.fromEntries(
    enumCategoryKeys.map((category) => [category, new Set(typedEnums[category].map((option) => option.id))])
  ) as Record<EnumCategoryKey, Set<string>>;
  if (enumCategoryKeys.some((category) => hasDuplicate(typedEnums[category].map((option) => option.id)))) {
    return false;
  }

  const validUserGroups = enumIdSets.userGroup;
  const validUseCases = enumIdSets.useCase;
  const validPerformanceAreas = enumIdSets.performanceArea;
  const useCaseOwner = new Map(typedEnums.useCase.map((option) => [option.id, option.userGroup]));
  const performanceAreaOwner = new Map(typedEnums.performanceArea.map((option) => [option.id, option.useCase]));
  if (typedEnums.useCase.some((option) => !option.userGroup || !validUserGroups.has(option.userGroup))) {
    return false;
  }
  if (typedEnums.performanceArea.some((option) => !option.useCase || !validUseCases.has(option.useCase))) {
    return false;
  }

  if (
    input.defaultFocus !== undefined &&
    (!isRecord(input.defaultFocus) ||
      typeof input.defaultFocus.userGroup !== 'string' ||
      typeof input.defaultFocus.useCase !== 'string' ||
      useCaseOwner.get(input.defaultFocus.useCase) !== input.defaultFocus.userGroup)
  ) {
    return false;
  }

  if (!input.kpis.every(isCurrentKpiMetricShape)) {
    return false;
  }

  const kpiIds = input.kpis.map((kpi) => kpi.id);
  if (hasDuplicate(kpiIds)) {
    return false;
  }
  const validKpis = new Set(kpiIds);
  const currentLookups = input.lookups as LookupDefinition[];
  if (
    hasDuplicate(currentLookups.map((lookup) => lookup.id)) ||
    currentLookups.some((lookup) => hasDuplicate(lookup.inputs.map((entry) => entry.id)))
  ) {
    return false;
  }
  const validLookups = new Set(currentLookups.map((lookup) => lookup.id));
  const currentVariables = input.variables as VariableDefinition[];
  if (hasDuplicate(currentVariables.map((variable) => variable.id))) {
    return false;
  }
  const validVariables = new Set(currentVariables.map((variable) => variable.id));
  const currentDataSources = input.dataSources as DataSource[];
  const dataSourceById = new Map(currentDataSources.map((source) => [source.id, source]));
  if (
    currentDataSources.some((source) => {
      const fieldIds = new Set(source.fields.map((field) => field.id));
      const groupedFieldIds = source.fieldGroups.flatMap((group) => group.fieldIds);
      return hasDuplicate(source.fields.map((field) => field.id)) ||
        (source.primaryKeyFieldId !== undefined && (
          !fieldIds.has(source.primaryKeyFieldId) ||
          groupedFieldIds.includes(source.primaryKeyFieldId) ||
          source.fields.find((field) => field.id === source.primaryKeyFieldId)?.dataType !== 'id'
        )) ||
        hasDuplicate(source.fieldGroups.map((group) => group.id)) ||
        hasDuplicate(groupedFieldIds) ||
        source.fieldGroups.some((group) =>
          !group.fieldIds.every((fieldId) => fieldIds.has(fieldId)) ||
          hasDuplicate(group.dimensions.map((dimension) => dimension.id)) ||
          hasDuplicate(group.dimensions.map((dimension) => dimension.name.trim().toLocaleLowerCase())) ||
          group.dimensions.some((dimension) => hasDuplicate(dimension.options.map((option) => option.toLocaleLowerCase())))
        );
    })
  ) {
    return false;
  }

  const currentRelations = input.tableRelations as TableRelation[];
  const relationById = new Map(currentRelations.map((relation) => [relation.id, relation]));
  if (
    hasDuplicate(currentRelations.map((relation) => relation.id)) ||
    currentRelations.some((relation) => {
      const source = dataSourceById.get(relation.sourceDataSourceId);
      const target = dataSourceById.get(relation.targetDataSourceId);
      return !source || !target || source.id === target.id || !source.primaryKeyFieldId ||
        (relation.cardinality !== 'oneToMany' && !target.primaryKeyFieldId);
    }) ||
    currentDataSources.some((source) => source.fields.some((field) => {
      if (!field.generatedRelationId) return false;
      const relation = relationById.get(field.generatedRelationId);
      if (!relation) return true;
      if (relation.cardinality === 'oneToMany') {
        return field.generatedRelationRole === 'oneCollection'
          ? relation.sourceDataSourceId !== source.id || field.dataType !== 'collection'
          : field.generatedRelationRole === 'manyForeignKey'
            ? relation.targetDataSourceId !== source.id || field.dataType !== 'id'
            : true;
      }
      if (relation.cardinality === 'manyToMany') {
        return field.generatedRelationRole === 'sourceCollection'
          ? relation.sourceDataSourceId !== source.id || field.dataType !== 'collection'
          : field.generatedRelationRole === 'targetCollection'
            ? relation.targetDataSourceId !== source.id || field.dataType !== 'collection'
            : true;
      }
      return true;
    })) ||
    currentRelations.some((relation) => relation.cardinality === 'oneToMany' && (
      dataSourceById.get(relation.sourceDataSourceId)?.fields.filter((field) => field.generatedRelationId === relation.id && field.generatedRelationRole === 'oneCollection').length !== 1 ||
      dataSourceById.get(relation.targetDataSourceId)?.fields.filter((field) => field.generatedRelationId === relation.id && field.generatedRelationRole === 'manyForeignKey').length !== 1
    )) ||
    currentRelations.some((relation) => relation.cardinality === 'manyToMany' && (
      dataSourceById.get(relation.sourceDataSourceId)?.fields.filter((field) => field.generatedRelationId === relation.id && field.generatedRelationRole === 'sourceCollection').length !== 1 ||
      dataSourceById.get(relation.targetDataSourceId)?.fields.filter((field) => field.generatedRelationId === relation.id && field.generatedRelationRole === 'targetCollection').length !== 1
    ))
  ) {
    return false;
  }

  return input.kpis.every((kpi) => {
    if (
      hasDuplicate(kpi.dimensions.map((dimension) => dimension.id)) ||
      hasDuplicate(kpi.dimensions.map((dimension) => dimension.name.trim().toLocaleLowerCase())) ||
      kpi.dimensions.some((dimension) => hasDuplicate(dimension.options.map((option) => option.toLocaleLowerCase())))
    ) {
      return false;
    }
    const dataFieldKeys = kpi.sources.flatMap((source) => source.type === 'dataField'
      ? [`${source.dataSourceId}\u0000${source.fieldId}`]
      : []
    );
    const variableIds = kpi.sources.flatMap((source) => source.type === 'variable' ? [source.variableId] : []);
    if (hasDuplicate(dataFieldKeys) || hasDuplicate(variableIds)) return false;
    const validReferences =
      kpi.sources.every((source) =>
        source.type === 'dataField'
          ? (() => {
              const dataSource = dataSourceById.get(source.dataSourceId);
              if (!dataSource?.fields.some((field) => field.id === source.fieldId)) return false;
              return true;
            })()
          : source.type === 'kpi'
            ? source.kpiId !== kpi.id && validKpis.has(source.kpiId)
            : source.type === 'lookup'
              ? validLookups.has(source.lookupId)
            : source.type === 'variable'
              ? validVariables.has(source.variableId)
            : true
      ) &&
      kpi.prerequisite.modules.every((id) => enumIdSets.prerequisiteModule.has(id)) &&
      kpi.prerequisite.kpis.every((id) => id !== kpi.id && validKpis.has(id)) &&
      kpi.previousApplication.every((id) => enumIdSets.previousApplication.has(id)) &&
      kpi.federalRequirement.every((id) => enumIdSets.federalRequirement.has(id)) &&
      kpi.performanceArea.every((id) => validPerformanceAreas.has(id)) &&
      kpi.userGroupUseCases.every(
        (entry) =>
          validUserGroups.has(entry.userGroup) &&
          entry.useCases.every((id) => validUseCases.has(id) && useCaseOwner.get(id) === entry.userGroup)
      ) &&
      kpi.performanceAreasByUseCase.every(
        (entry) =>
          validUseCases.has(entry.useCase) &&
          entry.performanceAreas.every((id) => performanceAreaOwner.get(id) === entry.useCase)
      ) &&
      kpi.notesByUseCase.every((entry) => validUseCases.has(entry.useCase));

    if (!validReferences) {
      return false;
    }

    const aggregate = new Set(kpi.performanceAreasByUseCase.flatMap((entry) => entry.performanceAreas));
    return kpi.performanceArea.every((id) => aggregate.has(id));
  });
};

const createId = (prefix: string) => {
  if (globalThis.crypto?.randomUUID) {
    return `${prefix}-${globalThis.crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const stringValue = (value: unknown): string => {
  return typeof value === 'string' ? value : value == null ? '' : String(value);
};

const latexIdentifier = (value: string) => value.trim().replace(/\s+/g, '\\ ');

const defaultDataFieldLatex = (fieldName: string, spatialUnit: string, dimensionNames: string[]) => {
  const field = latexIdentifier(fieldName);
  const subscript = [...dimensionNames.map(latexIdentifier).filter(Boolean), latexIdentifier(spatialUnit)]
    .filter(Boolean)
    .join(', ');
  return subscript ? `${field}_{${subscript}}` : field;
};

const defaultCollectionDataFieldLatex = (fieldName: string, spatialUnit: string, dimensionNames: string[]) => {
  const field = latexIdentifier(fieldName);
  const expression = `\\{${field}\\}`;
  const subscript = [...dimensionNames.map(latexIdentifier).filter(Boolean), latexIdentifier(spatialUnit)]
    .filter(Boolean)
    .join(', ');
  return subscript ? `${expression}_{${subscript}}` : expression;
};

const legacyDataFieldLatex = (fieldName: string, spatialUnit: string, dimensionName: string, option: string) =>
  defaultDataFieldLatex(fieldName, spatialUnit, [
    dimensionName.trim() ? `${dimensionName.trim()}=${option.trim()}` : ''
  ]);

const booleanValue = (value: unknown): boolean => {
  return typeof value === 'boolean' ? value : false;
};

const normalizeKey = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '');

const categoryAliases: Record<EnumCategoryKey, string[]> = {
  prerequisiteModule: [
    'prerequisiteModule',
    'prerequisiteModules',
    'prerequisite module',
    'prerequisite modules',
    'module',
    'modules'
  ],
  userGroup: ['userGroup', 'userGroups', 'user group', 'user groups', 'audience', 'audiences'],
  previousApplication: ['previousApplication', 'previousApplications', 'previous application', 'previous applications'],
  federalRequirement: ['federalRequirement', 'federalRequirements', 'federal requirement', 'federal requirements'],
  performanceArea: ['performanceArea', 'performanceAreas', 'performance area', 'performance areas'],
  useCase: ['useCase', 'useCases', 'use case', 'use cases']
};

const readCategory = (source: Record<string, unknown>, category: EnumCategoryKey): unknown => {
  const normalizedEntries = new Map(Object.entries(source).map(([key, value]) => [normalizeKey(key), value]));
  for (const alias of categoryAliases[category]) {
    const found = normalizedEntries.get(normalizeKey(alias));
    if (found !== undefined) {
      return found;
    }
  }

  return source[category];
};

const ensureUniqueId = (rawId: unknown, prefix: string, usedIds: Set<string>, warnings: string[], context: string) => {
  let id = stringValue(rawId).trim();
  if (!id) {
    id = createId(prefix);
    warnings.push(`${context} was missing an id; generated ${id}.`);
  }

  if (usedIds.has(id)) {
    const original = id;
    id = createId(prefix);
    warnings.push(`${context} reused id ${original}; generated ${id}.`);
  }

  usedIds.add(id);
  return id;
};

const repairEnums = (rawConfig: Record<string, unknown>, warnings: string[]): EnumDefinitions => {
  const rawEnums = isRecord(rawConfig.enums) ? rawConfig.enums : {};
  if (!isRecord(rawConfig.enums)) {
    warnings.push('Missing or invalid enums object; initialized empty enum definitions.');
  }

  const enums = {} as EnumDefinitions;

  for (const category of enumCategoryKeys) {
    const rawOptions = readCategory(rawEnums, category);
    const options = Array.isArray(rawOptions) ? rawOptions : [];
    if (!Array.isArray(rawOptions)) {
      warnings.push(`Missing enum category ${category}; initialized it as an empty list.`);
    }

    const usedIds = new Set<string>();
    enums[category] = options.map((option, index): EnumOption => {
      if (typeof option === 'string') {
        const id = ensureUniqueId('', `enum-${category}`, usedIds, warnings, `${category} option "${option}"`);
        return { id, label: option };
      }

      if (isRecord(option)) {
        const label = stringValue(option.label ?? option.name ?? option.value).trim();
        const displayLabel = label || `Untitled option ${index + 1}`;
        if (!label) {
          warnings.push(`${category} option ${index + 1} was missing a label; named it "${displayLabel}".`);
        }

        return {
          id: ensureUniqueId(option.id, `enum-${category}`, usedIds, warnings, `${category} option "${displayLabel}"`),
          label: displayLabel,
          description: stringValue(option.description) || undefined,
          userGroup:
            category === 'useCase'
              ? stringValue(option.userGroup ?? option.userGroupId ?? option.group ?? option.groupId ?? option['User Group']).trim() ||
                undefined
              : undefined,
          useCase:
            category === 'performanceArea'
              ? stringValue(option.useCase ?? option.useCaseId ?? option.case ?? option.caseId ?? option['Use Case']).trim() ||
                undefined
              : undefined
        };
      }

      const label = `Untitled option ${index + 1}`;
      warnings.push(`${category} option ${index + 1} was not readable; initialized it as "${label}".`);
      return {
        id: ensureUniqueId('', `enum-${category}`, usedIds, warnings, `${category} option "${label}"`),
        label
      };
    });
  }

  return enums;
};

const enumLabelLookup = (enums: EnumDefinitions, category: EnumCategoryKey) => {
  const lookup = new Map<string, string>();
  for (const option of enums[category]) {
    lookup.set(option.id, option.id);
    lookup.set(normalizeKey(option.label), option.id);
  }
  return lookup;
};

const repairEnumReferences = (
  rawValue: unknown,
  category: EnumCategoryKey,
  enums: EnumDefinitions,
  warnings: string[],
  kpiName: string
) => {
  const rawList = Array.isArray(rawValue) ? rawValue : [];
  if (rawValue !== undefined && !Array.isArray(rawValue)) {
    warnings.push(`${kpiName}: ${category} was not a list; cleared it.`);
  }

  const lookup = enumLabelLookup(enums, category);
  const repaired = new Set<string>();

  for (const value of rawList) {
    const reference = stringValue(value).trim();
    if (!reference) {
      continue;
    }

    const matchedId = lookup.get(reference) ?? lookup.get(normalizeKey(reference));
    if (matchedId) {
      repaired.add(matchedId);
    } else {
      warnings.push(`${kpiName}: ${category} reference "${reference}" did not match an enum option and was removed.`);
    }
  }

  return [...repaired];
};

const repairPerformanceAreaReferencesForUseCase = (
  rawValue: unknown,
  useCase: string,
  enums: EnumDefinitions,
  warnings: string[],
  kpiName: string
) => {
  const hasScopedDefinitions = enums.performanceArea.some((option) => option.useCase);
  if (!hasScopedDefinitions) {
    return repairEnumReferences(rawValue, 'performanceArea', enums, warnings, kpiName);
  }

  const rawList = Array.isArray(rawValue) ? rawValue : [];
  if (rawValue !== undefined && !Array.isArray(rawValue)) {
    warnings.push(`${kpiName}: performanceArea was not a list; cleared it.`);
  }

  const scopedOptions = enums.performanceArea.filter((option) => option.useCase === useCase);
  const repaired = new Set<string>();

  for (const value of rawList) {
    const reference = stringValue(value).trim();
    if (!reference) {
      continue;
    }

    const normalizedReference = normalizeKey(reference);
    const matched = scopedOptions.find(
      (option) => option.id === reference || normalizeKey(option.label) === normalizedReference
    );
    if (matched) {
      repaired.add(matched.id);
    } else {
      warnings.push(
        `${kpiName}: performanceArea reference "${reference}" did not match an enum option for this use case and was removed.`
      );
    }
  }

  return [...repaired];
};

const splitCommaList = (value: string) =>
  value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

const ensureEnumOptionByLabel = (
  enums: EnumDefinitions,
  category: EnumCategoryKey,
  label: string,
  warnings: string[],
  context: string
) => {
  const normalizedLabel = normalizeKey(label);
  const existing = enums[category].find((option) => option.id === label || normalizeKey(option.label) === normalizedLabel);
  if (existing) {
    return existing.id;
  }

  const usedIds = new Set(enums[category].map((option) => option.id));
  let id = createId(`enum-${category}`);
  while (usedIds.has(id)) {
    id = createId(`enum-${category}`);
  }

  enums[category] = [...enums[category], { id, label }];
  warnings.push(`${context}: added ${category} enum option "${label}".`);
  return id;
};

const readPrerequisiteModuleValue = (prerequisite: Record<string, unknown>) =>
  prerequisite.modules ??
  prerequisite.Modules ??
  prerequisite.moduleIds ??
  prerequisite.module ??
  prerequisite.Module ??
  prerequisite.prerequisiteModule ??
  prerequisite.prerequisiteModules ??
  prerequisite['Prerequisite module'] ??
  prerequisite['Prerequisite modules'];

const readPrerequisiteKpiValue = (prerequisite: Record<string, unknown>) =>
  prerequisite.kpis ??
  prerequisite.KPIs ??
  prerequisite.kpiIds ??
  prerequisite.prerequisiteKpis ??
  prerequisite.prerequisiteKPIs ??
  prerequisite.prerequisiteKpi ??
  prerequisite.prerequisiteKPI ??
  prerequisite['Prerequisite KPI'] ??
  prerequisite['Prerequisite KPIs'];

const repairPrerequisiteModules = (
  rawValue: unknown,
  enums: EnumDefinitions,
  warnings: string[],
  kpiName: string
) => {
  const rawReferences = Array.isArray(rawValue)
    ? rawValue.flatMap((entry) => splitCommaList(stringValue(entry)))
    : typeof rawValue === 'string'
      ? splitCommaList(rawValue)
      : rawValue == null
        ? []
        : [stringValue(rawValue).trim()].filter(Boolean);

  if (rawValue !== undefined && rawValue !== null && !Array.isArray(rawValue) && typeof rawValue !== 'string') {
    warnings.push(`${kpiName}: prerequisite module was not a list or string; converted it to text before matching enum options.`);
  }

  const repaired = new Set<string>();
  for (const reference of rawReferences) {
    const id = ensureEnumOptionByLabel(enums, 'prerequisiteModule', reference, warnings, kpiName);
    repaired.add(id);
  }

  return [...repaired];
};

const repairPrerequisiteKpis = (rawValue: unknown, warnings: string[], kpiName: string) => {
  if (rawValue == null) {
    return [];
  }

  if (!Array.isArray(rawValue)) {
    warnings.push(`${kpiName}: prerequisite KPI references were not a list; cleared them.`);
    return [];
  }

  return [...new Set(rawValue.map((value) => stringValue(value).trim()).filter(Boolean))];
};

const readUserGroupUseCaseValue = (record: Record<string, unknown>) =>
  record.userGroupUseCases ??
  record.userGroupsUseCases ??
  record.useCasesByUserGroup ??
  record.useCaseByUserGroup ??
  record['User Group Use Cases'] ??
  record['Use Cases by User Group'];

const repairUserGroupReferences = (
  rawValue: unknown,
  enums: EnumDefinitions,
  warnings: string[],
  kpiName: string
) => {
  const rawList = Array.isArray(rawValue)
    ? rawValue
    : typeof rawValue === 'string'
      ? splitCommaList(rawValue)
      : rawValue == null
        ? []
        : [rawValue];

  if (rawValue !== undefined && rawValue !== null && !Array.isArray(rawValue) && typeof rawValue !== 'string') {
    warnings.push(`${kpiName}: userGroup was not a list or string; converted it to text before matching enum options.`);
  }

  const lookup = enumLabelLookup(enums, 'userGroup');
  const repaired = new Set<string>();
  for (const value of rawList) {
    const reference = stringValue(value).trim();
    if (!reference) {
      continue;
    }

    const matchedId = lookup.get(reference) ?? lookup.get(normalizeKey(reference));
    if (matchedId) {
      repaired.add(matchedId);
    } else {
      warnings.push(`${kpiName}: userGroup reference "${reference}" did not match an enum option and was removed.`);
    }
  }

  return [...repaired];
};

const normalizeUseCaseGroups = (items: KpiUserGroupUseCase[]) => {
  const grouped = new Map<string, Set<string>>();
  for (const item of items) {
    if (!item.userGroup) {
      continue;
    }

    const group = grouped.get(item.userGroup) ?? new Set<string>();
    for (const useCase of item.useCases) {
      if (useCase) {
        group.add(useCase);
      }
    }
    grouped.set(item.userGroup, group);
  }

  return [...grouped.entries()].map(([userGroup, useCases]) => ({
    userGroup,
    useCases: [...useCases]
  }));
};

const normalizeUseCasePerformanceAreas = (items: KpiUseCasePerformanceArea[]) => {
  const grouped = new Map<string, Set<string>>();
  for (const item of items) {
    if (!item.useCase) {
      continue;
    }

    const areas = grouped.get(item.useCase) ?? new Set<string>();
    for (const performanceArea of item.performanceAreas) {
      if (performanceArea) {
        areas.add(performanceArea);
      }
    }
    grouped.set(item.useCase, areas);
  }

  return [...grouped.entries()].map(([useCase, performanceAreas]) => ({
    useCase,
    performanceAreas: [...performanceAreas]
  }));
};

const hasScopedPerformanceAreaDefinitions = (rawConfig: Record<string, unknown>) => {
  const rawEnums = isRecord(rawConfig.enums) ? rawConfig.enums : {};
  const rawOptions = readCategory(rawEnums, 'performanceArea');
  if (!Array.isArray(rawOptions)) {
    return false;
  }

  return rawOptions.some(
    (option) =>
      isRecord(option) &&
      stringValue(option.useCase ?? option.useCaseId ?? option.case ?? option.caseId ?? option['Use Case']).trim()
  );
};

const isLegacyPerformanceAreaSchema = (rawConfig: Record<string, unknown>) => {
  const schemaVersion = Number(rawConfig.schemaVersion);
  return (!Number.isFinite(schemaVersion) || schemaVersion < 8) && !hasScopedPerformanceAreaDefinitions(rawConfig);
};

const repairUserGroupUseCases = (
  record: Record<string, unknown>,
  enums: EnumDefinitions,
  warnings: string[],
  kpiName: string
) => {
  const rawGrouped = readUserGroupUseCaseValue(record);

  if (Array.isArray(rawGrouped)) {
    const repaired = rawGrouped.flatMap((item, index): KpiUserGroupUseCase[] => {
      if (!isRecord(item)) {
        warnings.push(`${kpiName}: userGroupUseCases item ${index + 1} was not an object and was removed.`);
        return [];
      }

      const rawUserGroup =
        item.userGroup ?? item.userGroupId ?? item.group ?? item.groupId ?? item.label ?? item['User Group'];
      const userGroups = repairUserGroupReferences(rawUserGroup == null ? [] : [rawUserGroup], enums, warnings, kpiName);
      if (userGroups.length === 0) {
        warnings.push(`${kpiName}: userGroupUseCases item ${index + 1} had no valid user group and was removed.`);
        return [];
      }

      return userGroups.map((userGroup) => ({
        userGroup,
        useCases: repairEnumReferences(item.useCases ?? item.useCase ?? item['Use Cases'], 'useCase', enums, warnings, kpiName)
      }));
    });

    return normalizeUseCaseGroups(repaired);
  }

  if (rawGrouped !== undefined) {
    warnings.push(`${kpiName}: userGroupUseCases was not a list; migrated legacy userGroup/useCase fields where possible.`);
  }

  const legacyUseCases = repairEnumReferences(readCategory(record, 'useCase'), 'useCase', enums, warnings, kpiName);
  const legacyUserGroups = repairUserGroupReferences(readCategory(record, 'userGroup'), enums, warnings, kpiName);
  if (legacyUseCases.length === 0 && legacyUserGroups.length === 0) {
    return [];
  }

  const userGroups =
    legacyUserGroups.length > 0
      ? legacyUserGroups
      : [ensureEnumOptionByLabel(enums, 'userGroup', 'Unspecified User Group', warnings, kpiName)];

  return normalizeUseCaseGroups(
    userGroups.map((userGroup) => ({
      userGroup,
      useCases: legacyUseCases
    }))
  );
};

const readPerformanceAreasByUseCaseValue = (record: Record<string, unknown>) =>
  record.performanceAreasByUseCase ??
  record.performanceAreaByUseCase ??
  record.performanceAreasByUseCases ??
  record['Performance Areas by Use Case'] ??
  record['Performance Area by Use Case'];

const repairPerformanceAreasByUseCase = (
  record: Record<string, unknown>,
  enums: EnumDefinitions,
  warnings: string[],
  kpiName: string
) => {
  const rawScoped = readPerformanceAreasByUseCaseValue(record);
  if (!Array.isArray(rawScoped)) {
    if (rawScoped !== undefined) {
      warnings.push(`${kpiName}: performanceAreasByUseCase was not a list; migrated legacy performanceArea where possible.`);
    }
    return [];
  }

  const repaired = rawScoped.flatMap((item, index): KpiUseCasePerformanceArea[] => {
    if (!isRecord(item)) {
      warnings.push(`${kpiName}: performanceAreasByUseCase item ${index + 1} was not an object and was removed.`);
      return [];
    }

    const rawUseCase = item.useCase ?? item.useCaseId ?? item.useCases ?? item['Use Case'];
    const useCases = repairEnumReferences(
      Array.isArray(rawUseCase) ? rawUseCase : rawUseCase == null ? [] : [rawUseCase],
      'useCase',
      enums,
      warnings,
      kpiName
    );
    if (useCases.length === 0) {
      warnings.push(`${kpiName}: performanceAreasByUseCase item ${index + 1} had no valid use case and was removed.`);
      return [];
    }

    const rawPerformanceAreas = item.performanceAreas ?? item.performanceArea ?? item['Performance Areas'];

    return useCases.map((useCase) => ({
      useCase,
      performanceAreas: repairPerformanceAreaReferencesForUseCase(rawPerformanceAreas, useCase, enums, warnings, kpiName)
    }));
  });

  return normalizeUseCasePerformanceAreas(repaired);
};

const readNotesByUseCaseValue = (record: Record<string, unknown>) =>
  record.notesByUseCase ??
  record.noteByUseCase ??
  record.useCaseNotes ??
  record.useCaseNote ??
  record.notes ??
  record['Notes by Use Case'] ??
  record['Use Case Notes'];

const normalizeUseCaseNotes = (items: KpiUseCaseNote[]) => {
  const grouped = new Map<string, string>();
  for (const item of items) {
    if (!item.useCase) {
      continue;
    }

    const note = item.note.trim();
    if (!note) {
      continue;
    }

    const existing = grouped.get(item.useCase);
    grouped.set(item.useCase, existing ? `${existing}\n${note}` : note);
  }

  return [...grouped.entries()].map(([useCase, note]) => ({
    useCase,
    note
  }));
};

const repairNotesByUseCase = (
  record: Record<string, unknown>,
  enums: EnumDefinitions,
  warnings: string[],
  kpiName: string
) => {
  const rawScoped = readNotesByUseCaseValue(record);
  if (rawScoped == null) {
    return [];
  }

  if (!Array.isArray(rawScoped)) {
    warnings.push(`${kpiName}: notesByUseCase was not a list and was cleared.`);
    return [];
  }

  const repaired = rawScoped.flatMap((item, index): KpiUseCaseNote[] => {
    if (!isRecord(item)) {
      warnings.push(`${kpiName}: notesByUseCase item ${index + 1} was not an object and was removed.`);
      return [];
    }

    const rawUseCase = item.useCase ?? item.useCaseId ?? item.useCases ?? item['Use Case'];
    const useCases = repairEnumReferences(
      Array.isArray(rawUseCase) ? rawUseCase : rawUseCase == null ? [] : [rawUseCase],
      'useCase',
      enums,
      warnings,
      kpiName
    );
    if (useCases.length === 0) {
      warnings.push(`${kpiName}: notesByUseCase item ${index + 1} had no valid use case and was removed.`);
      return [];
    }

    const note = stringValue(item.note ?? item.notes ?? item.text ?? item.value ?? item['Note']).trim();
    if (!note) {
      return [];
    }

    return useCases.map((useCase) => ({
      useCase,
      note
    }));
  });

  return normalizeUseCaseNotes(repaired);
};

const repairUseCaseOwnership = (enums: EnumDefinitions, kpis: KpiMetric[], warnings: string[], legacyPerformanceAreas: boolean) => {
  const nextEnums: EnumDefinitions = {
    ...enums,
    useCase: []
  };
  const validUserGroups = new Set(enums.userGroup.map((option) => option.id));
  const useCaseById = new Map(enums.useCase.map((option) => [option.id, option]));
  const usedUseCaseIds = new Set<string>();
  const claimedUnscopedIds = new Set<string>();
  const scopedByKey = new Map<string, EnumOption>();

  const ensureUnspecifiedUserGroup = () => {
    const existing = enums.userGroup.find((option) => normalizeKey(option.label) === normalizeKey('Unspecified User Group'));
    if (existing) {
      validUserGroups.add(existing.id);
      return existing.id;
    }

    const id = ensureEnumOptionByLabel(enums, 'userGroup', 'Unspecified User Group', warnings, 'Use Case migration');
    validUserGroups.add(id);
    nextEnums.userGroup = enums.userGroup;
    return id;
  };

  const addScopedOption = (option: EnumOption, userGroup: string, preserveId: boolean) => {
    const key = `${userGroup}\u0000${normalizeKey(option.label)}`;
    const existing = scopedByKey.get(key);
    if (existing) {
      return existing.id;
    }

    let id = preserveId ? option.id : createId('enum-useCase');
    while (usedUseCaseIds.has(id)) {
      id = createId('enum-useCase');
    }

    const scoped = {
      ...option,
      id,
      userGroup
    };
    nextEnums.useCase = [...nextEnums.useCase, scoped];
    scopedByKey.set(key, scoped);
    usedUseCaseIds.add(id);
    return id;
  };

  for (const option of enums.useCase) {
    if (option.userGroup && validUserGroups.has(option.userGroup)) {
      addScopedOption(option, option.userGroup, true);
    }
  }

  const resolveUseCaseForGroup = (useCaseId: string, userGroup: string, kpiName: string) => {
    const option = useCaseById.get(useCaseId);
    if (!option) {
      return undefined;
    }

    if (option.userGroup && validUserGroups.has(option.userGroup)) {
      if (option.userGroup === userGroup) {
        return addScopedOption(option, userGroup, true);
      }

      const clonedId = addScopedOption(option, userGroup, false);
      warnings.push(`${kpiName}: copied use case "${option.label}" for user group ownership.`);
      return clonedId;
    }

    if (!claimedUnscopedIds.has(option.id)) {
      claimedUnscopedIds.add(option.id);
      return addScopedOption(option, userGroup, true);
    }

    const clonedId = addScopedOption(option, userGroup, false);
    warnings.push(`${kpiName}: copied legacy use case "${option.label}" because it is used by multiple user groups.`);
    return clonedId;
  };

  const scopedKpis = kpis.map((kpi) => {
    const useCaseRetargets = new Map<string, Set<string>>();
    const userGroupUseCases = kpi.userGroupUseCases.map((entry) => {
      const useCases = entry.useCases
        .map((id) => {
          const scopedId = resolveUseCaseForGroup(id, entry.userGroup, kpi.name);
          if (scopedId) {
            const targets = useCaseRetargets.get(id) ?? new Set<string>();
            targets.add(scopedId);
            useCaseRetargets.set(id, targets);
          }
          return scopedId;
        })
        .filter(Boolean) as string[];
      return {
        ...entry,
        useCases: [...new Set(useCases)]
      };
    });

    const assignedUseCases = new Set(userGroupUseCases.flatMap((entry) => entry.useCases));
    const validUseCases = legacyPerformanceAreas ? assignedUseCases : new Set(nextEnums.useCase.map((option) => option.id));
    const scopedPerformanceAreas = kpi.performanceAreasByUseCase.length
      ? normalizeUseCasePerformanceAreas(
          kpi.performanceAreasByUseCase.flatMap((entry) => {
            const targets = useCaseRetargets.get(entry.useCase) ?? new Set([entry.useCase]);
            return [...targets]
              .filter((useCase) => validUseCases.has(useCase))
              .map((useCase) => ({
                useCase,
                performanceAreas: entry.performanceAreas
              }));
          })
        )
      : legacyPerformanceAreas
        ? normalizeUseCasePerformanceAreas(
            [...assignedUseCases].map((useCase) => ({
              useCase,
              performanceAreas: kpi.performanceArea
            }))
          )
        : [];

    const notesByUseCase = normalizeUseCaseNotes(
      kpi.notesByUseCase.flatMap((entry) => {
        const targets = useCaseRetargets.get(entry.useCase) ?? new Set([entry.useCase]);
        return [...targets]
          .filter((useCase) => validUseCases.has(useCase))
          .map((useCase) => ({
            useCase,
            note: entry.note
          }));
      })
    );

    return {
      ...kpi,
      userGroupUseCases,
      performanceAreasByUseCase: scopedPerformanceAreas,
      performanceArea: scopedPerformanceAreas.length || !legacyPerformanceAreas
        ? [...new Set(scopedPerformanceAreas.flatMap((entry) => entry.performanceAreas))]
        : kpi.performanceArea,
      notesByUseCase
    };
  });

  const unspecifiedUserGroup = () => ensureUnspecifiedUserGroup();
  for (const option of enums.useCase) {
    if (!usedUseCaseIds.has(option.id) && !claimedUnscopedIds.has(option.id)) {
      const userGroup = option.userGroup && validUserGroups.has(option.userGroup) ? option.userGroup : unspecifiedUserGroup();
      addScopedOption(option, userGroup, true);
    }
  }

  return {
    enums: nextEnums,
    kpis: scopedKpis
  };
};

const createOwnedPerformanceAreaId = (optionId: string, useCase: string, usedIds: Set<string>) => {
  const baseId = `${optionId}-${useCase}`;
  let id = baseId;
  let index = 2;
  while (usedIds.has(id)) {
    id = `${baseId}-${index}`;
    index += 1;
  }
  usedIds.add(id);
  return id;
};

const repairPerformanceAreaOwnership = (
  enums: EnumDefinitions,
  kpis: KpiMetric[],
  warnings: string[],
  legacyPerformanceAreas: boolean
) => {
  const nextEnums: EnumDefinitions = {
    ...enums,
    performanceArea: [...enums.performanceArea]
  };

  const hasPerformanceData =
    nextEnums.performanceArea.length > 0 ||
    kpis.some((kpi) => kpi.performanceArea.length > 0 || kpi.performanceAreasByUseCase.some((entry) => entry.performanceAreas.length > 0));

  if (legacyPerformanceAreas && hasPerformanceData && nextEnums.useCase.length === 0) {
    const userGroup = ensureEnumOptionByLabel(
      nextEnums,
      'userGroup',
      'Unspecified User Group',
      warnings,
      'Performance area migration'
    );
    const useCaseId = createId('enum-useCase');
    nextEnums.useCase = [
      {
        id: useCaseId,
        label: 'Unspecified Use Case',
        description: '',
        userGroup
      }
    ];
    warnings.push('Performance area migration: added an unspecified use case to own legacy performance area options.');
  }

  const validUseCases = new Set(nextEnums.useCase.map((option) => option.id));
  const usedIds = new Set<string>();
  const scopedOptions: EnumOption[] = [];
  const labelUseCaseLookup = new Map<string, string>();
  const optionById = new Map(nextEnums.performanceArea.map((option) => [option.id, option]));

  const keyFor = (label: string, useCase: string) => `${useCase}\u0000${label}`;
  const addScopedOption = (option: EnumOption, useCase: string, keepId: boolean) => {
    const key = keyFor(option.label, useCase);
    const existing = labelUseCaseLookup.get(key);
    if (existing) {
      return existing;
    }

    const id = keepId && !usedIds.has(option.id) ? option.id : createOwnedPerformanceAreaId(option.id || 'enum-performanceArea', useCase, usedIds);
    if (keepId) {
      usedIds.add(id);
    }

    scopedOptions.push({
      id,
      label: option.label,
      description: option.description,
      useCase
    });
    labelUseCaseLookup.set(key, id);
    return id;
  };

  for (const option of nextEnums.performanceArea) {
    if (option.useCase && validUseCases.has(option.useCase)) {
      addScopedOption(option, option.useCase, true);
    }
  }

  const scopedIdFor = (performanceAreaId: string, useCase: string, kpiName: string) => {
    const option = optionById.get(performanceAreaId);
    if (!option) {
      warnings.push(`${kpiName}: performanceArea reference "${performanceAreaId}" did not match an enum option and was removed.`);
      return undefined;
    }

    if (option.useCase && validUseCases.has(option.useCase) && option.useCase === useCase) {
      return labelUseCaseLookup.get(keyFor(option.label, useCase)) ?? addScopedOption(option, useCase, true);
    }

    if (!legacyPerformanceAreas) {
      return undefined;
    }

    return addScopedOption(option, useCase, false);
  };

  for (const option of nextEnums.performanceArea) {
    if (legacyPerformanceAreas && (!option.useCase || !validUseCases.has(option.useCase))) {
      for (const useCase of validUseCases) {
        addScopedOption(option, useCase, false);
      }
    }
  }

  const scopedKpis = kpis.map((kpi) => {
    const validPerformanceAreasByUseCase = kpi.performanceAreasByUseCase
      .filter((entry) => validUseCases.has(entry.useCase))
      .map((entry) => ({
        useCase: entry.useCase,
        performanceAreas: [
          ...new Set(
            entry.performanceAreas
              .map((performanceArea) => scopedIdFor(performanceArea, entry.useCase, kpi.name))
              .filter(Boolean) as string[]
          )
        ]
      }));

    const performanceAreasByUseCase = validPerformanceAreasByUseCase.length
      ? validPerformanceAreasByUseCase
      : legacyPerformanceAreas
        ? [...validUseCases].map((useCase) => ({
            useCase,
            performanceAreas: [
              ...new Set(
                kpi.performanceArea
                  .map((performanceArea) => scopedIdFor(performanceArea, useCase, kpi.name))
                  .filter(Boolean) as string[]
              )
            ]
          }))
        : [];

    return {
      ...kpi,
      performanceAreasByUseCase,
      performanceArea: [...new Set(performanceAreasByUseCase.flatMap((entry) => entry.performanceAreas))]
    };
  });

  return {
    enums: {
      ...nextEnums,
      performanceArea: scopedOptions
    },
    kpis: scopedKpis
  };
};

const emptyScale = (): SpatialScaleConfig => ({
  applicable: false,
  isBasicUnit: false,
  aggregationMethod: '',
  formula: '',
  leftExpression: '',
  rightExpression: ''
});

const replaceLegacyGridTerminology = (value: string) =>
  value.replace(/\bgrids?\b/gi, (match) => {
    const replacement = match.toLowerCase() === 'grids' ? 'cells' : 'cell';
    if (match === match.toUpperCase()) return replacement.toUpperCase();
    if (match[0] === match[0].toUpperCase()) return `${replacement[0].toUpperCase()}${replacement.slice(1)}`;
    return replacement;
  });

const migrateLegacyGridTerminology = (value: unknown): unknown => {
  if (typeof value === 'string') return replaceLegacyGridTerminology(value);
  if (Array.isArray(value)) return value.map(migrateLegacyGridTerminology);
  if (!isRecord(value)) return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      replaceLegacyGridTerminology(key),
      migrateLegacyGridTerminology(entry)
    ])
  );
};

const CELL_TERMINOLOGY_SCHEMA_VERSION = 22;

const repairSpatialScales = (rawValue: unknown, warnings: string[], kpiName: string): KpiMetric['spatialScales'] => {
  const rawScales = isRecord(rawValue) ? rawValue : {};
  if (!isRecord(rawValue)) {
    warnings.push(`${kpiName}: spatialScales was missing or invalid; initialized empty spatial scale settings.`);
  }

  const repaired = {} as KpiMetric['spatialScales'];
  for (const scale of spatialScaleKeys) {
    const rawScale = isRecord(rawScales[scale]) ? rawScales[scale] : {};
    const importedFormula = stringValue(rawScale.formula ?? rawScale.aggregationFormula ?? rawScale.latex);
    const parsedFormula = splitFormula(importedFormula);
    const leftExpression = stringValue(rawScale.leftExpression) || parsedFormula.leftExpression;
    const rightExpression = stringValue(rawScale.rightExpression) || parsedFormula.rightExpression;
    const isBasicUnit = booleanValue(rawScale.isBasicUnit);
    repaired[scale] = {
      applicable: booleanValue(rawScale.applicable),
      isBasicUnit,
      aggregationMethod: stringValue(rawScale.aggregationMethod ?? rawScale.explanation ?? rawScale.generalExplanation),
      formula: isBasicUnit ? '' : rightExpression,
      leftExpression: '',
      rightExpression: isBasicUnit ? '' : rightExpression
    };
  }

  return repaired;
};

const repairFormulaTerms = (rawTerms: unknown, warnings: string[], kpiName: string, formulaLabel: string) => {
  if (rawTerms == null) {
    return [];
  }

  if (!Array.isArray(rawTerms)) {
    warnings.push(`${kpiName}: ${formulaLabel} term explanations were not a list and were cleared.`);
    return [];
  }

  return rawTerms.flatMap((item, index) => {
    if (typeof item === 'string') {
      return [{ term: item, explanation: '' }];
    }

    if (!isRecord(item)) {
      warnings.push(`${kpiName}: ${formulaLabel} term explanation ${index + 1} was not readable and was removed.`);
      return [];
    }

    return [
      {
        term: stringValue(item.term ?? item.key ?? item.symbol ?? item.latex ?? item.LaTeX ?? item['Term']),
        explanation: stringValue(item.explanation ?? item.value ?? item.description ?? item['Explanation'])
      }
    ];
  });
};

const splitFormula = (formula: string) => {
  const equalsIndex = formula.indexOf('=');
  return equalsIndex < 0
    ? { leftExpression: '', rightExpression: formula }
    : {
        leftExpression: formula.slice(0, equalsIndex).trim(),
        rightExpression: formula.slice(equalsIndex + 1).trim()
      };
};

const repairFormulaItem = (item: unknown, index: number, warnings: string[], kpiName: string): KpiFormulaItem => {
  const label = `formula item ${index + 1}`;
  if (typeof item === 'string') {
    const sides = splitFormula(item);
    return {
      tag: `Formula ${index + 1}`,
      formula: item,
      ...sides,
      generalExplanation: '',
      terms: []
    };
  }

  if (!isRecord(item)) {
    warnings.push(`${kpiName}: ${label} was not readable; initialized it as a blank formula item.`);
    return {
      tag: `Formula ${index + 1}`,
      formula: '',
      leftExpression: '',
      rightExpression: '',
      generalExplanation: '',
      terms: []
    };
  }

  const tag = stringValue(item.tag ?? item.Tag ?? item.label ?? item.name).trim() || `Formula ${index + 1}`;
  const formula = stringValue(item.formula ?? item.Formula ?? item.latex ?? item.LaTeX);
  const fallbackSides = splitFormula(formula);
  const leftExpression = stringValue(item.leftExpression ?? item.left ?? item.lhs ?? item['Left Expression']) || fallbackSides.leftExpression;
  const rightExpression = stringValue(item.rightExpression ?? item.right ?? item.rhs ?? item['Right Expression']) || fallbackSides.rightExpression;
  return {
    tag,
    formula: leftExpression ? `${leftExpression} = ${rightExpression}` : rightExpression,
    leftExpression,
    rightExpression,
    generalExplanation: stringValue(
      item.generalExplanation ??
        item.general_expression ??
        item.expression ??
        item.Expression ??
        item.explanation ??
        item.Explanation ??
        item.formulaExplanation ??
        item['Formula explanation'] ??
        item['General Explanation']
    ),
    terms: repairFormulaTerms(
      item.terms ?? item.termExplanations ?? item.termWiseExplanations ?? item.variables ?? item['Term Explanations'],
      warnings,
      kpiName,
      tag
    )
  };
};

const repairFormulaGroups = (description: Record<string, unknown>, warnings: string[], kpiName: string): KpiFormulaGroup[] => {
  const rawItems =
    description.formulas ??
    description.Formulas ??
    description.formulaGroups ??
    description['Formula groups'] ??
    description.formulaItems ??
    description['Formula items'];

  if (Array.isArray(rawItems)) {
    const groups: KpiFormulaGroup[] = [];
    const looseItems: KpiFormulaItem[] = [];

    rawItems.forEach((item, index) => {
      if (isRecord(item) && Array.isArray(item.items ?? item.formulas ?? item.Formulas)) {
        const rawGroupItems = item.items ?? item.formulas ?? item.Formulas;
        groups.push({
          name: stringValue(item.name ?? item.groupName ?? item.label ?? item.title ?? item['Group Name']).trim(),
          items: (rawGroupItems as unknown[]).map((formulaItem, itemIndex) =>
            repairFormulaItem(formulaItem, itemIndex, warnings, kpiName)
          )
        });
        return;
      }

      looseItems.push(repairFormulaItem(item, index, warnings, kpiName));
    });

    if (looseItems.length > 0) {
      groups.unshift({
        name: 'Formula',
        items: looseItems
      });
    }

    return groups.filter((group) => group.name.trim() || group.items.length > 0);
  }

  if (rawItems !== undefined) {
    warnings.push(`${kpiName}: formulas was not a list; migrated legacy single formula fields where possible.`);
  }

  const legacyFormula = stringValue(description.formula ?? description.Formula).trim();
  const legacyExpression = stringValue(
    description.generalExplanation ??
      description.expression ??
      description.Expression ??
      description.formulaExplanation ??
      description['Formula explanation'] ??
      description.formula_explanation
  ).trim();
  const legacyTag = stringValue(description.formulaTag ?? description.tag ?? description.Tag).trim() || 'Formula';

  if (!legacyFormula && !legacyExpression) {
    return [];
  }

  return [
    {
      name: 'Formula',
      items: [
        {
          tag: legacyTag,
          formula: legacyFormula,
          ...splitFormula(legacyFormula),
          generalExplanation: legacyExpression,
          terms: []
        }
      ]
    }
  ];
};

const repairDefaultFocus = (rawConfig: Record<string, unknown>, enums: EnumDefinitions, warnings: string[]): KpiDefaultFocus | undefined => {
  const rawFocus = rawConfig.defaultFocus ?? rawConfig.focusMode ?? rawConfig.focus ?? rawConfig['Default Focus'];
  if (rawFocus == null) {
    return undefined;
  }

  if (!isRecord(rawFocus)) {
    warnings.push('Default focus was not an object and was cleared.');
    return undefined;
  }

  const userGroupReference = stringValue(rawFocus.userGroup ?? rawFocus.userGroupId ?? rawFocus.group ?? rawFocus['User Group']).trim();
  const useCaseReference = stringValue(rawFocus.useCase ?? rawFocus.useCaseId ?? rawFocus.case ?? rawFocus['Use Case']).trim();
  const userGroupLookup = enumLabelLookup(enums, 'userGroup');
  const useCaseLookup = enumLabelLookup(enums, 'useCase');
  const userGroup = userGroupLookup.get(userGroupReference) ?? userGroupLookup.get(normalizeKey(userGroupReference));
  const useCase = useCaseLookup.get(useCaseReference) ?? useCaseLookup.get(normalizeKey(useCaseReference));

  if (!userGroup || !useCase) {
    warnings.push('Default focus did not match existing user group/use case options and was cleared.');
    return undefined;
  }

  const validPair = enums.useCase.some((option) => option.id === useCase && option.userGroup === userGroup);
  if (!validPair) {
    warnings.push('Default focus use case does not belong to the selected user group and was cleared.');
    return undefined;
  }

  return { userGroup, useCase };
};

const normalizeDataSourceFieldType = (value: unknown, legacyUnit: string): DataSourceFieldType => {
  const normalized = normalizeKey(stringValue(value));
  const aliases: Record<string, DataSourceFieldType> = {
    id: 'id', identifier: 'id', key: 'id',
    number: 'number', numeric: 'number', integer: 'number', float: 'number', decimal: 'number',
    boolean: 'boolean', bool: 'boolean',
    text: 'text', string: 'text',
    enum: 'enum', enums: 'enum', enumeration: 'enum',
    collection: 'collection', array: 'collection', list: 'collection', set: 'collection'
  };
  if (aliases[normalized]) return aliases[normalized];
  const normalizedUnit = normalizeKey(legacyUnit);
  if (normalizedUnit === 'boolean' || normalizedUnit === 'bool') return 'boolean';
  if (normalizedUnit === 'id' || normalizedUnit === 'identifier') return 'id';
  return legacyUnit.trim() ? 'number' : 'text';
};

const repairDataSources = (rawValue: unknown, warnings: string[]): DataSource[] => {
  if (rawValue == null) {
    return [];
  }
  if (!Array.isArray(rawValue)) {
    warnings.push('Data sources were not a list and were initialized empty.');
    return [];
  }

  const usedSourceIds = new Set<string>();
  return rawValue.flatMap((rawSource, sourceIndex) => {
    if (!isRecord(rawSource)) {
      warnings.push(`Data source ${sourceIndex + 1} was not readable and was removed.`);
      return [];
    }
    const name = stringValue(rawSource.name ?? rawSource.Name).trim() || `Data source ${sourceIndex + 1}`;
    const id = ensureUniqueId(rawSource.id, 'source', usedSourceIds, warnings, `Data source "${name}"`);
    const rawFields = Array.isArray(rawSource.fields ?? rawSource.Fields) ? (rawSource.fields ?? rawSource.Fields) as unknown[] : [];
    const usedFieldIds = new Set<string>();
    const fields = rawFields.flatMap((rawField, fieldIndex): DataSourceField[] => {
      if (!isRecord(rawField)) {
        warnings.push(`${name}: field ${fieldIndex + 1} was not readable and was removed.`);
        return [];
      }
      const fieldName = stringValue(rawField.name ?? rawField.Name).trim() || `Field ${fieldIndex + 1}`;
      const legacyUnit = stringValue(rawField.valueUnit ?? rawField.unit ?? rawField['Value Unit']);
      const dataType = normalizeDataSourceFieldType(rawField.dataType ?? rawField.fieldType ?? rawField.type, legacyUnit);
      const generatedRelationId = stringValue(rawField.generatedRelationId).trim();
      const generatedRelationRole = rawField.generatedRelationRole === 'oneCollection' ||
        rawField.generatedRelationRole === 'manyForeignKey' ||
        rawField.generatedRelationRole === 'sourceCollection' ||
        rawField.generatedRelationRole === 'targetCollection'
        ? rawField.generatedRelationRole
        : undefined;
      return [{
        id: ensureUniqueId(rawField.id, 'field', usedFieldIds, warnings, `${name}: field "${fieldName}"`),
        name: fieldName,
        meaning: stringValue(rawField.meaning ?? rawField.description ?? rawField.Meaning),
        dataType,
        valueUnit: dataType === 'number' ? legacyUnit : '',
        ...(generatedRelationId ? { generatedRelationId } : {}),
        ...(generatedRelationRole ? { generatedRelationRole } : {})
      }];
    });
    const validFieldIds = new Set(fields.map((field) => field.id));
    const claimedFieldIds = new Set<string>();
    const usedGroupIds = new Set<string>();
    const rawGroups = Array.isArray(rawSource.fieldGroups) ? rawSource.fieldGroups : [];
    const fieldGroups = rawGroups.flatMap((rawGroup, groupIndex): DataSourceFieldGroup[] => {
      if (!isRecord(rawGroup)) return [];
      const fieldIds = (Array.isArray(rawGroup.fieldIds) ? rawGroup.fieldIds : [])
        .map((value) => stringValue(value))
        .filter((fieldId) => validFieldIds.has(fieldId) && !claimedFieldIds.has(fieldId));
      fieldIds.forEach((fieldId) => claimedFieldIds.add(fieldId));
      const rawDimensions = Array.isArray(rawGroup.dimensions)
        ? rawGroup.dimensions
        : [
            {
              name: rawGroup.dimensionName ?? rawGroup.versionName ?? rawGroup.name,
              options: rawGroup.dimensionOptions ?? rawGroup.versions
            }
          ];
      const usedDimensionIds = new Set<string>();
      const seenDimensionNames = new Set<string>();
      const dimensions = rawDimensions.flatMap((rawDimension, dimensionIndex) => {
        const dimensionRecord = isRecord(rawDimension) ? rawDimension : undefined;
        const dimensionName = stringValue(
          dimensionRecord?.name ?? dimensionRecord?.dimensionName ?? dimensionRecord?.label ?? rawDimension
        ).trim();
        const normalizedName = dimensionName.toLocaleLowerCase();
        if (!dimensionName || seenDimensionNames.has(normalizedName)) return [];
        seenDimensionNames.add(normalizedName);
        const rawOptions = dimensionRecord?.options ?? dimensionRecord?.dimensionOptions ?? dimensionRecord?.versions;
        const seenOptions = new Set<string>();
        const options = (Array.isArray(rawOptions) ? rawOptions : stringValue(rawOptions).split(','))
          .map((value) => stringValue(value).trim())
          .filter((option) => {
            const normalizedOption = option.toLocaleLowerCase();
            if (!option || seenOptions.has(normalizedOption)) return false;
            seenOptions.add(normalizedOption);
            return true;
          });
        return [{
          id: ensureUniqueId(
            dimensionRecord?.id,
            'dimension',
            usedDimensionIds,
            warnings,
            `${name}: field group ${groupIndex + 1}, dimension ${dimensionIndex + 1}`
          ),
          name: dimensionName,
          options
        }];
      });
      return [{
        id: ensureUniqueId(rawGroup.id, 'field-group', usedGroupIds, warnings, `${name}: field group ${groupIndex + 1}`),
        dimensions,
        fieldIds,
        position: Math.max(0, Math.min(Number.isInteger(rawGroup.position) ? Number(rawGroup.position) : 0, fields.length))
      }];
    });
    const rawSpatialUnit = stringValue(rawSource.spatialUnit ?? rawSource.spatialScale ?? rawSource['Spatial Unit']).trim();
    const normalizedSpatialUnit = rawSpatialUnit.toLocaleLowerCase().replace(/[^a-z0-9]/g, '');
    const matchingScale = spatialScaleKeys.find((scale) =>
      normalizedSpatialUnit === scale.toLocaleLowerCase() ||
      normalizedSpatialUnit === spatialScaleLabels[scale].toLocaleLowerCase().replace(/[^a-z0-9]/g, '') ||
      (scale === 'cell' && normalizedSpatialUnit === 'grid')
    );
    const spatialUnit: SpatialUnit = rawSpatialUnit.toLocaleLowerCase() === 'point'
      ? 'Point'
      : matchingScale
        ? spatialScaleLabels[matchingScale]
        : '';
    if (rawSpatialUnit && !spatialUnit) {
      warnings.push(`${name}: unsupported spatial unit "${rawSpatialUnit}" was cleared.`);
    }
    return [{
      id,
      name,
      spatialUnit,
      primaryKeyFieldId: (() => {
        const candidate = stringValue(rawSource.primaryKeyFieldId).trim();
        const candidateField = fields.find((field) => field.id === candidate && field.dataType === 'id');
        if (candidateField && claimedFieldIds.has(candidate)) {
          warnings.push(`${name}: dimensioned field "${candidateField.name}" cannot be the primary key; the primary key was cleared.`);
          return undefined;
        }
        return candidateField ? candidate : undefined;
      })(),
      fields,
      fieldGroups
    }];
  });
};

const relationFieldBaseName = (value: string) => value.trim().replace(/[^\p{L}\p{N}_]+/gu, '') || 'Table';
const fallbackRelationKeyName = (source?: DataSource) => `${relationFieldBaseName(source?.name ?? 'Table')}ID`;
const collectionRelationFieldName = (keyName: string) => {
  const normalized = relationFieldBaseName(keyName);
  return normalized.endsWith('s') ? normalized : `${normalized}s`;
};

const repairTableRelations = (rawValue: unknown, dataSources: DataSource[], warnings: string[]): TableRelation[] => {
  if (rawValue == null) return [];
  if (!Array.isArray(rawValue)) {
    warnings.push('Table relations were not a list and were initialized empty.');
    return [];
  }
  const sourceById = new Map(dataSources.map((source) => [source.id, source]));
  const usedIds = new Set<string>();
  const seenPairs = new Set<string>();
  return rawValue.flatMap((rawRelation, relationIndex): TableRelation[] => {
    if (!isRecord(rawRelation)) return [];
    const sourceDataSourceId = stringValue(rawRelation.sourceDataSourceId ?? rawRelation.sourceTableId ?? rawRelation.oneDataSourceId).trim();
    const targetDataSourceId = stringValue(rawRelation.targetDataSourceId ?? rawRelation.targetTableId ?? rawRelation.manyDataSourceId).trim();
    const source = sourceById.get(sourceDataSourceId);
    const target = sourceById.get(targetDataSourceId);
    const rawCardinality = rawRelation.cardinality ?? rawRelation.type;
    const cardinality: TableRelation['cardinality'] = rawCardinality === 'manyToMany'
      ? 'manyToMany'
      : rawCardinality === 'oneToMany'
        ? 'oneToMany'
        : 'oneToOne';
    if (!source || !target || source.id === target.id || !source.primaryKeyFieldId || (cardinality !== 'oneToMany' && !target.primaryKeyFieldId)) {
      warnings.push(`Table relation ${relationIndex + 1} did not connect compatible table keys and was removed.`);
      return [];
    }
    const pairKey = cardinality !== 'oneToMany'
      ? [source.id, target.id].sort().join('\u0000')
      : `${source.id}\u0000${target.id}`;
    if (seenPairs.has(`${cardinality}\u0000${pairKey}`)) return [];
    seenPairs.add(`${cardinality}\u0000${pairKey}`);
    return [{
      id: ensureUniqueId(rawRelation.id, 'relation', usedIds, warnings, `Table relation ${relationIndex + 1}`),
      sourceDataSourceId: source.id,
      targetDataSourceId: target.id,
      cardinality
    }];
  });
};

const reconcileRelationFields = (dataSources: DataSource[], relations: TableRelation[]): DataSource[] => {
  const relationById = new Map(relations.map((relation) => [relation.id, relation]));
  const sourceById = new Map(dataSources.map((source) => [source.id, source]));
  return dataSources.map((source) => {
    const seenGeneratedRoles = new Set<string>();
    const retainedFields = source.fields.flatMap((field): DataSourceField[] => {
      if (!field.generatedRelationId) return [field];
      const relation = relationById.get(field.generatedRelationId);
      if (!relation) return [];
      const generatedKey = `${field.generatedRelationId}\u0000${field.generatedRelationRole ?? ''}`;
      if (seenGeneratedRoles.has(generatedKey)) return [];
      seenGeneratedRoles.add(generatedKey);
      if (relation.cardinality === 'oneToMany') {
        if (field.generatedRelationRole === 'oneCollection' && relation.sourceDataSourceId === source.id) {
          return [{ ...field, dataType: 'collection', valueUnit: '' }];
        }
        if (field.generatedRelationRole === 'manyForeignKey' && relation.targetDataSourceId === source.id) {
          return [{ ...field, dataType: 'id', valueUnit: '' }];
        }
      }
      if (relation.cardinality === 'manyToMany') {
        if (field.generatedRelationRole === 'sourceCollection' && relation.sourceDataSourceId === source.id) {
          return [{ ...field, dataType: 'collection', valueUnit: '' }];
        }
        if (field.generatedRelationRole === 'targetCollection' && relation.targetDataSourceId === source.id) {
          return [{ ...field, dataType: 'collection', valueUnit: '' }];
        }
      }
      return [];
    });
    const fields = [...retainedFields];
    relations.forEach((relation) => {
      const target = sourceById.get(relation.targetDataSourceId);
      const relationSource = sourceById.get(relation.sourceDataSourceId);
      const targetPrimaryKey = target?.fields.find((field) => field.id === target.primaryKeyFieldId);
      const sourcePrimaryKey = relationSource?.fields.find((field) => field.id === relationSource.primaryKeyFieldId);
      if (relation.cardinality === 'oneToMany' && source.id === relation.sourceDataSourceId && !fields.some((field) => field.generatedRelationId === relation.id && field.generatedRelationRole === 'oneCollection')) {
        fields.push({
          id: createId('field'),
          name: collectionRelationFieldName(targetPrimaryKey?.name || fallbackRelationKeyName(target)),
          meaning: `Related ${target?.name ?? 'table'} record IDs`,
          dataType: 'collection',
          valueUnit: '',
          generatedRelationId: relation.id,
          generatedRelationRole: 'oneCollection'
        });
      }
      if (relation.cardinality === 'oneToMany' && source.id === relation.targetDataSourceId && !fields.some((field) => field.generatedRelationId === relation.id && field.generatedRelationRole === 'manyForeignKey')) {
        fields.push({
          id: createId('field'),
          name: sourcePrimaryKey?.name.trim() ? relationFieldBaseName(sourcePrimaryKey.name) : fallbackRelationKeyName(relationSource),
          meaning: `ID of the related ${relationSource?.name ?? 'table'} record`,
          dataType: 'id',
          valueUnit: '',
          generatedRelationId: relation.id,
          generatedRelationRole: 'manyForeignKey'
        });
      }
      if (relation.cardinality === 'manyToMany' && source.id === relation.sourceDataSourceId && !fields.some((field) => field.generatedRelationId === relation.id && field.generatedRelationRole === 'sourceCollection')) {
        fields.push({
          id: createId('field'),
          name: collectionRelationFieldName(targetPrimaryKey?.name || fallbackRelationKeyName(target)),
          meaning: `Related ${target?.name ?? 'table'} record IDs`,
          dataType: 'collection',
          valueUnit: '',
          generatedRelationId: relation.id,
          generatedRelationRole: 'sourceCollection'
        });
      }
      if (relation.cardinality === 'manyToMany' && source.id === relation.targetDataSourceId && !fields.some((field) => field.generatedRelationId === relation.id && field.generatedRelationRole === 'targetCollection')) {
        fields.push({
          id: createId('field'),
          name: collectionRelationFieldName(sourcePrimaryKey?.name || fallbackRelationKeyName(relationSource)),
          meaning: `Related ${relationSource?.name ?? 'table'} record IDs`,
          dataType: 'collection',
          valueUnit: '',
          generatedRelationId: relation.id,
          generatedRelationRole: 'targetCollection'
        });
      }
    });
    const fieldIds = new Set(fields.map((field) => field.id));
    return {
      ...source,
      fields,
      fieldGroups: source.fieldGroups.map((group) => ({ ...group, fieldIds: group.fieldIds.filter((id) => fieldIds.has(id)) }))
    };
  });
};

const repairLookups = (rawValue: unknown, warnings: string[]): LookupDefinition[] => {
  if (rawValue == null) return [];
  if (!Array.isArray(rawValue)) {
    warnings.push('Lookups were not a list and were initialized empty.');
    return [];
  }
  const usedLookupIds = new Set<string>();
  return rawValue.flatMap((rawLookup, lookupIndex): LookupDefinition[] => {
    if (!isRecord(rawLookup)) {
      warnings.push(`Lookup ${lookupIndex + 1} was not readable and was removed.`);
      return [];
    }
    const outputName = stringValue(rawLookup.outputName ?? rawLookup.name ?? rawLookup.output).trim() || `Lookup ${lookupIndex + 1}`;
    const id = ensureUniqueId(rawLookup.id, 'lookup', usedLookupIds, warnings, `Lookup "${outputName}"`);
    const rawInputs = Array.isArray(rawLookup.inputs ?? rawLookup.arguments) ? (rawLookup.inputs ?? rawLookup.arguments) as unknown[] : [];
    const usedInputIds = new Set<string>();
    const inputs = rawInputs.flatMap((rawInput, inputIndex): LookupInput[] => {
      if (!isRecord(rawInput)) return [];
      return [{
        id: ensureUniqueId(rawInput.id, 'lookup-input', usedInputIds, warnings, `${outputName}: input ${inputIndex + 1}`),
        representation: stringValue(rawInput.representation ?? rawInput.name ?? rawInput.variable),
        explanation: stringValue(rawInput.explanation ?? rawInput.description)
      }];
    });
    return [{
      id,
      outputName,
      outputExplanation: stringValue(rawLookup.outputExplanation ?? rawLookup.explanation ?? rawLookup.description),
      inputs
    }];
  });
};

const repairVariables = (rawValue: unknown, warnings: string[]): VariableDefinition[] => {
  if (rawValue == null) return [];
  if (!Array.isArray(rawValue)) {
    warnings.push('Variables were not a list and were initialized empty.');
    return [];
  }
  const usedVariableIds = new Set<string>();
  return rawValue.flatMap((rawVariable, variableIndex): VariableDefinition[] => {
    if (!isRecord(rawVariable)) {
      warnings.push(`Variable ${variableIndex + 1} was not readable and was removed.`);
      return [];
    }
    const name = stringValue(rawVariable.name ?? rawVariable.Name).trim() || `Variable ${variableIndex + 1}`;
    return [{
      id: ensureUniqueId(rawVariable.id, 'variable', usedVariableIds, warnings, `Variable "${name}"`),
      name,
      explanation: stringValue(rawVariable.explanation ?? rawVariable.description ?? rawVariable.Explanation),
      unit: stringValue(rawVariable.unit ?? rawVariable.valueUnit ?? rawVariable.Unit)
    }];
  });
};

const repairKpiSources = (rawValue: unknown, warnings: string[], kpiName: string): KpiSourceItem[] => {
  if (rawValue == null) {
    return [];
  }
  if (!Array.isArray(rawValue)) {
    warnings.push(`${kpiName}: sources were not a list and were initialized empty.`);
    return [];
  }
  const usedIds = new Set<string>();
  return rawValue.flatMap((rawSource, index): KpiSourceItem[] => {
    if (!isRecord(rawSource)) {
      warnings.push(`${kpiName}: source ${index + 1} was not readable and was removed.`);
      return [];
    }
    const type = rawSource.type === 'custom'
      ? 'custom'
      : rawSource.type === 'variable' || rawSource.variableId || rawSource.variable
        ? 'variable'
      : rawSource.type === 'lookup' || rawSource.lookupId || rawSource.lookup
        ? 'lookup'
      : rawSource.type === 'kpi' || rawSource.kpiId || rawSource.kpi
        ? 'kpi'
        : 'dataField';
    const id = ensureUniqueId(rawSource.id, 'kpi-source', usedIds, warnings, `${kpiName}: source ${index + 1}`);
    if (type === 'custom') {
      return [{
        id,
        type,
        name: stringValue(rawSource.name ?? rawSource.label).trim() || `Custom source ${index + 1}`,
        latex: stringValue(rawSource.latex ?? rawSource.symbol)
      }];
    }
    if (type === 'kpi') {
      const kpiId = stringValue(rawSource.kpiId ?? rawSource.kpi).trim();
      return kpiId ? [{ id, type, kpiId, latex: stringValue(rawSource.latex ?? rawSource.symbol) }] : [];
    }
    if (type === 'variable') {
      const variableId = stringValue(rawSource.variableId ?? rawSource.variable).trim();
      return variableId ? [{ id, type, variableId, latex: stringValue(rawSource.latex ?? rawSource.symbol) }] : [];
    }
    if (type === 'lookup') {
      const lookupId = stringValue(rawSource.lookupId ?? rawSource.lookup).trim();
      return lookupId ? [{ id, type, lookupId, latex: stringValue(rawSource.latex ?? rawSource.symbol) }] : [];
    }
    const dataSourceId = stringValue(rawSource.dataSourceId ?? rawSource.sourceId ?? rawSource.dataSource).trim();
    const fieldId = stringValue(rawSource.fieldId ?? rawSource.field).trim();
    if (!dataSourceId || !fieldId) return [];
    const legacyOption = stringValue(rawSource.version).trim();
    return [{
      id,
      type,
      dataSourceId,
      fieldId,
      ...(legacyOption ? { version: legacyOption } : {}),
      latex: stringValue(rawSource.latex ?? rawSource.symbol)
    } as KpiSourceItem];
  });
};

const repairKpiDimensions = (rawValue: unknown, warnings: string[], kpiName: string): DataSourceFieldDimension[] => {
  if (rawValue == null) return [];
  if (!Array.isArray(rawValue)) {
    warnings.push(`${kpiName}: dimensions were not a list and were initialized empty.`);
    return [];
  }

  const usedIds = new Set<string>();
  const seenNames = new Set<string>();
  return rawValue.flatMap((rawDimension, index): DataSourceFieldDimension[] => {
    const record = isRecord(rawDimension) ? rawDimension : undefined;
    const name = stringValue(record?.name ?? record?.label ?? rawDimension).trim();
    const normalizedName = name.toLocaleLowerCase();
    if (!name || seenNames.has(normalizedName)) return [];
    seenNames.add(normalizedName);

    const rawOptions = record?.options;
    const seenOptions = new Set<string>();
    const options = (Array.isArray(rawOptions) ? rawOptions : stringValue(rawOptions).split(','))
      .map((option) => stringValue(option).trim())
      .filter((option) => {
        const normalizedOption = option.toLocaleLowerCase();
        if (!option || seenOptions.has(normalizedOption)) return false;
        seenOptions.add(normalizedOption);
        return true;
      });

    return [{
      id: ensureUniqueId(record?.id, 'kpi-dimension', usedIds, warnings, `${kpiName}: dimension ${index + 1}`),
      name,
      options
    }];
  });
};

export const createBlankConfig = (): KpiPoolConfig => ({
  schemaVersion: CURRENT_SCHEMA_VERSION,
  title: 'Untitled KPI Library',
  updatedAt: new Date().toISOString(),
  enums: {
    prerequisiteModule: [],
    userGroup: [],
    previousApplication: [],
    federalRequirement: [],
    performanceArea: [],
    useCase: []
  },
  dataSources: [],
  tableRelations: [],
  lookups: [],
  variables: [],
  kpis: []
});

export const createBlankKpi = (): KpiMetric => ({
  id: createId('kpi'),
  lastModified: new Date().toISOString(),
  name: 'Untitled KPI',
  dimensions: [],
  sources: [],
  description: {
    overview: '',
    formulaComment: '',
    formulas: []
  },
  prerequisite: {
    modules: [],
    kpis: [],
    values: ''
  },
  spatialScales: {
    link: emptyScale(),
    cell: emptyScale(),
    project: emptyScale(),
    taz: emptyScale(),
    corridor: emptyScale(),
    subRegion: emptyScale(),
    region: emptyScale()
  },
  previousApplication: [],
  federalRequirement: [],
  performanceArea: [],
  performanceAreasByUseCase: [],
  notesByUseCase: [],
  userGroupUseCases: []
});

export const createEnumOption = (label = 'New option', userGroup?: string, useCase?: string): EnumOption => ({
  id: createId('enum'),
  label,
  description: '',
  userGroup,
  useCase
});

export class UnsupportedSchemaVersionError extends Error {
  readonly schemaVersion: number;

  constructor(schemaVersion: number) {
    super(`Schema version ${schemaVersion} is newer than this application supports (${CURRENT_SCHEMA_VERSION}).`);
    this.name = 'UnsupportedSchemaVersionError';
    this.schemaVersion = schemaVersion;
  }
}

export const repairConfig = (input: unknown): RepairResult => {
  const inputSchemaVersion = isRecord(input) ? Number(input.schemaVersion) : Number.NaN;
  if (Number.isFinite(inputSchemaVersion) && inputSchemaVersion > CURRENT_SCHEMA_VERSION) {
    throw new UnsupportedSchemaVersionError(inputSchemaVersion);
  }

  const requiresCellTerminologyMigration =
    !Number.isFinite(inputSchemaVersion) || inputSchemaVersion < CELL_TERMINOLOGY_SCHEMA_VERSION;
  const migratedInput = requiresCellTerminologyMigration ? migrateLegacyGridTerminology(input) : input;

  if (isCurrentKpiPoolConfig(migratedInput)) {
    return { config: migratedInput, warnings: [] };
  }

  const warnings: string[] = [];
  const importTimestamp = new Date().toISOString();
  const rawConfig = isRecord(migratedInput) ? migratedInput : {};
  if (!isRecord(input)) {
    warnings.push('The embedded configuration root was not an object; initialized a blank config.');
  } else if (Number.isFinite(inputSchemaVersion) && inputSchemaVersion < CURRENT_SCHEMA_VERSION) {
    warnings.push(`Upgraded schema version ${inputSchemaVersion} to ${CURRENT_SCHEMA_VERSION}.`);
  } else if (!Number.isFinite(inputSchemaVersion)) {
    warnings.push(`Upgraded an unversioned configuration to schema version ${CURRENT_SCHEMA_VERSION}.`);
  }
  const legacyPerformanceAreas = isLegacyPerformanceAreaSchema(rawConfig);

  const enums = repairEnums(rawConfig, warnings);
  const repairedDataSources = repairDataSources(rawConfig.dataSources ?? rawConfig.sources, warnings);
  const tableRelations = repairTableRelations(rawConfig.tableRelations ?? rawConfig.relations, repairedDataSources, warnings);
  const dataSources = reconcileRelationFields(repairedDataSources, tableRelations);
  const lookups = repairLookups(rawConfig.lookups, warnings);
  const variables = repairVariables(rawConfig.variables, warnings);
  const rawKpis = Array.isArray(rawConfig.kpis) ? rawConfig.kpis : [];
  if (!Array.isArray(rawConfig.kpis)) {
    warnings.push('Missing or invalid kpis list; initialized it as an empty list.');
  }

  const usedKpiIds = new Set<string>();
  const kpis = rawKpis.map((rawKpi, index): KpiMetric => {
    const record = isRecord(rawKpi) ? rawKpi : {};
    const name = stringValue(record.name ?? record.Name).trim() || `Untitled KPI ${index + 1}`;
    if (!isRecord(rawKpi)) {
      warnings.push(`KPI ${index + 1} was not an object; initialized it as "${name}".`);
    }

    const description = isRecord(record.description ?? record.Description)
      ? (record.description ?? record.Description) as Record<string, unknown>
      : {};
    const prerequisite = isRecord(record.prerequisite ?? record.Prerequisite)
      ? (record.prerequisite ?? record.Prerequisite) as Record<string, unknown>
      : {};

    const kpi: KpiMetric = {
      id: ensureUniqueId(record.id, 'kpi', usedKpiIds, warnings, `KPI "${name}"`),
      lastModified: (() => {
        const value = stringValue(record.lastModified ?? record.lastModifiedAt).trim();
        return value && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : importTimestamp;
      })(),
      name,
      dimensions: repairKpiDimensions(record.dimensions, warnings, name),
      sources: repairKpiSources(record.sources ?? record.source ?? record.Source, warnings, name),
      description: {
        overview: stringValue(description.overview ?? description.Overview),
        formulaComment: stringValue(description.formulaComment ?? description.formulaNote ?? description['Formula Comment']),
        formulas: repairFormulaGroups(description, warnings, name)
      },
      prerequisite: {
        modules: repairPrerequisiteModules(readPrerequisiteModuleValue(prerequisite), enums, warnings, name),
        kpis: repairPrerequisiteKpis(readPrerequisiteKpiValue(prerequisite), warnings, name),
        values: stringValue(prerequisite.values ?? prerequisite.prerequisiteValues ?? prerequisite['Prerequisite values'])
      },
      spatialScales: repairSpatialScales(record.spatialScales ?? record['Spatial scales'], warnings, name),
      previousApplication: repairEnumReferences(
        readCategory(record, 'previousApplication'),
        'previousApplication',
        enums,
        warnings,
        name
      ),
      federalRequirement: repairEnumReferences(
        readCategory(record, 'federalRequirement'),
        'federalRequirement',
        enums,
        warnings,
        name
      ),
      performanceArea: repairEnumReferences(readCategory(record, 'performanceArea'), 'performanceArea', enums, warnings, name),
      performanceAreasByUseCase: repairPerformanceAreasByUseCase(record, enums, warnings, name),
      notesByUseCase: repairNotesByUseCase(record, enums, warnings, name),
      userGroupUseCases: repairUserGroupUseCases(record, enums, warnings, name)
    };

    return kpi;
  });

  const validKpiIds = new Set(kpis.map((kpi) => kpi.id));
  const dataSourceById = new Map(dataSources.map((source) => [source.id, source]));
  const validLookupIds = new Set(lookups.map((lookup) => lookup.id));
  const validVariableIds = new Set(variables.map((variable) => variable.id));
  const kpisWithValidDependencies = kpis.map((kpi) => {
    const nextDependencies = kpi.prerequisite.kpis.filter((id) => id !== kpi.id && validKpiIds.has(id));
    const removedCount = kpi.prerequisite.kpis.length - nextDependencies.length;
    if (removedCount > 0) {
      warnings.push(`${kpi.name}: removed ${removedCount} invalid prerequisite KPI reference${removedCount === 1 ? '' : 's'}.`);
    }

    const sourceLatexReplacements = new Map<string, string | null>();
    const normalizedSources = kpi.sources.flatMap((source): KpiSourceItem[] => {
      if (source.type === 'kpi') {
        return source.kpiId !== kpi.id && validKpiIds.has(source.kpiId) ? [source] : [];
      }
      if (source.type === 'lookup') return validLookupIds.has(source.lookupId) ? [source] : [];
      if (source.type === 'variable') return validVariableIds.has(source.variableId) ? [source] : [];
      if (source.type !== 'dataField') return [source];
      const dataSource = dataSourceById.get(source.dataSourceId);
      const field = dataSource?.fields.find((entry) => entry.id === source.fieldId);
      if (!dataSource || !field) return [];
      const legacySource = source as typeof source & { version?: string };
      const group = dataSource.fieldGroups.find((entry) => entry.fieldIds.includes(source.fieldId));
      const dimensionNames = group?.dimensions.map((dimension) => dimension.name) ?? [];
      let normalizedSource: KpiSourceItem = source;

      if (legacySource.version !== undefined) {
        const { version: legacyOption, ...withoutLegacyOption } = legacySource;
        const firstDimension = group?.dimensions[0];
        const latex = firstDimension && source.latex === legacyDataFieldLatex(field.name, dataSource.spatialUnit, firstDimension.name, legacyOption)
          ? defaultDataFieldLatex(field.name, dataSource.spatialUnit, dimensionNames)
          : source.latex;
        normalizedSource = { ...withoutLegacyOption, latex };
      }

      if (field.dataType === 'collection' && normalizedSource.type === 'dataField') {
        const identifier = latexIdentifier(field.name);
        const oldDefaults = new Set([`\\{ ${identifier} \\}`, `\\{${identifier}\\}`]);
        if (oldDefaults.has(normalizedSource.latex)) {
          const nextLatex = defaultCollectionDataFieldLatex(field.name, dataSource.spatialUnit, dimensionNames);
          if (nextLatex !== normalizedSource.latex) {
            const previousReplacement = sourceLatexReplacements.get(normalizedSource.latex);
            if (!sourceLatexReplacements.has(normalizedSource.latex)) {
              sourceLatexReplacements.set(normalizedSource.latex, nextLatex);
            } else if (previousReplacement !== nextLatex) {
              sourceLatexReplacements.set(normalizedSource.latex, null);
            }
            normalizedSource = { ...normalizedSource, latex: nextLatex };
          }
        }
      }

      return [normalizedSource];
    });
    const seenDataFields = new Set<string>();
    const seenLookups = new Set<string>();
    const seenVariables = new Set<string>();
    const nextSources = normalizedSources.filter((source) => {
      if (source.type === 'lookup') {
        if (seenLookups.has(source.lookupId)) return false;
        seenLookups.add(source.lookupId);
        return true;
      }
      if (source.type === 'variable') {
        if (seenVariables.has(source.variableId)) return false;
        seenVariables.add(source.variableId);
        return true;
      }
      if (source.type !== 'dataField') return true;
      const key = `${source.dataSourceId}\u0000${source.fieldId}`;
      if (seenDataFields.has(key)) return false;
      seenDataFields.add(key);
      return true;
    });
    if (nextSources.length !== kpi.sources.length) {
      const sourceRemovedCount = kpi.sources.length - nextSources.length;
      warnings.push(`${kpi.name}: removed ${sourceRemovedCount} invalid source reference${sourceRemovedCount === 1 ? '' : 's'}.`);
    }

    const replaceMigratedLatex = (value: string) => {
      let nextValue = value;
      for (const [previousLatex, nextLatex] of sourceLatexReplacements) {
        if (nextLatex === null) continue;
        nextValue = nextValue.split(previousLatex).join(nextLatex);
      }
      return nextValue;
    };
    const description = sourceLatexReplacements.size === 0
      ? kpi.description
      : {
          ...kpi.description,
          formulas: kpi.description.formulas.map((group) => ({
            ...group,
            items: group.items.map((item) => {
              const leftExpression = replaceMigratedLatex(item.leftExpression);
              const rightExpression = replaceMigratedLatex(item.rightExpression);
              return {
                ...item,
                formula: leftExpression ? `${leftExpression} = ${rightExpression}` : rightExpression,
                leftExpression,
                rightExpression,
                terms: item.terms.map((term) => ({ ...term, term: replaceMigratedLatex(term.term) }))
              };
            })
          }))
        };
    const spatialScales = sourceLatexReplacements.size === 0
      ? kpi.spatialScales
      : Object.fromEntries(spatialScaleKeys.map((scale) => {
          const current = kpi.spatialScales[scale];
          const rightExpression = replaceMigratedLatex(current.rightExpression);
          return [scale, { ...current, formula: rightExpression, leftExpression: '', rightExpression }];
        })) as KpiMetric['spatialScales'];

    return {
      ...kpi,
      sources: nextSources,
      description,
      spatialScales,
      prerequisite: {
        ...kpi.prerequisite,
        kpis: nextDependencies
      }
    };
  });

  const { enums: useCaseScopedEnums, kpis: useCaseScopedKpis } = repairUseCaseOwnership(
    enums,
    kpisWithValidDependencies,
    warnings,
    legacyPerformanceAreas
  );
  const { enums: scopedEnums, kpis: scopedKpis } = repairPerformanceAreaOwnership(
    useCaseScopedEnums,
    useCaseScopedKpis,
    warnings,
    legacyPerformanceAreas
  );
  const defaultFocus = repairDefaultFocus(rawConfig, scopedEnums, warnings);

  const repaired: KpiPoolConfig = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    title: stringValue(rawConfig.title).trim() || 'Untitled KPI Library',
    updatedAt: stringValue(rawConfig.updatedAt) || new Date().toISOString(),
    defaultFocus,
    enums: scopedEnums,
    dataSources,
    tableRelations,
    lookups,
    variables,
    kpis: scopedKpis
  };

  const parsed = kpiPoolConfigSchema.safeParse(repaired);
  if (!parsed.success) {
    warnings.push('The repaired configuration still had validation issues; preserved the repaired data for review.');
    return { config: repaired, warnings };
  }

  return { config: parsed.data as KpiPoolConfig, warnings };
};

export const prepareForExport = (config: KpiPoolConfig): KpiPoolConfig => {
  const repaired = repairConfig(config).config;
  return {
    ...repaired,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    updatedAt: new Date().toISOString()
  };
};
