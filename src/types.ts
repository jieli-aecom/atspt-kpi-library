export const spatialScaleKeys = ['link', 'cell', 'project', 'taz', 'corridor', 'subRegion', 'region'] as const;
export type SpatialScaleKey = (typeof spatialScaleKeys)[number];

export const spatialScaleLabels = {
  link: 'Link',
  cell: 'Cell',
  project: 'Project',
  taz: 'TAZ',
  corridor: 'Corridor',
  subRegion: 'Sub-Region',
  region: 'Region'
} as const satisfies Record<SpatialScaleKey, string>;

export const genericSpatialUnits = ['Point'] as const;
export const spatialUnitOptions = [
  ...spatialScaleKeys.map((scale) => spatialScaleLabels[scale]),
  ...genericSpatialUnits
];
export type SpatialUnit = '' | (typeof spatialUnitOptions)[number];

export const isSpatialUnit = (value: unknown): value is SpatialUnit =>
  value === '' || (typeof value === 'string' && spatialUnitOptions.some((option) => option === value));

export const CURRENT_SCHEMA_VERSION = 35 as const;

export const kpiEnumCategoryKeys = ['previousApplication', 'federalRequirement', 'performanceArea'] as const;
export type KpiEnumCategoryKey = (typeof kpiEnumCategoryKeys)[number];

export const enumCategoryKeys = ['prerequisiteModule', 'userGroup', ...kpiEnumCategoryKeys, 'useCase'] as const;
export type EnumCategoryKey = (typeof enumCategoryKeys)[number];

export type EnumOption = {
  id: string;
  label: string;
  description?: string;
  userGroup?: string;
  useCase?: string;
};

export type EnumDefinitions = Record<EnumCategoryKey, EnumOption[]>;

export type ValueEnumDefinition = {
  id: string;
  name: string;
  options: string[];
};

export type KpiFormulaTerm = {
  term: string;
  explanation: string;
};

export type KpiFormulaItem = {
  tag: string;
  formula: string;
  leftExpression: string;
  rightExpression: string;
  generalExplanation: string;
  terms: KpiFormulaTerm[];
};

export type DataSourceField = {
  id: string;
  name: string;
  meaning: string;
  dataType: DataSourceFieldType;
  collectionItemType?: DataSourceCollectionItemType;
  valueUnit: string;
  options: string[];
  enumId?: string;
  generatedRelationId?: string;
  generatedRelationRole?: 'oneCollection' | 'manyForeignKey' | 'sourceCollection' | 'targetCollection';
};

export const dataSourceFieldTypes = ['id', 'number', 'boolean', 'text', 'enum', 'collection'] as const;
export type DataSourceFieldType = (typeof dataSourceFieldTypes)[number];
export const dataSourceCollectionItemTypes = ['number', 'enum', 'id', 'boolean', 'text'] as const;
export type DataSourceCollectionItemType = (typeof dataSourceCollectionItemTypes)[number];

export type DataSourceFieldDimension = {
  id: string;
  name: string;
  options: string[];
  enumId?: string;
};

export type DataSourceFieldGroup = {
  id: string;
  dimensions: DataSourceFieldDimension[];
  fieldIds: string[];
  position: number;
};

export type DataSource = {
  id: string;
  name: string;
  spatialUnit: SpatialUnit;
  primaryKeyFieldId?: string;
  fields: DataSourceField[];
  fieldGroups: DataSourceFieldGroup[];
};

export type TableRelation = {
  id: string;
  sourceDataSourceId: string;
  targetDataSourceId: string;
  cardinality: 'oneToOne' | 'oneToMany' | 'manyToMany';
};

export const lookupValueTypes = ['number', 'enum'] as const;
export type LookupValueType = (typeof lookupValueTypes)[number];

export type LookupInput = {
  id: string;
  representation: string;
  explanation: string;
  valueType: LookupValueType;
  options: string[];
  enumId?: string;
};

export type LookupDefinition = {
  id: string;
  outputName: string;
  outputExplanation: string;
  outputValueType: LookupValueType;
  outputOptions: string[];
  outputEnumId?: string;
  text: string;
  inputs: LookupInput[];
};

export type VariableDefinition = {
  id: string;
  name: string;
  explanation: string;
  defaultValue: string;
  unit: string;
};

export type DataLibraryGroup = {
  id: string;
  name: string;
  itemIds: string[];
  position: number;
};

export type KpiDataFieldSource = {
  id: string;
  type: 'dataField';
  dataSourceId: string;
  fieldId: string;
  latex: string;
};

export type KpiReferenceSource = {
  id: string;
  type: 'kpi';
  kpiId: string;
  latex: string;
};

export type KpiLookupSource = {
  id: string;
  type: 'lookup';
  lookupId: string;
  latex: string;
};

export type KpiVariableSource = {
  id: string;
  type: 'variable';
  variableId: string;
  latex: string;
};

export type KpiCustomSource = {
  id: string;
  type: 'custom';
  name: string;
  latex: string;
};

export type KpiSourceItem = KpiDataFieldSource | KpiReferenceSource | KpiLookupSource | KpiVariableSource | KpiCustomSource;

export type KpiFormulaGroup = {
  name: string;
  items: KpiFormulaItem[];
};

export type KpiDescription = {
  overview: string;
  formulaComment: string;
  formulas: KpiFormulaGroup[];
};

export type KpiPrerequisite = {
  modules: string[];
  kpis: string[];
  values: string;
};

export type SpatialScaleConfig = {
  applicable: boolean;
  isBasicUnit: boolean;
  aggregationMethod: string;
  formula: string;
  leftExpression: string;
  rightExpression: string;
};

export type KpiUserGroupUseCase = {
  userGroup: string;
  useCases: string[];
};

export type KpiUseCasePerformanceArea = {
  useCase: string;
  performanceAreas: string[];
};

export type KpiUseCaseNote = {
  useCase: string;
  note: string;
};

export type KpiDefaultFocus = {
  userGroup: string;
  useCase: string;
};

export type KpiMetric = {
  id: string;
  lastModified: string;
  name: string;
  note: string;
  dimensions: DataSourceFieldDimension[];
  sources: KpiSourceItem[];
  description: KpiDescription;
  prerequisite: KpiPrerequisite;
  spatialScales: Record<SpatialScaleKey, SpatialScaleConfig>;
  previousApplication: string[];
  federalRequirement: string[];
  performanceArea: string[];
  performanceAreasByUseCase: KpiUseCasePerformanceArea[];
  notesByUseCase: KpiUseCaseNote[];
  userGroupUseCases: KpiUserGroupUseCase[];
};

export type KpiPoolConfig = {
  schemaVersion: typeof CURRENT_SCHEMA_VERSION;
  title: string;
  updatedAt?: string;
  defaultFocus?: KpiDefaultFocus;
  enums: EnumDefinitions;
  valueEnums: ValueEnumDefinition[];
  valueEnumGroups: DataLibraryGroup[];
  dataSources: DataSource[];
  tableRelations: TableRelation[];
  lookups: LookupDefinition[];
  lookupGroups: DataLibraryGroup[];
  variables: VariableDefinition[];
  variableGroups: DataLibraryGroup[];
  kpis: KpiMetric[];
};

export type RepairResult = {
  config: KpiPoolConfig;
  warnings: string[];
};

export const enumCategoryLabels: Record<EnumCategoryKey, string> = {
  prerequisiteModule: 'Prerequisite Module',
  userGroup: 'User Group',
  previousApplication: 'Previous Application',
  federalRequirement: 'Federal Requirement',
  performanceArea: 'Performance Area',
  useCase: 'Use Case'
};
