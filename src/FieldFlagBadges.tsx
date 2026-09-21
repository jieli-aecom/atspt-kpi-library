import { AlertTriangle, Sigma, Wrench } from 'lucide-react';
import { fieldFlags } from './fieldFlags';
import type { DataSourceField } from './types';

export function FieldFlags({ field, compact = false }: { field?: DataSourceField; compact?: boolean }) {
  const flags = fieldFlags(field);
  if (!flags.length) return null;
  return <span className={`field-flags${compact ? ' is-compact' : ''}`}>
    {flags.map(({ key, label, letter, note }) => {
      const Icon = key === 'preprocessing' ? Wrench : key === 'derived' ? Sigma : AlertTriangle;
      return <span className={`field-flag flag-${key}`} key={key} title={note.trim() ? `${label}: ${note}` : label} aria-label={label}>
        <Icon size={10} aria-hidden="true" />{compact ? letter : label}
      </span>;
    })}
  </span>;
}
