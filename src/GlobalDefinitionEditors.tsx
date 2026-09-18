import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Settings2, X } from 'lucide-react';
import katex from 'katex';
import { InlineMath } from 'react-katex';
import { spatialScaleKeys, genericSpatialUnits, type KpiPoolConfig, type LogicDefinition } from './types';
import { rewriteGlobalNotation, scaleReplacements } from './globalDefinitions';

const notationError = (entries: { latex: string }[]) => {
  const seen = new Set<string>();
  for (const entry of entries) {
    const latex = entry.latex.trim();
    if (!latex) return 'Enter a LaTeX expression for every definition.';
    if (seen.has(latex)) return 'Each definition needs a distinct LaTeX expression.';
    seen.add(latex);
    try { katex.renderToString(latex, { throwOnError: true, strict: 'ignore', trust: false }); }
    catch { return `Invalid LaTeX: ${latex}`; }
  }
  return '';
};

function BusyNotice() {
  return createPortal(<div className="global-definition-busy" role="alert" aria-busy="true" tabIndex={-1}>
    <p>Updating formula references…</p>
  </div>, document.body);
}

export function SpatialScaleController({ config, onChange }: { config: KpiPoolConfig; onChange: (next: KpiPoolConfig) => void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(config.spatialScaleDefinitions);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const latest = useRef(config); latest.current = config;
  const apply = async () => {
    const normalized = Object.fromEntries(spatialScaleKeys.map((key) => [key, { name: draft[key].name.trim(), latex: draft[key].latex.trim() }])) as typeof draft;
    const names = spatialScaleKeys.map((key) => normalized[key].name.toLocaleLowerCase());
    const validation = names.some((name) => !name) ? 'Enter a name for every scale.'
      : new Set([...names, ...genericSpatialUnits.map((name) => name.toLocaleLowerCase())]).size !== names.length + genericSpatialUnits.length ? 'Scale names must be distinct from each other and from Point.'
      : notationError([...Object.values(normalized), ...config.logic]);
    if (validation) { setError(validation); return; }
    setBusy(true); setError('');
    try {
      const next = await rewriteGlobalNotation(config, scaleReplacements(config.spatialScaleDefinitions, normalized), new Map(spatialScaleKeys.map((key) => [config.spatialScaleDefinitions[key].name, normalized[key].name])));
      if (latest.current !== config) throw new Error('The library changed during this update. Apply again to use the latest library.');
      onChange({ ...next, spatialScaleDefinitions: normalized });
      setOpen(false);
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'The update could not be applied.'); }
    finally { setBusy(false); }
  };
  return <>
    <button className="mini-icon-button" type="button" aria-label="Manage spatial scales" aria-haspopup="dialog" aria-expanded={open} title="Manage spatial scales" onClick={() => { setDraft(config.spatialScaleDefinitions); setError(''); setOpen(true); }}><Settings2 size={13} /></button>
    {open ? createPortal(<div className="global-definition-overlay" onKeyDown={(event) => { event.stopPropagation(); if (event.key === 'Escape' && !busy) setOpen(false); }}>
      <section className="popup-surface global-definition-dialog" role="dialog" aria-modal="true" aria-label="Manage spatial scales">
        <header><div><h2>Spatial Scales</h2><p>Rename scales and edit notation. The hierarchy stays fixed.</p></div><button type="button" className="mini-icon-button" aria-label="Close spatial scales" disabled={busy} onClick={() => setOpen(false)}><X size={14} /></button></header>
        <fieldset className="scale-definition-list" disabled={busy} aria-label="Spatial scale definitions">
          <div className="scale-definition-columns" aria-hidden="true"><span>#</span><span>Name</span><span>LaTeX</span><span>Preview</span></div>
          {spatialScaleKeys.map((key, index) => <div className="scale-definition-row" key={key}>
            <span className="scale-definition-number">{index + 1}</span>
            <input aria-label={`Scale ${index + 1} name`} value={draft[key].name} onChange={(event) => setDraft({ ...draft, [key]: { name: event.target.value, latex: draft[key].latex === draft[key].name ? event.target.value : draft[key].latex } })} />
            <input className="scale-definition-latex" aria-label={`Scale ${index + 1} LaTeX`} value={draft[key].latex} onChange={(event) => setDraft({ ...draft, [key]: { ...draft[key], latex: event.target.value } })} />
            <div className="scale-definition-preview"><InlineMath math={draft[key].latex} /></div>
          </div>)}
        </fieldset>
        <div className="scale-definition-legend" aria-label="Scale notation guide">
          <span><span className="scale-legend-example is-current"><InlineMath math={draft.cell.latex} /></span>Current unit</span>
          <span><span className="scale-legend-example is-other"><InlineMath math={`${draft.cell.latex}_i`} /></span>Other unit · any subscript</span>
        </div>
        {error ? <p className="scale-definition-error" role="alert">{error}</p> : null}
        <footer><span>Updates formulas and table units throughout the library.</span><div className="scale-definition-actions"><button type="button" className="secondary-action tiny" disabled={busy} onClick={() => setOpen(false)}>Cancel</button><button type="button" className="primary-action tiny" aria-label="Apply spatial scales" disabled={busy} onClick={apply}>Apply changes</button></div></footer>
      </section>
    </div>, document.body) : null}
    {busy ? <BusyNotice /> : null}
  </>;
}

