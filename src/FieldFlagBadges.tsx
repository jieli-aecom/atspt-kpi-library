import { AlertTriangle, Sigma, Wrench } from 'lucide-react';
import { fieldFlags, type fieldFlagDefinitions } from './fieldFlags';
import type { DataSourceField } from './types';

export function FieldFlagBadge({ flag, compact = false }: {
  flag: typeof fieldFlagDefinitions[number] & { note?: string };
  compact?: boolean;
}) {
  const { key, label, letter, note = '' } = flag;
  const Icon = key === 'preprocessing' ? Wrench : key === 'derived' ? Sigma : AlertTriangle;
  return <span className={`field-flag flag-${key}`} title={note.trim() ? `${label}: ${note}` : label} aria-label={label}>
    <Icon size={10} aria-hidden="true" />{compact ? letter : label}
  </span>;
}

export function FieldFlags({ field, compact = false }: { field?: DataSourceField; compact?: boolean }) {
  const flags = fieldFlags(field);
  if (!flags.length) return null;
  return <span className={`field-flags${compact ? ' is-compact' : ''}`}>
    {flags.map((flag) => <FieldFlagBadge key={flag.key} flag={flag} compact={compact} />)}
  </span>;
}
