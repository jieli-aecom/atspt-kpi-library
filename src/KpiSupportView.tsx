import { useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import type { KpiPoolConfig } from './types';
import { traceKpiSupport, type SupportTarget } from './kpiSupport';

export function KpiSupportSummary({ config, target }: { config: KpiPoolConfig; target: SupportTarget }) {
  const results = useMemo(() => traceKpiSupport(config, target), [config, target.dataSourceId, target.fieldId]);
  return <section className="kpi-support-summary">
    <strong>Supported KPIs · {results.length}</strong>
    <p>Direct support uses this {target.fieldId === undefined ? 'table’s fields' : 'field'} as a KPI source. Indirect support passes through other fields or KPIs, including KPI prerequisites. Paths follow declared references.</p>
    {!results.length ? <p>No supported KPIs found.</p> : <>
      <small>A KPI may appear in both groups. One example path is shown per KPI in each group.</small>
      {(['direct', 'indirect'] as const).map((kind) => {
        const entries = results.filter((result) => result[kind]);
        return <section key={kind}>
          <h3>{kind === 'direct' ? 'Direct' : 'Indirect'} support ({entries.length})</h3>
          {!entries.length ? <p>None.</p> : <ul>{entries.map((result) => <li key={result.kpiId}>
            <strong>{result.name}</strong>
            <div className="kpi-support-path">{result[kind]!.map((node) => node.label).join(' → ')}</div>
          </li>)}</ul>}
        </section>;
      })}
    </>}
  </section>;
}

export function KpiSupportDialog({ config, target, onClose }: { config: KpiPoolConfig; target: SupportTarget; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    return () => previous?.focus();
  }, []);
  const table = config.dataSources.find((entry) => entry.id === target.dataSourceId);
  const field = table?.fields.find((entry) => entry.id === target.fieldId);
  return createPortal(<div className="kpi-note-dialog-backdrop kpi-support-backdrop" data-preserve-source-library-state onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }} onKeyDown={(event) => {
    if (event.key === 'Escape') { event.stopPropagation(); onClose(); }
    if (event.key === 'Tab') { event.preventDefault(); closeRef.current?.focus(); }
  }}>
    <section className="kpi-note-dialog" role="dialog" aria-modal="true" aria-labelledby="kpi-support-title">
      <header className="kpi-note-dialog-header"><div><span>KPI support</span><strong id="kpi-support-title">{table?.name || 'Untitled table'}{field ? ` · ${field.name || 'Untitled field'}` : ''}</strong></div>
        <button className="mini-icon-button" type="button" ref={closeRef} aria-label="Close KPI support" onClick={onClose}><X size={16} /></button>
      </header>
      <div className="kpi-note-dialog-body"><KpiSupportSummary config={config} target={target} /></div>
    </section>
  </div>, document.body);
}
