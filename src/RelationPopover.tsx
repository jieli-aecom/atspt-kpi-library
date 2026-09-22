import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/** Escape the library scroller and keep the whole relationship editor in the viewport. */
export function RelationPopover({ children, className, label }: { children: ReactNode; className: string; label: string }) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number; width: number }>();
  useLayoutEffect(() => {
    const anchor = anchorRef.current?.parentElement;
    const popup = popupRef.current;
    if (!anchor || !popup) return;
    const update = () => {
      const margin = 12;
      const gap = 6;
      const width = Math.min(360, window.innerWidth - margin * 2);
      const rect = anchor.getBoundingClientRect();
      const height = Math.min(popup.getBoundingClientRect().height, window.innerHeight - margin * 2);
      const left = Math.max(margin, Math.min(rect.right - width, window.innerWidth - width - margin));
      const preferredTop = rect.bottom + gap + height <= window.innerHeight - margin
        ? rect.bottom + gap : rect.top - height - gap;
      const top = Math.max(margin, Math.min(preferredTop, window.innerHeight - height - margin));
      setPosition((current) => current?.top === top && current.left === left && current.width === width ? current : { top, left, width });
    };
    const onScroll = (event: Event) => {
      if (event.target instanceof Node && popup.contains(event.target)) return;
      update();
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(popup);
    observer.observe(anchor);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, []);
  return <>
    <span ref={anchorRef} hidden />
    {createPortal(<div ref={popupRef} className={`popup-surface field-relation-popover ${className}`} role="dialog" aria-label={label}
      style={{ ...position, right: 'auto', bottom: 'auto', visibility: position ? 'visible' : 'hidden' }}>
      {children}
    </div>, document.body)}
  </>;
}
