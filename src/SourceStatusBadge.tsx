import { sourceStatusColors, sourceStatuses, type SourceStatus } from './sourceStatus';

export function SourceStatusBadge({ status, compact = false }: { status: SourceStatus; compact?: boolean }) {
  return <span className="source-status-badge" title={`Source status: ${status}`} aria-label={`Source status: ${status}`}>
    <span className="source-status-dot" style={{ backgroundColor: sourceStatusColors[status] }} aria-hidden="true" />
    {!compact && <span>{status}</span>}
  </span>;
}

export function SourceStatusButtons({ status, label, onChange }: { status: SourceStatus; label: string; onChange: (status: SourceStatus) => void }) {
  return <span className="source-status-buttons" role="group" aria-label={label}>
    {sourceStatuses.map((value) => <button key={value} type="button" title={value}
      aria-label={`${label}: ${value}`} aria-pressed={status === value} onClick={() => onChange(value)}>
      <span className="source-status-dot" style={{ backgroundColor: sourceStatusColors[value] }} aria-hidden="true" />
    </button>)}
  </span>;
}
