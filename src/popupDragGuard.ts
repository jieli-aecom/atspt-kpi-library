/** Consume drag-generated clicks even when the browser targets an ancestor of a portal. */
export function installPopupDragGuard(
  document: Document,
  isInside: (target: EventTarget | null) => boolean
) {
  let gesture: { pointerId: number; x: number; y: number; dragged: boolean } | undefined;
  const trackMovement = (event: PointerEvent) => {
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    if (Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) >= 4) {
      gesture.dragged = true;
    }
  };
  const pointerDown = (event: PointerEvent) => {
    // A fresh press also clears a completed gesture for which no click was emitted.
    gesture = event.button === 0 && isInside(event.target)
      ? { pointerId: event.pointerId, x: event.clientX, y: event.clientY, dragged: false }
      : undefined;
  };
  const pointerUp = (event: PointerEvent) => {
    trackMovement(event);
    if (gesture?.pointerId === event.pointerId && !isInside(event.target)) {
      gesture.dragged = true;
    }
  };
  const pointerCancel = (event: PointerEvent) => {
    if (gesture?.pointerId === event.pointerId) gesture = undefined;
  };
  const click = (event: MouseEvent) => {
    // Keyboard activation must still work, including after a drag emitted no click.
    if (event.detail === 0) return;
    if ('pointerId' in event && gesture && event.pointerId !== gesture.pointerId) return;
    const suppress = gesture?.dragged;
    gesture = undefined;
    if (!suppress) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  };
  document.addEventListener('pointerdown', pointerDown, { capture: true });
  document.addEventListener('pointermove', trackMovement, { capture: true });
  document.addEventListener('pointerup', pointerUp, { capture: true });
  document.addEventListener('pointercancel', pointerCancel, { capture: true });
  document.addEventListener('click', click, { capture: true });
  return () => {
    document.removeEventListener('pointerdown', pointerDown, { capture: true });
    document.removeEventListener('pointermove', trackMovement, { capture: true });
    document.removeEventListener('pointerup', pointerUp, { capture: true });
    document.removeEventListener('pointercancel', pointerCancel, { capture: true });
    document.removeEventListener('click', click, { capture: true });
  };
}
