import type { DataSourceField } from './types.js';

export const fieldFlagDefinitions = [
  { key: 'preprocessing', letter: 'P', label: 'Preprocessing Needed' },
  { key: 'derived', letter: 'D', label: 'Derived' },
  { key: 'unavailable', letter: 'U', label: 'Potentially Unavailable' }
] as const;

export const fieldFlags = (field?: DataSourceField) => fieldFlagDefinitions.flatMap((flag) => {
  const enabled = flag.key === 'preprocessing' ? field?.preprocessingNeeded
    : flag.key === 'derived' ? field?.derived : field?.potentiallyUnavailable;
  const note = flag.key === 'preprocessing' ? field?.details
    : flag.key === 'unavailable' ? field?.potentiallyUnavailableNote : '';
  return enabled ? [{ ...flag, note: note ?? '' }] : [];
});

export const fieldFlagTone = (field?: DataSourceField) => field?.potentiallyUnavailable ? 'unavailable'
  : field?.preprocessingNeeded ? 'preprocessing' : field?.derived ? 'derived' : '';

export const fieldFlagsText = (field: DataSourceField) => fieldFlags(field)
  .map(({ label, note }) => note.trim() ? `${label}: ${note.trim()}` : label).join('; ');
