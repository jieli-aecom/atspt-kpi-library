import { useEffect, useId, useState } from 'react';
import { kpiNumberError } from './kpiNumbers';
import type { KpiMetric } from './types';

export function KpiNumberInput({ kpi, kpis, onChange }: {
  kpi: KpiMetric;
  kpis: KpiMetric[];
  onChange: (number: number | null) => void;
}) {
  const [draft, setDraft] = useState(String(kpi.displayNumber ?? ''));
  const [error, setError] = useState('');
  const errorId = useId();
  useEffect(() => {
    setDraft(String(kpi.displayNumber ?? ''));
    setError('');
  }, [kpi.displayNumber]);
  const commit = () => {
    const message = kpiNumberError(draft, kpi.id, kpis);
    setError(message);
    if (!message) {
      const number = draft.trim() ? Number(draft) : null;
      setDraft(String(number ?? ''));
      if (number !== kpi.displayNumber) onChange(number);
    }
  };
  return <div className="kpi-number-editor" onClick={(event) => event.stopPropagation()}>
    <input
      className="kpi-number-input"
      type="text"
      inputMode="decimal"
      aria-label={`KPI number for ${kpi.name}`}
      aria-invalid={Boolean(error)}
      aria-describedby={error ? errorId : undefined}
      title={error || `KPI number: ${kpi.displayNumber ?? 'unassigned'}. Enter an unused number or leave blank.`}
      value={draft}
      onChange={(event) => { setDraft(event.target.value); setError(''); }}
      onBlur={commit}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === 'Enter') { event.preventDefault(); commit(); }
        if (event.key === 'Escape') { setDraft(String(kpi.displayNumber ?? '')); setError(''); }
      }}
    />
    {error ? <span id={errorId} className="kpi-number-error" role="alert">{error}</span> : null}
  </div>;
}
