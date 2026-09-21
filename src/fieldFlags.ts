import type { DataSourceField } from './types.js';

export const fieldFlags = (field?: DataSourceField) => [
  ...(field?.preprocessingNeeded ? [{ key: 'preprocessing', letter: 'P', label: 'Preprocessing Needed', note: field.details }] : []),
  ...(field?.derived ? [{ key: 'derived', letter: 'D', label: 'Derived', note: '' }] : []),
  ...(field?.potentiallyUnavailable ? [{ key: 'unavailable', letter: 'U', label: 'Potentially Unavailable', note: field.potentiallyUnavailableNote ?? '' }] : [])
];

export const fieldFlagTone = (field?: DataSourceField) => field?.potentiallyUnavailable ? 'unavailable'
  : field?.preprocessingNeeded ? 'preprocessing' : field?.derived ? 'derived' : '';

export const fieldFlagsText = (field: DataSourceField) => fieldFlags(field)
  .map(({ label, note }) => note.trim() ? `${label}: ${note.trim()}` : label).join('; ');
