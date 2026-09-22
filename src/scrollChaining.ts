/** Consume vertical wheel movement in a cell, then pass the remainder up immediately. */
export function installVerticalScrollChaining(element: HTMLElement) {
  const document = element.ownerDocument;
  const view = document.defaultView;
  if (!view) return () => {};

  const onWheel = (event: WheelEvent) => {
    // Keep zoom and horizontal gestures native, including Shift + wheel.
    if (event.defaultPrevented || !event.cancelable || event.ctrlKey || event.shiftKey ||
        !event.deltaY || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;

    const style = view.getComputedStyle(element);
    const unit = event.deltaMode === 1
      ? Number.parseFloat(style.lineHeight) || Number.parseFloat(style.fontSize) * 1.2 || 16
      : event.deltaMode === 2 ? element.clientHeight : 1;
    let remaining = event.deltaY * unit;

    // A non-passive native listener avoids browser scroll latching at cell edges.
    // Consume the leftover delta in the same event, not on a later mouse movement.
    event.preventDefault();
    for (let current: HTMLElement | null = element; current && remaining; current = current.parentElement) {
      const scrollable = current === element || current === document.scrollingElement ||
        /^(auto|scroll|overlay)$/.test(view.getComputedStyle(current).overflowY);
      if (!scrollable || current.scrollHeight <= current.clientHeight) continue;
      const before = current.scrollTop;
      current.scrollBy({ top: remaining, behavior: 'instant' });
      const unconsumed = remaining - (current.scrollTop - before);
      // Browser zoom can round scroll offsets; never reverse the parent's direction.
      remaining = remaining > 0 ? Math.max(0, unconsumed) : Math.min(0, unconsumed);
    }
  };

  element.addEventListener('wheel', onWheel, { passive: false });
  return () => element.removeEventListener('wheel', onWheel);
}
