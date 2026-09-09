import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import type { KpiPoolConfig } from './types';
import { traceKpiSupport, type SupportTarget } from './kpiSupport';

export function KpiSupportSummary({ config, target }: { config: KpiPoolConfig; target: SupportTarget }) {
  const results = useMemo(() => traceKpiSupport(config, target), [config, target.dataSourceId, target.fieldId]);
  return <details className="kpi-support-summary">
    <summary>Supported KPIs <span className="kpi-support-count">{results.length}</span></summary>
    {!results.length ? <p>No supported KPIs found.</p> : <>
      <p>Direct = used as a source. Indirect = through other fields or KPIs. One example path per support type.</p>
      <ul>{results.map((result) => <li key={result.kpiId}>
        <strong>{result.name}</strong>
        {(['direct', 'indirect'] as const).map((kind) => result[kind] ? <div className="kpi-support-path" key={kind}>
          <span className={`kpi-support-kind ${kind}`}>{kind}</span>
          <span className="kpi-support-chain">{result[kind]!.slice(0, -1).map((node, index) => <span key={node.key}>
            {index > 0 ? <span className="kpi-support-arrow" aria-hidden="true"> → </span> : null}
            <span className={`kpi-support-node is-${node.kind}`}>{node.tableName ? <span className="kpi-support-table-badge">{node.tableName}</span> : null}<span>{node.label}</span></span>
          </span>)}<span className="kpi-support-arrow" title={`Supports ${result.name}`}> → this KPI</span></span>
        </div> : null)}
      </li>)}</ul>
    </>}
  </details>;
}

export function KpiSupportDialog({ config, target, onClose, children, heading = 'Table details', showSupport = true }: { config: KpiPoolConfig; target: SupportTarget; onClose: () => void; children?: ReactNode; heading?: string; showSupport?: boolean }) {
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
    if (event.key === 'Tab') {
      const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, [tabindex="0"]')).filter((element) => element.getClientRects().length);
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  }}>
    <section className="kpi-note-dialog" role="dialog" aria-modal="true" aria-labelledby="kpi-support-title">
      <header className="kpi-note-dialog-header"><div><span>{heading}</span><strong id="kpi-support-title">{table?.name || 'Untitled table'}{field ? ` · ${field.name || 'Untitled field'}` : ''}</strong></div>
        <button className="mini-icon-button" type="button" ref={closeRef} aria-label={`Close ${heading.toLowerCase()}`} onClick={onClose}><X size={16} /></button>
      </header>
      <div className="kpi-note-dialog-body">{children}{showSupport ? <KpiSupportSummary config={config} target={target} /> : null}</div>
    </section>
  </div>, document.body);
}