function LogicRow({ item, config, onChange, highlighted }: { item: LogicDefinition; config: KpiPoolConfig; onChange: (next: KpiPoolConfig) => void; highlighted: boolean }) {
  const [draft, setDraft] = useState(item);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const latest = useRef(config); latest.current = config;
  useEffect(() => { setDraft(item); }, [item]);
  const apply = async () => {
    const normalized = { ...draft, latex: draft.latex.trim() };
    const validation = notationError([...Object.values(config.spatialScaleDefinitions), ...config.logic.map((entry) => entry.id === item.id ? normalized : entry)]);
    if (validation) { setError(validation); return; }
    setBusy(true); setError('');
    try {
      const next = await rewriteGlobalNotation(config, new Map([[item.latex, normalized.latex]]));
      if (latest.current !== config) throw new Error('The library changed during this update. Apply again to use the latest library.');
      onChange({ ...next, logic: config.logic.map((entry) => entry.id === item.id ? normalized : entry) });
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'The update could not be applied.'); }
    finally { setBusy(false); }
  };
  return <div className={`logic-definition-row ${highlighted ? 'is-source-highlighted' : ''}`} data-library-target={`logic:${item.id}`}>
    <fieldset disabled={busy}>
      <label className="field"><span>Logic LaTeX</span><input aria-label="Logic LaTeX" value={draft.latex} onChange={(event) => setDraft({ ...draft, latex: event.target.value })} /></label>
      <label className="field"><span>Meaning</span><textarea aria-label="Logic meaning" value={draft.explanation} onChange={(event) => setDraft({ ...draft, explanation: event.target.value })} /></label>
      <InlineMath math={draft.latex} />
      <div className="library-final-actions"><button type="button" className="primary-action tiny" onClick={apply}>Apply logic</button><button type="button" className="secondary-action tiny" onClick={() => { setDraft(item); setError(''); }}>Reset</button><button type="button" className="secondary-action tiny" onClick={() => onChange({ ...config, logic: config.logic.filter((entry) => entry.id !== item.id) })}>Delete logic</button></div>
    </fieldset>
    {error ? <p role="alert">{error}</p> : null}
    {busy ? <BusyNotice /> : null}
  </div>;
}

export function LogicLibrary({ config, onChange, highlightedId }: { config: KpiPoolConfig; onChange: (next: KpiPoolConfig) => void; highlightedId?: string }) {
  return <section className="logic-library" aria-label="Logic">
    <h3>Logic</h3><p>Define reusable notation and its meaning. Logic is highlighted in every formula automatically. Apply a changed expression to update all references. Deleting a definition retains written formulas.</p>
    {config.logic.map((item) => <LogicRow key={item.id} item={item} config={config} onChange={onChange} highlighted={item.id === highlightedId} />)}
    <button type="button" className="secondary-action tiny" onClick={() => {
      let latex = '\\max'; let suffix = 1;
      while ([...config.logic, ...Object.values(config.spatialScaleDefinitions)].some((entry) => entry.latex === latex)) latex = `\\operatorname{logic${suffix++}}`;
      onChange({ ...config, logic: [...config.logic, { id: crypto.randomUUID(), latex, explanation: '' }] });
    }}>Add logic</button>
  </section>;
}
