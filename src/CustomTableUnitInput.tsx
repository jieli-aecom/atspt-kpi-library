import { useEffect, useRef, useState } from 'react';
import { renameCustomTableUnit } from './customTableUnit';
import type { DataSource, KpiPoolConfig } from './types';

/** Keep work alive when a table editor closes after committing on blur. */
export function useCustomTableUnitRename(config: KpiPoolConfig, onChange: (next: KpiPoolConfig) => void) {
  const latest = useRef({ config, onChange });
  latest.current = { config, onChange };
  const pending = useRef(new Map<string, string>());
  const running = useRef(false);
  const mounted = useRef(true);
  const [busyIds, setBusyIds] = useState<string[]>([]);
  const [error, setError] = useState('');
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const rename = async (sourceId: string, name: string) => {
    pending.current.set(sourceId, name);
    setBusyIds([...pending.current.keys()]);
    if (running.current) return;
    running.current = true;
    setError('');
    const stale = Symbol('stale');
    try {
      while (mounted.current && pending.current.size) {
        const [id, nextName] = pending.current.entries().next().value!;
        const snapshot = latest.current.config;
        try {
          const next = await renameCustomTableUnit(snapshot, id, nextName, async () => {
            await new Promise<void>((resolve) => setTimeout(resolve, 0));
            if (!mounted.current || snapshot !== latest.current.config) throw stale;
          });
          if (!mounted.current) return;
          // Restart against concurrent edits instead of publishing an old snapshot.
          if (snapshot !== latest.current.config) continue;
          if (next !== snapshot) {
            latest.current = { ...latest.current, config: next };
            latest.current.onChange(next);
          }
          pending.current.delete(id);
          setBusyIds([...pending.current.keys()]);
          // Allow the committed config to render before processing another table.
          await new Promise<void>((resolve) => setTimeout(resolve, 0));
        } catch (failure) {
          if (failure === stale) continue;
          throw failure;
        }
      }
    } catch (failure) {
      if (mounted.current) setError(failure instanceof Error ? failure.message : 'Unable to update unit references.');
    } finally {
      running.current = false;
      pending.current.clear();
      if (mounted.current) setBusyIds([]);
    }
  };
  return { rename, busyIds, error };
}

export function CustomTableUnitInput({ source, onRename, busy, className }: {
  source: DataSource;
  onRename: (sourceId: string, name: string) => void;
  busy: boolean;
  className?: string;
}) {
  const [draft, setDraft] = useState(source.customUnit ?? '');
  useEffect(() => { setDraft(source.customUnit ?? ''); }, [source.id, source.customUnit]);
  const apply = () => {
    const name = draft.trim();
    if (!busy && name !== (source.customUnit ?? '')) onRename(source.id, name);
  };
  return <>
    <input className={className} aria-label="Custom table unit" placeholder="Specify unit" value={draft}
      disabled={busy} aria-busy={busy} title="Renames formula subscripts when you finish editing"
      onChange={(event) => setDraft(event.target.value)} onBlur={apply}
      onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); apply(); } }} />
    {busy ? <small role="status">Updating formula subscripts…</small> : null}
  </>;
}
