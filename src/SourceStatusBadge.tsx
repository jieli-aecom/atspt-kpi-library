import { sourceStatusColors, sourceStatuses, type SourceStatus } from './sourceStatus';

export function SourceStatusBadge({ status, compact = false }: { status: SourceStatus; compact?: boolean }) {
  return <span className="source-status-badge" title={`Source status: ${status}`} aria-label={`Source status: ${status}`}>
    <span className="source-status-dot" style={{ backgroundColor: sourceStatusColors[status] }} aria-hidden="true" />
    {!compact && <span>{status}</span>}
  </span>;
}

export function SourceStatusSelect({ status, label, onChange }: { status: SourceStatus; label: string; onChange: (status: SourceStatus) => void }) {
  return <span className="source-status-select"><SourceStatusBadge status={status} compact />
    <select aria-label={label} value={status} onChange={(event) => onChange(event.target.value as SourceStatus)}>
      {sourceStatuses.map((value) => <option key={value}>{value}</option>)}
    </select>
  </span>;
}
